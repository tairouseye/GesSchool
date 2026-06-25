-- =====================================================================
--  009 — Paie : éléments de salaire (primes / retenues / mode)
-- =====================================================================

alter table salaires add column if not exists prime    numeric(12,2) not null default 0;
alter table salaires add column if not exists retenue  numeric(12,2) not null default 0;
alter table salaires add column if not exists mode     mode_paiement;
alter table salaires add column if not exists notes    text;

-- Unicité d'une fiche de paie par personnel et période.
create unique index if not exists salaires_personnel_periode_uidx
  on salaires(personnel_id, periode);
