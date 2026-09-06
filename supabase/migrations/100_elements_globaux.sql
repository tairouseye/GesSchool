-- =====================================================================
--  100 — RH & PAIE (P3 audit) : éléments globaux + exclusions
--  Appliquer un élément de paie à une PORTÉE (tous / une catégorie / une
--  fonction) avec un montant par défaut, et EXCLURE des employés précis.
--  Priorité de fusion (le plus spécifique l'emporte pour un même élément) :
--    global 'tous' < global 'categorie' < global 'fonction' < régime < individuel
--  Non destructif : sans affectation globale, comportement inchangé.
-- =====================================================================

create table if not exists element_affectations (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  element_id uuid not null references elements_paie(id) on delete cascade,
  portee     text not null check (portee in ('tous','categorie','fonction')),
  valeur     text not null default '',   -- '' pour 'tous' ; sinon catégorie/fonction
  montant    numeric(12,2) not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ecole_id, element_id, portee, valeur)
);
create index if not exists element_affectations_ecole_idx on element_affectations(ecole_id);

create table if not exists element_exclusions (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  affectation_id uuid not null references element_affectations(id) on delete cascade,
  personnel_id  uuid not null references personnels(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (affectation_id, personnel_id)
);
create index if not exists element_exclusions_ecole_idx on element_exclusions(ecole_id);
create index if not exists element_exclusions_aff_idx on element_exclusions(affectation_id);

do $$
declare t text;
begin
  foreach t in array array['element_affectations','element_exclusions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_tenant on %I', t, t);
    execute format(
      'create policy %I_tenant on %I using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''rh'')))) with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''rh''))))',
      t, t);
  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists element_exclusions;
-- drop table if exists element_affectations;
