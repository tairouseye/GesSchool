-- =====================================================================
--  177 — Premier domaine basculé sur les cases : la Comptabilité
--
--  Première étape de l'étape 3 du plan. On REMPLACE `a_role('comptable')`
--  par `a_acces('comptabilite')`, et on retire la branche rôle.
--
--  ⚠️ POURQUOI ON NE GARDE PAS LES DEUX. Laisser `a_role('comptable') or
--  a_acces('comptabilite')` serait confortable — aucun risque de perte —
--  mais alors décocher la case masquerait l'écran pendant que la base
--  continuerait d'autoriser. C'est le défaut corrigé par la migration 173
--  et par les lots 1 et 2 de l'audit. Le backfill de la migration 175
--  garantit que personne ne perd son accès : il a donné la case
--  `comptabilite` à tous les comptables.
--
--  La Comptabilité d'abord parce que c'est le domaine le plus isolé : ses
--  tables ne sont lues que par `src/lib/comptabilite.js`. Une exception,
--  vérifiée avant d'écrire et traitée ci-dessous : `comptes`.
-- =====================================================================

-- --- 1. Deux chemins d'écriture ouverts aux ANONYMES -------------------
--
--  🔴 TROUVÉ EN INVENTORIANT LE DOMAINE, et c'est plus grave que la faille
--  de lecture de ce matin. `poster_salaire_charge(uuid)` et
--  `poster_salaire_reglement(uuid)` sont `security definer`, n'ont AUCUNE
--  garde — ni établissement, ni rôle — et étaient `grant`ées à **anon**
--  comme à `authenticated`. Un appelant non authentifié qui connaît un
--  identifiant de salaire ou de dépense pouvait donc **créer des écritures
--  comptables** dans le grand livre d'une école.
--
--  Exploitation peu probable (deux UUID non énumérables), mais c'est un
--  chemin d'ÉCRITURE, pas de lecture.
--
--  Les autres fonctions internes du même groupe (`_compta_poster`,
--  `poster_depense`, `poster_facture`, `poster_paiement`, `recalc_salaire`)
--  avaient bien été révoquées : ces deux-là ont été oubliées.
--
--  ⚠️ VÉRIFIÉ AVANT DE RÉVOQUER, comme pour `absences_periode` (mig. 174) :
--  leurs seuls appelants sont les déclencheurs `compta_salaire_upd` et
--  `poster_depense_ins`, plus `comptabiliser_exercice` — tous
--  `security definer` appartenant à `postgres`, donc ils continueront de
--  les atteindre. Aucun appel depuis `src/`.
--  ⚠️ `from public`, ET PAS SEULEMENT `from anon, authenticated` : c'est
--  l'erreur que j'ai faite au premier essai. L'ACL de ces fonctions portait
--  `=X/postgres`, c'est-à-dire EXECUTE accordé à **PUBLIC** — le défaut de
--  PostgreSQL. `anon` et `authenticated` n'avaient aucun droit propre : ils
--  HÉRITAIENT de PUBLIC. Révoquer à ces deux rôles ne retirait donc rien, et
--  l'appel anonyme passait toujours. Seul le retrait à PUBLIC ferme la porte.
revoke execute on function public.poster_salaire_charge(uuid) from public, anon, authenticated;
revoke execute on function public.poster_salaire_reglement(uuid) from public, anon, authenticated;

comment on function public.poster_salaire_charge(uuid) is
  'INTERNE (déclencheur compta_salaire_upd). Ne pas accorder à anon ni authenticated : '
  'aucune garde d''établissement ni de rôle — elle ÉCRIT dans le grand livre (mig. 177).';
comment on function public.poster_salaire_reglement(uuid) is
  'INTERNE (déclencheur poster_depense_ins). Même avertissement que poster_salaire_charge (mig. 177).';

-- --- 2. Les comptes de trésorerie : lus par TROIS domaines -------------
--
--  ⚠️ C'EST L'EXCEPTION QUI A FAILLI CASSER LA BASCULE. `comptes` n'est pas
--  une table de la seule Comptabilité :
--    - le secrétariat et le comptable y choisissent le compte d'encaissement
--      (`Paiements.jsx`, case `encaissement`) ;
--    - la RH y choisit le compte qui règle les salaires (`RH.jsx`, case `rh`).
--  La réduire à `a_acces('comptabilite')` aurait empêché le secrétariat
--  d'encaisser — un verrou juste en apparence, une régression en pratique.
--
--  Lecture : les trois domaines. Écriture : la Comptabilité seule — créer
--  ou supprimer un compte de trésorerie est un acte comptable.
drop policy if exists comptes_tenant on public.comptes;
drop policy if exists comptes_lecture_rh on public.comptes;

