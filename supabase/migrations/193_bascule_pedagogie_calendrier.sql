-- =====================================================================
--  193 — Pédagogie & calendrier : 14 tables, dont 9 que tout le personnel
--        pouvait réécrire
--
--  🔴 CE QUE N'IMPORTE QUEL MEMBRE DU PERSONNEL POUVAIT FAIRE. Neuf tables
--  portaient UNE policy `for all` avec pour seul prédicat
--  `ecole_id = ecole_courante()` :
--    • `emplois_du_temps`, `creneaux_horaires`, `salles`, `volumes_horaires`,
--      `indisponibilites_enseignants` → **réécrire l'emploi du temps de
--      l'établissement** ;
--    • `cahier_textes` → modifier le cahier de textes d'un autre enseignant ;
--    • `progressions` → modifier sa progression ;
--    • `coefficients_matieres` → **changer les coefficients des matières**,
--      donc déplacer toutes les moyennes et tous les classements ;
--    • `fournitures` → modifier la liste de fournitures publiée aux familles.
--  Un bibliothécaire, un surveillant, un enseignant : tous.
--
--  Cinq autres tables étaient déjà restreintes par rôle et ne demandent
--  qu'une traduction en cases.
--
--  ⚠️ DEUX TRAITEMENTS, et la distinction est le cœur de cette migration :
--
--  1. LES TABLES DE CONTENU (le cahier de textes, la progression, l'emploi du
--     temps, les observations, la programmation, les fournitures) : lecture ET
--     écriture à la case de leur écran. Le comptable n'a pas à lire le cahier
--     de textes.
--
--  2. LES RÉFÉRENTIELS (créneaux, salles, volumes horaires, indisponibilités,
--     coefficients, sous-niveaux, items d'acquis) : lecture LARGE, écriture à
--     la case. Ils sont lus par d'autres écrans pour composer un affichage —
--     fermer leur lecture viderait des grilles en silence, comme l'aurait
--     fait `classes` à la migration 186.
--
--  ⚠️ ET LE PÉRIMÈTRE PAR CYCLE EST AJOUTÉ AU PASSAGE aux quatre tables qui
--  portent une clé de classe ou d'élève (`cahier_textes`, `progressions`,
--  `emplois_du_temps`, `acquis_observations`). Elles auraient dû figurer dans
--  la migration 188 ; elles n'y étaient pas parce qu'elles n'étaient pas
--  encore basculées. Chaque conjonction garde sa porte de sortie
--  (`... is null or`), donc l'inertie est préservée.
-- =====================================================================

-- --- 1. Les tables de CONTENU : lecture et écriture à la case ----------
do $$
declare
  v_map text[][] := array[
    array['cahier_textes',        'cahier',        '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['progressions',         'progression',   '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['emplois_du_temps',     'emploi',        '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['acquis_observations',  'acquis',        'peut_voir_eleve(eleve_id)'],
    array['fournitures',          'fournitures',   'true'],
    array['programmations',       'programmation', 'true'],
    array['programmation_lignes', 'programmation', 'true']
  ];
  i int; t text; v_case text; v_per text; v_n int := 0;
begin
  for i in 1 .. array_length(v_map, 1) loop
    t := v_map[i][1]; v_case := v_map[i][2]; v_per := v_map[i][3];
    --  On retire toutes les policies existantes de la table, quel que soit
    --  leur nom : `_tenant`, `_select`, `_ins`, `_upd`, `_del`, `_obs_*`…
    --  Les énumérer à la main en aurait laissé une derrière, et une policy
    --  permissive oubliée annule le resserrement (elles se combinent par OU).
    declare r record;
    begin
      for r in select p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t
      loop
        execute format('drop policy %I on public.%I;', r.polname, t);
      end loop;
    end;
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces(%2$L)) and %3$s))
      with check ((select est_super_admin())
             or (ecole_id = (select ecole_courante()) and (select a_acces(%2$L)) and %3$s));$p$,
      t, v_case, v_per);
    v_n := v_n + 1;
  end loop;
  if v_n <> 7 then raise exception 'Attendu 7 tables de contenu, % traitée(s).', v_n; end if;
