-- =====================================================================
--  185 — Septième domaine : Notes & bulletins
--
--  Le domaine le plus structuré du chantier, et celui où une bascule
--  distraite aurait fait le plus de dégâts. Partout le même motif :
--
--      est_gestion() OR (a_role('enseignant') AND <cloisonnement>)
--
--  — « l'administration voit tout, l'enseignant voit ce qu'il enseigne »
--  (migrations 058 et 173). Et `est_gestion()` vaut {promoteur, direction},
--  c'est-à-dire EXACTEMENT `p_toutes_classes`, le pouvoir posé à la 184.
--
--  🔴 LE PIÈGE, le même qu'à la migration 184 : traduire `est_gestion()` par
--  `a_acces('notes_bulletins')` aurait donné toutes les classes à TOUT
--  enseignant, puisqu'il détient cette case. La bascule aurait supprimé le
--  cloisonnement en croyant le traduire. La traduction juste est :
--
--      a_acces('p_toutes_classes') OR (a_acces('notes_bulletins') AND <cloisonnement>)
--
--  ⚠️ BONNE NOUVELLE DE CONCEPTION : les deux gardes les plus utilisées sont
--  déjà FACTORISÉES dans `peut_noter_evaluation()` et
--  `peut_editer_bulletin()`. Les basculer suffit — les six policies qui les
--  appellent suivent sans être touchées. C'est l'intérêt d'avoir nommé la
--  règle une fois.
-- =====================================================================

-- --- 1. Les deux gardes factorisées -----------------------------------
create or replace function public.peut_noter_evaluation(p_eval uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select a_acces('p_toutes_classes') or exists (
    select 1 from evaluations ev
    where ev.id = p_eval
      and a_acces('notes_bulletins')
      and enseigne_classe_matiere(ev.classe_id, ev.matiere_id)
  );
$fn$;

create or replace function public.peut_editer_bulletin(p_bulletin uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select a_acces('p_toutes_classes') or exists (
    select 1 from bulletins b
    where b.id = p_bulletin
      and a_acces('notes_bulletins')
      and enseigne_classe(b.classe_id)
  );
$fn$;

-- --- 2. Les policies qui portent la règle en clair ---------------------
--
--  ⚠️ FORME HOISTÉE pour les termes indépendants de la ligne. `notes` est la
--  table qui grandira le plus vite de toute l'application : une école de
--  1 000 élèves × 10 matières × 3 trimestres × 3 devoirs fait 90 000 lignes.
--  La leçon de la migration 183 (29 secondes sur 59 346 lignes) s'applique
--  donc ici avant même que le problème se pose.
--
--  ⚠️ `peut_noter_evaluation(evaluation_id)` et `peut_editer_bulletin(bulletin_id)`
--  NE PEUVENT PAS être hoistées : leur argument dépend de la ligne. Mais les
--  envelopper n'aurait rien donné, alors que mettre `est_super_admin()` et
--  `ecole_courante()` en sous-requête réduit le travail par ligne à un seul
--  appel au lieu de trois. C'est la part du gain qu'on peut prendre.

--  notes : lecture
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and ((select a_acces('p_toutes_classes'))
             or ((select a_acces('notes_bulletins'))
                 and exists (select 1 from evaluations v
                              where v.id = notes.evaluation_id and enseigne_classe(v.classe_id)))))
  );

--  notes : écriture — la garde factorisée décide, on ne hoiste que l'enveloppe
drop policy if exists notes_ins on public.notes;
drop policy if exists notes_upd on public.notes;
drop policy if exists notes_del on public.notes;
create policy notes_ins on public.notes for insert
  with check ((select est_super_admin())
              or (ecole_id = (select ecole_courante()) and peut_noter_evaluation(evaluation_id)));
create policy notes_upd on public.notes for update
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and peut_noter_evaluation(evaluation_id)))
  with check ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and peut_noter_evaluation(evaluation_id)));
create policy notes_del on public.notes for delete
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and peut_noter_evaluation(evaluation_id)));

--  evaluations : lire = la classe, écrire = la classe ET la matière.
--  ⚠️ CETTE DISTINCTION EST VOULUE (mig. 058) : un enseignant voit les
--  évaluations de sa classe (pour s'y situer) mais ne note que SA matière.
--  Ne pas l'uniformiser.
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and ((select a_acces('p_toutes_classes'))
             or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id))))
  );
drop policy if exists evaluations_ins on public.evaluations;
drop policy if exists evaluations_upd on public.evaluations;
drop policy if exists evaluations_del on public.evaluations;
create policy evaluations_ins on public.evaluations for insert
  with check ((select est_super_admin())
              or (ecole_id = (select ecole_courante())
                  and ((select a_acces('p_toutes_classes'))
                       or ((select a_acces('notes_bulletins'))
                           and enseigne_classe_matiere(classe_id, matiere_id)))));
