-- =====================================================================
--  108 — Module « Supérieur » (LMD) : socle de données
--
--  Introduit le TYPE d'établissement (école vs supérieur) et l'ossature
--  académique universitaire : Faculté → Département → Filière → Semestre,
--  puis la maquette pédagogique (UE → ECUE) avec crédits et coefficients.
--
--  100 % ADDITIF et ISOLÉ : aucune table existante (classes, notes,
--  bulletins…) n'est modifiée ; les écoles gardent exactement leur
--  comportement (type par défaut = 'ecole'). Le module ne s'affiche que
--  lorsque type_etablissement = 'superieur'.
-- =====================================================================

-- 1) Type d'établissement (bascule du menu académique).
alter table ecoles
  add column if not exists type_etablissement text not null default 'ecole'
  check (type_etablissement in ('ecole', 'superieur'));

-- 2) Fonctions d'aide déjà présentes : ecole_courante(), est_super_admin(),
--    est_admin(), a_role(). Politique commune :
--      lecture  = membre de l'école ;
--      écriture = promoteur (est_admin) ou responsable pédagogique (direction).

-- --- Facultés / UFR / Instituts ---
create table if not exists facultes (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  nom        text not null,
  sigle      text,
  ordre      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists facultes_ecole_idx on facultes(ecole_id);

-- --- Départements ---
create table if not exists departements (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  faculte_id  uuid not null references facultes(id) on delete cascade,
  nom         text not null,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists departements_ecole_idx on departements(ecole_id);
create index if not exists departements_faculte_idx on departements(faculte_id);

-- --- Filières / Mentions ---
create table if not exists filieres (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  departement_id uuid not null references departements(id) on delete cascade,
  nom            text not null,
  sigle          text,
  diplome        text not null default 'licence' check (diplome in ('licence','master','doctorat')),
  ordre          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists filieres_ecole_idx on filieres(ecole_id);
create index if not exists filieres_departement_idx on filieres(departement_id);

-- --- Semestres (par filière) ---
create table if not exists semestres (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  filiere_id     uuid not null references filieres(id) on delete cascade,
  niveau         text,                                   -- L1, L2, L3, M1, M2…
  numero         integer,                                -- rang du semestre (1..10)
  libelle        text not null,                          -- « Licence 1 — Semestre 1 »
  credits_requis integer not null default 30,            -- norme LMD
  ordre          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists semestres_ecole_idx on semestres(ecole_id);
create index if not exists semestres_filiere_idx on semestres(filiere_id);

-- --- UE (Unités d'Enseignement) — maquette d'un semestre ---
create table if not exists ue (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  filiere_id  uuid not null references filieres(id) on delete cascade,
  semestre_id uuid not null references semestres(id) on delete cascade,
  code        text,
  intitule    text not null,
  credits     numeric(5,2) not null default 0,
  coefficient numeric(5,2) not null default 1,
  type_ue     text not null default 'fondamentale'
              check (type_ue in ('fondamentale','transversale','optionnelle','libre')),
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ue_ecole_idx on ue(ecole_id);
create index if not exists ue_semestre_idx on ue(semestre_id);

-- --- ECUE (Éléments Constitutifs d'une UE) ---
create table if not exists ecue (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  ue_id       uuid not null references ue(id) on delete cascade,
  code        text,
  intitule    text not null,
  credits     numeric(5,2) not null default 0,
  coefficient numeric(5,2) not null default 1,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ecue_ecole_idx on ecue(ecole_id);
create index if not exists ecue_ue_idx on ecue(ue_id);

-- 3) RLS — cloisonnement multi-établissement identique au reste de l'app.
do $$
declare t text;
begin
  foreach t in array array['facultes','departements','filieres','semestres','ue','ecue']
  loop
    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      est_super_admin() or ecole_id = ecole_courante()
    );$p$, t, t);

    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_ecrire on %I for all using (
      est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction')))
    ) with check (
      est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction')))
    );$p$, t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists ecue, ue, semestres, filieres, departements, facultes cascade;
-- alter table ecoles drop column if exists type_etablissement;
