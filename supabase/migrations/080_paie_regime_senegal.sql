-- =====================================================================
--  080 — PHASE D-bis : fondations paie « régime réel » (configurable/école)
--  - Champs fiscaux sur le personnel (part IR/TRIMF, matricule, catégorie…).
--  - cotisations_paie : cotisations définies par le comptable (taux sal./patr.,
--    plafond, forfait) — amorçage Sénégal par défaut.
--  - bareme_ir : barème IR+TRIMF chargé PAR ÉCOLE (mensuel ET annuel) ; l'IR
--    mensuel est déduit chaque mois, régularisé en fin d'année via l'annuel.
--  - mode de paie (simplifié / complet) stocké dans `parametres`.
--  Aucune donnée existante modifiée. Le mode reste 'simplifie' par défaut.
-- =====================================================================

-- 1) Champs fiscaux employé (saisis par le comptable) ------------------
alter table personnels add column if not exists matricule           text;
alter table personnels add column if not exists categorie           text;
alter table personnels add column if not exists n_ipres             text;
alter table personnels add column if not exists situation_familiale text;
alter table personnels add column if not exists part_ir             numeric(4,1) not null default 1;
alter table personnels add column if not exists part_trimf          numeric(4,1) not null default 1;

-- 2) Cotisations configurables ----------------------------------------
create table if not exists cotisations_paie (
  id               uuid primary key default gen_random_uuid(),
  ecole_id         uuid not null references ecoles(id) on delete cascade,
  libelle          text not null,
  assiette         text not null default 'brut',       -- base de calcul (brut…)
  taux_salarial    numeric(6,4) not null default 0,     -- ex. 0.0560
  taux_patronal    numeric(6,4) not null default 0,     -- ex. 0.0840
  plafond          numeric(12,2),                       -- null = pas de plafond
  forfait_salarial numeric(12,2) not null default 0,    -- si > 0, ignore le taux
  forfait_patronal numeric(12,2) not null default 0,
  ordre            int not null default 0,
  actif            boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists cotisations_paie_ecole_idx on cotisations_paie(ecole_id);

alter table cotisations_paie enable row level security;
drop policy if exists cotisations_paie_tenant on cotisations_paie;
create policy cotisations_paie_tenant on cotisations_paie
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))));

-- 3) Barème IR + TRIMF chargé par école (mensuel ET annuel) -----------
create table if not exists bareme_ir (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  periodicite text not null check (periodicite in ('mensuel', 'annuel')),
  revenu      numeric(14,2) not null,                   -- borne de revenu brut
  trimf       numeric(12,2) not null default 0,
  ir          jsonb not null default '{}'::jsonb,       -- { "1": x, "1.5": y, ... } IR par nb de parts
  created_at  timestamptz not null default now()
);
create index if not exists bareme_ir_lookup_idx on bareme_ir(ecole_id, periodicite, revenu);
create unique index if not exists bareme_ir_uidx on bareme_ir(ecole_id, periodicite, revenu);

alter table bareme_ir enable row level security;
drop policy if exists bareme_ir_tenant on bareme_ir;
create policy bareme_ir_tenant on bareme_ir
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))));

-- 4) Amorçage des cotisations Sénégal par défaut (écoles sans config) --
do $$
declare e record;
begin
  for e in select id from ecoles loop
    if not exists (select 1 from cotisations_paie where ecole_id = e.id) then
      insert into cotisations_paie(ecole_id, libelle, taux_salarial, taux_patronal, plafond, forfait_salarial, forfait_patronal, ordre) values
        (e.id, 'IPRES - Régime général',        0.0560, 0.0840, 432000, 0,    0,    0),
        (e.id, 'CSS - Accident du travail',      0,      0.0500, 63000,  0,    0,    1),
        (e.id, 'CSS - Allocations familiales',   0,      0.0700, 63000,  0,    0,    2),
        (e.id, 'IPM',                            0,      0,      null,   5000, 5000, 3),
        (e.id, 'CFCE (charge employeur)',        0,      0.0300, null,   0,    0,    4);
    end if;
  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists bareme_ir;
-- drop table if exists cotisations_paie;
-- alter table personnels drop column if exists matricule;
-- alter table personnels drop column if exists categorie;
-- alter table personnels drop column if exists n_ipres;
-- alter table personnels drop column if exists situation_familiale;
-- alter table personnels drop column if exists part_ir;
-- alter table personnels drop column if exists part_trimf;
