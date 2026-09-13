-- =====================================================================
--  106 — RH & PAIE : compléter la fiche employé (conformité)
--  Coordonnées de paiement + fiscal : pays, n° fiscal, banque, compte,
--  mobile money, personnes à charge. (Le n° IPRES existe déjà — 080.)
--  Non destructif : colonnes optionnelles.
-- =====================================================================

alter table personnels add column if not exists pays              text;
alter table personnels add column if not exists numero_fiscal     text;
alter table personnels add column if not exists banque            text;
alter table personnels add column if not exists compte_bancaire   text;
alter table personnels add column if not exists mobile_money       text;
alter table personnels add column if not exists personnes_a_charge int not null default 0;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table personnels drop column if exists personnes_a_charge;
-- alter table personnels drop column if exists mobile_money;
-- alter table personnels drop column if exists compte_bancaire;
-- alter table personnels drop column if exists banque;
-- alter table personnels drop column if exists numero_fiscal;
-- alter table personnels drop column if exists pays;
