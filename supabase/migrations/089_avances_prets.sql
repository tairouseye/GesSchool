-- =====================================================================
--  089 — PHASE 2 : Avances sur salaire & Prêts au personnel
--  - avances_prets : octroi (montant, échéancier, motif). Le SOLDE n'est PAS
--    stocké : il se DÉDUIT (montant − Σ remboursements) → réversible.
--  - remboursements : une déduction par bulletin (unique par période) ; en
--    cascade à la suppression du bulletin (brouillon) → le solde se restaure seul.
--  L'échéance due est prélevée automatiquement à la génération de la paie.
--  RLS : RH / promoteur, cloisonné par école (comme les salaires).
-- =====================================================================

create table if not exists avances_prets (
  id               uuid primary key default gen_random_uuid(),
  ecole_id         uuid not null references ecoles(id) on delete cascade,
  personnel_id     uuid not null references personnels(id) on delete cascade,
  type             text not null check (type in ('avance', 'pret')),
  montant          numeric(12,2) not null,
  date_octroi      date not null default current_date,
  motif            text,
  mode             mode_paiement,
  nb_echeances     int not null default 1,
  montant_echeance numeric(12,2) not null,
  premiere_echeance text not null,                 -- 'YYYY-MM'
  statut           text not null default 'en_cours' check (statut in ('en_cours', 'solde', 'annule')),
  created_at       timestamptz not null default now()
);
create index if not exists avances_prets_ecole_idx on avances_prets(ecole_id);
create index if not exists avances_prets_pers_idx on avances_prets(personnel_id);

alter table avances_prets enable row level security;
drop policy if exists avances_prets_tenant on avances_prets;
create policy avances_prets_tenant on avances_prets
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

create table if not exists remboursements (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  avance_pret_id uuid not null references avances_prets(id) on delete cascade,
  salaire_id     uuid references salaires(id) on delete cascade,
  periode        text not null,
  montant        numeric(12,2) not null,
  created_at     timestamptz not null default now(),
  unique (avance_pret_id, periode)
);
create index if not exists remboursements_ecole_idx on remboursements(ecole_id);
create index if not exists remboursements_ap_idx on remboursements(avance_pret_id);

alter table remboursements enable row level security;
drop policy if exists remboursements_tenant on remboursements;
create policy remboursements_tenant on remboursements
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists remboursements;
-- drop table if exists avances_prets;
