-- =====================================================================
--  016 — Modules activables par école (« vendre à la carte »)
--  Rétablit dans le versionnement la colonne `ecoles.modules_actifs`
--  introduite en v2.7.0 mais jamais committée comme migration.
--
--  Sémantique (cf. src/lib/modules.js) :
--    modules_actifs = NULL  → TOUS les modules actifs (compat ascendante)
--    modules_actifs = '{...}' → seuls les modules listés sont actifs
--  Les ids valides sont ceux de MODULES (scolarite, evaluations,
--  vie_scolaire, finances, rh, communication, pilotage).
-- =====================================================================

alter table ecoles add column if not exists modules_actifs text[];

comment on column ecoles.modules_actifs is
  'Modules commerciaux actifs (ids de src/lib/modules.js). NULL = tous actifs.';
