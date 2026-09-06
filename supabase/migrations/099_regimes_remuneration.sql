-- =====================================================================
--  099 — RH & PAIE (P2 audit) : régimes de rémunération assignables
--  Un « régime » regroupe des éléments récurrents (avec un montant par
--  défaut) et s'affecte à un employé — ou en masse à une catégorie — sans
--  ressaisir les éléments un par un. À la génération de la paie, les
--  éléments de l'employé = éléments du régime + affectations individuelles
--  (l'individuel prime sur le régime pour un même élément).
--  Non destructif : les affectations individuelles existantes continuent
--  de fonctionner (un employé sans régime = comportement actuel).
-- =====================================================================

create table if not exists regimes_paie (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  libelle     text not null,
  description text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists regimes_paie_ecole_idx on regimes_paie(ecole_id);
create unique index if not exists regimes_paie_uidx on regimes_paie(ecole_id, lower(libelle));

create table if not exists regime_elements (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  regime_id  uuid not null references regimes_paie(id) on delete cascade,
  element_id uuid not null references elements_paie(id) on delete cascade,
  montant    numeric(12,2) not null default 0,
  ordre      int not null default 0,
  created_at timestamptz not null default now(),
  unique (regime_id, element_id)
);
create index if not exists regime_elements_ecole_idx on regime_elements(ecole_id);
create index if not exists regime_elements_regime_idx on regime_elements(regime_id);

alter table personnels add column if not exists regime_id uuid references regimes_paie(id) on delete set null;

-- RLS (même modèle que elements_paie : gestion admin ou RH)
do $$
declare t text;
begin
  foreach t in array array['regimes_paie','regime_elements'] loop
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
-- alter table personnels drop column if exists regime_id;
-- drop table if exists regime_elements;
-- drop table if exists regimes_paie;
