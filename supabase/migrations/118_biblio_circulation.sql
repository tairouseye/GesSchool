-- =====================================================================
--  118 — Bibliothèque : CIRCULATION (prêts, retours, réservations, règles)
--
--  Décision structurante — IDENTITÉ DE L'EMPRUNTEUR :
--  un étudiant peut emprunter au guichet SANS avoir activé son compte.
--  L'emprunteur est donc soit un `profils` (compte actif : enseignant,
--  personnel, étudiant lié), soit un `eleves` (étudiant sans compte) :
--  au moins l'un des deux est renseigné (contrainte CHECK).
--  Sans cela, la circulation serait bloquée par l'activation des comptes.
--
--  Intégrité : un trigger tient `biblio_exemplaires.statut` synchronisé avec
--  les prêts (emprunté / disponible) — la vérité est en base, pas dans l'UI.
--
--  Prérequis : migrations 115, 116, 117.
-- =====================================================================

-- --- Helper de gestion bibliothèque (évite de répéter le prédicat) ---------
create or replace function public._biblio_gestion(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin()
      or (p_ecole is not null and p_ecole = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('bibliothecaire')));
$$;
grant execute on function public._biblio_gestion(uuid) to authenticated;

-- --- Règles de prêt, configurables PAR RÔLE --------------------------------
--  Volontairement une TABLE et non `parametres` : `_peut_ecrire_parametre`
--  (057) renvoie `false` pour toute clé inconnue → un bibliothécaire ne
--  pourrait pas éditer ces règles.
create table if not exists biblio_regles_pret (
  id                 uuid primary key default gen_random_uuid(),
  ecole_id           uuid not null references ecoles(id) on delete cascade,
  role               text not null,                     -- etudiant | enseignant | chercheur | personnel …
  max_emprunts       integer not null default 3,
  duree_jours        integer not null default 14,
  renouvellements_max integer not null default 1,
  penalite_jour      numeric(12,2) not null default 0,
  penalites_actives  boolean not null default false,
  actif              boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (ecole_id, role)
);
create index if not exists biblio_regles_pret_ecole_idx on biblio_regles_pret(ecole_id, actif);

-- --- Emprunts ---------------------------------------------------------------
create table if not exists biblio_emprunts (
  id                   uuid primary key default gen_random_uuid(),
  ecole_id             uuid not null references ecoles(id) on delete cascade,
  exemplaire_id        uuid not null references biblio_exemplaires(id) on delete cascade,
  emprunteur_profil_id uuid references profils(id) on delete set null,
  emprunteur_eleve_id  uuid references eleves(id) on delete set null,
  date_emprunt         date not null default current_date,
  date_echeance        date not null,
  date_retour          date,
  renouvellements      integer not null default 0,
  statut               text not null default 'en_cours'
                       check (statut in ('en_cours','rendu','retard','perdu')),
  agent_profil_id      uuid references profils(id) on delete set null,  -- qui a prêté/repris
  note                 text,
  created_at           timestamptz not null default now(),
  constraint biblio_emprunts_emprunteur_chk
    check (emprunteur_profil_id is not null or emprunteur_eleve_id is not null)
);
create index if not exists biblio_emprunts_ecole_idx on biblio_emprunts(ecole_id, statut);
create index if not exists biblio_emprunts_exemplaire_idx on biblio_emprunts(exemplaire_id);
create index if not exists biblio_emprunts_profil_idx on biblio_emprunts(emprunteur_profil_id);
create index if not exists biblio_emprunts_eleve_idx on biblio_emprunts(emprunteur_eleve_id);
create index if not exists biblio_emprunts_echeance_idx
  on biblio_emprunts(ecole_id, date_echeance) where statut = 'en_cours';

