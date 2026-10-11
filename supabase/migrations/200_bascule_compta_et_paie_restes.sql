-- =====================================================================
--  200 — Comptabilité & paie : les 10 tables qui restaient
--
--  🔴 POURQUOI MAINTENANT, ET PAS DANS L'ORDRE PRÉVU. Le promoteur a demandé
--  que **les deux responsables de Tut'Tank ne voient pas la Comptabilité,
--  alors que la responsable RH & Paie la voie**. La migration 199 lui donne le
--  moyen de décocher la case — mais mesuré juste après : décocher
--  `comptabilite` ne changeait RIEN. La responsable lisait toujours les 102
--  comptes du plan comptable, et la RH n'en lisait aucun.
--
--  La cause : ces tables étaient encore gardées par `est_gestion() or
--  a_role('comptable')`. Or `est_gestion()` comprend la **direction**, et les
--  deux responsables portent `direction` + `comptable`. La case ne décidait
--  rien. C'est exactement le défaut que le plan nomme « ⚠️ Ne pas garder les
--  deux » : l'écran se ferme, la base continue d'autoriser.
--
--  ⚠️ L'ÉCRAN À COCHER NE VAUT QUE CE QUE VALENT LES POLICIES. Livrer la 199
--  seule aurait donné au promoteur un réglage qui a l'air de marcher et qui ne
--  protège rien — pire que pas de réglage du tout.
--
--  ⚠️ UNE TABLE EST PARTAGÉE, et la manquer aurait cassé la paie en silence :
--  **`plan_comptable` est lu par `rh.js`** autant que par `comptabilite.js` —
--  la paie rattache ses lignes aux comptes. Sa garde porte donc les DEUX
--  cases. Même piège que `dettes_personnel` à la migration 182, trouvé de la
--  même façon : en cherchant qui lit la table avant de la resserrer.
--
--  Les quatre autres (`journaux`, `parametres_compta`, `periodes_compta`,
--  `categories_finance`) ne sont lues que par `comptabilite.js` — vérifié.
--  Et `categories_finance` va bien à `comptabilite`, cohérent avec
--  `recettes`/`depenses` que la migration 177 y a déjà mises.
-- =====================================================================

do $$
declare
  v_map text[][] := array[
    --  ⚠️ LA TABLE PARTAGÉE : la paie en a besoin.
    array['plan_comptable',       '(select a_acces(''comptabilite'')) or (select a_acces(''rh''))'],
    --  La comptabilité générale, lue par son seul écran.
    array['journaux',             '(select a_acces(''comptabilite''))'],
    array['parametres_compta',    '(select a_acces(''comptabilite''))'],
    array['periodes_compta',      '(select a_acces(''comptabilite''))'],
    array['categories_finance',   '(select a_acces(''comptabilite''))'],
    --  La paie : traduction 1 pour 1 de `est_admin() or a_role('rh')`.
    array['avances_prets',        '(select a_acces(''rh''))'],
    array['element_affectations', '(select a_acces(''rh''))'],
    array['element_exclusions',   '(select a_acces(''rh''))'],
    array['regime_elements',      '(select a_acces(''rh''))'],
    array['remboursements',       '(select a_acces(''rh''))']
  ];
  i int; t text; v_pred text; v_n int := 0; r record;
begin
  for i in 1 .. array_length(v_map, 1) loop
    t := v_map[i][1]; v_pred := v_map[i][2];
    --  Policies retirées par ÉNUMÉRATION du catalogue, pas par leurs noms
    --  attendus : une policy permissive oubliée annulerait tout le
    --  resserrement, puisqu'elles se combinent par OU (leçon de la mig. 193).
    for r in select p.polname from pg_policy p
              join pg_class c on c.oid = p.polrelid
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = t
    loop
      execute format('drop policy %I on public.%I;', r.polname, t);
    end loop;
    --  Forme HOISTÉE `(select f())` : évaluée une seule fois par requête, au
    --  lieu d'une fois par ligne. Mesuré ailleurs dans ce chantier : 35 s
    --  → 14 ms sur une table de barème.
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and (%2$s)))
      with check ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and (%2$s)));$p$,
      t, v_pred);
    v_n := v_n + 1;
  end loop;
  if v_n <> 10 then raise exception 'Attendu 10 tables, % traitée(s).', v_n; end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; v_p text; r record; begin
--   foreach t in array array['plan_comptable','journaux','parametres_compta',
--                            'periodes_compta','categories_finance','avances_prets',
--                            'element_affectations','element_exclusions',
--                            'regime_elements','remboursements'] loop
--     for r in select p.polname from pg_policy p join pg_class c on c.oid=p.polrelid
--               join pg_namespace n on n.oid=c.relnamespace
--              where n.nspname='public' and c.relname=t loop
--       execute format('drop policy %I on public.%I;', r.polname, t);
--     end loop;
--     v_p := case when t in ('plan_comptable','journaux','parametres_compta',
--                            'periodes_compta','categories_finance')
--                 then 'est_gestion() or a_role(''comptable'')'
--                 else 'est_admin() or a_role(''rh'')' end;
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (%2$s)))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (%2$s)));$p$, t, v_p);
--   end loop; end $$;
-- -- ⚠️ Annuler redonne la comptabilité à TOUTE la direction, quelles que
-- -- soient les cases cochées — c'est-à-dire que le réglage de la 199
-- -- redevient un contrôle d'écran sans effet.
-- notify pgrst, 'reload schema';
