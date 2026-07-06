-- =====================================================================
--  035 — Module Cantine (abonnements, repas, menu)
--  Activable par école (modules_actifs = 'cantine'). Accès Gestion :
--  promoteur / comptable / secrétaire (cloisonnement cohérent avec 033).
-- =====================================================================

create table if not exists cantine_abonnements (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  eleve_id   uuid not null references eleves(id) on delete cascade,
  formule    text not null default 'mensuel' check (formule in ('mensuel','prepaye')),
  tarif      numeric(12,2) not null default 0,   -- mensuel = /mois ; prépayé = prix d'un repas
  solde      numeric(12,2) not null default 0,   -- crédit prépayé
  regime     text,                                -- régime / allergies
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ecole_id, eleve_id)
);
create index if not exists cantine_abo_ecole_idx on cantine_abonnements(ecole_id);

create table if not exists cantine_repas (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  eleve_id   uuid not null references eleves(id) on delete cascade,
  date_repas date not null default current_date,
  cout       numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (ecole_id, eleve_id, date_repas)
);
create index if not exists cantine_repas_ecole_date_idx on cantine_repas(ecole_id, date_repas);

create table if not exists cantine_menus (
  id       uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  semaine  date not null,                 -- lundi de la semaine
  jour     int  not null check (jour between 1 and 7),
  plats    text,
  unique (ecole_id, semaine, jour)
);
create index if not exists cantine_menus_ecole_idx on cantine_menus(ecole_id, semaine);

-- RLS : lecture + écriture réservées à la Gestion (promoteur/comptable/secrétaire).
do $$
declare t text;
begin
  foreach t in array array['cantine_abonnements','cantine_repas','cantine_menus'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_gestion on %1$I;', t);
    execute format(
      'create policy %1$s_gestion on %1$I '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'') or a_role(''secretaire'')))) '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'') or a_role(''secretaire''))));',
      t);
  end loop;
end $$;
