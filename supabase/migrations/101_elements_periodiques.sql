-- =====================================================================
--  101 — RH & PAIE (P4 audit) : éléments périodiques
--  Un élément peut être mensuel (défaut, comportement actuel) ou périodique
--  (trimestriel / semestriel / annuel) : il ne se déclenche que sur ses mois.
--  Anti-double naturel : une seule fiche par mois, l'élément ne figure que
--  sur ses mois de déclenchement (ex. prime trimestrielle en 3/6/9/12).
--  `mois_declenchement` (optionnel) surcharge les mois par défaut.
--  Non destructif : les éléments existants restent 'mensuel'.
-- =====================================================================

alter table elements_paie
  add column if not exists periodicite text not null default 'mensuel'
    check (periodicite in ('mensuel','trimestriel','semestriel','annuel','ponctuel'));
alter table elements_paie
  add column if not exists mois_declenchement int[];

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table elements_paie drop column if exists mois_declenchement;
-- alter table elements_paie drop column if exists periodicite;