create policy evaluations_upd on public.evaluations for update
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins'))
                      and enseigne_classe_matiere(classe_id, matiere_id)))))
  with check ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins'))
                      and enseigne_classe_matiere(classe_id, matiere_id)))));
create policy evaluations_del on public.evaluations for delete
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins'))
                      and enseigne_classe_matiere(classe_id, matiere_id)))));

--  bulletins : les quatre verbes portent la même règle
drop policy if exists bulletins_select on public.bulletins;
drop policy if exists bulletins_ins on public.bulletins;
drop policy if exists bulletins_upd on public.bulletins;
drop policy if exists bulletins_del on public.bulletins;
create policy bulletins_select on public.bulletins for select
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id)))));
create policy bulletins_ins on public.bulletins for insert
  with check ((select est_super_admin())
              or (ecole_id = (select ecole_courante())
                  and ((select a_acces('p_toutes_classes'))
                       or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id)))));
create policy bulletins_upd on public.bulletins for update
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id)))))
  with check ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id)))));
create policy bulletins_del on public.bulletins for delete
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante())
             and ((select a_acces('p_toutes_classes'))
                  or ((select a_acces('notes_bulletins')) and enseigne_classe(classe_id)))));

--  bulletin_lignes : lecture par la classe du bulletin, écriture par la garde
--  factorisée (déjà basculée au bloc 1).
drop policy if exists bulletin_lignes_select on public.bulletin_lignes;
create policy bulletin_lignes_select on public.bulletin_lignes
  for select using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and ((select a_acces('p_toutes_classes'))
             or ((select a_acces('notes_bulletins'))
                 and exists (select 1 from bulletins b
                              where b.id = bulletin_lignes.bulletin_id and enseigne_classe(b.classe_id)))))
  );

-- --- 3. Les procès-verbaux de conseil de classe -----------------------
--
--  🔴 ENCORE UNE LECTURE SANS PRÉDICAT DE RÔLE. `conseils_classe_select`
--  valait `est_super_admin() or ecole_id = ecole_courante()` : tout membre du
--  personnel lisait les procès-verbaux de conseil de classe — décisions de
--  passage, appréciations, délibérations. Fermé à la case pédagogique.
--
--  ⚠️ VÉRIFIÉ : la signature « gestion » du PV n'en souffre pas, parce que
--  `signer_conseil` est `security definer` et lit la table elle-même.
--
--  L'écriture nommait `secretaire`, qui ne peut pas ouvrir l'écran Bulletins
--  (`ACCES.bulletins` = direction + enseignant) : droit inatteignable, retiré.
--  Le PV appartient à qui arrête les bulletins — `p_bulletins_diffuser`.
drop policy if exists conseils_classe_select on public.conseils_classe;
drop policy if exists conseils_classe_ins on public.conseils_classe;
drop policy if exists conseils_classe_upd on public.conseils_classe;
drop policy if exists conseils_classe_del on public.conseils_classe;
create policy conseils_classe_select on public.conseils_classe for select
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and (select a_acces('notes_bulletins'))));
create policy conseils_classe_ecrire on public.conseils_classe for all
  using ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and (select a_acces('p_bulletins_diffuser'))))
  with check ((select est_super_admin())
         or (ecole_id = (select ecole_courante()) and (select a_acces('p_bulletins_diffuser'))));

