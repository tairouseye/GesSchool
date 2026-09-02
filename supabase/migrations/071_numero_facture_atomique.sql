-- 071 — Numéro de facture ATOMIQUE (par école ET par année).
--
-- Avant : `genererNumero` côté client faisait `count(*) + 1`. Ni atomique, ni
-- résistant aux suppressions, ni concurrent-safe → collisions sur l'index unique
-- `factures(ecole_id, numero)` → l'INSERT échoue et la facture n'est pas créée
-- (après toute suppression, en facturation concurrente ou en lot).
--
-- Correctif : compteur atomique en base (même modèle que les matricules), posé
-- par un trigger BEFORE INSERT → toutes les voies d'insertion sont couvertes,
-- dans la transaction, et un numéro n'est JAMAIS réutilisé.

-- Compteur par (école, année).
create table if not exists facture_compteurs (
  ecole_id uuid not null references ecoles(id) on delete cascade,
  annee    integer not null,
  dernier  integer not null default 0,
  primary key (ecole_id, annee)
);
-- Aucun accès client : RLS active sans policy ; les fonctions SECURITY DEFINER
-- (propriétaire) passent outre.
alter table facture_compteurs enable row level security;

-- Amorçage : repartir du plus grand numéro existant par (école, année), sinon
-- le premier numéro généré pourrait heurter une facture déjà en base.
insert into facture_compteurs (ecole_id, annee, dernier)
select ecole_id,
       (split_part(numero, '-', 2))::int,
       max((split_part(numero, '-', 3))::int)
from factures
where numero ~ '^F-[0-9]{4}-[0-9]+$'
group by ecole_id, (split_part(numero, '-', 2))::int
on conflict (ecole_id, annee) do update
  set dernier = greatest(facture_compteurs.dernier, excluded.dernier);

-- Prochain numéro atomique pour une école/année donnée.
create or replace function public.prochain_numero_facture(p_ecole uuid, p_annee integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_seq integer;
begin
  insert into facture_compteurs (ecole_id, annee, dernier)
  values (p_ecole, p_annee, 1)
  on conflict (ecole_id, annee) do update set dernier = facture_compteurs.dernier + 1
  returning dernier into v_seq;
  return 'F-' || p_annee::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Trigger : pose le numéro à l'insertion s'il est absent (toutes voies couvertes).
create or replace function public.set_numero_facture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.numero is null then
    NEW.numero := public.prochain_numero_facture(
      NEW.ecole_id,
      extract(year from coalesce(NEW.date_emission, current_date))::int
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_numero_facture on factures;
create trigger trg_set_numero_facture
  before insert on factures
  for each row execute function set_numero_facture();

-- ANNULATION
-- drop trigger if exists trg_set_numero_facture on factures;
-- drop function if exists public.set_numero_facture();
-- drop function if exists public.prochain_numero_facture(uuid, integer);
-- drop table if exists facture_compteurs;
