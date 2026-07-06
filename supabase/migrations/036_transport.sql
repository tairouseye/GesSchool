-- =====================================================================
--  036 — Module Transport scolaire (circuits, arrêts, abonnements, embarquement)
--  Activable par école (modules_actifs = 'transport'). Accès Gestion :
--  promoteur / comptable / secrétaire.
-- =====================================================================

create table if not exists transport_circuits (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  nom           text not null,
  vehicule      text,
  chauffeur     text,
  chauffeur_tel text,
  heure_depart  text,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists transport_circuits_ecole_idx on transport_circuits(ecole_id);

create table if not exists transport_arrets (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  circuit_id uuid not null references transport_circuits(id) on delete cascade,
  libelle    text not null,
  ordre      int  not null default 0,
  heure      text
);
create index if not exists transport_arrets_circuit_idx on transport_arrets(circuit_id);

create table if not exists transport_abonnements (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  eleve_id   uuid not null references eleves(id) on delete cascade,
  circuit_id uuid references transport_circuits(id) on delete set null,
  arret_id   uuid references transport_arrets(id) on delete set null,
  trajet     text not null default 'aller_retour' check (trajet in ('aller_retour','aller','retour')),
  tarif      numeric(12,2) not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ecole_id, eleve_id)
);
create index if not exists transport_abo_ecole_idx on transport_abonnements(ecole_id);

create table if not exists transport_pointages (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  eleve_id   uuid not null references eleves(id) on delete cascade,
  circuit_id uuid references transport_circuits(id) on delete set null,
  date_p     date not null default current_date,
  sens       text not null default 'aller' check (sens in ('aller','retour')),
  embarque   boolean not null default false,
  debarque   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ecole_id, eleve_id, date_p, sens)
);
create index if not exists transport_pointages_idx on transport_pointages(ecole_id, date_p, sens);

-- RLS : lecture + écriture réservées à la Gestion (promoteur/comptable/secrétaire).
do $$
declare t text;
begin
  foreach t in array array['transport_circuits','transport_arrets','transport_abonnements','transport_pointages'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_gestion on %1$I;', t);
    execute format(
      'create policy %1$s_gestion on %1$I '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'') or a_role(''secretaire'')))) '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'') or a_role(''secretaire''))));',
      t);
  end loop;
end $$;
