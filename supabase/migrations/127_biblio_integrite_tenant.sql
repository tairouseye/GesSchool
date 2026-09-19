-- =====================================================================
--  127 — Bibliothèque : INTÉGRITÉ MULTI-ÉTABLISSEMENT
--
--  Constat d'audit : rien n'imposait qu'une ligne référence une ressource
--  de SA PROPRE école. Les policies contrôlent `ecole_id` — la colonne de la
--  ligne écrite — mais pas l'école de la ligne pointée. Un membre pouvait
--  donc créer une réservation, un favori ou un dépôt portant son `ecole_id`
--  et le `ressource_id` d'un autre établissement.
--
--  Aucune fuite en lecture (les policies de lecture filtrent sur l'école de
--  la ligne lue), mais on pouvait polluer le catalogue d'un tiers — et, via
--  la liaison auteurs, injecter un nom dans SON index de recherche.
--
--  Le remède est la clé étrangère COMPOSITE : on référence (id, ecole_id)
--  plutôt que (id) seul, ce qui rend l'incohérence impossible à écrire.
--
--  ⚠️ Si une donnée incohérente existe déjà, la migration échouera en posant
--  la contrainte. La requête de CONTRÔLE en fin de fichier permet de le
--  vérifier AVANT d'exécuter ce script.
--
--  Prérequis : migrations 117 → 126.
-- =====================================================================

-- --- Clés candidates (id, ecole_id) sur les tables parentes ----------------
--  `id` reste la clé primaire ; on ajoute l'unicité du couple, seule façon
--  de pouvoir le référencer.
alter table biblio_ressources
  add constraint biblio_ressources_id_ecole_uk unique (id, ecole_id);
alter table biblio_exemplaires
  add constraint biblio_exemplaires_id_ecole_uk unique (id, ecole_id);
alter table biblio_auteurs
  add constraint biblio_auteurs_id_ecole_uk unique (id, ecole_id);
alter table biblio_numeriques
  add constraint biblio_numeriques_id_ecole_uk unique (id, ecole_id);
alter table biblio_bibliotheques
  add constraint biblio_bibliotheques_id_ecole_uk unique (id, ecole_id);

-- --- Tables écrites par de simples MEMBRES (surface d'abus réelle) ---------
alter table biblio_reservations
  drop constraint if exists biblio_reservations_ressource_id_fkey,
  add constraint biblio_reservations_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete cascade;

alter table biblio_favoris
  drop constraint if exists biblio_favoris_ressource_id_fkey,
  add constraint biblio_favoris_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete cascade;

alter table biblio_depots
  drop constraint if exists biblio_depots_ressource_id_fkey,
  add constraint biblio_depots_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete set null;

-- --- Cœur du catalogue ----------------------------------------------------
alter table biblio_exemplaires
  drop constraint if exists biblio_exemplaires_ressource_id_fkey,
  add constraint biblio_exemplaires_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete cascade;

--  Liaison auteurs : c'est par elle qu'on pouvait injecter un nom dans
--  l'index de recherche d'un autre établissement (trigger de la 125).
alter table biblio_ressource_auteurs
  drop constraint if exists biblio_ressource_auteurs_ressource_id_fkey,
  add constraint biblio_ressource_auteurs_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete cascade;
alter table biblio_ressource_auteurs
  drop constraint if exists biblio_ressource_auteurs_auteur_id_fkey,
  add constraint biblio_ressource_auteurs_auteur_fk
    foreign key (auteur_id, ecole_id)
    references biblio_auteurs (id, ecole_id) on delete cascade;

alter table biblio_numeriques
  drop constraint if exists biblio_numeriques_ressource_id_fkey,
  add constraint biblio_numeriques_ressource_fk
    foreign key (ressource_id, ecole_id)
    references biblio_ressources (id, ecole_id) on delete cascade;

alter table biblio_acces_regles
  drop constraint if exists biblio_acces_regles_numerique_id_fkey,
  add constraint biblio_acces_regles_numerique_fk
    foreign key (numerique_id, ecole_id)
    references biblio_numeriques (id, ecole_id) on delete cascade;

alter table biblio_emprunts
  drop constraint if exists biblio_emprunts_exemplaire_id_fkey,
  add constraint biblio_emprunts_exemplaire_fk
    foreign key (exemplaire_id, ecole_id)
    references biblio_exemplaires (id, ecole_id) on delete cascade;

alter table biblio_localisations
  drop constraint if exists biblio_localisations_bibliotheque_id_fkey,
  add constraint biblio_localisations_bibliotheque_fk
    foreign key (bibliotheque_id, ecole_id)
    references biblio_bibliotheques (id, ecole_id) on delete cascade;

alter table biblio_inventaire_scans
  drop constraint if exists biblio_inventaire_scans_exemplaire_id_fkey,
  add constraint biblio_inventaire_scans_exemplaire_fk
    foreign key (exemplaire_id, ecole_id)
    references biblio_exemplaires (id, ecole_id) on delete cascade;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE — à exécuter AVANT la migration en cas de doute.
--  Toute ligne renvoyée est une incohérence à corriger d'abord.
-- =====================================================================
-- select 'reservations' t, r.id from biblio_reservations r
--   join biblio_ressources x on x.id = r.ressource_id where x.ecole_id <> r.ecole_id
-- union all select 'favoris', f.id from biblio_favoris f
--   join biblio_ressources x on x.id = f.ressource_id where x.ecole_id <> f.ecole_id
-- union all select 'exemplaires', e.id from biblio_exemplaires e
--   join biblio_ressources x on x.id = e.ressource_id where x.ecole_id <> e.ecole_id
-- union all select 'liaison auteurs', l.id from biblio_ressource_auteurs l
--   join biblio_ressources x on x.id = l.ressource_id where x.ecole_id <> l.ecole_id
-- union all select 'emprunts', m.id from biblio_emprunts m
--   join biblio_exemplaires x on x.id = m.exemplaire_id where x.ecole_id <> m.ecole_id;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- Remplacer chaque contrainte composite par la simple d'origine, p. ex. :
-- alter table biblio_exemplaires drop constraint biblio_exemplaires_ressource_fk,
--   add constraint biblio_exemplaires_ressource_id_fkey
--     foreign key (ressource_id) references biblio_ressources(id) on delete cascade;
-- puis retirer les contraintes *_id_ecole_uk.
