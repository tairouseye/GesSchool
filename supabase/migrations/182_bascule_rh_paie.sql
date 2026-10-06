-- =====================================================================
--  182 — Cinquième domaine : RH & paie
--
--  Le domaine le plus sensible du lot — des salaires nominatifs — et,
--  paradoxalement, le plus homogène : onze tables sur onze portent
--  `est_admin() or a_role('rh')`, soit exactement la case `rh`, que seul le
--  modèle « Responsable RH » détient. Bascule 1 pour 1.
--
--  ⚠️ AUCUN NOUVEAU POUVOIR ICI, et c'est une bonne nouvelle. Les
--  Encaissements en avaient demandé deux parce que la case `encaissement`
--  couvrait deux modèles aux droits inégaux. La case `rh` n'est détenue que
--  par un modèle : il n'y a donc rien à départager.
--
--  ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS, délibérément : séparer « voir les
--  salaires » de « configurer la paie ». Ce serait une décision nouvelle, pas
--  la reproduction d'un droit existant — aujourd'hui la RH fait les deux. À
--  poser si le besoin apparaît, pas en passant.
--
--  ÉTAT VÉRIFIÉ AVANT D'ÉCRIRE :
--    - les 11 tables ont RLS ACTIVÉE et exactement une policy chacune ;
--      aucune n'est ouverte ;
--    - tous les accès directs à ces tables passent par `src/lib/rh.js`, qui
--      n'est importé que par `RH.jsx` (case `rh`) et par
--      `src/lib/organigramme.js` → écran Organigramme, **promoteur-only**
--      (`ROUTES_PROMOTEUR`), donc qui contourne `a_acces` ;
--    - `src/lib/comptabilite.js` ne lit AUCUNE table RH : il n'appelle que la
--      RPC `dettes_personnel`, traitée à part ci-dessous.
-- =====================================================================

-- --- 1. Les neuf tables à garde identique -----------------------------
do $$
declare t text;
begin
  foreach t in array array['personnels', 'contrats', 'salaires', 'salaire_lignes',
                           'elements_paie', 'personnel_elements_paie', 'conges',
                           'absences_rh', 'regimes_paie'] loop
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')));$p$, t);
  end loop;
end $$;

