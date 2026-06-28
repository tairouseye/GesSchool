-- =====================================================================
--  GesSchool — Vérifications de sécurité pour les migrations 016-018
--  À exécuter dans le SQL Editor Supabase (projet GeScola).
--  Ce fichier n'est PAS une migration : c'est un outil de contrôle.
--  Exécute chaque SECTION séparément (sélectionne le bloc puis « Run »).
-- =====================================================================


-- =====================================================================
--  SECTION 1 — AVANT d'appliquer 017
--  Inspecte les RPC admin_* déjà en prod. Compare leur corps à celui
--  de 017_console_superadmin.sql AVANT de l'appliquer (create or replace
--  écrasera l'existant). La colonne `a_la_garde` doit idéalement être true.
-- =====================================================================
select
  p.proname                                          as fonction,
  pg_get_function_identity_arguments(p.oid)          as arguments,
  (pg_get_functiondef(p.oid) ilike '%est_super_admin()%') as a_la_garde
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_ecoles','admin_set_abonnement',
                    'admin_set_statut','admin_set_modules')
order by p.proname;
-- (0 ligne = les RPC n'existent pas encore → 017 les créera proprement.)
-- Pour voir le corps complet d'une fonction existante :
--   select pg_get_functiondef('public.admin_ecoles'::regproc);


-- =====================================================================
--  SECTION 2 — APRÈS avoir appliqué 016 + 017 + 018
--  Vérifications STATIQUES (zéro risque, aucune donnée modifiée).
-- =====================================================================

-- 2.a — La colonne modules_actifs existe bien (migration 016)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'ecoles'
  and column_name = 'modules_actifs';

-- 2.b — Les RPC admin_* sont bien gardées par est_super_admin() (017)
select p.proname,
       (pg_get_functiondef(p.oid) ilike '%est_super_admin()%') as a_la_garde
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_ecoles','admin_set_abonnement',
                    'admin_set_statut','admin_set_modules')
order by p.proname;   -- les 4 lignes doivent afficher a_la_garde = true

-- 2.c — RLS par rôle en place (018) : chaque table sensible doit avoir
--       un SELECT large + des écritures (INSERT/UPDATE/DELETE) qui
--       contiennent le contrôle de rôle (a_role / est_gestion).
select
  tablename,
  cmd,
  policyname,
  coalesce(with_check, qual) as predicat_ecriture
from pg_policies
where schemaname = 'public'
  and tablename in (
    'paiements','factures','facture_lignes','frais',
    'evaluations','notes','bulletins','bulletin_lignes',
    'eleves','inscriptions','eleve_tuteurs','tuteurs','documents_eleve',
    'absences','incidents')
order by tablename, cmd;
-- Attendu pour chaque table : 1 policy SELECT (predicat large) + 3 policies
-- INSERT/UPDATE/DELETE dont le prédicat mentionne a_role(...) / est_gestion().
-- ⚠️ Si une table garde encore une policy nommée «<table>_tenant», c'est que
--    018 n'a pas été appliqué sur elle → relancer la migration.


-- =====================================================================
--  SECTION 3 — Test FONCTIONNEL du RLS (optionnel, avancé)
--  Simule un enseignant qui tente d'enregistrer un PAIEMENT : doit être
--  REFUSÉ par le RLS après 018 (avant 018 : c'était autorisé = la faille).
--
--  Tout est encapsulé dans une transaction annulée (ROLLBACK) : AUCUNE
--  donnée n'est modifiée. Sélectionne et exécute TOUT le bloc d'un coup.
-- =====================================================================
begin;
do $$
declare
  v_uid     uuid;
  v_facture uuid;
  v_ecole   uuid;
begin
  -- 1) Choisit un enseignant "pur" (sans rôle élevé) rattaché à une école
  --    qui possède au moins une facture, + cette facture.
  select pr.profil_id, f.id, f.ecole_id
    into v_uid, v_facture, v_ecole
  from profil_roles pr
  join factures f on f.ecole_id = pr.ecole_id
  where pr.role = 'enseignant'
    and not exists (
      select 1 from profil_roles g
      where g.profil_id = pr.profil_id
        and g.role in ('admin_ecole','direction','comptable','super_admin'))
  limit 1;

  if v_uid is null then
    raise notice 'TEST IGNORÉ : aucun enseignant "pur" avec une facture dans son école (pas assez de données).';
    return;
  end if;

  -- 2) Endosse l'identité de cet enseignant (claim JWT + rôle Postgres)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 3) Tentative d'écriture interdite : le RLS (018) doit la refuser.
  begin
    insert into paiements (ecole_id, facture_id, montant, mode)
    values (v_ecole, v_facture, 100, 'especes'::mode_paiement);
    -- On n'arrive ici que si l'insert a RÉUSSI = RLS non appliqué = PROBLÈME.
    raise warning '❌ ÉCHEC : un enseignant a pu créer un paiement (RLS par rôle absent sur paiements).';
  exception
    when insufficient_privilege then
      raise notice '✅ OK : paiement REFUSÉ à l''enseignant (RLS par rôle actif).';
  end;

  execute 'reset role';
end $$;
rollback;   -- aucune donnée modifiée, quoi qu'il arrive
