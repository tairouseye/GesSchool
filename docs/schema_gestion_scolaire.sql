-- =====================================================================
--  GesSchool — Schéma de base de données (PostgreSQL / Supabase)
--  SaaS multi-tenant de gestion scolaire (Sénégal / Afrique de l'Ouest)
--
--  Principes :
--   - Multi-tenant par `ecole_id` présent sur (presque) toutes les tables.
--   - Isolation stricte via RLS (Row Level Security) : un utilisateur ne
--     voit QUE les données de son école.
--   - `super_admin` (éditeur du SaaS) traverse les tenants.
--   - Noms métier en français ; types/contrôles explicites.
--
--  11 domaines :
--    1. Plateforme & tenants        6. Évaluations & bulletins
--    2. Identité & rôles            7. Vie scolaire
--    3. Structure académique        8. Finances (paiements parents)
--    4. Élèves & inscriptions       9. Comptabilité
--    5. Pédagogie / enseignement   10. Ressources humaines
--                                  11. Communication & système
--
--  Ce fichier est le SCHÉMA DE RÉFÉRENCE. La migration applicative
--  (supabase/migrations/) en dérivera, éventuellement découpée.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
--  TYPES ÉNUMÉRÉS
-- ---------------------------------------------------------------------
create type role_systeme as enum (
  'super_admin',   -- éditeur du SaaS (multi-écoles)
  'admin_ecole',   -- administrateur d'un établissement
  'direction',     -- directeur / principal / proviseur
  'enseignant',
  'comptable',
  'rh',
  'surveillant',   -- vie scolaire
  'parent'         -- tuteur / responsable légal
);

create type type_cycle as enum (
  'prescolaire',
  'premier_cycle',   -- élémentaire / primaire
  'second_cycle',    -- collège
  'lycee',
  'formation_pro',
  'universite'
);

create type sexe as enum ('M', 'F');

create type statut_inscription as enum (
  'pre_inscrit', 'inscrit', 'reinscrit', 'transfere', 'abandon', 'exclu', 'diplome'
);

create type statut_facture as enum (
  'brouillon', 'emise', 'partiellement_payee', 'payee', 'en_retard', 'annulee'
);

create type mode_paiement as enum (
  'especes', 'wave', 'orange_money', 'free_money', 'virement', 'cheque', 'carte'
);

create type type_evaluation as enum (
  'devoir', 'composition', 'examen', 'interro', 'tp', 'oral', 'projet'
);

create type type_absence as enum ('absence', 'retard');
create type statut_justif as enum ('non_justifie', 'justifie', 'en_attente');

create type statut_abonnement as enum ('essai', 'actif', 'suspendu', 'expire', 'annule');

-- =====================================================================
--  DOMAINE 1 — PLATEFORME & TENANTS
-- =====================================================================

-- 1.1 Plans d'abonnement du SaaS (catalogue global, non tenant)
create table plans_abonnement (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,                 -- 'starter', 'pro', 'campus'
  libelle       text not null,
  prix_mensuel  numeric(12,2) not null default 0,
  max_eleves    integer,                              -- null = illimité
  max_classes   integer,
  fonctions     jsonb not null default '{}'::jsonb,   -- flags de modules activés
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 1.2 Écoles = tenants
create table ecoles (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  sigle         text,
  type_etablissement text,                            -- privé / public / confessionnel...
  cycles_actifs type_cycle[] not null default '{}',  -- cycles ouverts dans l'établissement
  logo_url      text,
  cachet_url    text,                                 -- image du cachet (signature visuelle)
  couleur_primaire   text default '#0B1F3A',         -- navy par défaut (identité)
  couleur_secondaire text default '#C9A227',         -- or
  email         text,
  telephone     text,
  adresse       text,
  ville         text,
  region        text,
  pays          text not null default 'Sénégal',
  devise        text not null default 'XOF',
  langue        text not null default 'fr',
  fuseau        text not null default 'Africa/Dakar',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 1.3 Abonnement courant d'une école
create table abonnements (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  plan_id       uuid not null references plans_abonnement(id),
  statut        statut_abonnement not null default 'essai',
  debut         date not null default current_date,
  fin           date,
  created_at    timestamptz not null default now()
);
create index on abonnements(ecole_id);

-- =====================================================================
--  DOMAINE 2 — IDENTITÉ & RÔLES
-- =====================================================================

-- 2.1 Profil applicatif lié à auth.users (Supabase Auth)
create table profils (
  id          uuid primary key references auth.users(id) on delete cascade,
  ecole_id    uuid references ecoles(id) on delete cascade,  -- null pour super_admin
  prenom      text not null,
  nom         text not null,
  email       text,
  telephone   text,
  avatar_url  text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on profils(ecole_id);

-- 2.2 Rôles attribués (un utilisateur peut cumuler des rôles dans son école)
create table profil_roles (
  id          uuid primary key default gen_random_uuid(),
  profil_id   uuid not null references profils(id) on delete cascade,
  ecole_id    uuid references ecoles(id) on delete cascade,
  role        role_systeme not null,
  unique (profil_id, ecole_id, role)
);
create index on profil_roles(ecole_id);
create index on profil_roles(profil_id);

-- =====================================================================
--  DOMAINE 3 — STRUCTURE ACADÉMIQUE
-- =====================================================================

-- 3.1 Années scolaires (par école)
create table annees_scolaires (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  libelle     text not null,                 -- '2025-2026'
  date_debut  date not null,
  date_fin    date not null,
  courante    boolean not null default false,
  cloturee    boolean not null default false,
  unique (ecole_id, libelle)
);
create index on annees_scolaires(ecole_id);

-- 3.2 Périodes (trimestres / semestres) d'une année
create table periodes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  annee_id      uuid not null references annees_scolaires(id) on delete cascade,
  libelle       text not null,               -- 'Trimestre 1'
  ordre         integer not null,
  date_debut    date,
  date_fin      date,
  unique (annee_id, ordre)
);
create index on periodes(ecole_id);

-- 3.3 Cycles activés dans l'école (instances de type_cycle)
create table cycles (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  type        type_cycle not null,
  libelle     text not null,                 -- 'Collège', 'Élémentaire'...
  ordre       integer not null default 0,
  unique (ecole_id, type)
);
create index on cycles(ecole_id);

-- 3.4 Niveaux (CP, CE1... 6e, 5e... Seconde...) rattachés à un cycle
create table niveaux (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  cycle_id    uuid not null references cycles(id) on delete cascade,
  libelle     text not null,
  ordre       integer not null default 0
);
create index on niveaux(ecole_id);
create index on niveaux(cycle_id);

-- 3.5 Classes (instances de niveau pour une année : '6e A')
create table classes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  niveau_id     uuid not null references niveaux(id) on delete restrict,
  annee_id      uuid not null references annees_scolaires(id) on delete cascade,
  libelle       text not null,               -- '6e A'
  effectif_max  integer,
  prof_principal_id uuid,                     -- FK enseignants (déclarée plus bas via ALTER si besoin)
  salle         text,
  created_at    timestamptz not null default now()
);
create index on classes(ecole_id);
create index on classes(annee_id);

-- 3.6 Matières
create table matieres (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  code        text,
  libelle     text not null,
  cycle_id    uuid references cycles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on matieres(ecole_id);

-- =====================================================================
--  DOMAINE 4 — ÉLÈVES & INSCRIPTIONS
-- =====================================================================

-- 4.1 Élèves
create table eleves (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  matricule     text,                          -- unique par école (cf. index)
  prenom        text not null,
  nom           text not null,
  sexe          sexe,
  date_naissance date,
  lieu_naissance text,
  nationalite   text,
  photo_url     text,
  adresse       text,
  groupe_sanguin text,
  infos_medicales text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index on eleves(ecole_id, matricule) where matricule is not null;
create index on eleves(ecole_id);

-- 4.2 Tuteurs / responsables (parent peut avoir un compte = profil)
create table tuteurs (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  profil_id   uuid references profils(id) on delete set null,  -- si compte parent
  prenom      text not null,
  nom         text not null,
  telephone   text,
  email       text,
  profession  text,
  adresse     text,
  created_at  timestamptz not null default now()
);
create index on tuteurs(ecole_id);

-- 4.3 Lien élève ↔ tuteur (responsable légal, paie, etc.)
create table eleve_tuteurs (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  tuteur_id     uuid not null references tuteurs(id) on delete cascade,
  lien_parente  text,                          -- 'père', 'mère', 'tuteur'...
  responsable_legal boolean not null default false,
  responsable_paiement boolean not null default false,
  unique (eleve_id, tuteur_id)
);
create index on eleve_tuteurs(ecole_id);

-- 4.4 Inscriptions (un élève -> une classe -> une année)
create table inscriptions (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete restrict,
  annee_id      uuid not null references annees_scolaires(id) on delete cascade,
  statut        statut_inscription not null default 'inscrit',
  date_inscription date not null default current_date,
  redoublant    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (eleve_id, annee_id)
);
create index on inscriptions(ecole_id);
create index on inscriptions(classe_id);

-- 4.5 Documents du dossier élève
create table documents_eleve (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  eleve_id    uuid not null references eleves(id) on delete cascade,
  type        text,                            -- 'extrait_naissance', 'certificat'...
  fichier_url text not null,
  created_at  timestamptz not null default now()
);
create index on documents_eleve(ecole_id);

-- =====================================================================
--  DOMAINE 5 — PÉDAGOGIE / ENSEIGNEMENT
-- =====================================================================

-- 5.1 Enseignants (lié à un profil optionnel)
create table enseignants (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  profil_id   uuid references profils(id) on delete set null,
  prenom      text not null,
  nom         text not null,
  specialite  text,
  telephone   text,
  email       text,
  created_at  timestamptz not null default now()
);
create index on enseignants(ecole_id);

-- FK différée : prof principal d'une classe
alter table classes
  add constraint classes_prof_principal_fk
  foreign key (prof_principal_id) references enseignants(id) on delete set null;

-- 5.2 Affectation enseignant ↔ classe ↔ matière (+ coefficient)
create table affectations (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  enseignant_id uuid not null references enseignants(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  matiere_id    uuid not null references matieres(id) on delete cascade,
  coefficient   numeric(4,2) not null default 1,
  annee_id      uuid not null references annees_scolaires(id) on delete cascade,
  unique (classe_id, matiere_id, annee_id)
);
create index on affectations(ecole_id);

-- 5.3 Emploi du temps (créneaux)
create table emplois_du_temps (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  matiere_id    uuid references matieres(id) on delete set null,
  enseignant_id uuid references enseignants(id) on delete set null,
  jour          integer not null,             -- 1=lundi ... 7=dimanche
  heure_debut   time not null,
  heure_fin     time not null,
  salle         text
);
create index on emplois_du_temps(ecole_id);
create index on emplois_du_temps(classe_id);

-- =====================================================================
--  DOMAINE 6 — ÉVALUATIONS & BULLETINS
-- =====================================================================

-- 6.1 Évaluations
create table evaluations (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  matiere_id    uuid not null references matieres(id) on delete cascade,
  periode_id    uuid not null references periodes(id) on delete cascade,
  enseignant_id uuid references enseignants(id) on delete set null,
  type          type_evaluation not null default 'devoir',
  libelle       text,
  bareme        numeric(5,2) not null default 20,
  coefficient   numeric(4,2) not null default 1,
  date_eval     date,
  created_at    timestamptz not null default now()
);
create index on evaluations(ecole_id);
create index on evaluations(classe_id, periode_id);

-- 6.2 Notes (note d'un élève à une évaluation)
create table notes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  valeur        numeric(5,2),                  -- null = non noté / absent
  absent        boolean not null default false,
  appreciation  text,
  unique (evaluation_id, eleve_id)
);
create index on notes(ecole_id);
create index on notes(eleve_id);

-- 6.3 Bulletins (synthèse élève/période ; moyennes & rang calculés)
create table bulletins (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  periode_id    uuid not null references periodes(id) on delete cascade,
  moyenne_generale numeric(5,2),
  rang          integer,
  effectif      integer,
  mention       text,
  appreciation_generale text,
  decision      text,                          -- conseil de classe
  pdf_url       text,
  genere_le     timestamptz,
  unique (eleve_id, periode_id)
);
create index on bulletins(ecole_id);
create index on bulletins(classe_id, periode_id);

-- 6.4 Détail par matière d'un bulletin
create table bulletin_lignes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  bulletin_id   uuid not null references bulletins(id) on delete cascade,
  matiere_id    uuid not null references matieres(id) on delete cascade,
  moyenne       numeric(5,2),
  coefficient   numeric(4,2) not null default 1,
  rang_matiere  integer,
  appreciation  text,
  enseignant    text
);
create index on bulletin_lignes(ecole_id);
create index on bulletin_lignes(bulletin_id);

-- =====================================================================
--  DOMAINE 7 — VIE SCOLAIRE
-- =====================================================================

create table absences (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  classe_id     uuid references classes(id) on delete set null,
  type          type_absence not null default 'absence',
  date_abs      date not null,
  heure_debut   time,
  heure_fin     time,
  motif         text,
  statut        statut_justif not null default 'non_justifie',
  saisi_par     uuid references profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on absences(ecole_id);
create index on absences(eleve_id);

create table incidents (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  type          text,                          -- 'sanction', 'observation', 'félicitation'
  gravite       integer,
  description   text,
  date_incident date not null default current_date,
  saisi_par     uuid references profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on incidents(ecole_id);

-- =====================================================================
--  DOMAINE 8 — FINANCES (PAIEMENTS PARENTS)
-- =====================================================================

-- 8.1 Grille tarifaire (types de frais : inscription, scolarité, cantine...)
create table frais (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  annee_id      uuid references annees_scolaires(id) on delete cascade,
  niveau_id     uuid references niveaux(id) on delete set null,  -- frais par niveau (optionnel)
  libelle       text not null,                 -- 'Scolarité', 'Inscription', 'Cantine'
  montant       numeric(12,2) not null,
  recurrent     boolean not null default false,-- mensuel ?
  obligatoire   boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on frais(ecole_id);

-- 8.2 Factures (émises à un tuteur pour un élève)
create table factures (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  numero        text,                          -- unique par école
  eleve_id      uuid not null references eleves(id) on delete cascade,
  tuteur_id     uuid references tuteurs(id) on delete set null,
  annee_id      uuid references annees_scolaires(id) on delete set null,
  date_emission date not null default current_date,
  date_echeance date,
  montant_total numeric(12,2) not null default 0,
  montant_paye  numeric(12,2) not null default 0,  -- maintenu par trigger sur paiements
  statut        statut_facture not null default 'emise',
  notes         text,
  created_at    timestamptz not null default now()
);
create unique index on factures(ecole_id, numero) where numero is not null;
create index on factures(ecole_id);
create index on factures(eleve_id);

-- 8.3 Lignes de facture (détail des frais)
create table facture_lignes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  facture_id    uuid not null references factures(id) on delete cascade,
  frais_id      uuid references frais(id) on delete set null,
  libelle       text not null,
  quantite      numeric(8,2) not null default 1,
  prix_unitaire numeric(12,2) not null default 0,
  montant       numeric(12,2) not null default 0
);
create index on facture_lignes(ecole_id);
create index on facture_lignes(facture_id);

-- 8.4 Paiements (encaissements ; statut facture dérivé du cumulé)
create table paiements (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  facture_id    uuid not null references factures(id) on delete cascade,
  montant       numeric(12,2) not null,
  mode          mode_paiement not null default 'especes',
  reference     text,                          -- réf. mobile money / chèque
  date_paiement date not null default current_date,
  encaisse_par  uuid references profils(id) on delete set null,
  recu_url      text,
  created_at    timestamptz not null default now()
);
create index on paiements(ecole_id);
create index on paiements(facture_id);

-- =====================================================================
--  DOMAINE 9 — COMPTABILITÉ
-- =====================================================================

create table comptes (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  numero      text,
  libelle     text not null,
  type        text,                            -- 'produit', 'charge', 'tresorerie'...
  created_at  timestamptz not null default now()
);
create index on comptes(ecole_id);

create table depenses (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  compte_id   uuid references comptes(id) on delete set null,
  libelle     text not null,
  montant     numeric(12,2) not null,
  mode        mode_paiement,
  date_depense date not null default current_date,
  beneficiaire text,
  justificatif_url text,
  saisi_par   uuid references profils(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on depenses(ecole_id);

create table ecritures (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  compte_id   uuid references comptes(id) on delete set null,
  libelle     text,
  debit       numeric(12,2) not null default 0,
  credit      numeric(12,2) not null default 0,
  date_ecriture date not null default current_date,
  reference   text
);
create index on ecritures(ecole_id);

-- =====================================================================
--  DOMAINE 10 — RESSOURCES HUMAINES
-- =====================================================================

create table personnels (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  profil_id   uuid references profils(id) on delete set null,
  prenom      text not null,
  nom         text not null,
  fonction    text,                            -- 'enseignant', 'surveillant', 'compta'...
  telephone   text,
  email       text,
  date_embauche date,
  created_at  timestamptz not null default now()
);
create index on personnels(ecole_id);

create table contrats (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  personnel_id uuid not null references personnels(id) on delete cascade,
  type        text,                            -- CDI / CDD / vacation
  salaire_base numeric(12,2),
  debut       date,
  fin         date,
  created_at  timestamptz not null default now()
);
create index on contrats(ecole_id);

create table salaires (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  personnel_id uuid not null references personnels(id) on delete cascade,
  periode     text,                            -- '2026-01'
  montant_brut numeric(12,2),
  montant_net  numeric(12,2),
  paye        boolean not null default false,
  date_paiement date,
  created_at  timestamptz not null default now()
);
create index on salaires(ecole_id);

-- =====================================================================
--  DOMAINE 11 — COMMUNICATION & SYSTÈME
-- =====================================================================

create table annonces (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  titre       text not null,
  contenu     text,
  cible       text,                            -- 'tous', 'parents', 'enseignants', 'classe'
  classe_id   uuid references classes(id) on delete cascade,
  publie_le   timestamptz not null default now(),
  auteur_id   uuid references profils(id) on delete set null
);
create index on annonces(ecole_id);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  destinataire_id uuid references profils(id) on delete cascade,
  titre       text,
  message     text,
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on notifications(ecole_id);
create index on notifications(destinataire_id);

create table parametres (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  cle         text not null,
  valeur      jsonb,
  unique (ecole_id, cle)
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid references ecoles(id) on delete set null,
  profil_id   uuid references profils(id) on delete set null,
  action      text not null,
  entite      text,
  entite_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log(ecole_id);

-- =====================================================================
--  FONCTIONS UTILITAIRES (contexte tenant pour RLS)
-- =====================================================================

-- École de l'utilisateur connecté (depuis son profil)
create or replace function ecole_courante()
returns uuid language sql stable security definer set search_path = public as $$
  select ecole_id from profils where id = auth.uid()
$$;

-- L'utilisateur a-t-il un rôle donné ?
create or replace function a_role(p_role role_systeme)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profil_roles
    where profil_id = auth.uid() and role = p_role
  )
$$;

create or replace function est_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select a_role('super_admin')
$$;

-- =====================================================================
--  TRIGGERS — cohérence financière (montant_paye + statut facture)
-- =====================================================================

create or replace function recalc_facture() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_facture uuid := coalesce(new.facture_id, old.facture_id);
  v_total numeric(12,2);
  v_paye  numeric(12,2);
  v_echeance date;
begin
  select montant_total, date_echeance into v_total, v_echeance
  from factures where id = v_facture;

  select coalesce(sum(montant),0) into v_paye
  from paiements where facture_id = v_facture;

  update factures set
    montant_paye = v_paye,
    statut = case
      when v_paye <= 0 and v_echeance is not null and v_echeance < current_date then 'en_retard'
      when v_paye <= 0 then 'emise'
      when v_paye >= v_total then 'payee'
      else 'partiellement_payee'
    end
  where id = v_facture;
  return null;
end;
$$;

create trigger trg_paiement_recalc
  after insert or update or delete on paiements
  for each row execute function recalc_facture();

-- =====================================================================
--  ROW LEVEL SECURITY
--  Stratégie : tout est isolé par ecole_courante(), super_admin passe.
-- =====================================================================

-- Active RLS + policy standard sur toutes les tables tenant (ecole_id).
do $$
declare t text;
  tenant_tables text[] := array[
    'abonnements','profils','profil_roles','annees_scolaires','periodes',
    'cycles','niveaux','classes','matieres','eleves','tuteurs','eleve_tuteurs',
    'inscriptions','documents_eleve','enseignants','affectations','emplois_du_temps',
    'evaluations','notes','bulletins','bulletin_lignes','absences','incidents',
    'frais','factures','facture_lignes','paiements','comptes','depenses','ecritures',
    'personnels','contrats','salaires','annonces','notifications','parametres','audit_log'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security;', t);
    -- Lecture/écriture limitées à l'école courante (ou super_admin)
    execute format($f$
      create policy %1$s_tenant on %1$I
      using (est_super_admin() or ecole_id = ecole_courante())
      with check (est_super_admin() or ecole_id = ecole_courante());
    $f$, t);
  end loop;
end $$;

-- Cas particulier : profils.ecole_id peut être null (super_admin) ;
-- un utilisateur peut toujours lire/éditer SON propre profil.
create policy profils_self on profils
  using (id = auth.uid())
  with check (id = auth.uid());

-- Catalogue global (lecture par tous les authentifiés, écriture super_admin)
alter table plans_abonnement enable row level security;
create policy plans_lecture on plans_abonnement for select using (auth.role() = 'authenticated');
create policy plans_admin   on plans_abonnement for all
  using (est_super_admin()) with check (est_super_admin());

-- Table ecoles : un membre voit son école ; super_admin voit tout ;
-- création d'école = onboarding (gérée via fonction SECURITY DEFINER côté app).
alter table ecoles enable row level security;
create policy ecoles_membre on ecoles for select
  using (est_super_admin() or id = ecole_courante());
create policy ecoles_admin on ecoles for update
  using (est_super_admin() or (id = ecole_courante() and a_role('admin_ecole')))
  with check (est_super_admin() or id = ecole_courante());

-- =====================================================================
--  FIN DU SCHÉMA
--  Récap : 38 tables tenant + ecoles + plans_abonnement ≈ 40+ relations,
--  réparties sur 11 domaines. RLS active partout, isolation par ecole_id.
-- =====================================================================
