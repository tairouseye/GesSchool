-- =====================================================================
--  087 — Diagnostic santé : vérifie la présence des objets clés (paie/compta)
--  Utile pour repérer une régression (ex. migration perdue après une
--  pause/restauration du projet). Renvoie un jsonb de contrôles.
--  Réservé au promoteur / super-admin / RH.
-- =====================================================================

create or replace function diagnostic_sante()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'tables', jsonb_build_object(
      'salaire_lignes',           to_regclass('public.salaire_lignes') is not null,
      'cotisations_paie',         to_regclass('public.cotisations_paie') is not null,
      'bareme_ir',                to_regclass('public.bareme_ir') is not null,
      'journal_audit',            to_regclass('public.journal_audit') is not null,
      'elements_paie',            to_regclass('public.elements_paie') is not null,
      'personnel_elements_paie',  to_regclass('public.personnel_elements_paie') is not null,
      'categories_finance',       to_regclass('public.categories_finance') is not null
    ),
    'colonnes', jsonb_build_object(
      'salaires.statut',          exists(select 1 from information_schema.columns where table_schema='public' and table_name='salaires'      and column_name='statut'),
      'personnels.taux_horaire',  exists(select 1 from information_schema.columns where table_schema='public' and table_name='personnels'    and column_name='taux_horaire'),
      'personnels.part_ir',       exists(select 1 from information_schema.columns where table_schema='public' and table_name='personnels'    and column_name='part_ir'),
      'salaire_lignes.nature',    exists(select 1 from information_schema.columns where table_schema='public' and table_name='salaire_lignes' and column_name='nature'),
      'salaire_lignes.base',      exists(select 1 from information_schema.columns where table_schema='public' and table_name='salaire_lignes' and column_name='base'),
      'elements_paie.soumis',     exists(select 1 from information_schema.columns where table_schema='public' and table_name='elements_paie'  and column_name='soumis'),
      'paiements.compte_id',      exists(select 1 from information_schema.columns where table_schema='public' and table_name='paiements'      and column_name='compte_id')
    ),
    'fonctions', jsonb_build_object(
      'payer_salaire',    to_regprocedure('payer_salaire(uuid,date,mode_paiement,uuid)') is not null,
      'valider_salaire',  to_regprocedure('valider_salaire(uuid)') is not null,
      'devalider_salaire',to_regprocedure('devalider_salaire(uuid,text)') is not null,
      'annuler_salaire',  to_regprocedure('annuler_salaire(uuid)') is not null,
      'recalc_salaire',   to_regprocedure('recalc_salaire(uuid)') is not null,
      'remplacer_bareme', to_regprocedure('remplacer_bareme(uuid,text,jsonb)') is not null,
      'dettes_personnel', to_regprocedure('dettes_personnel(uuid)') is not null,
      'soldes_comptes',   to_regprocedure('soldes_comptes(uuid)') is not null
    ),
    'triggers', jsonb_build_object(
      'salaire_lignes_recalc', exists(select 1 from pg_trigger where tgname = 'salaire_lignes_recalc'),
      'salaire_lignes_lock',   exists(select 1 from pg_trigger where tgname = 'salaire_lignes_lock')
    )
  )
  where est_super_admin() or est_admin() or a_role('rh');
$$;

grant execute on function diagnostic_sante() to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists diagnostic_sante();
