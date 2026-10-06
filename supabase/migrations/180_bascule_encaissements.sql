-- =====================================================================
--  180 — Quatrième domaine : les Encaissements. Et DEUX POUVOIRS DE PLUS,
--        parce que la case `encaissement` ne suffisait pas à dire la vérité.
--
--  🔴 LE PROBLÈME QUE CETTE MIGRATION A DÛ RÉSOUDRE AVANT DE BASCULER.
--  La case `encaissement` regroupe Paiements et Recouvrement — c'est juste,
--  ils lisent `factures`. Mais le comptable et le secrétariat n'ont PAS les
--  mêmes droits en base, et basculer naïvement les aurait égalisés :
--
--    • `frais` ne s'écrit que par `est_admin() or a_role('comptable')` : le
--      secrétariat encaisse, il ne fixe pas les tarifs. `a_acces('encaissement')`
--      lui aurait donné la grille tarifaire de l'école.
--    • `statut_paiement_classe` — l'indicateur de paiement de la liste Élèves
--      — nomme `direction`, que la case `eleves` ne distingue NI de
--      l'enseignant NI du surveillant. `a_acces('eleves')` aurait montré à
--      tout enseignant quelles familles sont en retard de paiement.
--
--  C'est exactement le raisonnement qui a déjà produit `p_relancer` : la
--  donnée se partage, l'acte non. D'où deux pouvoirs de plus, GÉNÉRÉS depuis
--  `src/lib/acces.js` comme tous les blocs de ce chantier :
--    `p_frais`         → fixer la grille des frais et les règles de relance
--    `p_voir_impayes`  → voir qui est à jour dans la liste des élèves
--
--  ⚠️ CETTE MIGRATION REDÉFINIT DONC `boites_du_modele()` (posée en 176) et
--  REJOUE LE BACKFILL : sans cela, personne ne possèderait les deux nouvelles
--  cases et les écrans se fermeraient pour tout le monde sauf le promoteur.
-- =====================================================================

-- --- 1. Les modèles, avec les deux pouvoirs ----------------------------
--
--  ⚠️ BLOC GÉNÉRÉ par `boitesDuModele()` de `src/lib/acces.js`. Une épreuve
--  (`test/acces.test.mjs`) compare la DÉFINITION EN VIGUEUR — la migration
--  la plus récente qui porte ce bloc — au JS, et échoue si l'on édite un
--  seul côté à la main.
create or replace function public.boites_du_modele(p_modele text)
returns text[] language sql immutable as $fn$
  select case p_modele
    when 'direction' then array['_pedagogie','acquis','admissions','annonces','biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque','cahier','codes_etudiants','codes_parents','deliberations_sup','eleves','emploi','emploi_sup','enseignants','filieres','fournitures','inscriptions_sup','membres','messagerie','notes_bulletins','notes_lmd','p_bulletins_diffuser','p_codes_parents','p_voir_impayes','parametres','photos','presence_vie','programmation','progression','structure']
    when 'comptable' then array['_gestion','annonces','biblio_acquisitions','biblio_inventaire','cantine','certificats','codes_etudiants','codes_parents','comptabilite','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','membres','messagerie','p_eleves_editer','p_frais','p_relancer','p_voir_impayes','parametres','transport']
    when 'secretaire' then array['_gestion','admissions','annonces','bibliotheque','cantine','certificats','codes_etudiants','codes_parents','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','messagerie','p_eleves_editer','p_voir_impayes','parametres','photos','transport']
    when 'enseignant' then array['_pedagogie','acquis','bibliotheque','cahier','eleves','emploi','emploi_sup','fournitures','notes_bulletins','notes_lmd','presence_vie','progression']
    when 'surveillant' then array['_pedagogie','cahier','eleves','presence_vie']
    when 'rh' then array['enseignants','membres','rh']
    when 'bibliothecaire' then array['biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque']
    else null
  end;
$fn$;

