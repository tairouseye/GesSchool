-- =====================================================================
--  178 — Deuxième domaine basculé sur les cases : Cantine et Transport
--
--  Suite de la migration 177. Même règle, rappelée parce qu'elle est la
--  seule qui compte : on REMPLACE `a_role('x')` par `a_acces('clé')`, on
--  ne met pas les deux côte à côte. Garder le rôle ferait que décocher la
--  case masquerait l'écran pendant que la base continuerait d'autoriser —
--  le défaut corrigé par la migration 173 et par les lots 1 et 2 de
--  l'audit.
--
--  ⚠️ DEUX CASES, PAS UNE. `cantine` et `transport` sont deux cases
--  distinctes (`src/lib/acces.js`), et deux domaines distincts ici : une
--  école peut avoir un bus sans cantine. Ne pas les fusionner sous
--  prétexte qu'elles vivent dans le même groupe de menu « Services ».
--
--  ÉTAT VÉRIFIÉ AVANT D'ÉCRIRE (ce qui rend ce domaine sûr) :
--    - les 7 tables portent UNE policy chacune, identique, `for all` :
--      `est_admin() or a_role('comptable') or a_role('secretaire')` ;
--    - `ACCES.cantine` et `ACCES.transport` valent exactement
--      `["comptable","secretaire"]` : la bascule ne déplace aucun droit ;
--    - 4 fonctions seulement touchent ces tables (`enfant_cantine`,
--      `enfant_cantine_menu`, `enfant_transport`, `transport_notifier`),
--      toutes `security definer`, toutes gardées, AUCUNE accordée à
--      PUBLIC. Contrairement à la 174 (`absences_periode`) et à la 177
--      (`poster_salaire_*`), ce domaine ne cachait pas de porte ouverte ;
--    - aucun autre domaine ne lit ces tables. `facturerAbonnements`
--      ([src/lib/paiements.js]) reçoit les lignes en PARAMÈTRE : elle
--      n'ouvre jamais `cantine_abonnements`. Donc pas d'exception à
--      traiter comme `comptes` à la migration 177.
--
--  ⚠️ LE CHEMIN DES FAMILLES NE PASSE PAS PAR CES POLICIES. Les parents
--  lisent l'abonnement de leur enfant par `enfant_cantine`,
--  `enfant_cantine_menu` et `enfant_transport` — `security definer`,
--  gardées par `_parent_possede()`. Elles contournent la RLS par
--  construction : resserrer les policies ci-dessous ne leur retire rien.
--  C'est volontaire et il faut le savoir avant de « corriger » l'absence
--  de policy parent.
--
--  🔖 À RETENIR POUR L'ÉTAPE 2 (l'arbre à cocher) : les cases `cantine` et
--  `transport` sont COUPLÉES à `encaissement`. Le bouton « Facturer » de
--  ces deux écrans écrit dans `factures` et `facture_lignes`, qui
--  resteront gardées par `encaissement`. Aujourd'hui c'est sans effet —
--  les deux modèles qui ont `cantine` ont aussi `encaissement` — mais le
--  jour où le promoteur pourra décocher case par case, décocher
--  `encaissement` en gardant `cantine` donnera un bouton qui échoue.
--  À traiter dans l'arbre (dépendance affichée), pas ici.
-- =====================================================================

-- --- 1. Les trois tables de la cantine --------------------------------
do $$
declare t text;
begin
  foreach t in array array['cantine_abonnements', 'cantine_repas', 'cantine_menus'] loop
    execute format('drop policy if exists %1$s_gestion on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('cantine')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('cantine')));$p$, t);
  end loop;
end $$;

-- --- 2. Les quatre tables du transport --------------------------------
do $$
declare t text;
begin
  foreach t in array array['transport_circuits', 'transport_arrets',
                           'transport_abonnements', 'transport_pointages'] loop
    execute format('drop policy if exists %1$s_gestion on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('transport')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('transport')));$p$, t);
  end loop;
end $$;

-- --- 3. La seule RPC du domaine ---------------------------------------
--
--  `transport_notifier` prévient les parents que l'enfant est monté dans
--  le bus. Sa garde est substituée SANS retoucher le corps, et le bloc
--  ÉCHOUE bruyamment si la garde attendue n'est pas trouvée — plutôt que
--  de laisser passer une fonction qu'on croirait basculée. C'est le patron
--  de la migration 177.
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'transport_notifier';
  if v_def is null then
    raise exception 'transport_notifier introuvable : ne pas basculer à l''aveugle.';
  end if;
  v_new := replace(v_def,
    'est_admin() or a_role(''comptable'') or a_role(''secretaire'')',
    'a_acces(''transport'')');
  if v_new = v_def then
    raise exception 'Garde attendue introuvable dans transport_notifier.';
  end if;
  execute v_new;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['cantine_abonnements','cantine_repas','cantine_menus',
--                            'transport_circuits','transport_arrets',
--                            'transport_abonnements','transport_pointages'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_gestion on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante()
--              and (est_admin() or a_role('comptable') or a_role('secretaire'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante()
--              and (est_admin() or a_role('comptable') or a_role('secretaire'))));$p$, t);
--   end loop; end $$;
-- -- puis rétablir la garde de transport_notifier en remplaçant
-- -- a_acces('transport') par est_admin() or a_role('comptable') or a_role('secretaire').
-- notify pgrst, 'reload schema';
