-- =====================================================================
--  196 — Les RPC de communication que la migration 194 avait manquées
--
--  🔴 POURQUOI ELLES ONT ÉTÉ MANQUÉES. La migration 194 a basculé les TABLES
--  `annonces` et `messages`, et je me suis arrêté là. Or la messagerie école ↔
--  familles ne passe PAS par la table : elle passe par cinq fonctions
--  `security definer`, qui **contournent la RLS par construction**. Les
--  policies de la 194 ne les gouvernent donc pas du tout. Décocher la case
--  « Messagerie » masquait l'écran mais laissait les quatre RPC servir : un
--  appel REST direct listait les conversations, lisait un fil complet et
--  envoyait un message au nom de l'établissement.
--
--  C'est le défaut que le plan nomme « ⚠️ Ne pas garder les deux », vu par
--  l'autre bout : ici ce n'était pas la policy qui gardait le rôle, c'était
--  une couche entière que je n'avais pas regardée. Trouvé en balayant
--  `pg_proc` au lieu de deviner domaine par domaine.
--
--  ⚠️ CES FONCTIONS SONT RÉÉCRITES EN ENTIER, pas corrigées par substitution.
--  Leurs gardes s'étalent sur DEUX lignes :
--      if p_parent is null or not (est_admin() or a_role('direction')
--           or a_role('comptable') or a_role('secretaire')) then
--  et un ancre de substitution multi-ligne ne peut pas correspondre : les
--  définitions stockées portent des fins de ligne mélangées (CRLF le plus
--  souvent, LF parfois). Les réécrire en entier est aussi plus honnête — le
--  lecteur de cette migration voit ce que la fonction fait, au lieu d'un
--  `replace()` opaque.
--
--  ⚠️ `_annonce_visible_par` N'EST PAS TOUCHÉE, et c'est délibéré. Vérifié :
--  elle est appelée par la policy `fichiers_ecole_select`, c'est-à-dire
--  qu'elle décide **qui peut ouvrir la pièce jointe d'une annonce**. Sa liste
--  de rôles (direction, comptable, secrétariat, **enseignant**) est un test de
--  DESTINATAIRE, pas une permission de gestion : un enseignant doit pouvoir
--  ouvrir le PDF joint à une annonce de l'école. La remplacer par
--  `a_acces('annonces')` — qui ne couvre pas les enseignants — rendrait ces
--  pièces jointes illisibles pour eux, en silence. Même discipline qui a
--  sauvé `eleves_select` à la migration 186 et la lecture de `sous_niveaux`
--  à la 193 : avant de resserrer, regarder qui lit.
-- =====================================================================