-- --- 2. Rejouer le backfill pour tout le monde -------------------------
--
--  `recalculer_acces_personnel` recalcule COMPLÈTEMENT depuis les rôles
--  (mig. 176), donc la rejouer est idempotent : elle ajoute les deux
--  nouvelles cases à qui y a droit et ne retire rien d'autre.
do $$
declare r record; v_n int := 0;
begin
  for r in select distinct profil_id, ecole_id from profil_roles loop
    perform public.recalculer_acces_personnel(r.profil_id, r.ecole_id);
    v_n := v_n + 1;
  end loop;
  raise notice 'Accès recalculés pour % couples (profil, école).', v_n;
end $$;

-- --- 3. Le cœur du domaine : quatre tables, une case -------------------
--
--  `factures`, `facture_lignes`, `paiements` et `declarations_paiement`
--  portaient toutes la même garde `est_admin() or a_role('comptable') or
--  a_role('secretaire')` — exactement `ACCES.paiements`. Bascule 1 pour 1,
--  aucun droit déplacé.
--
--  ⚠️ LES FAMILLES NE PASSENT PAS PAR CES POLICIES, vérifié avant : les
--  parents lisent par `enfant_factures`, `enfant_facture_detail`,
--  `enfant_declarations`, et les étudiants par `mes_factures`,
--  `mes_declarations_paiement` — toutes `security definer`, gardées par
--  `_parent_possede()` ou `_eleve_courant()`, donc elles contournent la RLS
--  par construction. Resserrer ici ne leur retire rien.
do $$
declare t text;
begin
  foreach t in array array['factures', 'facture_lignes', 'paiements', 'declarations_paiement'] loop
    execute format('drop policy if exists %1$s_gestion on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')));$p$, t);
  end loop;
end $$;

-- --- 4. `frais` : lire avec la case, ÉCRIRE avec le pouvoir ------------
--
--  🔴 DEUX DÉFAUTS ICI, de sens opposé.
--
--  Le premier : `frais_select` était `est_super_admin() or ecole_id =
--  ecole_courante()`, SANS prédicat de rôle — tout membre du personnel
--  lisait la grille tarifaire. Fermé à la case.
--  ⚠️ VÉRIFIÉ AVANT DE FERMER, parce que deux compteurs lisent `frais`
--  ailleurs : `etatMiseEnRoute` ([src/lib/academique.js]) et `resumeSource`
--  ([src/lib/annee.js]). Tous deux ne servent QUE les écrans Pilotage et
--  Passage d'année, gardés par `GardePromoteur` — et le promoteur contourne
--  `a_acces` inconditionnellement. Aucun compteur ne tombera donc à zéro.
--  Sans cette vérification, la direction aurait lu « 0 frais configurés »
--  sur son tableau de mise en route : exactement le défaut du lot 2.
--
--  Le second : l'écriture nommait `a_role('comptable')` et PAS le
--  secrétariat. La case `encaissement` les couvre tous les deux, donc elle
--  aurait donné les tarifs de l'école au secrétariat. D'où `p_frais`.
drop policy if exists frais_select on public.frais;
create policy frais_select on public.frais
  for select using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')));

--  Les trois verbes d'écriture sont écrits à la main plutôt qu'en boucle :
--  `insert` ne prend qu'un `with check`, `delete` qu'un `using`, et `update`
--  les deux. Une boucle les aurait uniformisés — et un `using` sur un
--  `insert` est silencieusement ignoré par PostgreSQL.
drop policy if exists frais_ins on public.frais;
create policy frais_ins on public.frais
  for insert with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));
drop policy if exists frais_upd on public.frais;
create policy frais_upd on public.frais
  for update using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')))
         with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));
drop policy if exists frais_del on public.frais;
create policy frais_del on public.frais
  for delete using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));

-- --- 5. `regles_relance` : la configuration DES relances ---------------
--
--  Même découpage, et il tombe juste : la lecture n'avait aucun prédicat de
--  rôle (tout le personnel lisait les paliers de relance), l'écriture
--  nommait le comptable seul. Les règles de relance SONT la configuration de
--  l'acte de relancer : elles reviennent donc à `p_relancer`, sans qu'il
--  faille inventer un pouvoir de plus.
drop policy if exists regles_relance_select on public.regles_relance;
create policy regles_relance_select on public.regles_relance
  for select using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')));
