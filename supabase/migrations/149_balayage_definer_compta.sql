-- =====================================================================
--  149 — Balayage : les helpers de comptabilité et de paie étaient eux
--        aussi appelables par tout compte connecté
--
--  Suite de la migration 148. Plutôt que de continuer à découvrir ces trous
--  un par un, balayage de TOUT le schéma :
--
--   1. recensement des 169 fonctions `SECURITY DEFINER` du dépôt ;
--   2. exclusion de celles qui portent une garde de rôle en interne ou une
--      révocation explicite de PUBLIC → 31 restent ;
--   3. croisement avec les 148 RPC réellement exposées par PostgREST (une
--      fonction `returns trigger` ne l'est pas) → 19 restent ;
--   4. mise à l'écart des 4 fonctions PUBLIQUES PAR CONCEPTION
--      (`campagne_publique`, `deposer_candidature`, `suivre_candidature`
--      pour le portail d'admission ; `verifier_document` pour le QR) ;
--   5. vérification qu'aucune des restantes n'est appelée depuis `src/`.
--
--  Restent NEUF fonctions internes atteignables par n'importe quel compte
--  connecté — et ce sont les plus sensibles, puisqu'elles écrivent dans la
--  comptabilité :
--
--     _compta_poster, _compta_tresorerie, _annuler_piece_source,
--     _compte_ligne_salaire, poster_facture, poster_paiement,
--     poster_depense ....................... écritures comptables (096, 098)
--     recalc_salaire ....................... moteur de paie (078)
--     prochain_numero_facture .............. séquence de numérotation (071)
--
--  Toutes sont invoquées par des déclencheurs, qui s'exécutent avec les
--  droits du PROPRIÉTAIRE : la révocation ne les gêne pas.
--
--  ⚠️ `prochain_matricule` est VOLONTAIREMENT laissée exposée : l'interface
--  l'appelle (`academique.js`) pour proposer un matricule à la création d'un
--  élève. Elle se limite d'elle-même à `ecole_courante()` — nulle pour un
--  parent, qui échoue donc déjà. Le seul abus possible serait qu'un membre
--  du personnel consomme un numéro de SA propre école : sans conséquence.
--
--  ⚠️ MÉTHODE : la révocation est DYNAMIQUE, par lecture de `pg_proc`.
--  Écrire `revoke execute on function f(uuid, text)` exige la signature
--  exacte, et une seule erreur fait échouer la migration. En extrayant les
--  neuf signatures des fichiers d'origine, SIX différaient de ce que j'avais
--  d'abord écrit de mémoire. Le dépôt lui-même peut avoir dérivé de la base
--  (précédent avéré : `enfant_factures`). On lit donc la vérité dans le
--  catalogue, ce qui couvre aussi d'éventuelles surcharges.
--
--  Prérequis : migrations 071, 078, 096, 098, 148.
-- =====================================================================

do $$
declare
  f record;
  n integer := 0;
begin
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prosecdef                       -- SECURITY DEFINER uniquement
       and p.proname = any (array[
             '_compta_poster', '_compta_tresorerie', '_annuler_piece_source',
             '_compte_ligne_salaire', 'poster_facture', 'poster_paiement',
             'poster_depense', 'recalc_salaire', 'prochain_numero_facture'
           ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated;', f.signature);
    raise notice 'Révoquée : %', f.signature;
    n := n + 1;
  end loop;

  raise notice '% fonction(s) refermée(s).', n;
  if n = 0 then
    raise warning 'Aucune fonction révoquée : vérifiez que les noms correspondent au schéma déployé.';
  end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • avec une session de PARENT, chacune de ces neuf fonctions doit
--     renvoyer 403 « permission denied for function » ;
--   • avec un compte de GESTION, les parcours qui les utilisent
--     INDIRECTEMENT doivent continuer de fonctionner :
--       – encaisser un paiement → l'écriture comptable est bien postée,
--       – créer une facture     → son numéro est bien attribué,
--       – recalculer un bulletin de paie ;
--   • `prochain_matricule` doit RESTER appelable par le personnel
--     (création d'un élève).
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- do $$ declare f record; begin
--   for f in select p.oid::regprocedure as s from pg_proc p
--     join pg_namespace ns on ns.oid = p.pronamespace
--    where ns.nspname = 'public' and p.proname = any (array[
--      '_compta_poster','_compta_tresorerie','_annuler_piece_source',
--      '_compte_ligne_salaire','poster_facture','poster_paiement',
--      'poster_depense','recalc_salaire','prochain_numero_facture'])
--   loop execute format('grant execute on function %s to authenticated;', f.s); end loop;
-- end $$;
--  (déconseillé : c'est l'état qui les rendait appelables par tout compte
--   connecté.)
