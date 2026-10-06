-- =====================================================================
--  186 — Huitième et dernier domaine du plan : Élèves & structure
--
--  Le domaine le plus partagé de l'application : presque chaque écran lit
--  `eleves` ou `classes`. C'est aussi celui qui cachait le trou le plus
--  large.
--
--  🔴 TOUTE LA STRUCTURE DE L'ÉCOLE ÉTAIT MODIFIABLE PAR N'IMPORTE QUEL
--  MEMBRE DU PERSONNEL. `classes`, `niveaux`, `matieres`, `series`,
--  `enseignants` et `affectations` portaient UNE policy `for all` avec pour
--  seul prédicat `ecole_id = ecole_courante()` : aucun contrôle de rôle. Un
--  enseignant, un surveillant, un bibliothécaire pouvait donc **créer,
--  modifier et SUPPRIMER** les classes, les niveaux, les matières et les
--  affectations de l'établissement — alors que l'écran Structure est réservé
--  à la direction seule (`ACCES.structure = ["direction"]`). La migration 174
--  avait verrouillé `cycles` pour cette raison exacte ; ces six tables-là
--  avaient été oubliées.
--
--  Et les cinq tables de l'élève (`eleves`, `inscriptions`, `tuteurs`,
--  `eleve_tuteurs`, `documents_eleve`) étaient LUES par tout le personnel —
--  y compris les pièces d'état civil scannées de `documents_eleve`.
-- =====================================================================

-- --- 1. Les cinq tables de l'élève ------------------------------------
--
--  Écriture : `est_admin() or a_role('comptable') or a_role('secretaire')`
--  reproduit EXACTEMENT le pouvoir `p_eleves_editer` (qui dérive lui-même de
--  `peutEditerEleves`). Bascule 1 pour 1.
--
--  ⚠️ LECTURE DE `eleves` : DEUX CASES, et la seconde m'a évité de casser le
--  SIGB. `src/lib/bibliotheque.js` lit `eleves` pour afficher le nom de
--  l'emprunteur (lignes 470, 516, 553) et pour le CHERCHER
--  (`chercherEtudiants`, ligne 530). Or le bibliothécaire ne détient PAS la
--  case `eleves` : la fermer à cette seule case aurait vidé la liste des
--  prêts et rendu la recherche d'emprunteur muette — sans aucune erreur à
--  l'écran. Vérifié aussi : la bibliothèque ne lit NI `inscriptions`, NI
--  `tuteurs`, NI `documents_eleve`.
drop policy if exists eleves_select on public.eleves;
create policy eleves_select on public.eleves
  for select using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and ((select a_acces('eleves')) or (select a_acces('biblio_circulation'))))
  );

do $$
declare t text;
begin
  --  Les quatre autres : lecture à la seule case `eleves`.
  foreach t in array array['inscriptions', 'tuteurs', 'eleve_tuteurs', 'documents_eleve'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format($p$create policy %1$s_select on public.%1$I for select
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('eleves'))));$p$, t);
  end loop;

  --  Et l'écriture des cinq, sur le pouvoir d'édition.
  --  ⚠️ FORME HOISTÉE : `eleves` et `inscriptions` grandissent avec les
  --  effectifs, et `eleve_tuteurs` avec eux. Leçon de la migration 183.
  foreach t in array array['eleves', 'inscriptions', 'tuteurs', 'eleve_tuteurs', 'documents_eleve'] loop
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format($p$create policy %1$s_ins on public.%1$I for insert
      with check ((select est_super_admin())
                  or (ecole_id = (select ecole_courante()) and (select a_acces('p_eleves_editer'))));$p$, t);
    execute format($p$create policy %1$s_upd on public.%1$I for update
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('p_eleves_editer'))))
      with check ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('p_eleves_editer'))));$p$, t);
    execute format($p$create policy %1$s_del on public.%1$I for delete
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces('p_eleves_editer'))));$p$, t);
  end loop;
