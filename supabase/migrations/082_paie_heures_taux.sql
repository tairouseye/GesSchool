-- =====================================================================
--  082 — PHASE D-quater : Brut piloté par heures × taux horaire
--  Le Brut = Σ (heures mensuelles × taux horaire) — salaire de base, sursalaire…
--  Les heures (fixes pour tous, définies par le comptable) sont ajustables par
--  bulletin (absences). Chaque ligne porte base (heures/assiette) + taux ;
--  montant = round(base × taux). Cotisation : base = min(brut, plafond).
--  - personnels : taux_horaire (base) + taux_sursalaire par employé.
--  - salaire_lignes : base + taux (montant reste la valeur sommée par le trigger).
--  Les heures mensuelles sont stockées dans `parametres` (cle=heures_mensuelles).
--  Rétro-compatible : colonnes nullables, rien de modifié.
-- =====================================================================

alter table personnels add column if not exists taux_horaire    numeric(14,4) not null default 0;
alter table personnels add column if not exists taux_sursalaire numeric(14,4) not null default 0;

alter table salaire_lignes add column if not exists base numeric(14,2);  -- heures ou assiette
alter table salaire_lignes add column if not exists taux numeric(14,6);  -- taux horaire ou % cotisation

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table salaire_lignes drop column if exists base;
-- alter table salaire_lignes drop column if exists taux;
-- alter table personnels drop column if exists taux_horaire;
-- alter table personnels drop column if exists taux_sursalaire;
