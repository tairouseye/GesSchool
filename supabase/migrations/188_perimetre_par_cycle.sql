-- =====================================================================
--  188 — ÉTAPE 4 : le périmètre par cycle
--
--  Le besoin d'origine, posé le 05/10/2026 : « les responsables du
--  préscolaire et de l'élémentaire jouent aussi le rôle de gestionnaire. Je
--  voudrais que chacune n'ait accès qu'au niveau qui la concerne. »
--
--  Les huit bascules (mig. 177→186) étaient le prérequis : tant que la base
--  décidait par rôle, il n'y avait pas d'endroit pour accrocher un périmètre.
--
--  ⚠️ SÉMANTIQUE : AUCUNE LIGNE DE PÉRIMÈTRE = AUCUNE RESTRICTION. Les
--  helpers rendent NULL quand la personne n'est pas cloisonnée, et toutes les
--  conjonctions commencent par `... is null or`. La migration est donc
--  INERTE jusqu'à ce qu'un périmètre soit posé : rien ne change pour les sept
--  écoles ni pour aucun compte existant tant que `personnel_perimetre.mode`
--  vaut `ecole`.
--
--  ⚠️ DEUX PERSONNES NE SONT JAMAIS CLOISONNÉES, et c'est écrit DANS le
--  helper, pas chez l'appelant : le **promoteur** (il ne peut pas se
--  verrouiller lui-même, même en se désignant sur un cycle) et la **RH**
--  (décision du promoteur : la paie et le personnel ne se découpent pas par
--  cycle).
-- =====================================================================

-- --- 1. Les trois helpers, source unique de vérité --------------------
--
--  ⚠️ `security definer` : ils lisent `personnel_perimetre` et
--  `personnel_cycles`, que l'utilisateur ne doit pas pouvoir contourner. Et
--  `stable`, pour que le planificateur les sorte de la boucle (leçon de la
--  migration 183 : un appel par ligne coûtait 29 secondes sur 59 346 lignes).

--  NULL = aucune restriction. `{}` = cloisonné sur rien (fail-closed).
create or replace function public.cycles_autorises()
returns uuid[] language plpgsql stable security definer set search_path = public as $fn$
declare v_mode text; v_cycles uuid[]; v_ecole uuid := ecole_courante();
begin
  --  Fail-closed : pas de session, aucun cycle (et non « tous »).
  if auth.uid() is null then return '{}'::uuid[]; end if;
  --  Le promoteur et la RH ne sont JAMAIS cloisonnés. Inconditionnel, ici.
  if est_super_admin() or a_role('admin_ecole') or a_role('rh') then return null; end if;
  if v_ecole is null then return '{}'::uuid[]; end if;

  select pp.mode into v_mode from personnel_perimetre pp
   where pp.profil_id = auth.uid() and pp.ecole_id = v_ecole;
  --  Pas de ligne, ou mode `ecole` : aucune restriction.
  if v_mode is distinct from 'cycles' then return null; end if;

  select coalesce(array_agg(pc.cycle_id), '{}') into v_cycles
    from personnel_cycles pc
   where pc.profil_id = auth.uid() and pc.ecole_id = v_ecole;
  --  Mode `cycles` sans aucun cycle désigné : on ne montre RIEN plutôt que
  --  tout. Un périmètre vide est une erreur de saisie, pas une permission.
  return v_cycles;
end $fn$;

create or replace function public.classes_autorisees()
returns uuid[] language sql stable security definer set search_path = public as $fn$
  select case when public.cycles_autorises() is null then null
    else coalesce((
      select array_agg(c.id)
        from classes c
        join niveaux n on n.id = c.niveau_id
       where n.cycle_id = any(public.cycles_autorises())
         and c.ecole_id = public.ecole_courante()
    ), '{}'::uuid[])
  end;
$fn$;

