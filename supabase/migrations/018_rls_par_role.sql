-- =====================================================================
--  018 — Durcissement RLS : écritures restreintes par rôle
--
--  Problème corrigé : jusqu'ici le contrôle d'accès « par métier » était
--  appliqué uniquement côté client (src/lib/permissions.js). Au niveau
--  base, la policy générique `<table>_tenant` n'isolait que par TENANT :
--      using (est_super_admin() or ecole_id = ecole_courante())
--  → n'importe quel membre de l'école pouvait écrire dans n'importe
--    quelle table de son école via un appel API direct (ex. un enseignant
--    modifiant des paiements). Escalade de privilèges intra-tenant.
--
--  Correctif : pour les tables sensibles, on SÉPARE
--    - SELECT  : tout membre de l'école (lecture inchangée),
--    - INSERT/UPDATE/DELETE : membre de l'école ET rôle métier requis.
--  La gestion (super_admin / admin_ecole / direction, via est_gestion())
--  conserve un accès complet.
--
--  Note : l'espace parent n'est PAS impacté — il passe par des RPC
--  SECURITY DEFINER (enfant_notes, enfant_factures…) qui contournent RLS.
-- =====================================================================

-- Helper temporaire : (re)pose les policies select + écritures-par-rôle.
create or replace function pg_temp._rls_par_role(p_tables text[], p_pred text)
returns void language plpgsql as $$
declare t text;
begin
  foreach t in array p_tables loop
    -- on retire l'ancienne policy générique + d'éventuelles policies de ce script
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);

    -- lecture : tout membre de l'école (ou super-admin)
    execute format(
      'create policy %1$s_select on public.%1$I for select '
      || 'using (est_super_admin() or ecole_id = ecole_courante());', t);

    -- écritures : membre de l'école ET rôle métier requis
    execute format(
      'create policy %1$s_ins on public.%1$I for insert '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));',
      t, p_pred);
    execute format(
      'create policy %1$s_upd on public.%1$I for update '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and %2$s)) '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));',
      t, p_pred);
    execute format(
      'create policy %1$s_del on public.%1$I for delete '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and %2$s));',
      t, p_pred);
  end loop;
end $$;

-- Finances : comptable (+ gestion)
select pg_temp._rls_par_role(
  array['paiements','factures','facture_lignes','frais'],
  '(est_gestion() or a_role(''comptable''))');

-- Évaluations & bulletins : enseignant (+ gestion)
select pg_temp._rls_par_role(
  array['evaluations','notes','bulletins','bulletin_lignes'],
  '(est_gestion() or a_role(''enseignant''))');

-- Dossier élève / inscriptions : comptable (+ gestion)
-- (côté Gestion ; les rôles purement pédagogiques restent en lecture seule,
--  cf. peutEditerEleves dans src/lib/permissions.js)
select pg_temp._rls_par_role(
  array['eleves','inscriptions','eleve_tuteurs','tuteurs','documents_eleve'],
  '(est_gestion() or a_role(''comptable''))');

-- Vie scolaire : surveillant ou enseignant (+ gestion)
select pg_temp._rls_par_role(
  array['absences','incidents'],
  '(est_gestion() or a_role(''surveillant'') or a_role(''enseignant''))');

-- pg_temp._rls_par_role disparaît automatiquement en fin de session.
