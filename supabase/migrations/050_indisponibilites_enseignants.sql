-- =====================================================================
--  050 — Indisponibilités des enseignants
--
--  Chaque ligne marque un créneau (jour + heure de début) où l'enseignant
--  n'est PAS disponible. Le générateur d'emploi du temps évite ces créneaux.
-- =====================================================================

create table if not exists indisponibilites_enseignants (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  enseignant_id uuid not null references enseignants(id) on delete cascade,
  jour          int  not null check (jour between 1 and 7),
  heure_debut   time not null,
  created_at    timestamptz not null default now(),
  unique (ecole_id, enseignant_id, jour, heure_debut)
);
create index if not exists indispo_ens_idx on indisponibilites_enseignants(ecole_id, enseignant_id);

-- RLS tenant (membre de l'école)
alter table indisponibilites_enseignants enable row level security;
drop policy if exists indisponibilites_enseignants_tenant on indisponibilites_enseignants;
create policy indisponibilites_enseignants_tenant on indisponibilites_enseignants
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());
