-- =====================================================================
--  027 — Cahier de progression (planification des leçons par l'enseignant)
-- =====================================================================

create table if not exists progressions (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  matiere_id    uuid references matieres(id) on delete set null,
  enseignant_id uuid references enseignants(id) on delete set null,
  periode_id    uuid references periodes(id) on delete set null,
  titre         text not null,            -- chapitre / leçon
  description   text,
  date_prevue   date,
  statut        text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'fait')),
  created_at    timestamptz not null default now()
);
create index if not exists progressions_ecole_idx on progressions(ecole_id);
create index if not exists progressions_classe_idx on progressions(classe_id);

alter table progressions enable row level security;
drop policy if exists progressions_tenant on progressions;
create policy progressions_tenant on progressions
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());
