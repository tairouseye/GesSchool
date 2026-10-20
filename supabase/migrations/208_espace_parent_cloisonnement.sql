-- =====================================================================
--  208 — Espace parent : fermer les derniers accès non cloisonnés
--
--  Audit de l'espace parent (20/10/2026). Toutes les RPC parent vérifiées
--  passent par `_parent_possede` — sauf celles-ci :
--
--  🔴 1. `mon_acces_notes(p_eleve)` (mig. 114) ne vérifiait PAS que l'élève
--     est un enfant de l'appelant, et restait exécutable par `anon` (aucun
--     `revoke`). Avec n'importe quel identifiant d'élève, elle répondait si
--     cet élève est inscrit dans le SUPÉRIEUR. Le statut de consentement,
--     lui, est filtré sur `auth.uid()` : pas de fuite de ce côté. Elle refuse
--     désormais tout élève qui n'est pas le sien, comme les autres RPC.
--
--  🔴 2. `_acces_notes_autorise` est SECURITY DEFINER et n'avait aucun
--     `revoke` : appelable directement par n'importe qui, avec le même effet
--     de sonde. Elle n'est utilisée QUE par des fonctions SECURITY DEFINER
--     (114, 163, 166, 172 — vérifié), qui l'exécutent avec les droits de
--     leur propriétaire : retirer l'exécution aux rôles clients ne les
--     touche pas.
--
--  🟠 3. La preuve de paiement « obligatoire » (mig. 198, 202) n'était
--     contrôlée que par `trim(p_preuve) <> ''`. N'importe quelle chaîne
--     passait, y compris le chemin d'une preuve rangée dans le dossier d'un
--     AUTRE élève. On exige maintenant que le chemin soit dans le dossier de
--     l'élève concerné — la même règle que la policy `preuves_insert`
--     (`_preuve_eleve`, fail-closed). L'EXISTENCE du fichier n'est pas
--     vérifiée ici : aucune fonction du projet ne lit encore `storage.objects`
--     et ce privilège n'a pas été vérifié en base. À ajouter après essai en
--     recette si on le souhaite.
--
--  🟠 4. `enfant_bulletin_lignes` ne filtrait pas `statut = 'publie'`, alors
--     que `enfant_bulletins` le fait depuis la 166. Un parent qui connaîtrait
--     l'identifiant d'un bulletin en relecture de SON enfant en lisait les
--     lignes. Défense en profondeur : même message que « introuvable ».
--
--  🟠 5. Exactitude (pas de sécurité) :
--     • `enfant_notes` renvoyait les notes des évaluations ARCHIVÉES (mig.
--       160), que le calcul officiel des bulletins exclut. Une évaluation
--       archivée est, par décision de l'école, hors moyenne : la montrer au
--       parent dans une moyenne la contredisait.
--     • `enfant_bulletins` n'indiquait pas le BARÈME de l'école : l'écran
--       parent affichait « /20 » en dur, faux pour une école notée sur 10.
--       On ajoute la colonne `bareme` (paramètre `notation`, défaut 20).
--     • `mes_demandes` ne renvoyait pas l'identifiant de l'élève : la
--       rubrique « Documents » d'un enfant listait et comptait les demandes
--       de toute la fratrie. On ajoute `eleve_id` (en DERNIÈRE colonne).
--
--  Hygiène : `revoke ... from public, anon` sur les RPC parent qui ne
--  l'avaient jamais eu (elles refusaient déjà un appel sans session, via
--  `auth.uid()` NULL — c'est un second verrou, pas une correction de fuite).
--
--  ⚠️ NON DESTRUCTIF : aucune table, aucune donnée, aucune policy RLS n'est
--  modifiée. Les signatures qui changent de type de retour
--  (`enfant_bulletins`, `mes_demandes`) sont détruites puis recréées à
--  l'identique + une colonne en fin de liste : les appels existants
--  continuent de fonctionner.
--
--  Prérequis : 004, 028, 114, 160, 166, 198, 202.
--  ESSAI : supabase/tests/essai_208_parent.sql (sur une base de recette).
-- =====================================================================


-- --- 1. mon_acces_notes : l'appelant doit être parent de l'élève --------
create or replace function public.mon_acces_notes(p_eleve uuid)
returns table(requiert boolean, statut text)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Non authentifié.'; end if;
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select
      coalesce((select e.type_etablissement from eleves el join ecoles e on e.id = el.ecole_id
                 where el.id = p_eleve), 'ecole') = 'superieur',
      (select a.statut from acces_parent_etudiant a
        where a.eleve_id = p_eleve and a.parent_profil_id = auth.uid());
