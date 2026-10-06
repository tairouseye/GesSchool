-- =====================================================================
--  184 — Sixième domaine : Présence & vie scolaire
--        + le pouvoir « Voir toutes les classes », qui manquait à la base
--
--  🔴 DEUX DÉFAUTS DE LECTURE, trouvés en inventoriant le domaine.
--
--  `absences_select` et `incidents_select` valaient
--  `est_super_admin() or ecole_id = ecole_courante()` — SANS aucun prédicat
--  de rôle. Tout membre du personnel — le comptable, la secrétaire, la RH, le
--  bibliothécaire — pouvait donc lire **toutes les absences et tous les
--  incidents disciplinaires** de chaque élève de l'école. Les écrans qui les
--  affichent (Feuille de présence, Assiduité, Vie scolaire, Présence par
--  séance) sont réservés à la direction, aux enseignants et aux surveillants
--  (`ACCES.appel`, `.assiduite`, `.vie_scolaire`). Encore un contrôle
--  frontend pris pour une sécurité — et ici il porte sur des données
--  disciplinaires nominatives.
--
--  ⚠️ VÉRIFIÉ AVANT DE FERMER, parce qu'un compteur mal cloisonné afficherait
--  zéro en silence (défaut du lot 2) : les seuls lecteurs sont
--  `src/lib/viescolaire.js` (Appel, AppelSup, Assiduité, Vie scolaire) et
--  `statsPedagogie()` de `src/lib/dashboard.js`, appelée UNIQUEMENT par
--  `AccueilPedagogie.jsx`. `statsGestion()` — l'accueil du comptable — ne lit
--  ni absences ni incidents (vérifié ligne par ligne). `src/lib/bulletins.js`
--  passe par des RPC, pas par les tables. Personne ne perd un compteur.
--
--  ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS, et il faut le dire franchement :
--  elle ne cloisonne PAS l'enseignant à ses propres classes sur ces tables.
--  Aujourd'hui, un enseignant qui a la case `presence_vie` lit les absences
--  de toute l'école, et c'était déjà le cas avant. Le restreindre ici
--  retirerait la vue Assiduité d'établissement sans que personne l'ait
--  demandé : c'est l'objet de l'ÉTAPE 4 (le périmètre par cycle/classe), qui
--  s'appliquera à ces tables comme aux autres.
-- =====================================================================

-- --- 1. Le pouvoir qui manquait à la base ------------------------------
--
--  ⚠️ BLOC GÉNÉRÉ par `boitesDuModele()` de `src/lib/acces.js`.
--
--  🔴 POURQUOI `p_toutes_classes` EXISTE. `absences_classe_periode` garde
--  aujourd'hui :
--      est_admin() or a_role('direction') or a_role('comptable')
--      or a_role('secretaire') or enseigne_classe(p_classe)
--  — c'est-à-dire : l'administration voit TOUTES les classes, l'enseignant
--  seulement CELLES QU'IL ENSEIGNE (cloisonnement de la migration 058).
--
--  Remplacer la liste de rôles par `a_acces('presence_vie')` aurait été une
--  faute grave : l'enseignant DÉTIENT cette case, il aurait donc obtenu
--  toutes les classes. La bascule aurait supprimé le cloisonnement en croyant
--  le traduire. Et aucune case existante ne distingue « voit tout » de
--  « voit les siennes » : la notion n'existait que dans le FRONT
--  (`voitToutesClasses`, utilisée par neuf écrans). On la nomme donc en base.
--
--  Le comptable et la secrétaire, eux, sortent de cette garde : `ACCES.bulletins`
--  ne les nomme pas, ils ne peuvent pas ouvrir l'écran qui l'appelle. Droit
--  inatteignable retiré, comme `transactions_paiement` à la migration 180.
create or replace function public.boites_du_modele(p_modele text)
returns text[] language sql immutable as $fn$
  select case p_modele
    when 'direction' then array['_pedagogie','acquis','admissions','annonces','biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque','cahier','codes_etudiants','codes_parents','deliberations_sup','eleves','emploi','emploi_sup','enseignants','filieres','fournitures','inscriptions_sup','membres','messagerie','notes_bulletins','notes_lmd','p_bulletins_diffuser','p_codes_parents','p_toutes_classes','p_voir_impayes','parametres','photos','presence_vie','programmation','progression','structure']
    when 'comptable' then array['_gestion','annonces','biblio_acquisitions','biblio_inventaire','cantine','certificats','codes_etudiants','codes_parents','comptabilite','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','membres','messagerie','p_eleves_editer','p_frais','p_relancer','p_voir_impayes','parametres','transport']
    when 'secretaire' then array['_gestion','admissions','annonces','bibliotheque','cantine','certificats','codes_etudiants','codes_parents','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','messagerie','p_eleves_editer','p_voir_impayes','parametres','photos','transport']
    when 'enseignant' then array['_pedagogie','acquis','bibliotheque','cahier','eleves','emploi','emploi_sup','fournitures','notes_bulletins','notes_lmd','presence_vie','progression']
    when 'surveillant' then array['_pedagogie','cahier','eleves','presence_vie']
    when 'rh' then array['enseignants','membres','rh']
    when 'bibliothecaire' then array['biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque']
    else null
  end;
$fn$;

do $$
declare r record; v_n int := 0;
begin
  for r in select distinct profil_id, ecole_id from profil_roles loop
    perform public.recalculer_acces_personnel(r.profil_id, r.ecole_id);
    v_n := v_n + 1;
  end loop;
  raise notice 'Accès recalculés pour % couples (profil, école).', v_n;
end $$;

