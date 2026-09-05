-- =====================================================================
--  091 — PHASE 4 : Congés du personnel (demande → approbation → solde)
--  Workflow : en_attente → approuvé / refusé (décideur + date tracés).
--  Solde de congé annuel = quota (paramètre école) − jours annuels approuvés
--  dans l'année. Pas de retenue paie automatique (respecte le principe d'audit).
--  RLS : RH / promoteur, cloisonné par école.
-- =====================================================================

create table if not exists conges (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  personnel_id uuid not null references personnels(id) on delete cascade,
  type         text not null default 'annuel' check (type in ('annuel', 'maladie', 'maternite', 'sans_solde', 'autre')),
  date_debut   date not null,
  date_fin     date not null,
  jours        numeric(5,1) not null default 0,
  motif        text,
  statut       text not null default 'en_attente' check (statut in ('en_attente', 'approuve', 'refuse')),
  motif_refus  text,
  decide_par   uuid,
  decide_le    timestamptz,
  saisi_par    uuid,
  created_at   timestamptz not null default now()
);
create index if not exists conges_ecole_idx on conges(ecole_id, statut);
create index if not exists conges_pers_idx on conges(personnel_id);

alter table conges enable row level security;
drop policy if exists conges_tenant on conges;
create policy conges_tenant on conges
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists conges;
