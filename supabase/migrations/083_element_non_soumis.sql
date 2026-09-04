-- =====================================================================
--  083 — PHASE D-quater/2 : gains « non soumis » (indemnités exonérées)
--  Un gain marqué « non soumis » (transport, prime de panier…) entre dans le
--  NET mais PAS dans l'assiette des cotisations / IR / TRIMF (comme dans les
--  bulletins réels : l'indemnité de transport est ajoutée après cotisations).
--  Repéré côté ligne par nature='non_soumis' (sens='gain').
-- =====================================================================

alter table elements_paie add column if not exists soumis boolean not null default true;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table elements_paie drop column if exists soumis;
