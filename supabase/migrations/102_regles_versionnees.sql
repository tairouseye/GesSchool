-- =====================================================================
--  102 — RH & PAIE (P9 audit) : règles versionnées par date d'effet
--  Cotisations et barème IR gagnent une DATE D'EFFET (+ date de fin), pour
--  tracer les évolutions réglementaires sans écraser l'historique. La paie
--  d'une période utilise la version EN VIGUEUR ce mois-là.
--  Non destructif : les lignes existantes prennent effet le 2000-01-01
--  (donc s'appliquent à tout, comportement inchangé).
-- =====================================================================

-- Cotisations : versioning + code stable (identité d'une cotisation à travers ses versions)
alter table cotisations_paie add column if not exists date_effet date not null default date '2000-01-01';
alter table cotisations_paie add column if not exists date_fin   date;
alter table cotisations_paie add column if not exists code       text;
update cotisations_paie
   set code = lower(regexp_replace(libelle, '[^a-zA-Z0-9]+', '_', 'g'))
 where code is null;
create index if not exists cotisations_paie_effet_idx on cotisations_paie(ecole_id, date_effet);

-- Barème IR : versioning (une version = toutes les lignes d'une même date_effet)
alter table bareme_ir add column if not exists date_effet date not null default date '2000-01-01';
drop index if exists bareme_ir_uidx;
create unique index if not exists bareme_ir_uidx on bareme_ir(ecole_id, periodicite, date_effet, revenu);
create index if not exists bareme_ir_effet_idx on bareme_ir(ecole_id, periodicite, date_effet);

-- remplacer_bareme : ajoute/replace une VERSION datée (conserve les autres versions)
create or replace function remplacer_bareme(p_ecole uuid, p_periodicite text, p_rows jsonb, p_date_effet date default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; v_effet date := coalesce(p_date_effet, date_trunc('year', current_date)::date);
begin
  if not (est_super_admin() or (ecole_courante() = p_ecole and (est_gestion() or a_role('rh') or a_role('comptable')))) then
    raise exception 'Accès refusé.';
  end if;
  if p_periodicite not in ('mensuel', 'annuel') then raise exception 'Périodicité invalide.'; end if;

  -- Ne supprime que la version de MÊME date d'effet (réimport) ; garde l'historique.
  delete from bareme_ir where ecole_id = p_ecole and periodicite = p_periodicite and date_effet = v_effet;
  insert into bareme_ir (ecole_id, periodicite, revenu, trimf, ir, date_effet)
  select p_ecole, p_periodicite,
         (r->>'revenu')::numeric,
         coalesce((r->>'trimf')::numeric, 0),
         coalesce(r->'ir', '{}'::jsonb),
         v_effet
  from jsonb_array_elements(p_rows) r
  where (r->>'revenu') is not null;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function remplacer_bareme(uuid, text, jsonb, date) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (remettre l'ancienne signature remplacer_bareme(uuid,text,jsonb) — cf. 085)
-- drop index if exists bareme_ir_effet_idx;
-- drop index if exists bareme_ir_uidx;
-- create unique index bareme_ir_uidx on bareme_ir(ecole_id, periodicite, revenu);
-- alter table bareme_ir drop column if exists date_effet;
-- alter table cotisations_paie drop column if exists code;
-- alter table cotisations_paie drop column if exists date_fin;
-- alter table cotisations_paie drop column if exists date_effet;
