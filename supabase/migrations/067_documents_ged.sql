-- =====================================================================
--  067 — GED : généralisation de la table `documents` (archivage multi-familles)
--
--  La table `documents` (039) ne stockait que les certificats/attestations
--  (centrés élève, avec workflow de validation). On la généralise pour
--  archiver TOUT document généré par l'école (factures, reçus, bulletins,
--  paie…), classé par famille et cible, avec un instantané de données
--  (voie A) pour ré-affichage à l'identique.
--
--  L'archivage côté app est BEST-EFFORT : tant que cette migration n'est pas
--  passée, les inserts d'archivage échouent en silence sans bloquer la
--  création des factures/paiements. Une fois passée, l'archivage se remplit.
-- =====================================================================

alter table documents
  add column if not exists famille       text,          -- scolarite | pedagogie | finances | rh
  add column if not exists cible_type    text,          -- eleve | personnel | classe | ecole
  add column if not exists cible_id      uuid,          -- réf. polymorphe (pas de FK)
  add column if not exists cible_libelle text,          -- libellé lisible (affichage sans jointure)
  add column if not exists annee_id      uuid references annees_scolaires(id) on delete set null,
  add column if not exists periode_id    uuid references periodes(id) on delete set null,
  add column if not exists montant       numeric,       -- pour les documents financiers
  add column if not exists donnees       jsonb;         -- instantané (voie A)

-- Élargir le statut aux documents archivés (non soumis à validation).
alter table documents drop constraint if exists documents_statut_check;
alter table documents add constraint documents_statut_check
  check (statut in ('en_attente','valide','rejete','archive','genere'));

-- Familles des documents existants (certificats/attestations = Scolarité).
update documents set famille = 'scolarite' where famille is null;

create index if not exists documents_ecole_famille_idx on documents(ecole_id, famille, created_at desc);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table documents drop constraint if exists documents_statut_check;
-- alter table documents add constraint documents_statut_check
--   check (statut in ('en_attente','valide','rejete'));
-- alter table documents
--   drop column if exists famille, drop column if exists cible_type,
--   drop column if exists cible_id, drop column if exists cible_libelle,
--   drop column if exists annee_id, drop column if exists periode_id,
--   drop column if exists montant, drop column if exists donnees;
-- drop index if exists documents_ecole_famille_idx;
