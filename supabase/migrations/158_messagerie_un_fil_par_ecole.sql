-- =====================================================================
--  158 — Messagerie : un fil par personne et par école, non par fiche
--
--  Constaté à l'audit de l'espace parent, avec de vraies sessions :
--
--    Idrissa KANE  : 4 fiches tuteur, 4 enfants dans la MÊME école
--                    → 4 boutons tous intitulés « Tut'Tank », indiscernables
--    Tahirou SEYE  : 3 fiches pour 1 enfant
--                    → 3 onglets, dont deux pour des écoles où il n'a
--                      aucun enfant (fiches orphelines)
--
--  Et le miroir existait côté école : `ecole_conversations()` listant les
--  fiches, Idrissa y apparaissait QUATRE FOIS sous le même nom.
--
--  ⚠️ CE N'EST PAS UN DÉFAUT D'AFFICHAGE, C'EST UN DÉFAUT DE CLÉ.
--  Le fil était identifié par la fiche tuteur. Or une fiche est créée par
--  élève ET par responsable — c'est le principe même des codes d'accès
--  (5 élèves × 2 parents = 10 codes). Une personne a donc plusieurs fiches
--  dans une même école, et ses échanges se répartissaient entre elles :
--  l'école répondait dans un fil, le parent regardait dans un autre.
--
--  La bonne clé de conversation est la PERSONNE dans une ÉCOLE, soit
--  (tuteurs.profil_id, tuteurs.ecole_id). C'est ce que les deux côtés
--  utilisent désormais.
--
--  ⚠️ AUCUNE DONNÉE N'EST DÉPLACÉE. Les messages restent attachés à leur
--  fiche : on change la façon de les REGROUPER, pas de les stocker. Un
--  déplacement serait irréversible et inutile — la lecture agrège, et
--  l'écriture se fait sur une fiche canonique (la plus ancienne de l'école),
--  choix déterministe pour que deux envois successifs ne se dispersent pas.
--  Vérifié avant écriture : 4 messages de parents en base, aucun orphelin
--  possible.
--
--  ⚠️ LES NOMS DE PARAMÈTRES CHANGENT (`p_tuteur` → `p_ecole`). PostgREST
--  résout les RPC PAR NOM : l'ancien appel répondra 404 PGRST202, pas 403.
--  Le front est modifié dans le même lot, et les anciennes signatures sont
--  supprimées pour ne pas laisser deux surcharges ambiguës.
--
--  Le volet ÉTUDIANT (mig. 139) n'est pas touché : sa clé est `eleve_id`,
--  un étudiant majeur n'a qu'un fil et le problème ne s'y pose pas.
--
--  Prérequis : migrations 014, 046, 133, 139.
-- =====================================================================