create policy comptes_select on public.comptes
  for select using (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (a_acces('comptabilite') or a_acces('encaissement') or a_acces('rh')))
  );

create policy comptes_ecrire on public.comptes
  for all
  using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('comptabilite')))
  with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('comptabilite')));

-- --- 3. Le reste du domaine, lu par la seule Comptabilité --------------
--
--  ⚠️ CECI RESSERRE UN ACCÈS, et il faut le dire : `ecritures`,
--  `exercices`, `pieces` et `regles_ecriture` reposaient sur
--  `est_gestion()`, qui vaut vrai pour la **direction**. Un responsable
--  pédagogique pouvait donc lire et écrire le grand livre par un appel
--  direct, alors que l'écran le lui cache (`ACCES.comptabilite` ne nomme
--  que le comptable). Encore un contrôle frontend pris pour une sécurité.
--  La case `comptabilite` n'est pas dans le modèle « Responsable
--  pédagogique » : il perd donc cet accès, ce qui est l'intention d'origine.
do $$
declare t text;
begin
  foreach t in array array['depenses', 'recettes', 'ecritures', 'exercices', 'pieces', 'regles_ecriture'] loop
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
    execute format($p$create policy %1$s_acces on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('comptabilite')))
      with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('comptabilite')));$p$, t);
  end loop;
end $$;

-- --- 4. Les fonctions du domaine -------------------------------------
--
--  `soldes_comptes` portait son contrôle d'établissement mais AUCUN
--  contrôle de rôle : tout membre de l'école pouvait lire les soldes de
--  trésorerie. On ajoute la case, en gardant les trois domaines comme pour
--  la table (l'écran Paiements affiche le solde du compte d'encaissement).
create or replace function public.soldes_comptes(p_ecole uuid)
returns table(compte_id uuid, entrees numeric, sorties numeric)
language sql stable security definer set search_path = public as $fn$
  select c.id,
    ( coalesce((select sum(r.montant) from recettes  r where r.compte_id = c.id and r.ecole_id = p_ecole), 0)
    + coalesce((select sum(p.montant) from paiements p where p.compte_id = c.id and p.ecole_id = p_ecole), 0)
    )::numeric,
    coalesce((select sum(d.montant) from depenses d where d.compte_id = c.id and d.ecole_id = p_ecole), 0)::numeric
  from comptes c
  where c.ecole_id = p_ecole
    and (public.est_super_admin()
         or (public.ecole_courante() = p_ecole
             and (public.a_acces('comptabilite') or public.a_acces('encaissement') or public.a_acces('rh'))));
$fn$;

--  Les quatre RPC d'écriture comptable portaient
--  `est_super_admin() or est_gestion() or a_role('comptable')` — donc la
--  direction, là encore. On remplace la garde SANS retoucher les corps :
--  la substitution est explicite, et le bloc échoue bruyamment si la garde
--  attendue n'est pas trouvée, plutôt que de laisser une fonction ouverte.
do $$
declare f record; v_def text; v_new text; v_n int := 0;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('assurer_exercices', 'comptabiliser_exercice',
                         'comptabiliser_piece', 'supprimer_piece')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_new := replace(v_def,
      'est_super_admin() or est_gestion() or a_role(''comptable'')',
      'a_acces(''comptabilite'')');
    if v_new = v_def then
      raise exception 'Garde attendue introuvable dans % : ne pas basculer à l''aveugle.', f.proname;
    end if;
    execute v_new;
    v_n := v_n + 1;
  end loop;
  if v_n <> 4 then
    raise exception 'Attendu 4 fonctions à basculer, % traitée(s).', v_n;
  end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- grant execute on function public.poster_salaire_charge(uuid) to anon, authenticated;
-- grant execute on function public.poster_salaire_reglement(uuid) to anon, authenticated;
-- drop policy if exists comptes_select on public.comptes;
-- drop policy if exists comptes_ecrire on public.comptes;
-- create policy comptes_tenant on public.comptes for all
--   using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('comptable'))))
--   with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('comptable'))));
-- create policy comptes_lecture_rh on public.comptes for select
--   using (est_super_admin() or (ecole_id = ecole_courante() and a_role('rh')));
-- do $$ declare t text; begin
--   foreach t in array array['depenses','recettes','ecritures','exercices','pieces','regles_ecriture'] loop
--     execute format('drop policy if exists %1$s_acces on public.%1$I;', t);
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))));$p$, t);
--   end loop; end $$;
-- -- puis rétablir la garde des 4 RPC en remplaçant a_acces('comptabilite')
-- -- par est_super_admin() or est_gestion() or a_role('comptable').
-- notify pgrst, 'reload schema';