-- --- 4. Les RPC du domaine -------------------------------------------
--
--  Les correspondances, vérifiées une par une :
--    `avancer_bulletins`         = promoteur + direction  → `p_bulletins_diffuser`
--    `_verifier_statut_bulletin` = idem (déclencheur)     → `p_bulletins_diffuser`
--    `signer_conseil`            = promoteur + comptable + secrétariat → `_gestion`
--    `bulletin_pour_attestation` = + direction            → `certificats` ou `p_toutes_classes`
--    `moyenne_notes_*`           = tenant SEUL            → + `_pedagogie`
--
--  🔴 `signer_conseil` MÉRITE UNE EXPLICATION. Sa garde exclut DÉLIBÉRÉMENT
--  `est_gestion()`, avec un commentaire qui le dit : sinon un responsable
--  pédagogique aurait pu fournir les DEUX signatures du procès-verbal, et le
--  « PV à deux signatures » n'en aurait exigé qu'une. En cases, comptable et
--  secrétariat partagent `_gestion`, que la direction N'A PAS — la traduction
--  conserve donc exactement la propriété. (Et le verrou de fond reste le
--  contrôle « vous avez déjà signé » par `profil_id`, qui empêche une même
--  personne de poser les deux, quels que soient ses accès.)
do $$
declare
  v_paires text[][] := array[
    array['avancer_bulletins',   'est_admin() or a_role(''direction'')', 'a_acces(''p_bulletins_diffuser'')'],
    array['_verifier_statut_bulletin', 'est_super_admin() or est_admin() or a_role(''direction'')',
          'est_super_admin() or a_acces(''p_bulletins_diffuser'')'],
    array['signer_conseil',      'est_admin() or a_role(''comptable'') or a_role(''secretaire'')', 'a_acces(''_gestion'')'],
    array['bulletin_pour_attestation', 'est_gestion() or a_role(''comptable'') or a_role(''secretaire'')',
          'a_acces(''certificats'') or a_acces(''p_toutes_classes'')'],
    array['moyenne_notes_ecole', 'public.est_super_admin() or public.ecole_courante() = p_ecole',
          'public.est_super_admin() or (public.ecole_courante() = p_ecole and public.a_acces(''_pedagogie''))'],
    array['moyenne_notes_par_niveau', 'public.est_super_admin() or public.ecole_courante() = p_ecole',
          'public.est_super_admin() or (public.ecole_courante() = p_ecole and public.a_acces(''_pedagogie''))']
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
  if v_n <> 6 then
    raise exception 'Attendu 6 substitutions, % traitée(s).', v_n;
  end if;
end $$;

--  Les deux agrégats étaient accordés à PUBLIC. Leur garde de tenant
--  refusait déjà l'anonyme (`ecole_courante()` vaut NULL), donc ce n'était pas
--  une faille ; on retire le droit quand même.
revoke execute on function public.moyenne_notes_ecole(uuid, uuid) from public, anon;
grant  execute on function public.moyenne_notes_ecole(uuid, uuid) to authenticated;
revoke execute on function public.moyenne_notes_par_niveau(uuid, uuid) from public, anon;
grant  execute on function public.moyenne_notes_par_niveau(uuid, uuid) to authenticated;

--  ⚠️ `etat_bulletins` N'EST PAS TOUCHÉE, et c'est important de comprendre
--  pourquoi : elle est `STABLE` **sans** `SECURITY DEFINER`. Elle s'exécute
--  donc sous l'appelant, et ses lectures de `bulletins`, `conseils_classe` et
--  `conseil_signatures` passent par la RLS — qu'on vient justement de
--  resserrer. C'est le bon choix (la leçon de la migration 167 : DEFINER
--  quand la fonction doit imposer une règle que la RLS ne sait pas dire,
--  INVOKER quand elle doit la SUBIR). Lui ajouter une garde serait redondant
--  et risquerait de la désaligner.
--
--  ⚠️ `enseigne_classe`, `enseigne_classe_matiere`, `est_responsable_cycle` et
--  `cycle_de_classe` ne sont pas touchées non plus : elles ne répondent que
--  SUR L'APPELANT (ses affectations, ses cycles) ou sur une donnée de
--  structure. Elles n'ont pas de rôle à traduire.
--
--  🔖 À NOTER, écart d'interface préexistant : le procès-verbal exige une
--  signature « gestion », mais le secrétariat ne peut pas ouvrir l'écran
--  Bulletins où se trouve le bouton (`ACCES.bulletins` = direction +
--  enseignant). Cette bascule ne l'aggrave pas — `signer_conseil` reste
--  ouverte à `_gestion` — mais le chemin manque côté écran.

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- -- 1. les deux gardes factorisées, version mig. 058/166 :
-- create or replace function public.peut_noter_evaluation(p_eval uuid)
-- returns boolean language sql stable security definer set search_path = public as $$
--   select est_gestion() or exists (select 1 from evaluations ev where ev.id = p_eval
--     and a_role('enseignant') and enseigne_classe_matiere(ev.classe_id, ev.matiere_id));
-- $$;
-- create or replace function public.peut_editer_bulletin(p_bulletin uuid)
-- returns boolean language sql stable security definer set search_path = public as $$
--   select est_gestion() or exists (select 1 from bulletins b where b.id = p_bulletin
--     and a_role('enseignant') and enseigne_classe(b.classe_id));
-- $$;
-- -- 2. les policies : remplacer partout
-- --    `(select a_acces('p_toutes_classes')) or ((select a_acces('notes_bulletins')) and X)`
-- --    par `est_gestion() or (a_role('enseignant') and X)`, et retirer les
-- --    sous-requêtes autour de est_super_admin()/ecole_courante().
-- -- 3. conseils_classe : select sur le seul ecole_id, écriture sur
-- --    est_admin() or a_role('direction') or a_role('secretaire').
-- -- 4. les 6 RPC : rejouer le bloc 4 en inversant chaque paire.
-- -- 5. grant execute ... to anon sur les deux agrégats.
-- notify pgrst, 'reload schema';
