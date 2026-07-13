-- =====================================================================
--  049 — Génération automatique des emplois du temps
--
--  Trois briques de configuration alimentent le générateur :
--   - creneaux_horaires : la grille type de la semaine, définie JOUR PAR JOUR
--     (créneaux de cours + pauses non planifiables).
--   - salles : les salles de l'établissement (anti-conflit à la génération).
--   - volumes_horaires : nombre de séances/semaine par matière et PAR NIVEAU
--     (s'applique à toutes les classes du niveau).
--
--  Le résultat est écrit dans emplois_du_temps (déjà existant : classe_id,
--  jour, heure_debut, heure_fin, matiere_id, enseignant_id, salle).
-- =====================================================================

-- Grille horaire (jour par jour) ---------------------------------------------
create table if not exists creneaux_horaires (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  jour        int  not null check (jour between 1 and 7),
  ordre       int  not null default 0,
  heure_debut time not null,
  heure_fin   time not null,
  pause       boolean not null default false,   -- récréation / pause déjeuner
  created_at  timestamptz not null default now()
);
create index if not exists creneaux_horaires_ecole_idx on creneaux_horaires(ecole_id, jour, ordre);

-- Salles ---------------------------------------------------------------------
create table if not exists salles (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  nom        text not null,
  capacite   int,
  created_at timestamptz not null default now()
);
create index if not exists salles_ecole_idx on salles(ecole_id);

-- Volume horaire par matière et par niveau (séances/semaine) ------------------
create table if not exists volumes_horaires (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  niveau_id  uuid not null references niveaux(id) on delete cascade,
  matiere_id uuid not null references matieres(id) on delete cascade,
  heures     int  not null default 1 check (heures >= 0),
  created_at timestamptz not null default now(),
  unique (ecole_id, niveau_id, matiere_id)
);
create index if not exists volumes_horaires_ecole_idx on volumes_horaires(ecole_id, niveau_id);

-- RLS tenant (aligné sur les tables structurelles : membre de l'école) --------
do $$
declare t text; tbls text[] := array['creneaux_horaires','salles','volumes_horaires'];
begin
  foreach t in array tbls loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_tenant on %1$I;', t);
    execute format($f$create policy %1$s_tenant on %1$I
      using (est_super_admin() or ecole_id = ecole_courante())
      with check (est_super_admin() or ecole_id = ecole_courante());$f$, t);
  end loop;
end $$;
