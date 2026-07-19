-- =====================================================================
--  055 — relances.facture_id doit être NULLABLE
--
--  Symptôme : « null value in column "facture_id" of relation "relances"
--  violates not-null constraint » au clic sur « Relancer » dans le module
--  Recouvrement & relances.
--
--  Cause : relancer_eleve() relance un ÉLÈVE (total dû, toutes factures
--  confondues) et insère donc facture_id = null. La table avait été créée
--  en base avec facture_id NOT NULL ; le dépôt, lui, la déclare nullable
--  (voir 019) mais `create table if not exists` ne rejoue jamais la
--  définition sur une table déjà présente → dérive.
--
--  Correctif idempotent : on retire la contrainte NOT NULL.
-- =====================================================================

alter table public.relances alter column facture_id drop not null;

comment on column public.relances.facture_id is
  'Facture visée ; null = relance manuelle au niveau élève (total dû).';

-- L''unicité « 1 palier = 1 fois par facture » ne concerne que les relances
-- automatiques (facture_id + regle_id renseignés). Sous Postgres, les NULL
-- sont distincts : les relances manuelles ne sont donc jamais bloquées.

notify pgrst, 'reload schema';
