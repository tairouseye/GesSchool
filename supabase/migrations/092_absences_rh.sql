-- =====================================================================
--  092 — PHASE 4 : Absences du personnel (distinct des absences ÉLÈVES)
--  Saisie d'absence / retard / maladie / autorisation, justifiée ou non.
--  Informatif : n'entraîne AUCUNE retenue automatique (les heures se règlent
--  à la préparation de la paie, avec validation). RLS RH / promoteur.
-- =====================================================================

create table if not exists absences_rh (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  personnel_id uuid not null references personnels(id) on delete cascade,
  type         text not null default 'absence' check (type in ('absence', 'retard', 'maladie', 'autorisation')),
  date_debut   date not null,
  date_fin     date,
  heures       numeric(5,1),
  justifie     boolean not null default false,
  motif        text,
  saisi_par    uuid,
  created_at   timestamptz not null default now()
);
create index if not exists absences_rh_ecole_idx on absences_rh(ecole_id);
create index if not exists absences_rh_pers_idx on absences_rh(personnel_id);

alter table absences_rh enable row level security;
drop policy if exists absences_rh_tenant on absences_rh;
create policy absences_rh_tenant on absences_rh
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists absences_rh;