-- =====================================================================
--  1. CÔTÉ PARENT
-- =====================================================================
--  Un fil par école. `tuteur_id` disparaît du retour : le laisser aurait
--  invité le front à continuer de raisonner par fiche.
drop function if exists public.mes_conversations();
create or replace function public.mes_conversations()
returns table(ecole_id uuid, ecole text, logo text,
              dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $$
  select ec.id, ec.nom, ec.logo_url,
    (select m.contenu    from messages m join tuteurs t2 on t2.id = m.tuteur_id
      where t2.profil_id = auth.uid() and t2.ecole_id = ec.id
      order by m.created_at desc limit 1),
    (select m.created_at from messages m join tuteurs t2 on t2.id = m.tuteur_id
      where t2.profil_id = auth.uid() and t2.ecole_id = ec.id
      order by m.created_at desc limit 1),
    (select count(*)     from messages m join tuteurs t2 on t2.id = m.tuteur_id
      where t2.profil_id = auth.uid() and t2.ecole_id = ec.id
        and m.expediteur = 'ecole' and m.lu = false)
  from ecoles ec
  where exists (select 1 from tuteurs t
                 where t.profil_id = auth.uid() and t.ecole_id = ec.id)
  order by ec.nom;
$$;
revoke execute on function public.mes_conversations() from public, anon;
grant execute on function public.mes_conversations() to authenticated;

--  Le fil d'une école : TOUS les messages de TOUTES les fiches du parent
--  dans cette école. C'est ici que l'éclatement se répare, sans rien bouger.
--  `create or replace` refuse de renommer un paramètre → drop d'abord.
drop function if exists public.conversation_messages(uuid);
create or replace function public.conversation_messages(p_ecole uuid)
returns table(id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_ecole is null or not exists (
    select 1 from tuteurs t where t.ecole_id = p_ecole and t.profil_id = auth.uid()
  ) then
    raise exception 'Accès refusé.';
  end if;

  update messages m set lu = true
   where m.expediteur = 'ecole' and m.lu = false
     and m.tuteur_id in (select t.id from tuteurs t
                          where t.ecole_id = p_ecole and t.profil_id = auth.uid());

  return query
    select m.id, m.expediteur, m.contenu, m.created_at
      from messages m
     where m.tuteur_id in (select t.id from tuteurs t
                            where t.ecole_id = p_ecole and t.profil_id = auth.uid())
     order by m.created_at;
end $$;
revoke execute on function public.conversation_messages(uuid) from public, anon;
grant execute on function public.conversation_messages(uuid) to authenticated;

drop function if exists public.parent_envoyer(uuid, text);
create or replace function public.parent_envoyer(p_ecole uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_fiche uuid;
begin
  --  Fiche canonique : la plus ancienne du parent dans cette école. Un choix
  --  arbitraire mais STABLE — sans cela, deux envois pourraient repartir dans
  --  deux fiches et reconstituer l'éclatement qu'on corrige.
  select t.id into v_fiche
    from tuteurs t
   where t.ecole_id = p_ecole and t.profil_id = auth.uid()
   order by t.created_at, t.id
   limit 1;
  if v_fiche is null then
    raise exception 'Accès refusé.';
  end if;
  if coalesce(trim(p_contenu), '') = '' then return; end if;

  insert into messages (ecole_id, tuteur_id, expediteur, contenu, auteur_id)
  values (p_ecole, v_fiche, 'parent', p_contenu, auth.uid());
end $$;
revoke execute on function public.parent_envoyer(uuid, text) from public, anon;
grant execute on function public.parent_envoyer(uuid, text) to authenticated;

-- =====================================================================
--  2. CÔTÉ ÉCOLE
-- =====================================================================
--  Une ligne par PERSONNE, et non par fiche. On nomme aussi les enfants
--  concernés : le secrétariat parlait à « Idrissa KANE » quatre fois sans
--  savoir de quel enfant il s'agissait.
drop function if exists public.ecole_conversations();
create or replace function public.ecole_conversations()
returns table(parent_id uuid, parent text, telephone text, enfants text,
              dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $$
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
     -- Mêmes rôles que la policy `messages_gestion` (mig. 133) et que le
     -- correctif de sécurité de la mig. 139.
     and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire'))
   group by p.id
   order by 6 desc nulls last;
$$;
revoke execute on function public.ecole_conversations() from public, anon;
grant execute on function public.ecole_conversations() to authenticated;

--  Le front lisait `messages` directement, filtré sur une fiche. Regrouper
--  par personne demanderait au client de connaître la liste des fiches —
--  exactement ce qu'on ne doit pas lui faire calculer. D'où deux RPC.
create or replace function public.ecole_fil_parent(p_parent uuid)
returns table(id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_parent is null or not (est_admin() or a_role('direction')
       or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Accès refusé.';
  end if;
  if not exists (select 1 from tuteurs t
                  where t.profil_id = p_parent and t.ecole_id = ecole_courante()) then
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
end $$;
revoke execute on function public.ecole_fil_parent(uuid) from public, anon;
grant execute on function public.ecole_fil_parent(uuid) to authenticated;

create or replace function public.ecole_envoyer_parent(p_parent uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_fiche uuid; v_ecole uuid := ecole_courante();
begin
  if p_parent is null or not (est_admin() or a_role('direction')
       or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Accès refusé.';
  end if;
  --  Même fiche canonique que côté parent : les deux versants écrivent au
  --  même endroit, sinon le fil se rescinderait par le bas.
  select t.id into v_fiche
    from tuteurs t
   where t.profil_id = p_parent and t.ecole_id = v_ecole
   order by t.created_at, t.id
   limit 1;
  if v_fiche is null then
    raise exception 'Ce parent n''appartient pas à votre établissement.';
  end if;
  if coalesce(trim(p_contenu), '') = '' then return; end if;

  insert into messages (ecole_id, tuteur_id, expediteur, contenu, auteur_id)
  values (v_ecole, v_fiche, 'ecole', p_contenu, auth.uid());
end $$;
revoke execute on function public.ecole_envoyer_parent(uuid, text) from public, anon;
grant execute on function public.ecole_envoyer_parent(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • Idrissa KANE : `mes_conversations()` renvoie UNE ligne (Tut'Tank),
--     plus quatre ; son fil contient les messages de ses quatre fiches ;
--   • Tahirou SEYE : ses écoles apparaissent une fois chacune — les fiches
--     orphelines ne créent plus d'onglet propre, mais restent visibles si
--     elles portent des messages (on ne cache aucun échange existant) ;
--   • côté école : Idrissa apparaît UNE fois, avec ses quatre enfants nommés ;
--   • un parent qui écrit, puis l'école qui répond, atterrissent dans la
--     MÊME fiche canonique — le fil ne se rescinde pas ;
--   • un enseignant appelant `ecole_conversations()` ou `ecole_fil_parent()`
--     est refusé (rôles de la mig. 133/139) ;
--   • un parent appelant `conversation_messages()` sur une école où il n'a
--     aucune fiche est refusé.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.ecole_envoyer_parent(uuid, text);
-- drop function if exists public.ecole_fil_parent(uuid);
-- drop function if exists public.ecole_conversations();
-- drop function if exists public.parent_envoyer(uuid, text);
-- drop function if exists public.conversation_messages(uuid);
-- drop function if exists public.mes_conversations();
-- (puis réappliquer mes_conversations / parent_envoyer de la mig. 014,
--  conversation_messages de la 046, ecole_conversations de la 139.)
