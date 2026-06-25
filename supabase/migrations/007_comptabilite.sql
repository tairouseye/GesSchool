-- =====================================================================
--  007 — Comptabilité (livre de caisse)
--  Comptes de trésorerie avec solde initial, recettes (entrées) en plus
--  des dépenses (sorties) existantes. Catégorie pour le classement.
-- =====================================================================

alter table comptes add column if not exists solde_initial numeric(12,2) not null default 0;
alter table comptes add column if not exists actif boolean not null default true;

alter table depenses add column if not exists categorie text;

create table if not exists recettes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  compte_id     uuid references comptes(id) on delete set null,
  libelle       text not null,
  categorie     text,
  montant       numeric(12,2) not null,
  mode          mode_paiement,
  date_recette  date not null default current_date,
  source        text,
  justificatif_url text,
  saisi_par     uuid references profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists recettes_ecole_idx on recettes(ecole_id);

-- RLS tenant (école courante ou super_admin)
alter table recettes enable row level security;
drop policy if exists recettes_tenant on recettes;
create policy recettes_tenant on recettes
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());