-- --- 1. La liste des conversations avec les familles ------------------
--
--  ⚠️ LA GARDE EST ÉCRITE EN `where`, DONC ELLE NE LÈVE RIEN : elle rend une
--  liste vide. Je la laisse sous cette forme — l'écran est déjà fermé par la
--  case, et transformer un résultat vide en exception changerait le
--  comportement d'un écran que rien n'oblige à changer.
create or replace function public.ecole_conversations()
returns table(parent_id uuid, parent text, telephone text, enfants text,
              dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $fn$
  select p.id,
         coalesce(max(t.prenom || ' ' || t.nom), ''),
         max(t.telephone),
         (select string_agg(distinct e.prenom || ' ' || e.nom, ', ' order by e.prenom || ' ' || e.nom)
            from tuteurs t3
            join eleve_tuteurs et on et.tuteur_id = t3.id
            join eleves e on e.id = et.eleve_id
           where t3.profil_id = p.id and t3.ecole_id = ecole_courante()),
         (select m.contenu    from messages m join tuteurs t2 on t2.id = m.tuteur_id
           where t2.profil_id = p.id and t2.ecole_id = ecole_courante()
           order by m.created_at desc limit 1),
         (select m.created_at from messages m join tuteurs t2 on t2.id = m.tuteur_id
           where t2.profil_id = p.id and t2.ecole_id = ecole_courante()
           order by m.created_at desc limit 1),
         (select count(*)     from messages m join tuteurs t2 on t2.id = m.tuteur_id
           where t2.profil_id = p.id and t2.ecole_id = ecole_courante()
             and m.expediteur = 'parent' and m.lu = false)
    from tuteurs t
    join profils p on p.id = t.profil_id
   where t.ecole_id = ecole_courante()
     and t.profil_id is not null
     --  La case de l'écran Messagerie, là où la mig. 133 posait quatre rôles.
     and a_acces('messagerie')
     --  ⚠️ ET LE PÉRIMÈTRE PAR CYCLE, structurellement absent de cette
     --  fonction : `security definer` contourne la RLS, donc la conjonction
     --  que la 194 a posée sur `messages` ne la gouverne pas. Sans ces
     --  quatre lignes, une responsable cloisonnée lit la liste des
     --  conversations de TOUTES les familles de l'école. Un parent est dans
     --  le périmètre si l'un de ses enfants y est. La porte de sortie
     --  `is null` garde la fonction inerte pour les non-cloisonnés.
     and (classes_autorisees() is null
          or exists (select 1 from tuteurs t4
                      join eleve_tuteurs et4 on et4.tuteur_id = t4.id
                     where t4.profil_id = p.id and t4.ecole_id = ecole_courante()
                       and peut_voir_eleve(et4.eleve_id)))
   group by p.id
   order by 6 desc nulls last;
$fn$;

-- --- 2. La même liste, côté étudiants ---------------------------------
create or replace function public.ecole_conversations_etudiants()
returns table(eleve_id uuid, etudiant text, matricule text,
              dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $fn$
  select e.id, e.prenom || ' ' || e.nom, e.matricule,
    (select m.contenu    from messages m where m.eleve_id = e.id order by m.created_at desc limit 1),
    (select m.created_at from messages m where m.eleve_id = e.id order by m.created_at desc limit 1),
    (select count(*)     from messages m where m.eleve_id = e.id
                          and m.expediteur = 'etudiant' and m.lu = false)
    from eleves e
   where e.ecole_id = ecole_courante()
     and a_acces('messagerie')
     --  ⚠️ Même raison qu'au-dessus. Ici la clé d'élève est directe.
     and peut_voir_eleve(e.id)
     and exists (select 1 from messages m where m.eleve_id = e.id)
   order by 5 desc nulls last;
$fn$;

-- --- 3. Lire le fil d'un parent (et marquer ses messages lus) ---------
--
--  Celle-ci LÈVE, elle : c'est une action, pas une liste.
create or replace function public.ecole_fil_parent(p_parent uuid)
returns table(id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
begin
  if p_parent is null or not a_acces('messagerie') then
    raise exception 'Accès refusé.';
  end if;
  --  ⚠️ CE CONTRÔLE PORTE MAINTENANT LE PÉRIMÈTRE, parce que c'est le seul
  --  endroit où il peut être écrit : la fonction est `security definer`, donc
  --  elle contourne la policy `messages_acces` de la 194. Sans lui, une
  --  responsable cloisonnée ouvre le fil complet d'un parent de l'autre cycle
  --  en passant l'identifiant — et le marque lu au passage.
  if not exists (select 1 from tuteurs t
                  where t.profil_id = p_parent and t.ecole_id = ecole_courante()
                    and (classes_autorisees() is null
                         or exists (select 1 from eleve_tuteurs et
                                     where et.tuteur_id = t.id
                                       and peut_voir_eleve(et.eleve_id)))) then
    raise exception 'Ce parent n''appartient pas à votre établissement.';
  end if;

  update messages m set lu = true
   where m.expediteur = 'parent' and m.lu = false
     and m.tuteur_id in (select t.id from tuteurs t
                          where t.profil_id = p_parent and t.ecole_id = ecole_courante());

  return query
    select m.id, m.expediteur, m.contenu, m.created_at
      from messages m
     where m.tuteur_id in (select t.id from tuteurs t
                            where t.profil_id = p_parent and t.ecole_id = ecole_courante())
     order by m.created_at;
end $fn$;

-- --- 4. Envoyer un message à un parent au nom de l'établissement ------
create or replace function public.ecole_envoyer_parent(p_parent uuid, p_contenu text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_fiche uuid; v_ecole uuid := ecole_courante();
begin
  if p_parent is null or not a_acces('messagerie') then
    raise exception 'Accès refusé.';
  end if;
  --  Même fiche canonique que côté parent : les deux versants écrivent au
  --  même endroit, sinon le fil se rescinderait par le bas.
  --  ⚠️ Le périmètre s'écrit dans la sélection de la fiche : si aucune fiche
  --  du périmètre ne correspond, `v_fiche` reste nul et la fonction lève.
  select t.id into v_fiche
    from tuteurs t
   where t.profil_id = p_parent and t.ecole_id = v_ecole
     and (classes_autorisees() is null
          or exists (select 1 from eleve_tuteurs et
                      where et.tuteur_id = t.id
                        and peut_voir_eleve(et.eleve_id)))
   order by t.created_at, t.id
   limit 1;
  if v_fiche is null then
    raise exception 'Ce parent n''appartient pas à votre établissement.';
  end if;
  if coalesce(trim(p_contenu), '') = '' then return; end if;

  insert into messages (ecole_id, tuteur_id, expediteur, contenu, auteur_id)
  values (v_ecole, v_fiche, 'ecole', p_contenu, auth.uid());
end $fn$;

-- --- 5. Notifier TOUTES les familles de l'établissement ---------------
--
--  Celle-ci relève de la case `annonces`, pas de `messagerie` : elle écrit une
--  notification à chaque famille de l'école. Sa garde actuelle
--  (`est_admin() or direction or comptable or secretaire`) est exactement
--  `ACCES.annonces` — traduction 1 pour 1, aucun droit déplacé.
--
--  ⚠️ LA BRANCHE `auth.uid() is null` EST CONSERVÉE : c'est l'appel système
--  (cron, clé de service), qui n'a pas de session à contrôler. La retirer
--  casserait les relances automatiques de 07h00.
create or replace function public._notifier_parents_ecole(
  p_ecole uuid, p_titre text, p_msg text, p_categorie text default null)
returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_n integer;
begin
  if auth.uid() is not null
     and not (est_super_admin() or (p_ecole = ecole_courante() and a_acces('annonces'))) then
    raise exception 'Réservé à l''administration de l''établissement.';
  end if;

  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  select distinct p_ecole, t.profil_id, p_titre, p_msg, null::uuid, p_categorie
    from tuteurs t
   where t.ecole_id = p_ecole
     and t.profil_id is not null
     and exists (select 1 from eleve_tuteurs et where et.tuteur_id = t.id);
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

-- --- Les droits d'exécution -------------------------------------------
--
--  ⚠️ `EXECUTE` EST ACCORDÉ À PUBLIC PAR DÉFAUT, et `anon` HÉRITE de public :
--  sans ces `revoke`, un appel non authentifié atteindrait la fonction. Un
--  `create or replace` conserve l'ACL existante, mais on la réaffirme — c'est
--  deux lignes, et l'oubli coûterait cher.
revoke execute on function public.ecole_conversations() from public, anon;
revoke execute on function public.ecole_conversations_etudiants() from public, anon;
revoke execute on function public.ecole_fil_parent(uuid) from public, anon;
revoke execute on function public.ecole_envoyer_parent(uuid, text) from public, anon;
revoke execute on function public._notifier_parents_ecole(uuid, text, text, text)
  from public, anon;
grant execute on function public.ecole_conversations() to authenticated;
grant execute on function public.ecole_conversations_etudiants() to authenticated;
grant execute on function public.ecole_fil_parent(uuid) to authenticated;
grant execute on function public.ecole_envoyer_parent(uuid, text) to authenticated;
grant execute on function public._notifier_parents_ecole(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  Remplacer dans les cinq corps ci-dessus :
--    a_acces('messagerie')  ->  est_admin() or a_role('direction')
--                               or a_role('comptable') or a_role('secretaire')
--    a_acces('annonces')    ->  est_admin() or a_role('direction')
--                               or a_role('comptable') or a_role('secretaire')
--  ⚠️ Annuler redonne la messagerie école ↔ familles à ces quatre rôles
--  indépendamment des cases cochées : décocher « Messagerie » masquerait
--  l'écran sans fermer les RPC.
-- notify pgrst, 'reload schema';
