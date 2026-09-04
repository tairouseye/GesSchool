-- =====================================================================
--  076 — PHASE A : catégories financières configurables par école
--  Remplace les listes codées en dur (recettes/dépenses) par une table
--  gérée par l'école. Rétro-compatible : recettes.categorie / depenses.categorie
--  (texte) restent la source d'affichage ; on ajoute un lien OPTIONNEL
--  categorie_id (aucune donnée existante modifiée).
--  RLS : gestion (promoteur/direction) ou comptable, cloisonné par école.
-- =====================================================================

create table if not exists categories_finance (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  sens       text not null check (sens in ('recette', 'depense')),
  libelle    text not null,
  ordre      int  not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists categories_finance_ecole_idx on categories_finance(ecole_id);
create unique index if not exists categories_finance_uidx
  on categories_finance(ecole_id, sens, lower(libelle));

alter table categories_finance enable row level security;
drop policy if exists categories_finance_tenant on categories_finance;
create policy categories_finance_tenant on categories_finance
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))));

-- Lien optionnel (le texte `categorie` reste renseigné pour compat/affichage).
alter table recettes add column if not exists categorie_id uuid references categories_finance(id) on delete set null;
alter table depenses add column if not exists categorie_id uuid references categories_finance(id) on delete set null;

-- Amorçage d'un jeu par défaut pour chaque école qui n'en a pas encore.
-- NB : « Scolarité / Inscription / Cantine / Transport » ne figurent PAS en
-- recette manuelle (elles transitent par le module Paiements → déjà comptées).
-- « Salaires » (dépense) est conservé tel quel (utilisé par payer_salaire).
do $$
declare
  e   record;
  lbl text;
  i   int;
  rec text[] := array['Don','Subvention','Location','Activité','Vente de fournitures','Uniforme','Examens','Divers'];
  dep text[] := array['Salaires','Fournitures','Loyer','Électricité','Eau','Internet','Transport','Entretien','Maintenance','Communication','Restauration','Fournisseurs','Impôts / Taxes','Divers'];
begin
  for e in select id from ecoles loop
    if not exists (select 1 from categories_finance where ecole_id = e.id) then
      i := 0;
      foreach lbl in array rec loop
        insert into categories_finance(ecole_id, sens, libelle, ordre) values (e.id, 'recette', lbl, i);
        i := i + 1;
      end loop;
      i := 0;
      foreach lbl in array dep loop
        insert into categories_finance(ecole_id, sens, libelle, ordre) values (e.id, 'depense', lbl, i);
        i := i + 1;
      end loop;
    end if;
  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table recettes drop column if exists categorie_id;
-- alter table depenses drop column if exists categorie_id;
-- drop table if exists categories_finance;