drop policy if exists regles_relance_ins on public.regles_relance;
create policy regles_relance_ins on public.regles_relance
  for insert with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_relancer')));
drop policy if exists regles_relance_upd on public.regles_relance;
create policy regles_relance_upd on public.regles_relance
  for update using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_relancer')))
         with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_relancer')));
drop policy if exists regles_relance_del on public.regles_relance;
create policy regles_relance_del on public.regles_relance
  for delete using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_relancer')));

-- --- 6. Les transactions de paiement en ligne -------------------------
--
--  ⚠️ CETTE TABLE N'A QUE UNE POLICY, DE LECTURE, et c'est VOULU : les lignes
--  sont écrites par le prestataire via une Edge Function en clé de service,
--  jamais par un utilisateur. On ne lui ajoute donc pas de policy d'écriture.
--
--  Sa lecture nommait `est_gestion()` — qui vaut vrai pour la DIRECTION —
--  alors que l'écran qui l'affiche est Paiements ([src/pages/Paiements.jsx]),
--  que la direction ne peut pas ouvrir (`ACCES.paiements` ne la nomme pas).
--  Elle perd donc un accès qu'elle n'avait aucun moyen d'exercer depuis
--  l'interface. Resserrement assumé.
drop policy if exists transactions_paiement_lecture on public.transactions_paiement;
create policy transactions_paiement_lecture on public.transactions_paiement
  for select using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')));

