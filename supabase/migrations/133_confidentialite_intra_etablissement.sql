-- =====================================================================
--  133 — PHASE 0 de l'audit : confidentialité À L'INTÉRIEUR d'un établissement
--
--  Constat mesuré avec un vrai compte `enseignant` d'UCAD, sans aucun droit
--  d'interface sur les finances : il lisait par simple appel REST
--     factures · facture_lignes · paiements · declarations_paiement · messages
--  L'interface masquait ; la base autorisait. Une faille « sécurisée en
--  apparence » : il suffit d'un jeton valide et d'un client HTTP.
--
--  Cause : la migration 001 pose sur 37 tables une policy unique
--  `<table>_tenant` qui ne contrôle QUE l'établissement, pas le rôle. Des
--  migrations ultérieures ont durci la comptabilité et la paie (depenses,
--  ecritures, comptes, salaires, personnels, contrats, conges — vérifiés
--  refusés à l'enseignant). La facturation et la messagerie ont été oubliées.
--
--  Ce correctif applique le MÊME patron aux tables restantes.
--
--  ⚠️ Ce qui N'EST PAS touché, volontairement :
--   • `tuteurs` : l'enseignant y accède depuis la fiche de l'élève
--     (`eleves.js`) et peut légitimement devoir joindre une famille.
--     Restreindre casserait la fiche élève pour les enseignants et les
--     surveillants. Accès assumé, pas oublié.
--   • Les espaces parent et étudiant : ils passent par des RPC
--     SECURITY DEFINER (`enfant_factures`, `mes_factures`, …) qui
--     contournent la RLS. Aucun impact.
--
--  Prérequis : migrations 001 et 047.
-- =====================================================================

-- --- Purge puis repose des policies ---------------------------------------
--  On supprime DYNAMIQUEMENT toute policy existante sur ces tables plutôt
--  que par nom : celles de `factures`/`paiements` viennent d'une boucle
--  `execute format` (migration 001) et celle de `declarations_paiement`
--  d'une migration jamais versionnée (cf. en-tête de la 047). Deviner un nom
--  qui n'existe pas laisserait l'ancienne policy EN PLACE — et deux policies
--  permissives s'additionnent : le durcissement serait sans effet.
--
--  Rôles retenus = ceux qui ont la page dans `ACCES`, plus le promoteur.
--  `direction` est exclue des finances comme dans l'interface, incluse dans
--  la messagerie comme dans l'interface.
do $$
declare
  t    text;
  pol  record;
  roles_finance constant text :=
    '(est_admin() or a_role(''comptable'') or a_role(''secretaire''))';
  roles_messagerie constant text :=
    '(est_admin() or a_role(''direction'') or a_role(''comptable'') or a_role(''secretaire''))';
  cond text;
begin
  foreach t in array array['factures', 'facture_lignes', 'paiements',
                           'declarations_paiement', 'messages']
  loop
    -- La table peut ne pas exister sur une base partielle : on passe.
    if to_regclass('public.' || t) is null then
      raise notice 'Table % absente, ignorée.', t;
      continue;
    end if;

    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I;', pol.policyname, t);
      raise notice 'Policy supprimée : %.%', t, pol.policyname;
    end loop;

    cond := format(
      'est_super_admin() or (ecole_id = ecole_courante() and %s)',
      case when t = 'messages' then roles_messagerie else roles_finance end);

    execute format(
      'create policy %1$s_gestion on public.%1$I for all using (%2$s) with check (%2$s);',
      t, cond);
    raise notice 'Policy posée : %_gestion', t;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE — à relancer après application, avec un compte `enseignant` :
--  les cinq tables doivent renvoyer 0 ligne, et les pages Paiements /
--  Recouvrement / Comptabilité doivent rester fonctionnelles pour le
--  comptable et le secrétariat.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['factures','facture_lignes','paiements'] loop
--     execute format('drop policy if exists %I_gestion on %I;', t, t);
--     execute format($p$create policy %1$s_tenant on %1$I
--       using (est_super_admin() or ecole_id = ecole_courante())
--       with check (est_super_admin() or ecole_id = ecole_courante());$p$, t);
--   end loop;
-- end $$;
-- drop policy if exists declarations_paiement_gestion on declarations_paiement;
-- drop policy if exists messages_gestion on messages;
-- create policy messages_tenant on messages
--   using (est_super_admin() or ecole_id = ecole_courante())
--   with check (est_super_admin() or ecole_id = ecole_courante());