-- --- 2. Les deux tables de CONFIGURATION de la paie -------------------
--
--  ⚠️ CECI RESSERRE UN ACCÈS, et il faut le dire. `bareme_ir` (le barème de
--  l'impôt sur le revenu) et `cotisations_paie` (les taux de cotisation)
--  portaient `est_gestion() or a_role('rh') or a_role('comptable')` — donc
--  la DIRECTION (via `est_gestion()`) et le COMPTABLE pouvaient lire et
--  ÉCRIRE la configuration de la paie.
--
--  VÉRIFIÉ AVANT DE FERMER : aucun écran atteignable par l'un ou par l'autre
--  ne lit ces tables. Leurs seuls lecteurs sont dans `src/lib/rh.js`, et
--  l'espace RH est réservé au modèle `rh` (`ACCES.rh = ["rh"]`). Ni la
--  direction ni le comptable ne peuvent ouvrir cet écran. Ils perdent donc
--  un droit qu'ils n'avaient aucun moyen d'exercer — exactement le cas de
--  `transactions_paiement` à la migration 180.
--
--  Et c'est un droit d'ÉCRITURE : la policy est `for all`. Modifier le
--  barème de l'IR change tous les bulletins de paie suivants.
do $$
declare t text;
begin
  foreach t in array array['bareme_ir', 'cotisations_paie'] loop
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')));$p$, t);
  end loop;
end $$;

-- --- 3. Les gardes des RPC, par paires explicites ---------------------
--
--  ⚠️ LE PIÈGE DE PRÉFIXE, DE NOUVEAU (leçon de la migration 180), et il
--  mord ici deux fois :
--
--   • `est_admin() or a_role('rh')` est contenu dans
--     `est_super_admin() or est_admin() or a_role('rh')` (diagnostic_sante) ;
--   • `remplacer_bareme` et `dettes_personnel` ont la MÊME chaîne de garde
--     mais doivent recevoir des remplacements DIFFÉRENTS.
--
--  Un `replace` global aurait donc produit des gardes à moitié basculées, qui
--  passent sans bruit. D'où une paire (fonction, recherche, remplacement) par
--  entrée, et un bloc qui échoue si l'une ne trouve pas sa chaîne.
--
--  🔴 `dettes_personnel` EST LA SEULE EXCEPTION DU DOMAINE, et elle est
--  réelle : elle est appelée depuis `src/lib/comptabilite.js` — l'écran du
--  comptable, qui affiche la dette envers le personnel. La réduire à
--  `a_acces('rh')` aurait cassé le bilan du comptable. Lecture : la RH ET la
--  Comptabilité. (La direction, elle, n'atteint ni l'un ni l'autre écran.)
--
--  ⚠️ `dettes_personnel` rend 0 plutôt qu'une erreur à un appelant non
--  autorisé : son contrôle est une clause `where`, pas un `raise`. On ne
--  change pas ce comportement ici — mais il faut le savoir, car « 0 F de
--  dette » et « vous n'avez pas le droit de voir » se ressemblent beaucoup
--  trop à l'écran. À reprendre avec les tuiles de synthèse.
do $$
declare
  v_paires text[][] := array[
    array['valider_salaire',    'est_admin() or a_role(''rh'')', 'a_acces(''rh'')'],
    array['devalider_salaire',  'est_admin() or a_role(''rh'')', 'a_acces(''rh'')'],
    array['annuler_salaire',    'est_admin() or a_role(''rh'')', 'a_acces(''rh'')'],
    array['maj_salaire',        'est_admin() or a_role(''rh'')', 'a_acces(''rh'')'],
    array['payer_salaire',      'est_admin() or a_role(''rh'')', 'a_acces(''rh'')'],
    array['diagnostic_sante',   'est_super_admin() or est_admin() or a_role(''rh'')', 'est_super_admin() or a_acces(''rh'')'],
    array['dettes_personnel',   'est_gestion() or a_role(''rh'') or a_role(''comptable'')', '(a_acces(''rh'') or a_acces(''comptabilite''))']
  ];
  i int; v_def text; v_new text; v_n int := 0;
begin
  for i in 1 .. array_length(v_paires, 1) loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_paires[i][1];
    if v_def is null then
      raise exception 'Fonction % introuvable : ne pas basculer à l''aveugle.', v_paires[i][1];
    end if;
    v_new := replace(v_def, v_paires[i][2], v_paires[i][3]);
    if v_new = v_def then
      raise exception 'Garde attendue introuvable dans % — elle a changé depuis l''inventaire.', v_paires[i][1];
    end if;
    execute v_new;
    v_n := v_n + 1;
  end loop;
  if v_n <> 7 then
    raise exception 'Attendu 7 fonctions basculées, % traitée(s).', v_n;
  end if;
end $$;

-- --- 4. `remplacer_bareme`, et ses DEUX signatures --------------------
--
--  ⚠️ ELLE EXISTE EN DEUX VERSIONS (avec et sans `p_date_effet`) : la
--  surcharge de la refonte « régime réel » n'a pas remplacé l'ancienne. Les
--  traiter par nom aurait basculé l'une et laissé l'autre ouverte — et c'est
--  précisément ce genre d'oubli qui a laissé `poster_salaire_charge` sans
--  garde jusqu'à la migration 177. On boucle donc sur les OID.
do $$
declare r record; v_new text; v_n int := 0;
begin
  for r in
    select p.oid, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'remplacer_bareme'
  loop
    v_new := replace(r.def,
      'est_gestion() or a_role(''rh'') or a_role(''comptable'')',
      'a_acces(''rh'')');
    if v_new = r.def then
      raise exception 'Garde attendue introuvable dans remplacer_bareme(%)', r.args;
    end if;
    execute v_new;
    v_n := v_n + 1;
  end loop;
  if v_n < 2 then
    raise exception 'Attendu au moins 2 surcharges de remplacer_bareme, % traitée(s).', v_n;
  end if;
end $$;

-- --- 5. Sept fonctions de paie accordées à PUBLIC ---------------------
--
--  🟠 Toutes portent une garde interne correcte — vérifié avant de conclure,
--  comme à la migration 180 — donc ce n'était pas une faille. Mais ce sont
--  des fonctions qui valident, dévalident et modifient des **bulletins de
--  paie nominatifs** : elles n'ont rien à faire à la portée d'un appelant
--  non authentifié.
--
--  ⚠️ `from public`, et pas seulement `from anon` : `anon` HÉRITE de PUBLIC
--  (leçon de la migration 177, où ma première révocation n'avait rien fermé).
revoke execute on function public.valider_salaire(uuid) from public, anon;
grant  execute on function public.valider_salaire(uuid) to authenticated;
revoke execute on function public.devalider_salaire(uuid, text) from public, anon;
grant  execute on function public.devalider_salaire(uuid, text) to authenticated;
revoke execute on function public.maj_salaire(uuid, numeric, numeric, numeric) from public, anon;
grant  execute on function public.maj_salaire(uuid, numeric, numeric, numeric) to authenticated;
revoke execute on function public.dettes_personnel(uuid) from public, anon;
grant  execute on function public.dettes_personnel(uuid) to authenticated;
revoke execute on function public.diagnostic_sante() from public, anon;
grant  execute on function public.diagnostic_sante() to authenticated;
revoke execute on function public.remplacer_bareme(uuid, text, jsonb) from public, anon;
grant  execute on function public.remplacer_bareme(uuid, text, jsonb) to authenticated;
revoke execute on function public.remplacer_bareme(uuid, text, jsonb, date) from public, anon;
grant  execute on function public.remplacer_bareme(uuid, text, jsonb, date) to authenticated;

--  ⚠️ `trg_audit_salaire_lignes` et `trg_lock_salaire_lignes` sont aussi
--  accordées à PUBLIC mais NE SONT PAS touchées : elles rendent `trigger`.
--  PostgREST ne les expose pas, et un appel direct échoue faute de contexte
--  de déclencheur. Les révoquer n'ajouterait rien et risquerait de gêner les
--  déclencheurs eux-mêmes. Noté pour qu'on ne les croie pas oubliées.

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['personnels','contrats','salaires','salaire_lignes',
--                            'elements_paie','personnel_elements_paie','conges',
--                            'absences_rh','regimes_paie'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('rh'))));$p$, t);
--   end loop;
--   foreach t in array array['bareme_ir','cotisations_paie'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('rh') or a_role('comptable'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('rh') or a_role('comptable'))));$p$, t);
--   end loop; end $$;
-- -- puis rejouer les blocs 3 et 4 en inversant chaque paire,
-- -- et rendre l'exécution à anon sur les 7 fonctions du bloc 5.
-- notify pgrst, 'reload schema';
