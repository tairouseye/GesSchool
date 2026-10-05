-- =====================================================================
--  173 — Le dossier pédagogique ne se lit plus par tout le personnel
--
--  🔴 LE DÉFAUT. Les quatre policies de LECTURE du dossier pédagogique
--  valaient simplement :
--
--      est_super_admin() or ecole_id = ecole_courante()
--
--  — aucun prédicat de rôle. Tout membre actif de l'école (comptable,
--  secrétaire, responsable RH, surveillant, bibliothécaire) pouvait donc
--  lire PAR L'API toutes les notes, toutes les évaluations, tous les
--  bulletins et leurs détails par matière, de tous les élèves.
--
--  L'interface, elle, le leur cachait : `ACCES.notes` et `ACCES.bulletins`
--  ne nomment que `direction` et `enseignant`. C'était donc un contrôle
--  FRONTEND pris pour une sécurité — exactement ce que la consigne du
--  projet interdit. Le guide Direction promet même le cloisonnement
--  « même par un appel direct à l'application » ; c'était vrai dans le
--  sens pédagogie → factures, faux dans l'autre sens.
--
--  🔴 ET UN ENSEIGNANT LISAIT TOUTE L'ÉCOLE. La migration 058 avait
--  cloisonné l'ÉCRITURE à ses propres classes, mais pas la lecture : un
--  enseignant de CI pouvait lire les notes et les bulletins du CM2.
--
--  ⚠️ CE QUI A ÉTÉ VÉRIFIÉ AVANT D'ÉCRIRE CETTE MIGRATION.
--
--  1. Le chemin PARENT est intact. `enfant_bulletins` et
--     `enfant_bulletin_lignes` sont SECURITY DEFINER : ils contournent la
--     RLS et gardent la grille de consentement de la migration 114. Le QR
--     d'authenticité (`verifier_document`) est DEFINER aussi.
--  2. Les deux fonctions INVOKER qui lisent `bulletins` —
--     `etat_bulletins` et `avancer_bulletins` — sont appelées depuis
--     l'écran Bulletins par la direction et l'enseignant : tous deux
--     restent autorisés ci-dessous.
--  3. Côté client, `notes`, `evaluations` et `bulletin_lignes` ne sont lus
--     que par `src/lib/bulletins.js`, pour les écrans Notes, Bulletins et
--     Classement (direction + enseignant).
--  4. SEULE EXCEPTION RÉELLE : le secrétariat a besoin de la moyenne pour
--     l'« attestation de résultats » (`Certificats.jsx` →
--     `getDernierBulletin`). Ce besoin est légitime et étroit : il reçoit
--     donc une RPC dédiée (§3), au lieu de laisser toute la Gestion lire
--     tout le dossier pédagogique.
--
--  ⚠️ POURQUOI LA LECTURE EST AU NIVEAU DE LA CLASSE, PAS DE LA MATIÈRE,
--  alors que l'écriture est au niveau de la matière. Un enseignant qui
--  ouvre « Bulletins » ou « Classement » fait calculer la moyenne de sa
--  classe PAR LE CLIENT, à partir des notes de TOUTES les matières. Une
--  policy limitée à sa matière lui aurait renvoyé un sous-ensemble sans
--  rien dire, et il aurait imprimé un bulletin FAUX. On ne fait jamais
--  calculer au client ce que la RLS lui cache (leçon de l'audit
--  bibliothèque). La lecture suit donc la classe, comme `bulletins`.
--
--  Aucune donnée n'est modifiée. Aucun index à créer : `notes(evaluation_id,
--  eleve_id)` et `bulletin_lignes(bulletin_id)` existent déjà.
-- =====================================================================

-- --- 1. Bulletins : lire ce qu'on pouvait déjà écrire -----------------
--  Symétrie exacte avec `bulletins_upd` (migration 058).
drop policy if exists bulletins_select on public.bulletins;
create policy bulletins_select on public.bulletins
  for select using (
    est_super_admin()
    or (
      ecole_id = ecole_courante()
      and (
        est_gestion()
        or (a_role('enseignant') and enseigne_classe(classe_id))
      )
    )
  );

-- --- 2. Le détail par matière suit son bulletin -----------------------
--  ⚠️ On ne réutilise PAS `peut_editer_bulletin` (le prédicat d'écriture) :
--  il porte sur le droit de MODIFIER, et refuserait la lecture d'un
--  bulletin déjà arrêté. Lire un bulletin publié doit rester possible.
drop policy if exists bulletin_lignes_select on public.bulletin_lignes;
create policy bulletin_lignes_select on public.bulletin_lignes
  for select using (
    est_super_admin()
    or (
      ecole_id = ecole_courante()
      and (
        est_gestion()
        or (
          a_role('enseignant')
          and exists (
            select 1 from public.bulletins b
             where b.id = bulletin_lignes.bulletin_id
               and enseigne_classe(b.classe_id)
          )
        )
      )
    )
  );

-- --- 3. Évaluations et notes ------------------------------------------
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (
    est_super_admin()
    or (
      ecole_id = ecole_courante()
      and (
        est_gestion()
        or (a_role('enseignant') and enseigne_classe(classe_id))
      )
    )
  );

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select using (
    est_super_admin()
    or (
      ecole_id = ecole_courante()
      and (
        est_gestion()
        or (
          a_role('enseignant')
          and exists (
            select 1 from public.evaluations v
             where v.id = notes.evaluation_id
               and enseigne_classe(v.classe_id)
          )
        )
      )
    )
  );

-- --- 4. L'attestation de résultats, et rien de plus -------------------
--
--  Le secrétariat délivre une « attestation de résultats » qui énonce la
--  moyenne, la mention, le rang et la décision du conseil. Il lui faut donc
--  CES champs, pour UN élève — pas le dossier pédagogique de l'école.
--
--  ⚠️ SECURITY DEFINER, DONC LE CLOISONNEMENT EST ÉCRIT À LA MAIN (leçon de
--  la migration 167) : la RLS ne s'applique plus dans le corps, c'est à
--  nous de vérifier l'établissement ET le rôle. Fail-closed : pas de
--  session, pas d'établissement courant, mauvais rôle ⇒ aucune ligne.
drop function if exists public.bulletin_pour_attestation(uuid, uuid);
create or replace function public.bulletin_pour_attestation(p_eleve uuid, p_annee uuid default null)
returns table(
  moyenne_generale numeric,
  mention text,
  decision text,
  rang integer,
  effectif integer,
  periode text
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_ecole uuid := ecole_courante();
begin
  --  Fail-closed, dans cet ordre : session, établissement, rôle.
  if auth.uid() is null or v_ecole is null or p_eleve is null then
    return;
  end if;
  --  Qui délivre un document administratif : la direction (qui a déjà la
  --  lecture complète) et le guichet — comptable, secrétariat. PAS un
  --  enseignant : il n'édite aucune attestation.
  if not (est_gestion() or a_role('comptable') or a_role('secretaire')) then
    return;
  end if;
  --  Cloisonnement écrit à la main : l'élève doit appartenir à MON école.
  if not exists (
    select 1 from eleves e where e.id = p_eleve and e.ecole_id = v_ecole
  ) then
    return;
  end if;

  return query
    select b.moyenne_generale, b.mention, b.decision, b.rang, b.effectif, pe.libelle
      from bulletins b
      join periodes pe on pe.id = b.periode_id
     where b.eleve_id = p_eleve
       and b.ecole_id = v_ecole
       and (p_annee is null or pe.annee_id = p_annee)
     order by pe.ordre desc
     limit 1;
end;
$fn$;

revoke execute on function public.bulletin_pour_attestation(uuid, uuid) from public, anon;
grant execute on function public.bulletin_pour_attestation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION (revient à l'état d'avant : lecture par tout le personnel)
-- =====================================================================
-- drop function if exists public.bulletin_pour_attestation(uuid, uuid);
-- drop policy if exists bulletins_select on public.bulletins;
-- create policy bulletins_select on public.bulletins for select
--   using (est_super_admin() or (ecole_id = ecole_courante()));
-- drop policy if exists bulletin_lignes_select on public.bulletin_lignes;
-- create policy bulletin_lignes_select on public.bulletin_lignes for select
--   using (est_super_admin() or (ecole_id = ecole_courante()));
-- drop policy if exists evaluations_select on public.evaluations;
-- create policy evaluations_select on public.evaluations for select
--   using (est_super_admin() or (ecole_id = ecole_courante()));
-- drop policy if exists notes_select on public.notes;
-- create policy notes_select on public.notes for select
--   using (est_super_admin() or (ecole_id = ecole_courante()));
-- notify pgrst, 'reload schema';