end $fn$;
revoke execute on function public.mon_acces_notes(uuid) from public, anon;
grant execute on function public.mon_acces_notes(uuid) to authenticated;


-- --- 2. _acces_notes_autorise : interne, plus appelable directement -----
revoke execute on function public._acces_notes_autorise(uuid) from public, anon, authenticated;


-- --- 3. Preuve de paiement : dans le dossier de l'élève concerné --------
--  Interne. `_preuve_eleve` (mig. 072) rend NULL pour un chemin non conforme :
--  la comparaison échoue alors, et la déclaration est refusée.
create or replace function public._preuve_de_eleve(p_preuve text, p_eleve uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(trim(p_preuve), '') <> ''
     and p_eleve is not null
     and public._preuve_eleve(p_preuve) is not distinct from p_eleve
     and public._preuve_eleve(p_preuve) is not null;
$fn$;
revoke execute on function public._preuve_de_eleve(text, uuid) from public, anon, authenticated;

--  Versant parent : corps de la 198, + le contrôle du dossier de la preuve.
create or replace function public.declarer_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text,
  p_preuve text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_eleve uuid; v_ecole uuid;
begin
  select eleve_id, ecole_id into v_eleve, v_ecole from factures where id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  perform public._verifier_declaration(p_facture, p_montant, p_preuve);
  if not public._preuve_de_eleve(p_preuve, v_eleve) then
    raise exception 'La preuve jointe n''est pas valide : téléversez à nouveau la capture du paiement.';
  end if;

  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin)
  values (v_ecole, p_facture, v_eleve, p_montant, p_mode::mode_paiement, p_reference, p_preuve);
end $fn$;
revoke execute on function public.declarer_paiement(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.declarer_paiement(uuid, numeric, text, text, text) to authenticated;

--  Paiement anticipé (parent OU étudiant) : corps de la 202, + le même
--  contrôle. L'étudiant téléverse dans SON dossier (`<son id>/…`,
--  src/lib/etudiant.js), donc la règle vaut pour les deux.
create or replace function public.declarer_avance(
  p_eleve uuid, p_mois text[], p_mode text, p_reference text, p_preuve text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_lignes jsonb; v_total numeric;
begin
  if not (public._parent_possede(p_eleve) or public._eleve_courant() = p_eleve) then
    raise exception 'Accès refusé.';
  end if;
  if coalesce(trim(p_preuve), '') = '' then
    raise exception 'Joignez la capture ou la photo de votre paiement : sans preuve, l''école ne peut pas le vérifier.';
  end if;
  if not public._preuve_de_eleve(p_preuve, p_eleve) then
    raise exception 'La preuve jointe n''est pas valide : téléversez à nouveau la capture du paiement.';
  end if;

  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  v_lignes := public._lignes_des_mois(p_eleve, p_mois);
  select sum((x->>'montant')::numeric) into v_total from jsonb_array_elements(v_lignes) x;
  if coalesce(v_total, 0) <= 0 then raise exception 'Montant invalide.'; end if;

  insert into declarations_paiement
    (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin, avance_lignes, declare_par)
  values
    (v_ecole, null, p_eleve, v_total, p_mode::mode_paiement, p_reference, p_preuve, v_lignes, auth.uid());
end $fn$;
revoke execute on function public.declarer_avance(uuid, text[], text, text, text) from public, anon;
grant execute on function public.declarer_avance(uuid, text[], text, text, text) to authenticated;


-- --- 4. Lignes de bulletin : seulement d'un bulletin PUBLIÉ -------------
create or replace function public.enfant_bulletin_lignes(p_bulletin uuid)
returns table(matiere text, moyenne numeric, coefficient numeric, appreciation text)
language plpgsql security definer set search_path = public as $fn$
declare v_eleve uuid; v_statut text;
begin
  select eleve_id, statut::text into v_eleve, v_statut from bulletins where id = p_bulletin;
  if v_eleve is null then raise exception 'Bulletin introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  --  Même message qu'un bulletin inexistant : ne pas révéler qu'un bulletin
  --  est en cours de relecture.
  if v_statut is distinct from 'publie' then raise exception 'Bulletin introuvable.'; end if;
  if not public._acces_notes_autorise(v_eleve) then return; end if;
  return query
    select m.libelle, l.moyenne, l.coefficient, l.appreciation
    from bulletin_lignes l join matieres m on m.id = l.matiere_id
    where l.bulletin_id = p_bulletin order by m.libelle;
end $fn$;
revoke execute on function public.enfant_bulletin_lignes(uuid) from public, anon;
grant execute on function public.enfant_bulletin_lignes(uuid) to authenticated;


-- --- 5a. Notes : sans les évaluations archivées -------------------------
create or replace function public.enfant_notes(p_eleve uuid)
returns table(periode text, ordre int, matiere text, type text, valeur numeric, bareme numeric, coefficient numeric, date_eval date)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;
  return query
    select p.libelle, p.ordre, m.libelle, ev.type::text, n.valeur, ev.bareme, ev.coefficient, ev.date_eval
    from notes n
    join evaluations ev on ev.id = n.evaluation_id
    join periodes p on p.id = ev.periode_id
    join matieres m on m.id = ev.matiere_id
    where n.eleve_id = p_eleve and n.absent = false and n.valeur is not null
      --  Mig. 160 : archivée = exclue des moyennes par l'école (calculerBulletins).
      and ev.actif
    order by p.ordre, m.libelle;
end $fn$;
revoke execute on function public.enfant_notes(uuid) from public, anon;
grant execute on function public.enfant_notes(uuid) to authenticated;


-- --- 5b. Bulletins : + le barème de l'école -----------------------------
--  Corps de la 166 À L'IDENTIQUE, + `bareme` en dernière colonne.
--  ⚠️ `drop` obligatoire : on change le `returns table(...)` (42P13).
drop function if exists public.enfant_bulletins(uuid);
create function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text,
  logo text,
  affiche_absences boolean, absences bigint, absences_justifiees bigint,
  bareme numeric
)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;

  update bulletins b set consulte_le = now()
   where b.eleve_id = p_eleve and b.statut = 'publie' and b.consulte_le is null;

  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle,
           ec.logo_url,
           public.bulletin_affiche_absences(b.classe_id),
           ab.absences, ab.justifiees,
           --  Barème d'affichage de l'école (paramètre `notation`, cf.
           --  src/lib/bulletins.js). Valeur non numérique ou absente → 20,
           --  le défaut de l'application ; jamais d'erreur de conversion.
           coalesce((select case when (pa.valeur->>'bareme') ~ '^[0-9]+(\.[0-9]+)?$'
                                 then (pa.valeur->>'bareme')::numeric end
                       from parametres pa
                      where pa.ecole_id = b.ecole_id and pa.cle = 'notation'
                      limit 1), 20)
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    left join lateral public.absences_periode(b.eleve_id, b.periode_id) ab on true
    where b.eleve_id = p_eleve
      and b.statut = 'publie'
    order by p.ordre;