end $$;

-- --- 2. Les RÉFÉRENTIELS : lecture large, écriture à la case -----------
--
--  ⚠️ `sous_niveaux` GARDE `est_membre_ecole()` DANS SA LECTURE, et c'est
--  délibéré : ce helper vaut vrai pour les PARENTS, qui lisent le sous-niveau
--  de leur enfant sur son bulletin. Le remplacer par le seul
--  `ecole_id = ecole_courante()` aurait vidé cette ligne du bulletin — pour
--  les familles, `ecole_courante()` vaut NULL.
do $$
declare
  v_map text[][] := array[
    array['creneaux_horaires',            'emploi',    'non'],
    array['salles',                       'emploi',    'non'],
    array['volumes_horaires',             'emploi',    'non'],
    array['indisponibilites_enseignants', 'emploi',    'non'],
    array['coefficients_matieres',        'structure', 'non'],
    array['sous_niveaux',                 'structure', 'familles'],
    --  ⚠️ `acquis_items` : l'écran dit lui-même « Seule la direction peut
    --  mettre en place le référentiel », et se garde par `voitToutesClasses`.
    --  La case `acquis` seule aurait ÉLARGI aux enseignants ; on exige donc la
    --  case ET le pouvoir « voit toutes les classes », ce qui reproduit
    --  exactement {promoteur, direction}.
    array['acquis_items',                 'acquis',    'direction']
  ];
  i int; t text; v_case text; v_mode text; v_lect text; v_ecr text; v_n int := 0;
begin
  for i in 1 .. array_length(v_map, 1) loop
    t := v_map[i][1]; v_case := v_map[i][2]; v_mode := v_map[i][3];
    v_lect := case when v_mode = 'familles'
                   then '(select est_super_admin()) or ecole_id = (select ecole_courante()) or est_membre_ecole(ecole_id)'
                   else '(select est_super_admin()) or ecole_id = (select ecole_courante())' end;
    v_ecr := case when v_mode = 'direction'
                  then format('(select a_acces(%L)) and (select a_acces(''p_toutes_classes''))', v_case)
                  else format('(select a_acces(%L))', v_case) end;
    declare r record;
    begin
      for r in select p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t
      loop
        execute format('drop policy %I on public.%I;', r.polname, t);
      end loop;
    end;
    execute format('create policy %1$s_select on public.%1$I for select using (%2$s);', t, v_lect);
    execute format($p$create policy %1$s_ecrire on public.%1$I for all
      using ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and %2$s))
      with check ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and %2$s));$p$,
      t, v_ecr);
    v_n := v_n + 1;
  end loop;
  if v_n <> 7 then raise exception 'Attendu 7 référentiels, % traité(s).', v_n; end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; r record; begin
--   foreach t in array array['cahier_textes','progressions','emplois_du_temps','fournitures',
--                            'creneaux_horaires','salles','volumes_horaires',
--                            'indisponibilites_enseignants','coefficients_matieres'] loop
--     for r in select p.polname from pg_policy p join pg_class c on c.oid=p.polrelid
--               join pg_namespace n on n.oid=c.relnamespace
--              where n.nspname='public' and c.relname=t loop
--       execute format('drop policy %I on public.%I;', r.polname, t);
--     end loop;
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante()))
--       with check (est_super_admin() or (ecole_id = ecole_courante()));$p$, t);
--   end loop; end $$;
-- -- ⚠️ Annuler rouvre l'écriture de l'emploi du temps et des coefficients de
-- -- matières à tout le personnel. Pour `programmations`, `programmation_lignes`,
-- -- `acquis_items`, `acquis_observations` et `sous_niveaux`, restaurer les
-- -- policies des migrations qui les ont créées — elles étaient déjà par rôle.
-- notify pgrst, 'reload schema';