-- --- 7. Les gardes des RPC, une par une -------------------------------
--
--  ⚠️ PAS DE SUBSTITUTION GLOBALE ICI, et c'est important. La chaîne
--  `est_admin() or a_role('comptable')` est un PRÉFIXE de
--  `est_admin() or a_role('comptable') or a_role('secretaire')` : un
--  `replace` appliqué à l'aveugle sur une fonction à trois rôles aurait
--  produit `a_acces('p_relancer') or a_role('secretaire')` — une garde
--  bancale, à moitié basculée, qui aurait passé sans bruit. Chaque fonction
--  a donc SA paire (recherche, remplacement), et le bloc échoue si l'une
--  d'elles ne trouve pas sa chaîne.
--
--  Les correspondances, vérifiées une par une :
--    `factures_paginees`, `supprimer_facture`, `tableau_bord_finances`
--        = comptable + secrétariat  → `encaissement`                 (1 pour 1)
--    `relancer_eleve`, `relancer_facture`
--        = comptable seul           → `p_relancer`                   (1 pour 1)
--    `statut_paiement_classe`
--        = direction + comptable + secrétariat → `p_voir_impayes`    (1 pour 1)
--    `valider_declaration`, `rejeter_declaration`                 ← CORRECTION
--
--  🔴 LA CORRECTION ASSUMÉE, et il faut la dire. Ces deux-là valaient
--  `est_gestion() or a_role('comptable')`, soit {promoteur, direction,
--  comptable} — le secrétariat EXCLU. Or les boutons « Valider » et
--  « Rejeter » sont sur l'écran Paiements, que le secrétariat ouvre : il
--  voyait donc un bouton qui répondait « Réservé à la comptabilité ». Et la
--  direction, qui en avait le droit, ne peut pas ouvrir cet écran. La garde
--  était à l'envers de l'interface. `a_acces('encaissement')` répare le
--  bouton du secrétariat et retire à la direction un droit qu'elle n'avait
--  aucun moyen d'exercer.
do $$
declare
  v_paires text[][] := array[
    array['factures_paginees',      'est_admin() or a_role(''comptable'') or a_role(''secretaire'')',            'a_acces(''encaissement'')'],
    array['supprimer_facture',      'est_admin() or a_role(''comptable'') or a_role(''secretaire'')',            'a_acces(''encaissement'')'],
    array['tableau_bord_finances',  'est_admin() or a_role(''comptable'') or a_role(''secretaire'')',            'a_acces(''encaissement'')'],
    array['statut_paiement_classe', 'est_admin() or a_role(''direction'') or a_role(''comptable'') or a_role(''secretaire'')', 'a_acces(''p_voir_impayes'')'],
    array['relancer_eleve',         'est_admin() or a_role(''comptable'')',                                      'a_acces(''p_relancer'')'],
    array['relancer_facture',       'est_admin() or a_role(''comptable'')',                                      'a_acces(''p_relancer'')'],
    array['valider_declaration',    'est_gestion() or a_role(''comptable'')',                                    'a_acces(''encaissement'')'],
    array['rejeter_declaration',    'est_gestion() or a_role(''comptable'')',                                    'a_acces(''encaissement'')']
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
  if v_n <> 8 then
    raise exception 'Attendu 8 fonctions basculées, % traitée(s).', v_n;
  end if;
end $$;

--  ⚠️ TROIS RPC NE SONT PAS TOUCHÉES, et c'est délibéré :
--  `relancer_tout()`, `psp_etat()` et `set_psp_config()` sont gardées par
--  `est_admin()` / `a_role('admin_ecole')` seul — ce sont des gardes de
--  PROMOTEUR, pas des rôles métier. Les remplacer par `a_acces(...)` les
--  aurait élargies à quiconque possède la case, puisque `a_acces` rend vrai
--  pour le promoteur quelle que soit la case. Même raison que Pilotage, qui
--  reste hors du modèle des cases.

-- --- 8. Trois fonctions accordées à PUBLIC ----------------------------
--
--  🟠 TROUVÉ EN INVENTORIANT LE DOMAINE, et moins grave qu'il n'y paraît.
--  `relancer_facture`, `relancer_tout` et `declarer_paiement` sont
--  `grant execute` à PUBLIC — donc appelables sans être connecté. J'ai lu
--  leur corps avant de conclure : les trois portent bien une garde interne
--  (`est_admin() or a_role('comptable')`, `est_admin()`, et
--  `_parent_possede()`), et toutes trois refusent un appelant anonyme. Ce
--  n'est donc PAS une faille — contrairement à `poster_salaire_charge` de la
--  migration 177, qui n'avait aucune garde.
--
--  On retire quand même le droit à PUBLIC : une fonction qui envoie des
--  notifications à toutes les familles d'une école n'a pas à être exposée
--  aux appelants non authentifiés, même bien gardée. Et `from public` et pas
--  seulement `from anon` — c'est la leçon de la migration 177 : `anon`
--  HÉRITE de PUBLIC, lui révoquer seul ne ferme rien.
revoke execute on function public.relancer_facture(uuid) from public, anon;
grant  execute on function public.relancer_facture(uuid) to authenticated;
revoke execute on function public.relancer_tout() from public, anon;
grant  execute on function public.relancer_tout() to authenticated;
revoke execute on function public.declarer_paiement(uuid, numeric, text, text, text) from public, anon;
grant  execute on function public.declarer_paiement(uuid, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- -- 1. rétablir boites_du_modele sans les deux pouvoirs (version mig. 176),
-- --    puis rejouer le bloc de recalcul de la section 2.
-- -- 2. les tables :
-- do $$ declare t text; begin
--   foreach t in array array['factures','facture_lignes','paiements','declarations_paiement'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_gestion on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))));$p$, t);
--   end loop; end $$;
-- drop policy if exists frais_select on public.frais;
-- create policy frais_select on public.frais for select
--   using (est_super_admin() or (ecole_id = ecole_courante()));
-- -- (idem frais_ins/upd/del et regles_relance_* avec est_admin() or a_role('comptable'),
-- --  regles_relance_select avec le seul ecole_id, et transactions_paiement_lecture
-- --  avec est_gestion() or a_role('comptable') or a_role('secretaire'))
-- -- 3. les 8 RPC : rejouer le bloc de la section 7 en inversant chaque paire.
-- -- 4. grant execute ... to anon sur les trois fonctions de la section 8.
-- notify pgrst, 'reload schema';
