-- =====================================================================
--  038 — Grille tarifaire : frais ciblables par CYCLE (pas seulement par niveau)
--  Cas d'usage : la scolarité est identique pour tout un cycle ; seules les
--  classes d'examen (niveau précis) peuvent avoir un tarif différent.
--  Ciblage d'un frais : cycle_id (tout le cycle) OU niveau_id (un niveau) OU
--  aucun (toute l'école).
-- =====================================================================

alter table frais add column if not exists cycle_id uuid references cycles(id) on delete set null;
create index if not exists frais_cycle_idx on frais(cycle_id);
