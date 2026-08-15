-- =====================================================================
--  068 — GED : élargir l'insertion de documents aux rôles générateurs
--
--  L'archivage (Phase 2b) crée une ligne `documents` au moment où le document
--  est produit. Or les bulletins sont publiés par la direction/enseignant et
--  la paie par le RH — non couverts par la policy d'insert (039) qui se
--  limitait à la Gestion. On l'élargit à ces rôles.
--
--  La LECTURE reste inchangée (Gestion + signataire) : le hub Documentation
--  est réservé au promoteur (est_admin), rien n'est exposé en plus.
-- =====================================================================

drop policy if exists documents_insert on documents;
create policy documents_insert on documents for insert with check (
  est_super_admin() or (ecole_id = ecole_courante() and (
    est_admin() or a_role('comptable') or a_role('secretaire')
    or a_role('direction') or a_role('rh') or a_role('enseignant')
  ))
);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION — revenir à la policy 039 (Gestion uniquement)
-- =====================================================================
-- drop policy if exists documents_insert on documents;
-- create policy documents_insert on documents for insert with check (
--   est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('comptable') or a_role('secretaire')))
-- );
