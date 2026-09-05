-- =====================================================================
--  090 — PHASE 3 : dossier employé (identité civile + historique contrats)
--  - personnels : identité civile complète (sexe, naissance, adresse, contact
--    d'urgence) pour un vrai dossier RH et des documents corrects.
--  - contrats : fin de période d'essai + motif de fin (l'historique existe déjà
--    — plusieurs contrats par personnel — mais était sous-exploité côté UI).
--  Rétro-compatible : colonnes nullables, aucune donnée modifiée.
-- =====================================================================

alter table personnels add column if not exists sexe             text;   -- 'M' / 'F'
alter table personnels add column if not exists date_naissance   date;
alter table personnels add column if not exists lieu_naissance   text;
alter table personnels add column if not exists adresse          text;
alter table personnels add column if not exists personne_prevenir text;
alter table personnels add column if not exists tel_urgence      text;

alter table contrats add column if not exists periode_essai_fin date;
alter table contrats add column if not exists motif_fin         text;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table personnels drop column if exists sexe;
-- alter table personnels drop column if exists date_naissance;
-- alter table personnels drop column if exists lieu_naissance;
-- alter table personnels drop column if exists adresse;
-- alter table personnels drop column if exists personne_prevenir;
-- alter table personnels drop column if exists tel_urgence;
-- alter table contrats drop column if exists periode_essai_fin;
-- alter table contrats drop column if exists motif_fin;