end $$;

-- --- 2. La structure : lire largement, écrire étroitement --------------
--
--  ⚠️ LA LECTURE RESTE OUVERTE À TOUT LE PERSONNEL, et c'est un choix motivé,
--  pas un oubli. Le sélecteur de classe est présent sur presque tous les
--  écrans — appel, notes, bulletins, élèves, paiements, recouvrement,
--  cantine, transport, bibliothèque, emploi du temps. Le fermer à une case
--  viderait des listes déroulantes partout, en silence. Et `ecole_courante()`
--  vaut déjà NULL pour un parent ou un élève : la lecture est donc bornée au
--  personnel de l'établissement.
--
--  L'ÉCRITURE, elle, revient à la case qui gère l'écran :
--    `classes`, `niveaux`, `matieres`, `series` → `structure` (direction)
--    `enseignants`, `affectations`              → `enseignants` (RH + direction)
do $$
declare t text; v_case text;
begin
  foreach t in array array['classes', 'niveaux', 'matieres', 'series',
                           'enseignants', 'affectations'] loop
    v_case := case when t in ('enseignants', 'affectations') then 'enseignants' else 'structure' end;
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('drop policy if exists %1$s_ecrire on public.%1$I;', t);
    execute format($p$create policy %1$s_select on public.%1$I for select
      using ((select est_super_admin()) or ecole_id = (select ecole_courante()));$p$, t);
    execute format($p$create policy %1$s_ecrire on public.%1$I for all
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces(%2$L))))
      with check ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces(%2$L))));$p$, t, v_case);
  end loop;
end $$;

--  ⚠️ POURQUOI DEUX POLICIES ET NON UNE. PostgreSQL combine les policies
--  permissives par OU : `_select` (for select) et `_ecrire` (for all) se
--  cumulent donc sur un SELECT, et la lecture reste ouverte. Sur un
--  INSERT/UPDATE/DELETE, seule `_ecrire` s'applique. C'est exactement l'effet
--  voulu, et c'est le patron déjà utilisé par `cycles` (mig. 174).

