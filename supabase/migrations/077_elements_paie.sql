-- =====================================================================
--  077 — PHASE C : catalogue d'éléments de paie configurables
--  Base de la paie dynamique (net = base + gains − retenues).
--  - elements_paie : catalogue par école (gain/retenue, fixe/variable,
--    récurrent, imposable). Géré par la RH / le promoteur sans code.
--  - personnel_elements_paie : affectation d'un élément RÉCURRENT à un
--    employé avec son montant (repris chaque mois — cf. Phase D).
--  RLS : RH ou promoteur (cohérent avec salaires/contrats), par école.
--  Aucune donnée existante modifiée.
-- =====================================================================

create table if not exists elements_paie (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  libelle    text not null,
  sens       text not null check (sens in ('gain', 'retenue')),
  mode       text not null default 'fixe' check (mode in ('fixe', 'variable')),
  recurrent  boolean not null default false,
  imposable  boolean not null default false,
  ordre      int not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists elements_paie_ecole_idx on elements_paie(ecole_id);
create unique index if not exists elements_paie_uidx on elements_paie(ecole_id, sens, lower(libelle));

alter table elements_paie enable row level security;
drop policy if exists elements_paie_tenant on elements_paie;
create policy elements_paie_tenant on elements_paie
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

create table if not exists personnel_elements_paie (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  personnel_id uuid not null references personnels(id) on delete cascade,
  element_id  uuid not null references elements_paie(id) on delete cascade,
  montant     numeric(12,2) not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (personnel_id, element_id)
);
create index if not exists personnel_elements_paie_ecole_idx on personnel_elements_paie(ecole_id);
create index if not exists personnel_elements_paie_pers_idx on personnel_elements_paie(personnel_id);

alter table personnel_elements_paie enable row level security;
drop policy if exists personnel_elements_paie_tenant on personnel_elements_paie;
create policy personnel_elements_paie_tenant on personnel_elements_paie
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

-- Amorçage d'un catalogue de départ pour chaque école qui n'en a pas.
-- (Avances / prêts / absences auront leurs modules dédiés — Phase F — donc
--  pas amorcés ici pour éviter les doublons de mécanisme.)
do $$
declare
  e   record;
  r   record;
  gains   text[] := array['Prime de transport','Prime de logement','Prime de responsabilité','Prime d''ancienneté','Indemnité','Heures supplémentaires','Prime de rendement','Bonus','Gratification'];
  gain_recurrent text[] := array['Prime de transport','Prime de logement','Prime de responsabilité','Prime d''ancienneté','Indemnité'];
  retenues text[] := array['Absence','Retard','Cotisation','Retenue fiscale','Autre retenue'];
  ret_recurrent text[] := array['Cotisation'];
  lbl text; i int;
begin
  for e in select id from ecoles loop
    if not exists (select 1 from elements_paie where ecole_id = e.id) then
      i := 0;
      foreach lbl in array gains loop
        insert into elements_paie(ecole_id, libelle, sens, mode, recurrent, ordre)
        values (e.id, lbl, 'gain',
                case when lbl = any(gain_recurrent) then 'fixe' else 'variable' end,
                lbl = any(gain_recurrent), i);
        i := i + 1;
      end loop;
      i := 0;
      foreach lbl in array retenues loop
        insert into elements_paie(ecole_id, libelle, sens, mode, recurrent, ordre)
        values (e.id, lbl, 'retenue',
                case when lbl = any(ret_recurrent) then 'fixe' else 'variable' end,
                lbl = any(ret_recurrent), i);
        i := i + 1;
      end loop;
    end if;
  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists personnel_elements_paie;
-- drop table if exists elements_paie;