-- --- Réservations (file d'attente) -----------------------------------------
create table if not exists biblio_reservations (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  ressource_id uuid not null references biblio_ressources(id) on delete cascade,
  profil_id    uuid references profils(id) on delete cascade,
  eleve_id     uuid references eleves(id) on delete cascade,
  rang         integer not null default 1,
  statut       text not null default 'active'
               check (statut in ('active','disponible','honoree','expiree','annulee')),
  expire_le    timestamptz,
  created_at   timestamptz not null default now(),
  constraint biblio_reservations_demandeur_chk
    check (profil_id is not null or eleve_id is not null)
);
create index if not exists biblio_reservations_ecole_idx on biblio_reservations(ecole_id, statut);
create index if not exists biblio_reservations_res_idx on biblio_reservations(ressource_id, statut, rang);
create index if not exists biblio_reservations_profil_idx on biblio_reservations(profil_id);

-- --- Favoris (strictement personnels) --------------------------------------
create table if not exists biblio_favoris (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  profil_id    uuid not null references profils(id) on delete cascade,
  ressource_id uuid not null references biblio_ressources(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (profil_id, ressource_id)
);
create index if not exists biblio_favoris_ecole_idx on biblio_favoris(ecole_id);
create index if not exists biblio_favoris_profil_idx on biblio_favoris(profil_id);

-- --- Journal (traçabilité) --------------------------------------------------
create table if not exists biblio_journal (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  profil_id   uuid references profils(id) on delete set null,
  action      text not null,
  cible_type  text,
  cible_id    uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists biblio_journal_ecole_idx on biblio_journal(ecole_id, created_at desc);

-- =====================================================================
--  Intégrité : statut de l'exemplaire piloté par les prêts
-- =====================================================================
create or replace function public.biblio_sync_statut_exemplaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.statut = 'en_cours' then
      update biblio_exemplaires set statut = 'emprunte' where id = new.exemplaire_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.statut in ('rendu') and old.statut <> 'rendu' then
      update biblio_exemplaires set statut = 'disponible' where id = new.exemplaire_id;
    elsif new.statut = 'perdu' then
      update biblio_exemplaires set statut = 'perdu' where id = new.exemplaire_id;
    elsif new.statut = 'en_cours' and old.statut <> 'en_cours' then
      update biblio_exemplaires set statut = 'emprunte' where id = new.exemplaire_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_biblio_statut_exemplaire on biblio_emprunts;
create trigger trg_biblio_statut_exemplaire
  after insert or update on biblio_emprunts
  for each row execute function public.biblio_sync_statut_exemplaire();

-- =====================================================================
--  RLS
-- =====================================================================
alter table biblio_regles_pret  enable row level security;
alter table biblio_emprunts     enable row level security;
alter table biblio_reservations enable row level security;
alter table biblio_favoris      enable row level security;
alter table biblio_journal      enable row level security;

-- Règles de prêt : lisibles par tout membre (l'usager voit son quota).
drop policy if exists biblio_regles_pret_select on biblio_regles_pret;
create policy biblio_regles_pret_select on biblio_regles_pret for select
  using (est_super_admin() or est_membre_ecole(ecole_id));
drop policy if exists biblio_regles_pret_ecrire on biblio_regles_pret;
create policy biblio_regles_pret_ecrire on biblio_regles_pret for all
  using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));

-- Emprunts : la gestion voit tout ; l'usager voit UNIQUEMENT les siens
-- (compte lié OU fiche élève rattachée à son compte).
drop policy if exists biblio_emprunts_select on biblio_emprunts;
create policy biblio_emprunts_select on biblio_emprunts for select using (
  _biblio_gestion(ecole_id)
  or emprunteur_profil_id = auth.uid()
  or exists (select 1 from eleves e where e.id = emprunteur_eleve_id and e.profil_id = auth.uid())
);
drop policy if exists biblio_emprunts_ecrire on biblio_emprunts;
create policy biblio_emprunts_ecrire on biblio_emprunts for all
  using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));

-- Réservations : la gestion gère ; l'usager crée/annule les siennes.
drop policy if exists biblio_reservations_select on biblio_reservations;
create policy biblio_reservations_select on biblio_reservations for select using (
  _biblio_gestion(ecole_id)
  or profil_id = auth.uid()
  or exists (select 1 from eleves e where e.id = eleve_id and e.profil_id = auth.uid())
);
drop policy if exists biblio_reservations_insert on biblio_reservations;
create policy biblio_reservations_insert on biblio_reservations for insert with check (
  _biblio_gestion(ecole_id)
  or (est_membre_ecole(ecole_id) and profil_id = auth.uid())
);
drop policy if exists biblio_reservations_update on biblio_reservations;
create policy biblio_reservations_update on biblio_reservations for update
  using (_biblio_gestion(ecole_id) or profil_id = auth.uid())
  with check (_biblio_gestion(ecole_id) or profil_id = auth.uid());
drop policy if exists biblio_reservations_delete on biblio_reservations;
create policy biblio_reservations_delete on biblio_reservations for delete
  using (_biblio_gestion(ecole_id) or profil_id = auth.uid());

-- Favoris : strictement personnels.
drop policy if exists biblio_favoris_self on biblio_favoris;
create policy biblio_favoris_self on biblio_favoris for all
  using (profil_id = auth.uid())
  with check (profil_id = auth.uid() and est_membre_ecole(ecole_id));

-- Journal : lecture gestion ; écriture par tout membre (traçabilité), jamais de modification.
drop policy if exists biblio_journal_select on biblio_journal;
create policy biblio_journal_select on biblio_journal for select
  using (_biblio_gestion(ecole_id));
drop policy if exists biblio_journal_insert on biblio_journal;
create policy biblio_journal_insert on biblio_journal for insert
  with check (est_membre_ecole(ecole_id));

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists trg_biblio_statut_exemplaire on biblio_emprunts;
-- drop function if exists public.biblio_sync_statut_exemplaire();
-- drop table if exists biblio_journal, biblio_favoris, biblio_reservations,
--   biblio_emprunts, biblio_regles_pret cascade;
-- drop function if exists public._biblio_gestion(uuid);