-- --- 2. Absences et incidents -----------------------------------------
--
--  ⚠️ FORME HOISTÉE D'EMBLÉE, et c'est la leçon de la migration 183 appliquée
--  avant d'en avoir besoin : `absences` croît avec les effectifs (une ligne
--  par absence et par élève). Un prédicat mêlant un terme dépendant de la
--  ligne à des appels de fonction est réévalué PAR LIGNE — c'est ce qui
--  faisait mettre 29 secondes à la lecture du barème. Les sous-requêtes
--  scalaires `(select f())` deviennent des InitPlan évalués une seule fois.
do $$
declare t text;
begin
  foreach t in array array['absences', 'incidents'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('presence_vie'))))
      with check ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('presence_vie'))));$p$, t);
  end loop;
end $$;

--  ⚠️ LES QUATRE POLICIES SONT FUSIONNÉES EN UNE, et c'est volontaire : avant
--  la bascule, lire était ouvert à tout le personnel et écrire était réservé
--  à `est_gestion() or surveillant or enseignant`. Après, les deux
--  correspondent à la même case `presence_vie` — exactement l'ensemble
--  {direction, enseignant, surveillant} qu'énuméraient les policies
--  d'écriture. Garder quatre policies identiques serait du bruit.

-- --- 3. Les deux RPC du domaine ---------------------------------------
--
--  `absences_classe_periode` : l'administration voit toutes les classes
--  (désormais `p_toutes_classes`), l'enseignant garde `enseigne_classe()`.
--  `etudiants_seance` : sa garde nommait `secretaire`, que `ACCES.appel_sup`
--  ne nomme pas — elle ne peut pas ouvrir Présence par séance. Droit
--  inatteignable retiré.
--  ⚠️ LA GARDE DE `absences_classe_periode` TIENT SUR DEUX LIGNES dans la
--  base, avec des retours chariot Windows et une indentation précise. Un motif
--  multiligne ne correspondrait donc pas, et le bloc aurait échoué — ce qui
--  est le bon comportement, mais bloque la migration pour rien. On la remplace
--  en DEUX substitutions d'une seule ligne chacune, appliquées dans l'ordre :
--  la définition est relue entre les deux, donc la seconde voit le résultat de
--  la première. Chacune doit trouver sa chaîne, sinon le bloc refuse.
do $$
declare
  v_paires text[][] := array[
    --  1. l'administration devient le pouvoir « voit toutes les classes »
    array['absences_classe_periode',
          'est_admin() or a_role(''direction'') or a_role(''comptable'')',
          'a_acces(''p_toutes_classes'')'],
    --  2. et la secrétaire sort de la garde, l'enseignant garde sa classe
    array['absences_classe_periode',
          'or a_role(''secretaire'') or enseigne_classe(p_classe)',
          'or enseigne_classe(p_classe)'],
    array['etudiants_seance',
          'est_gestion() or a_role(''enseignant'') or a_role(''surveillant'') or a_role(''secretaire'')',
          'a_acces(''presence_vie'')']
  ];
  i int; v_def text; v_new text; v_n int := 0;
begin
  for i in 1 .. array_length(v_paires, 1) loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_paires[i][1];
    if v_def is null then
      raise exception 'Fonction % introuvable.', v_paires[i][1];
    end if;
    v_new := replace(v_def, v_paires[i][2], v_paires[i][3]);
    if v_new = v_def then
      raise exception 'Garde attendue introuvable dans % — elle a changé depuis l''inventaire.', v_paires[i][1];
    end if;
    execute v_new;
    v_n := v_n + 1;
  end loop;
  if v_n <> 3 then
    raise exception 'Attendu 3 substitutions, % traitée(s).', v_n;
  end if;
end $$;

--  ⚠️ DEUX FONCTIONS NON TOUCHÉES, délibérément :
--
--  • `absences_periode(uuid, uuid)` : la migration 174 lui a RETIRÉ le droit
--    d'exécution à `authenticated` plutôt que de lui poser une garde, parce
--    que `enfant_bulletins` l'appelle dans un contexte où `ecole_courante()`
--    vaut NULL (un parent). Elle n'est donc atteignable que par les fonctions
--    `security definer` qui la portent. Lui ajouter une garde la casserait.
--
--  • `bulletin_affiche_absences(uuid)` : elle rend un BOOLÉEN — « le cycle de
--    cette classe affiche-t-il les absences sur le bulletin ? » — et aucune
--    donnée nominative. Elle n'est pas accordée à `anon`. Une garde ici
--    n'ajouterait rien qu'un risque de régression sur l'édition des bulletins.
--
--  Et les chemins familles restent intacts : `enfant_absences` et
--  `justifier_absence_parent` sont `security definer`, gardées par
--  `_parent_possede()`, et contournent la RLS par construction.

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- -- 1. rétablir boites_du_modele sans p_toutes_classes (version mig. 180),
-- --    puis rejouer le bloc de recalcul.
-- do $$ declare t text; begin
--   foreach t in array array['absences','incidents'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_select on public.%1$I for select
--       using (est_super_admin() or (ecole_id = ecole_courante()));$p$, t);
--     execute format($p$create policy %1$s_ins on public.%1$I for insert
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('surveillant') or a_role('enseignant'))));$p$, t);
--     execute format($p$create policy %1$s_upd on public.%1$I for update
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('surveillant') or a_role('enseignant'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('surveillant') or a_role('enseignant'))));$p$, t);
--     execute format($p$create policy %1$s_del on public.%1$I for delete
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion()
--              or a_role('surveillant') or a_role('enseignant'))));$p$, t);
--   end loop; end $$;
-- -- 2. rejouer le bloc 3 en inversant les deux paires.
-- notify pgrst, 'reload schema';
