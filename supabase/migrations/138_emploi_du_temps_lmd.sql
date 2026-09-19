-- =====================================================================
--  138 — Emploi du temps de l'enseignement supérieur
--
--  `emplois_du_temps` (migration 001) porte `classe_id NOT NULL`. L'université
--  n'a pas de classes : on y planifie par FILIÈRE, SEMESTRE et UE. La table
--  existante est donc inutilisable au supérieur — c'est pourquoi l'entrée de
--  menu y avait été masquée (v2.185.0). Voici le modèle qui manquait.
--
--  Choix de modélisation :
--   • La séance se rattache à une UE, qui porte déjà sa filière et son
--     semestre (migration 108). On les recopie pour pouvoir interroger un
--     emploi du temps sans jointure, mais elles restent cohérentes par
--     construction puisque l'interface les déduit de l'UE choisie.
--   • `type_seance` (CM / TD / TP) : une UE se donne rarement en un seul
--     format, et l'étudiant a besoin de savoir lequel.
--   • `salle` en texte libre, comme `emplois_du_temps`. Une table `salles`
--     existe ; l'y rattacher est une amélioration séparée, pas un prérequis.
--
--  Lecture ouverte à tout membre : un étudiant doit voir son emploi du temps,
--  et `ecole_courante()` est NULL pour lui. Écriture réservée à la direction.
--
--  Prérequis : migrations 108 (LMD) et 116 (est_membre_ecole).
-- =====================================================================

create table if not exists emplois_sup (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  filiere_id    uuid not null references filieres(id) on delete cascade,
  semestre_id   uuid not null references semestres(id) on delete cascade,
  ue_id         uuid references ue(id) on delete set null,
  ecue_id       uuid references ecue(id) on delete set null,
  enseignant_id uuid references enseignants(id) on delete set null,
  annee_id      uuid references annees_scolaires(id) on delete set null,
  type_seance   text not null default 'CM' check (type_seance in ('CM', 'TD', 'TP', 'autre')),
  jour          integer not null check (jour between 1 and 7),   -- 1 = lundi
  heure_debut   time not null,
  heure_fin     time not null,
  salle         text,
  note          text,
  created_at    timestamptz not null default now(),
  -- Une séance qui finit avant de commencer est une faute de saisie, pas une
  -- donnée : on la refuse plutôt que de l'afficher à l'envers.
  constraint emplois_sup_horaire_chk check (heure_fin > heure_debut)
);

create index if not exists emplois_sup_ecole_idx on emplois_sup(ecole_id, semestre_id, jour, heure_debut);
create index if not exists emplois_sup_filiere_idx on emplois_sup(filiere_id, annee_id);
create index if not exists emplois_sup_enseignant_idx on emplois_sup(enseignant_id);

alter table emplois_sup enable row level security;

drop policy if exists emplois_sup_select on emplois_sup;
create policy emplois_sup_select on emplois_sup for select
  using (est_super_admin() or est_membre_ecole(ecole_id));

drop policy if exists emplois_sup_ecrire on emplois_sup;
create policy emplois_sup_ecrire on emplois_sup for all
  using (
    est_super_admin()
    or (ecole_id = ecole_courante() and (est_admin() or a_role('direction')))
  )
  with check (
    est_super_admin()
    or (ecole_id = ecole_courante() and (est_admin() or a_role('direction')))
  );

-- =====================================================================
--  L'emploi du temps DE L'ÉTUDIANT
-- =====================================================================
--  Résolu depuis son inscription active : filière + niveau. Les semestres
--  portent le niveau (L1, M2…), on prend donc toutes les séances des
--  semestres de sa filière à son niveau.
--
--  RPC plutôt que policies : afficher un horaire lisible exige `ue`, `ecue`,
--  `semestres` et `enseignants`, toutes fermées à l'étudiant. Même raison
--  qu'en migration 129 pour les notes.
--
--  L'inscription est testée par `exists` et non par une jointure : un étudiant
--  réinscrit dans la même filière a plusieurs lignes actives, et une jointure
--  afficherait chaque cours autant de fois.
create or replace function public.mon_emploi_sup()
returns table (
  id            uuid,
  jour          integer,
  heure_debut   time,
  heure_fin     time,
  salle         text,
  type_seance   text,
  ue_code       text,
  ue_intitule   text,
  ecue_intitule text,
  enseignant    text,
  semestre      text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.jour, s.heure_debut, s.heure_fin, s.salle, s.type_seance,
         u.code, u.intitule, ec.intitule,
         nullif(trim(coalesce(en.prenom, '') || ' ' || coalesce(en.nom, '')), ''),
         sem.libelle
    from emplois_sup s
    join semestres sem on sem.id = s.semestre_id
    left join ue u    on u.id = s.ue_id
    left join ecue ec on ec.id = s.ecue_id
    left join enseignants en on en.id = s.enseignant_id
   where exists (
           select 1
             from inscriptions_sup i
             join eleves e on e.id = i.eleve_id
            where e.profil_id = auth.uid()
              and i.statut = 'active'
              and i.filiere_id = s.filiere_id
              -- Les semestres portent le niveau (L1, M2…) : on ne montre à
              -- l'étudiant que ceux du sien.
              and (sem.niveau is null or i.niveau is null or sem.niveau = i.niveau)
              -- Une séance non datée vaut pour toute année ; sinon elle doit
              -- correspondre à l'année de l'inscription.
              and (s.annee_id is null or i.annee_id is null or s.annee_id = i.annee_id)
         )
   order by s.jour, s.heure_debut;
$$;

revoke execute on function public.mon_emploi_sup() from public, anon;
grant execute on function public.mon_emploi_sup() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.mon_emploi_sup();
-- drop table if exists emplois_sup cascade;
