-- =====================================================================
--  078 — PHASE D : bulletin de paie dynamique (composition en lignes)
--  NET = Σ gains − Σ retenues. Chaque salaire porte des `salaire_lignes`.
--  - Migration SANS PERTE : les anciens salaires (montant_brut/prime/retenue)
--    sont convertis en lignes (Salaire de base / Prime / Retenue).
--  - Un trigger recalcule montant_brut(=Σgains)/retenue(=Σretenues)/montant_net
--    ET resynchronise la dépense comptable liée à chaque changement de ligne.
--  Le net des anciens salaires est préservé à l'identique.
-- =====================================================================

create table if not exists salaire_lignes (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  salaire_id uuid not null references salaires(id) on delete cascade,
  element_id uuid references elements_paie(id) on delete set null,
  libelle    text not null,
  sens       text not null check (sens in ('gain', 'retenue')),
  montant    numeric(12,2) not null default 0,
  ordre      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists salaire_lignes_salaire_idx on salaire_lignes(salaire_id);
create index if not exists salaire_lignes_ecole_idx on salaire_lignes(ecole_id);

alter table salaire_lignes enable row level security;
drop policy if exists salaire_lignes_tenant on salaire_lignes;
create policy salaire_lignes_tenant on salaire_lignes
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

-- Recalcule les totaux d'un salaire depuis ses lignes + resync dépense liée.
create or replace function recalc_salaire(p_salaire uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_g numeric; v_r numeric;
begin
  select coalesce(sum(montant) filter (where sens = 'gain'), 0),
         coalesce(sum(montant) filter (where sens = 'retenue'), 0)
    into v_g, v_r
    from salaire_lignes where salaire_id = p_salaire;
  update salaires set montant_brut = v_g, retenue = v_r, montant_net = v_g - v_r
    where id = p_salaire;
  -- Si le salaire est réglé, la dépense comptable suit le net.
  update depenses set montant = v_g - v_r where ref_salaire_id = p_salaire;
end $$;

-- ---- Migration SANS PERTE (avant la pose du trigger : colonnes intactes) ----
do $$
declare s record;
begin
  for s in select id, ecole_id, coalesce(montant_brut,0) brut, coalesce(prime,0) prime, coalesce(retenue,0) retenue from salaires loop
    if not exists (select 1 from salaire_lignes where salaire_id = s.id) then
      insert into salaire_lignes(ecole_id, salaire_id, libelle, sens, montant, ordre)
        values (s.ecole_id, s.id, 'Salaire de base', 'gain', s.brut, 0);
      if s.prime <> 0 then
        insert into salaire_lignes(ecole_id, salaire_id, libelle, sens, montant, ordre)
          values (s.ecole_id, s.id, 'Prime', 'gain', s.prime, 1);
      end if;
      if s.retenue <> 0 then
        insert into salaire_lignes(ecole_id, salaire_id, libelle, sens, montant, ordre)
          values (s.ecole_id, s.id, 'Retenue', 'retenue', s.retenue, 0);
      end if;
    end if;
  end loop;
end $$;

-- ---- Trigger de recalcul (après la migration) ----
create or replace function trg_recalc_salaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalc_salaire(coalesce(new.salaire_id, old.salaire_id));
  return null;
end $$;

drop trigger if exists salaire_lignes_recalc on salaire_lignes;
create trigger salaire_lignes_recalc
  after insert or update or delete on salaire_lignes
  for each row execute function trg_recalc_salaire();

-- ---- Recalage unique des totaux depuis les lignes (net inchangé) ----
do $$
declare s record;
begin
  for s in select id from salaires loop
    perform recalc_salaire(s.id);
  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists salaire_lignes_recalc on salaire_lignes;
-- drop function if exists trg_recalc_salaire();
-- drop function if exists recalc_salaire(uuid);
-- drop table if exists salaire_lignes;
-- (les colonnes montant_brut/prime/retenue/montant_net des anciens salaires
--  restent telles quelles ; aucune perte.)