-- --- 3. Les RPC du domaine -------------------------------------------
--
--  Les correspondances, vérifiées écran par écran :
--    `generer_code_tuteur`     = promoteur+direction+comptable+secrétariat → case `codes_parents`
--        (l'écran Codes parents, que les trois ouvrent, l'appelle vraiment)
--    `generer_code_etudiant`   = les mêmes                                → case `codes_etudiants`
--    `convertir_candidature`   = promoteur+direction+secrétariat           → case `admissions`
--
--  🔴 `generer_code_enseignant` EST UNE CORRECTION, pas une bascule. Sa garde
--  valait `a_role('admin_ecole') or a_role('direction')` — la RH en était
--  exclue. Or le bouton qui l'appelle est sur l'écran **Enseignants**
--  (`Enseignants.jsx` ligne 27), que `ACCES.enseignants = ["rh","direction"]`
--  ouvre à la RH. Elle voyait donc un bouton qui répondait « Réservé à
--  l'administration de l'école ». Troisième bouton à l'envers de son écran
--  trouvé dans ce chantier, après `valider_declaration` (mig. 180) et
--  « Relancer (push) » (mig. 181). La case `enseignants` répare le chemin.
--
--  🔴 ET `prochain_matricule` A EXIGÉ UNE VÉRIFICATION QUI A CHANGÉ MA
--  RÉPONSE. Elle n'avait qu'un contrôle d'établissement, donc n'importe quel
--  membre du personnel pouvait consommer des numéros de matricule. La fermer
--  à `p_eleves_editer` semblait évident — mais `convertir_candidature`
--  L'APPELLE, et cette fonction est ouverte à la **direction**, qui n'a PAS
--  `p_eleves_editer`. Convertir une candidature aurait donc échoué pour la
--  direction, sur une erreur venue d'une fonction qu'elle n'appelle pas
--  elle-même. D'où la disjonction des deux chemins.
do $$
declare
  v_paires text[][] := array[
    array['generer_code_tuteur',
          'a_role(''admin_ecole'') or a_role(''direction'') or a_role(''comptable'') or a_role(''secretaire'')',
          'a_acces(''codes_parents'')'],
    array['generer_code_etudiant',
          'est_admin() or a_role(''direction'') or a_role(''comptable'') or a_role(''secretaire'')',
          'a_acces(''codes_etudiants'')'],
    array['generer_code_enseignant',
          'a_role(''admin_ecole'') or a_role(''direction'')',
          'a_acces(''enseignants'')'],
    array['convertir_candidature',
          'est_admin() or a_role(''direction'') or a_role(''secretaire'')',
          'a_acces(''admissions'')'],
    array['prochain_matricule',
          'if v_ecole is null then raise exception ''Aucune école courante''; end if;',
          'if v_ecole is null then raise exception ''Aucune école courante''; end if;
  --  Les DEUX chemins légitimes : la création d''un élève (p_eleves_editer)
  --  et la conversion d''une candidature (admissions, qui appelle cette
  --  fonction depuis convertir_candidature).
  if not (a_acces(''p_eleves_editer'') or a_acces(''admissions'')) then
    raise exception ''Réservé au secrétariat et aux admissions.'';
  end if;']
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
  if v_n <> 5 then
    raise exception 'Attendu 5 substitutions, % traitée(s).', v_n;
  end if;
end $$;

--  Deux fonctions qui délivrent ou consomment des identifiants d'accès
--  étaient accordées à PUBLIC. Leurs gardes internes refusaient déjà
--  l'anonyme ; on retire le droit par principe — on ne laisse pas une
--  fabrique de codes d'accès à portée d'un appelant non authentifié.
revoke execute on function public.generer_code_etudiant(uuid) from public, anon;
grant  execute on function public.generer_code_etudiant(uuid) to authenticated;
revoke execute on function public.lier_etudiant(text) from public, anon;
grant  execute on function public.lier_etudiant(text) to authenticated;

--  ⚠️ `ouvrir_annee_scolaire` N'EST PAS TOUCHÉE : sa garde est
--  `est_super_admin() or a_role('admin_ecole')`, un verrou de PROMOTEUR et
--  non un rôle métier. `a_acces()` l'aurait élargie à quiconque possède la
--  case. Même raison que Pilotage, `relancer_tout` et `psp_etat`.
--
--  ⚠️ `lier_parent`, `lier_enseignant` et `lier_etudiant` n'ont pas de garde
--  de rôle, et c'est NORMAL : le code présenté EST le justificatif. Leur
--  verrou est le secret du code et le verrou d'e-mail de la migration 030.

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['eleves','inscriptions','tuteurs','eleve_tuteurs','documents_eleve'] loop
--     execute format('drop policy if exists %1$s_select on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_del on public.%1$I;', t);
--     execute format($p$create policy %1$s_select on public.%1$I for select
--       using (est_super_admin() or (ecole_id = ecole_courante()));$p$, t);
--     execute format($p$create policy %1$s_ins on public.%1$I for insert
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))));$p$, t);
--     execute format($p$create policy %1$s_upd on public.%1$I for update
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))));$p$, t);
--     execute format($p$create policy %1$s_del on public.%1$I for delete
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('comptable') or a_role('secretaire'))));$p$, t);
--   end loop;
--   foreach t in array array['classes','niveaux','matieres','series','enseignants','affectations'] loop
--     execute format('drop policy if exists %1$s_select on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_ecrire on public.%1$I;', t);
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante()))
--       with check (est_super_admin() or (ecole_id = ecole_courante()));$p$, t);
--   end loop; end $$;
-- -- puis rejouer le bloc 3 en inversant chaque paire,
-- -- et rendre l'exécution à anon sur les deux fonctions du bloc suivant.
-- notify pgrst, 'reload schema';
