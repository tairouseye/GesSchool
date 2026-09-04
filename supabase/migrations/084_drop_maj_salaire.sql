-- =====================================================================
--  084 — Nettoyage : suppression de la RPC maj_salaire (code mort)
--  Depuis la paie dynamique (078+), l'édition passe par les lignes
--  (salaire_lignes) et le net est recalculé par trigger. maj_salaire (074)
--  écrivait montant_brut/prime/retenue/montant_net en direct — incohérent
--  avec le modèle en lignes et plus appelée par l'application.
-- =====================================================================

drop function if exists maj_salaire(uuid, numeric, numeric, numeric);

-- =====================================================================
--  ANNULATION — recréer maj_salaire (cf. migration 074) si nécessaire.
-- =====================================================================
