-- =====================================================================
--  GesSchool — Migration 005
--  Séries (lycée) + grille de coefficients par série/niveau
--  + matricule élève configurable et auto-généré par école
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SÉRIES (L, L1, L2, S1, S2, S3, G… ) — propres à chaque école
-- ---------------------------------------------------------------------
create table if not exists series (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  code        text not null,                 -- 'S2'
  libelle     text not null,                 -- 'Scientifique 2'
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (ecole_id, code)
);
create index if not exists series_ecole_idx on series(ecole_id);

-- Une classe de lycée peut appartenir à une série (null = pas de série :
-- primaire / collège).
alter table classes add column if not exists serie_id uuid references series(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2) GRILLE DE COEFFICIENTS par matière, déclinée par série OU par niveau
--    (exactement un des deux scopes est renseigné)
-- ---------------------------------------------------------------------
create table if not exists coefficients_matieres (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  matiere_id  uuid not null references matieres(id) on delete cascade,
  niveau_id   uuid references niveaux(id) on delete cascade,
  serie_id    uuid references series(id) on delete cascade,
  coefficient numeric(5,2) not null default 1,
  -- soit un niveau, soit une série (jamais les deux, jamais aucun)
  constraint coef_un_seul_scope check ((niveau_id is not null) <> (serie_id is not null))
);
create index if not exists coef_ecole_idx on coefficients_matieres(ecole_id);
-- Unicité par portée
create unique index if not exists coef_matiere_niveau_uidx
  on coefficients_matieres(ecole_id, matiere_id, niveau_id) where niveau_id is not null;
create unique index if not exists coef_matiere_serie_uidx
  on coefficients_matieres(ecole_id, matiere_id, serie_id) where serie_id is not null;

-- ---------------------------------------------------------------------
-- 3) MATRICULE configurable par école : {PREFIXE}{SEP}{AA}{SEP}{SEQ}
--    ex. GS-25-0001  (séquence remise à zéro chaque année civile)
-- ---------------------------------------------------------------------
alter table ecoles add column if not exists matricule_prefixe   text;
alter table ecoles add column if not exists matricule_separateur text not null default '-';
alter table ecoles add column if not exists matricule_longueur   integer not null default 4;

-- Compteur de séquence par (école, année) pour une génération atomique.
create table if not exists matricule_compteurs (
  ecole_id  uuid not null references ecoles(id) on delete cascade,
  annee     integer not null,                -- année civile (2025)
  dernier   integer not null default 0,
  primary key (ecole_id, annee)
);

-- Retourne le prochain matricule formaté pour l'école de l'utilisateur
-- connecté, en incrémentant le compteur de l'année courante.
create or replace function prochain_matricule()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_ecole  uuid := ecole_courante();
  v_an     integer := extract(year from current_date)::int;
  v_prefixe text;
  v_sep    text;
  v_long   integer;
  v_seq    integer;
begin
  if v_ecole is null then
    raise exception 'Aucune école courante';
  end if;

  select coalesce(matricule_prefixe, ''), coalesce(matricule_separateur, '-'),
         greatest(coalesce(matricule_longueur, 4), 1)
    into v_prefixe, v_sep, v_long
    from ecoles where id = v_ecole;

  insert into matricule_compteurs (ecole_id, annee, dernier)
  values (v_ecole, v_an, 1)
  on conflict (ecole_id, annee)
    do update set dernier = matricule_compteurs.dernier + 1
  returning dernier into v_seq;

  return
    case when v_prefixe <> '' then v_prefixe || v_sep else '' end
    || lpad((v_an % 100)::text, 2, '0') || v_sep
    || lpad(v_seq::text, v_long, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- 4) RLS — mêmes règles tenant que le reste (école courante ou super_admin)
-- ---------------------------------------------------------------------
do $$
declare t text;
  tenant_tables text[] := array['series', 'coefficients_matieres', 'matricule_compteurs'];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      drop policy if exists %1$s_tenant on %1$I;
    $f$, t);
    execute format($f$
      create policy %1$s_tenant on %1$I
      using (est_super_admin() or ecole_id = ecole_courante())
      with check (est_super_admin() or ecole_id = ecole_courante());
    $f$, t);
  end loop;
end $$;
