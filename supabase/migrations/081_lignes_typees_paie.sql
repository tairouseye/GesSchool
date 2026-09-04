-- =====================================================================
--  081 — PHASE D-ter/2 : lignes de bulletin typées (régime complet)
--  - salaire_lignes.sens accepte 'patronal' (charges employeur, informatives,
--    N'entrant PAS dans le net — le trigger recalc ne somme que gain/retenue).
--  - salaire_lignes.nature : 'base'|'gain'|'cotisation'|'impot'|'patronal'|…
--    pour grouper le bulletin et régénérer les lignes statutaires.
--  Rétro-compatible : les lignes existantes restent 'gain'/'retenue', nature nulle.
-- =====================================================================

alter table salaire_lignes drop constraint if exists salaire_lignes_sens_check;
alter table salaire_lignes add constraint salaire_lignes_sens_check
  check (sens in ('gain', 'retenue', 'patronal'));

alter table salaire_lignes add column if not exists nature text;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table salaire_lignes drop column if exists nature;
-- delete from salaire_lignes where sens = 'patronal';
-- alter table salaire_lignes drop constraint if exists salaire_lignes_sens_check;
-- alter table salaire_lignes add constraint salaire_lignes_sens_check check (sens in ('gain','retenue'));