end $fn$;
revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;


-- --- 5c. Demandes de documents : + l'élève concerné ---------------------
drop function if exists public.mes_demandes();
create function public.mes_demandes()
returns table(id uuid, eleve text, type text, message text, statut text, reponse text,
              created_at timestamptz, ecole text, eleve_id uuid)
language sql security definer set search_path = public as $fn$
  select d.id, e.prenom || ' ' || e.nom, d.type, d.message, d.statut, d.reponse, d.created_at, ec.nom,
         d.eleve_id
  from demandes_documents d
  join tuteurs t on t.id = d.tuteur_id
  left join eleves e on e.id = d.eleve_id
  left join ecoles ec on ec.id = d.ecole_id
  where t.profil_id = auth.uid()
  order by d.created_at desc;
$fn$;
revoke execute on function public.mes_demandes() from public, anon;
grant execute on function public.mes_demandes() to authenticated;


-- --- 6. Hygiène : second verrou sur les RPC parent jamais restreintes ----
revoke execute on function public.demander_acces_notes(uuid) from public, anon;
grant execute on function public.demander_acces_notes(uuid) to authenticated;
revoke execute on function public.mes_messages_non_lus() from public, anon;
grant execute on function public.mes_messages_non_lus() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (lecture seule, après application en RECETTE)
--   select has_function_privilege('anon', 'public.mon_acces_notes(uuid)', 'execute');          -- false
--   select has_function_privilege('authenticated', 'public._acces_notes_autorise(uuid)', 'execute'); -- false
--   puis exécuter supabase/tests/essai_208_parent.sql (tout est annulé à la fin).
--
--  ANNULATION
--   Réappliquer les corps de 114 (mon_acces_notes, enfant_notes,
--   enfant_bulletin_lignes), 198 (declarer_paiement), 202 (declarer_avance),
--   166 (enfant_bulletins, après `drop`), 028 (mes_demandes, après `drop`), puis :
--   grant execute on function public._acces_notes_autorise(uuid) to public;
--   drop function if exists public._preuve_de_eleve(text, uuid);
-- =====================================================================
