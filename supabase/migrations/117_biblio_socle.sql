-- =====================================================================
--  117 — Bibliothèque universitaire : SOCLE CATALOGUE
--
--  Séparation OBLIGATOIRE des trois concepts (cf. plan) :
--    • biblio_ressources   = la NOTICE bibliographique (« Introduction à l'économie »)
--    • biblio_exemplaires  = l'EXEMPLAIRE physique (EX-001, code-barres, cote, rayon)
--    • biblio_numeriques   = le FICHIER numérique            → migration 119
--
--  Localisation physique hiérarchique :
--    Établissement → Bibliothèque → Salle → Rayon → Étagère
--    (biblio_localisations est auto-référencée via parent_id)
--
--  Multi-tenant : tout est scopé `ecole_id` (aucune notion d'« institution »
--  n'est créée, `ecoles` est la racine tenant existante).
--
--  LECTURE = tout membre de l'école, Y COMPRIS LES ÉTUDIANTS, via
--  `est_membre_ecole()` (116) — indispensable car `ecole_courante()` est NULL
--  pour eux. ÉCRITURE = promoteur / direction / bibliothécaire.
--
--  Prérequis : migrations 115 (rôles) et 116 (helper) déjà appliquées.
-- =====================================================================

-- --- Bibliothèques physiques (centrale, faculté, campus…) -------------------
create table if not exists biblio_bibliotheques (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  nom         text not null,
  type        text not null default 'centrale',   -- centrale | faculte | departement | campus | autre
  faculte_id  uuid references facultes(id) on delete set null,
  adresse     text,
  actif       boolean not null default true,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists biblio_bibliotheques_ecole_idx on biblio_bibliotheques(ecole_id, actif);

-- --- Localisations (salle → rayon → étagère), hiérarchie auto-référencée ----
create table if not exists biblio_localisations (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  bibliotheque_id uuid not null references biblio_bibliotheques(id) on delete cascade,
  parent_id       uuid references biblio_localisations(id) on delete cascade,
  type            text not null default 'rayon',  -- salle | rayon | etagere
  libelle         text not null,
  code            text,
  created_at      timestamptz not null default now()
);
create index if not exists biblio_localisations_ecole_idx on biblio_localisations(ecole_id);
create index if not exists biblio_localisations_biblio_idx on biblio_localisations(bibliotheque_id);
create index if not exists biblio_localisations_parent_idx on biblio_localisations(parent_id);

-- --- Auteurs (enseignant, étudiant, chercheur, externe) --------------------
create table if not exists biblio_auteurs (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  nom            text not null,
  prenom         text,
  affiliation    text,
  departement_id uuid references departements(id) on delete set null,
  orcid          text,
  biographie     text,
  photo_chemin   text,
  created_at     timestamptz not null default now()
);
create index if not exists biblio_auteurs_ecole_idx on biblio_auteurs(ecole_id, nom, prenom);

-- --- Ressources (notices bibliographiques) ---------------------------------
--  `type_ressource` est un TEXTE LIBRE (pas de contrainte) : les types doivent
--  rester configurables sans migration (livre, e-book, article, revue, mémoire,
--  thèse, rapport, actes, manuel, dictionnaire, archive, multimédia…).
create table if not exists biblio_ressources (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  titre         text not null,
  sous_titre    text,
  type_ressource text not null default 'livre',
  langue        text default 'fr',
  editeur       text,
  annee_pub     integer,
  isbn          text,
  issn          text,
  doi           text,
  resume        text,
  discipline    text,
  mots_cles     text[] not null default '{}',
  couverture_chemin text,
  visible       boolean not null default true,
  cree_par      uuid references profils(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Recherche plein texte, alimentée par TRIGGER (voir plus bas).
  -- NB : ce n'est volontairement PAS une colonne générée — `array_to_string`
  -- et la résolution de la configuration de recherche ne sont que STABLE,
  -- alors qu'une colonne générée exige une expression IMMUTABLE (ERROR 42P17).
  recherche     tsvector
);
create index if not exists biblio_ressources_ecole_idx on biblio_ressources(ecole_id, visible, created_at desc);
create index if not exists biblio_ressources_type_idx on biblio_ressources(ecole_id, type_ressource);
create index if not exists biblio_ressources_discipline_idx on biblio_ressources(ecole_id, discipline);
create index if not exists biblio_ressources_isbn_idx on biblio_ressources(ecole_id, isbn) where isbn is not null;
create index if not exists biblio_ressources_recherche_idx on biblio_ressources using gin (recherche);
-- Filtrage par mots-clés (opérateurs @> / &&) en complément du plein texte.
create index if not exists biblio_ressources_motscles_idx on biblio_ressources using gin (mots_cles);

-- Alimentation du vecteur de recherche (insert + update).
create or replace function public.biblio_maj_recherche()
returns trigger language plpgsql set search_path = public as $$
begin
  new.recherche := to_tsvector('french',
    coalesce(new.titre, '') || ' ' ||
    coalesce(new.sous_titre, '') || ' ' ||
    coalesce(new.editeur, '') || ' ' ||
    coalesce(new.discipline, '') || ' ' ||
    coalesce(new.resume, '') || ' ' ||
    coalesce(array_to_string(new.mots_cles, ' '), '')
  );
  return new;
end $$;

drop trigger if exists trg_biblio_recherche on biblio_ressources;
create trigger trg_biblio_recherche
  before insert or update on biblio_ressources
  for each row execute function public.biblio_maj_recherche();

-- Rattrapage des lignes déjà présentes (ré-exécution sans risque).
update biblio_ressources set titre = titre where recherche is null;

-- --- Liaison ressource ↔ auteurs (N-N, avec rôle et ordre) -----------------
create table if not exists biblio_ressource_auteurs (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  ressource_id uuid not null references biblio_ressources(id) on delete cascade,
  auteur_id    uuid not null references biblio_auteurs(id) on delete cascade,
  role         text not null default 'auteur',   -- auteur | co_auteur | directeur | editeur | traducteur
  ordre        integer not null default 0,
  unique (ressource_id, auteur_id, role)
);
create index if not exists biblio_ressource_auteurs_ecole_idx on biblio_ressource_auteurs(ecole_id);
create index if not exists biblio_ressource_auteurs_res_idx on biblio_ressource_auteurs(ressource_id);
create index if not exists biblio_ressource_auteurs_aut_idx on biblio_ressource_auteurs(auteur_id);

-- --- Exemplaires physiques --------------------------------------------------
create table if not exists biblio_exemplaires (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  ressource_id    uuid not null references biblio_ressources(id) on delete cascade,
  code_barres     text,
  cote            text,
  bibliotheque_id uuid references biblio_bibliotheques(id) on delete set null,
  localisation_id uuid references biblio_localisations(id) on delete set null,
  etat            text not null default 'bon'
                  check (etat in ('neuf','bon','use','abime','perdu')),
  statut          text not null default 'disponible'
                  check (statut in ('disponible','emprunte','reserve','retire','perdu')),
  date_acquisition date,
  prix            numeric(12,2),
  fournisseur     text,
  created_at      timestamptz not null default now()
);
create unique index if not exists biblio_exemplaires_code_idx
  on biblio_exemplaires(ecole_id, code_barres) where code_barres is not null;
create index if not exists biblio_exemplaires_ecole_idx on biblio_exemplaires(ecole_id, statut);
create index if not exists biblio_exemplaires_res_idx on biblio_exemplaires(ressource_id);
create index if not exists biblio_exemplaires_loc_idx on biblio_exemplaires(localisation_id);

-- =====================================================================
--  RLS — lecture : tout membre de l'école (dont ÉTUDIANTS, via 116)
--        écriture : promoteur / direction / bibliothécaire
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'biblio_bibliotheques','biblio_localisations','biblio_auteurs',
    'biblio_ressources','biblio_ressource_auteurs','biblio_exemplaires'
  ]
  loop
    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      est_super_admin() or est_membre_ecole(ecole_id)
    );$p$, t, t);

    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_ecrire on %I for all using (
      est_super_admin() or (ecole_id = ecole_courante() and (
        est_admin() or a_role('direction') or a_role('bibliothecaire')))
    ) with check (
      est_super_admin() or (ecole_id = ecole_courante() and (
        est_admin() or a_role('direction') or a_role('bibliothecaire')))
    );$p$, t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists biblio_exemplaires, biblio_ressource_auteurs,
--   biblio_ressources, biblio_auteurs, biblio_localisations,
--   biblio_bibliotheques cascade;