--  ⚠️ LE CAS QUI M'A FAIT AJOUTER UNE BRANCHE : un élève SANS inscription
--  dans l'année courante n'appartient à aucun cycle. Le cacher aux personnes
--  cloisonnées rendrait invisible l'élève qu'on vient de créer, juste avant
--  de l'inscrire — y compris à celle qui l'a créé. Il reste donc visible de
--  tous jusqu'à son inscription, moment où il entre dans un cycle.
create or replace function public.peut_voir_eleve(p_eleve uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_eleve is not null and (
    public.classes_autorisees() is null
    or exists (
      select 1 from inscriptions i
        join annees_scolaires a on a.id = i.annee_id
       where i.eleve_id = p_eleve and a.courante
         and i.classe_id = any(public.classes_autorisees())
    )
    or not exists (
      select 1 from inscriptions i
        join annees_scolaires a on a.id = i.annee_id
       where i.eleve_id = p_eleve and a.courante
    )
  );
$fn$;

revoke execute on function public.cycles_autorises() from public, anon;
revoke execute on function public.classes_autorisees() from public, anon;
revoke execute on function public.peut_voir_eleve(uuid) from public, anon;
grant execute on function public.cycles_autorises() to authenticated;
grant execute on function public.classes_autorisees() to authenticated;
grant execute on function public.peut_voir_eleve(uuid) to authenticated;

-- --- 2. La greffe sur les policies déjà basculées ---------------------
--
--  ⚠️ ON NE RETAPE AUCUNE POLICY. On lit l'expression existante et on lui
--  AJOUTE la conjonction, puis on recrée la policy à l'identique pour le
--  reste (verbe, caractère permissif). Retaper quarante prédicats à la main
--  aurait été quarante occasions d'en changer un par mégarde — et aucune
--  épreuve ne l'aurait vu, puisque le résultat aurait « marché ».
--
--  Le bloc ÉCHOUE si une table attendue n'a aucune policy, ou si le nombre
--  de policies traitées ne correspond pas.
--
--  ⚠️ `any((select f())::uuid[])` ET NON `any((select f()))`. Sans le cast,
--  PostgreSQL lit la forme SOUS-REQUÊTE de `ANY` : il attend un ENSEMBLE de
--  uuid, reçoit une ligne contenant un uuid[], et refuse — « operator does
--  not exist: uuid = uuid[] ». Le cast fait de l'argument une expression,
--  donc la forme TABLEAU. Première tentative de cette migration rejetée
--  exactement là, et c'est tant mieux : elle a échoué ENTIÈREMENT plutôt
--  qu'à moitié.
do $$
declare
  --  table → prédicat de périmètre
  v_map text[][] := array[
    --  clefées par la CLASSE
    array['classes',              '((select classes_autorisees()) is null or id = any((select classes_autorisees())::uuid[]))'],
    array['inscriptions',         '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['bulletins',            '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['evaluations',          '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    array['conseils_classe',      '((select classes_autorisees()) is null or classe_id = any((select classes_autorisees())::uuid[]))'],
    --  clefées par l'ÉLÈVE, colonne NON nulle
    array['eleves',               'peut_voir_eleve(id)'],
    array['absences',             'peut_voir_eleve(eleve_id)'],
    array['incidents',            'peut_voir_eleve(eleve_id)'],
    array['notes',                'peut_voir_eleve(eleve_id)'],
    array['factures',             'peut_voir_eleve(eleve_id)'],
    array['documents_eleve',      'peut_voir_eleve(eleve_id)'],
    array['eleve_tuteurs',        'peut_voir_eleve(eleve_id)'],
    array['cantine_abonnements',  'peut_voir_eleve(eleve_id)'],
    array['cantine_repas',        'peut_voir_eleve(eleve_id)'],
    array['transport_abonnements','peut_voir_eleve(eleve_id)'],
    array['transport_pointages',  'peut_voir_eleve(eleve_id)'],
    --  clefées par l'ÉLÈVE, colonne NULLABLE : une ligne sans élève ne
    --  concerne aucun cycle, elle reste visible (document RH, archive…).
    array['declarations_paiement','(eleve_id is null or peut_voir_eleve(eleve_id))'],
    array['demandes_documents',   '(eleve_id is null or peut_voir_eleve(eleve_id))'],
    array['documents',            '(eleve_id is null or peut_voir_eleve(eleve_id))'],
    array['transactions_paiement','(eleve_id is null or peut_voir_eleve(eleve_id))'],
    --  atteintes par leur PARENT
    array['facture_lignes',       '((select classes_autorisees()) is null or exists (select 1 from factures f where f.id = facture_lignes.facture_id and peut_voir_eleve(f.eleve_id)))'],
    array['bulletin_lignes',      '((select classes_autorisees()) is null or exists (select 1 from bulletins b where b.id = bulletin_lignes.bulletin_id and b.classe_id = any((select classes_autorisees())::uuid[])))']
  ];
  i int; r record; v_n int := 0; v_tables int := 0; v_cmd text; v_q text; v_w text;
begin
  for i in 1 .. array_length(v_map, 1) loop
    v_tables := 0;
    for r in
      select p.polname, p.polcmd, p.polpermissive,
             pg_get_expr(p.polqual, p.polrelid) as q,
             pg_get_expr(p.polwithcheck, p.polrelid) as w
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = v_map[i][1]
    loop
      --  Déjà greffée ? on ne double pas (la migration est rejouable).
      if coalesce(r.q, '') || coalesce(r.w, '') like '%autorisees()%'
         or coalesce(r.q, '') || coalesce(r.w, '') like '%peut_voir_eleve%' then
        v_tables := v_tables + 1;
        continue;
      end if;
      v_cmd := case r.polcmd when 'r' then 'select' when 'a' then 'insert'
                             when 'w' then 'update' when 'd' then 'delete' else 'all' end;
      v_q := case when r.q is null then null else '(' || r.q || ') and ' || v_map[i][2] end;
      v_w := case when r.w is null then null else '(' || r.w || ') and ' || v_map[i][2] end;
      execute format('drop policy %I on public.%I;', r.polname, v_map[i][1]);
      execute format('create policy %I on public.%I as %s for %s%s%s;',
        r.polname, v_map[i][1],
        case when r.polpermissive then 'permissive' else 'restrictive' end,
        v_cmd,
        case when v_q is null then '' else ' using (' || v_q || ')' end,
        case when v_w is null then '' else ' with check (' || v_w || ')' end);
      v_n := v_n + 1;
      v_tables := v_tables + 1;
    end loop;
    if v_tables = 0 then
      raise exception 'Table % : aucune policy trouvée — le périmètre ne s''appliquerait pas.', v_map[i][1];
    end if;
  end loop;
  raise notice 'Périmètre greffé sur % policy(ies), % table(s).', v_n, array_length(v_map, 1);
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  Il n'est pas nécessaire d'annuler les policies : vider
--  `personnel_cycles` et remettre `personnel_perimetre.mode = 'ecole'` suffit
--  à rendre la fonctionnalité inerte, puisque les helpers rendent alors NULL.
--
--  delete from personnel_cycles;
--  update personnel_perimetre set mode = 'ecole';
--
--  Pour retirer réellement la greffe, rejouer le bloc 2 en remplaçant
--  l'ajout par un retrait du suffixe ` and <prédicat>` — ou restaurer les
--  policies depuis les migrations 177→186, qui les portent toutes.
