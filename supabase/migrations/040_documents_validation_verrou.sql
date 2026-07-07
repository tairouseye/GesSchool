-- =====================================================================
--  040 — Verrouille la validation d'un document au SIGNATAIRE assigné
--  Avant : la Gestion (comptable/secrétaire) pouvait modifier un document et
--  donc le passer en « valide » par API, court-circuitant le signataire.
--  Après : seul le signataire assigné (ou le promoteur) peut valider/rejeter.
--  La Gestion garde la création (insert), la lecture et la suppression.
-- =====================================================================

drop policy if exists documents_update on documents;
create policy documents_update on documents for update using (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or signataire_profil = auth.uid()))
) with check (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or signataire_profil = auth.uid()))
);
