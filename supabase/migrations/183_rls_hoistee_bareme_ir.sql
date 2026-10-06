-- =====================================================================
--  183 — Le barème de l'IR mettait 29 SECONDES à se lire
--
--  🔴 TROUVÉ EN ÉPROUVANT LA MIGRATION 182, et c'est un défaut de
--  PERFORMANCE, pas de droits. Sous une session RH réelle :
--
--      select count(*) from personnels   →     33 ms
--      select count(*) from bareme_ir    → 35 408 ms
--
--  Le plan dit tout :
--      Index Only Scan using bareme_ir_effet_idx (actual rows=29664)
--        Filter: (est_super_admin() OR ((ecole_id = ecole_courante())
--                 AND a_acces('rh')))
--        Rows Removed by Filter: 29682
--      Execution Time: 28793 ms
--
--  Le prédicat est évalué **par ligne**, sur 59 346 lignes, à ~0,49 ms
--  chacune. Pourquoi ? Parce que l'expression mêle un terme DÉPENDANT de la
--  ligne (`ecole_id = ecole_courante()`) aux appels de fonction : PostgreSQL
--  ne peut alors rien sortir de la boucle, et rappelle `est_super_admin()` et
--  `a_acces()` pour chaque ligne. Isolés, ces mêmes appels sont hoistés et
--  coûtent 6 ms pour 30 000 évaluations — ce ne sont donc pas les fonctions
--  qui sont lentes, c'est leur PLACE dans l'expression.
--
--  ⚠️ CE N'EST PAS LA BASCULE QUI L'A CAUSÉ, mesuré plutôt que supposé, sur
--  8 000 lignes et sous la même session :
--      ancienne forme (est_gestion() or a_role('rh') or a_role('comptable'))
--                                                      →  9 715 ms
--      nouvelle forme (a_acces('rh'))                  →  6 203 ms
--      forme HOISTÉE                                   →      3 ms
--  La bascule a donc rendu la policy 36 % plus rapide — et l'une comme
--  l'autre était inutilisable. Le défaut est antérieur ; la 182 l'a seulement
--  rendu visible, parce qu'elle a lu la table pour de vrai.
--
--  LA CORRECTION : envelopper chaque appel de fonction dans une sous-requête
--  scalaire `(select f())`. PostgreSQL en fait alors un InitPlan, évalué UNE
--  fois, et le terme restant devient `ecole_id = <constante>` — que l'index
--  `bareme_ir_effet_idx` sait utiliser. Gain mesuré : **2 000 ×**.
--
--  ⚠️ SÉMANTIQUE INCHANGÉE, et c'est ce qui rend ce correctif sûr :
--  `(select f())` rend exactement ce que rend `f()`, y compris NULL (et
--  `ecole_id = NULL` reste non-vrai, comme avant). Aucun droit n'est modifié.
--
--  ⚠️ PORTÉE DÉLIBÉRÉMENT LIMITÉE À CETTE TABLE. Une seule table de la base
--  dépasse 2 000 lignes : celle-ci (59 346). La suivante en compte 248. Ré-
--  écrire les ~200 policies de l'application serait un refactoring global
--  sans nécessité. En revanche, les domaines qui restent à basculer
--  (`notes`, `absences`, `facture_lignes`…) grandissent avec les effectifs :
--  ils recevront la forme hoistée d'emblée.
-- =====================================================================

drop policy if exists bareme_ir_acces on public.bareme_ir;
create policy bareme_ir_acces on public.bareme_ir
  for all
  using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante()) and (select a_acces('rh')))
  )
  with check (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante()) and (select a_acces('rh')))
  );

comment on table public.bareme_ir is
  'Barème de l''IR, chargé par école et par périodicité (~30 000 lignes/école). '
  'Sa policy utilise la forme hoistée `(select f())` : sans elle, la lecture '
  'prend 29 s au lieu de 3 ms (mig. 183). Ne pas la réécrire en appels nus.';

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop policy if exists bareme_ir_acces on public.bareme_ir;
-- create policy bareme_ir_acces on public.bareme_ir for all
--   using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')))
--   with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('rh')));
-- -- ⚠️ Annuler cette migration remet la lecture du barème à 29 secondes.
-- notify pgrst, 'reload schema';
