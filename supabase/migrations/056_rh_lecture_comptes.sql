-- =====================================================================
--  056 — Le responsable RH peut LIRE les comptes de trésorerie
--
--  Contexte : payer_salaire() accepte un compte (caisse / banque) et impute
--  la dépense dessus ; le RPC autorise déjà « est_gestion() or a_role(''rh'') ».
--  Mais la table `comptes` était en RLS gestion/comptable uniquement : un RH
--  « pur » ne voyait donc aucun compte, le sélecteur restait vide et ses
--  salaires repartaient sans imputation — exactement ce qu'on voulait éviter.
--
--  On ouvre la LECTURE seule au rôle rh. La création / modification des
--  comptes reste réservée à la gestion et au comptable.
-- =====================================================================

drop policy if exists comptes_lecture_rh on public.comptes;
create policy comptes_lecture_rh on public.comptes
  for select
  using (
    est_super_admin()
    or (ecole_id = ecole_courante() and a_role('rh'))
  );

comment on policy comptes_lecture_rh on public.comptes is
  'Lecture seule des comptes pour le RH : imputation des salaires payés.';

notify pgrst, 'reload schema';
