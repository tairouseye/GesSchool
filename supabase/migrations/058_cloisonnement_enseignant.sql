-- =====================================================================
--  058 — L'enseignant est cloisonné à SES classes (en base, pas seulement
--        dans l'interface)
--
--  Constat d'audit : 018 restreint les évaluations/notes/bulletins au RÔLE
--  « enseignant », mais pas à ses classes :
--      (est_gestion() or a_role('enseignant'))
--  → n'importe quel enseignant de l'école pouvait lire ET écrire les notes de
--    TOUTES les classes via un appel API direct. Le filtrage « mes classes »
--    n'existait que dans l'UI (et manquait même dans Notes / Bulletins /
--    Vie scolaire jusqu'à la v2.61).
--
--  Correctif : on ajoute la condition « cette classe est la mienne » —
--  professeur principal OU affecté à la matière. La gestion (promoteur,
--  super-admin) et le responsable pédagogique (direction), couverts par
--  est_gestion(), gardent la vue complète de l'établissement.
--
--  La LECTURE reste ouverte aux membres de l'école : la restreindre casserait
--  les moyennes de classe, les classements et les conseils de classe. C'est
--  l'ÉCRITURE — le risque réel — qui est verrouillée.
-- =====================================================================

-- --------------------------------------------------------------------
--  Helpers
-- --------------------------------------------------------------------

-- Cette classe est-elle la mienne ? (prof principal ou affectation)
create or replace function public.enseigne_classe(p_classe uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from affectations a
      join enseignants e on e.id = a.enseignant_id
      where a.classe_id = p_classe and e.profil_id = auth.uid()
    )
    or exists (
      select 1 from classes c
      join enseignants e on e.id = c.prof_principal_id
      where c.id = p_classe and e.profil_id = auth.uid()
    );
$$;

-- J'enseigne cette matière dans cette classe ? (le prof principal garde la
-- main sur toutes les matières de sa classe : bulletins, conseils…)
create or replace function public.enseigne_classe_matiere(p_classe uuid, p_matiere uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from affectations a
      join enseignants e on e.id = a.enseignant_id
      where a.classe_id = p_classe and a.matiere_id = p_matiere
        and e.profil_id = auth.uid()
    )
    or exists (
      select 1 from classes c
      join enseignants e on e.id = c.prof_principal_id
      where c.id = p_classe and e.profil_id = auth.uid()
    );
$$;

revoke execute on function public.enseigne_classe(uuid) from public, anon;
revoke execute on function public.enseigne_classe_matiere(uuid, uuid) from public, anon;
grant execute on function public.enseigne_classe(uuid) to authenticated;
grant execute on function public.enseigne_classe_matiere(uuid, uuid) to authenticated;

-- --------------------------------------------------------------------
--  Évaluations : ma classe ET ma matière
-- --------------------------------------------------------------------
do $$
declare pred text :=
  '(est_gestion() or (a_role(''enseignant'') and enseigne_classe_matiere(classe_id, matiere_id)))';
begin
  drop policy if exists evaluations_ins on public.evaluations;
  drop policy if exists evaluations_upd on public.evaluations;
  drop policy if exists evaluations_del on public.evaluations;
  execute format('create policy evaluations_ins on public.evaluations for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
  execute format('create policy evaluations_upd on public.evaluations for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy evaluations_del on public.evaluations for delete using (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
end $$;

-- --------------------------------------------------------------------
--  Notes : on remonte à l'évaluation parente
-- --------------------------------------------------------------------
create or replace function public.peut_noter_evaluation(p_eval uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select est_gestion() or exists (
    select 1 from evaluations ev
    where ev.id = p_eval
      and a_role('enseignant')
      and enseigne_classe_matiere(ev.classe_id, ev.matiere_id)
  );
$$;
revoke execute on function public.peut_noter_evaluation(uuid) from public, anon;
grant execute on function public.peut_noter_evaluation(uuid) to authenticated;

do $$
declare pred text := '(peut_noter_evaluation(evaluation_id))';
begin
  drop policy if exists notes_ins on public.notes;
  drop policy if exists notes_upd on public.notes;
  drop policy if exists notes_del on public.notes;
  execute format('create policy notes_ins on public.notes for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
  execute format('create policy notes_upd on public.notes for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy notes_del on public.notes for delete using (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
end $$;

-- --------------------------------------------------------------------
--  Bulletins : ma classe (toutes matières — cas du prof principal)
-- --------------------------------------------------------------------
do $$
declare pred text :=
  '(est_gestion() or (a_role(''enseignant'') and enseigne_classe(classe_id)))';
begin
  drop policy if exists bulletins_ins on public.bulletins;
  drop policy if exists bulletins_upd on public.bulletins;
  drop policy if exists bulletins_del on public.bulletins;
  execute format('create policy bulletins_ins on public.bulletins for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
  execute format('create policy bulletins_upd on public.bulletins for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy bulletins_del on public.bulletins for delete using (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
end $$;

-- bulletin_lignes n'a pas de classe_id : on remonte au bulletin parent.
create or replace function public.peut_editer_bulletin(p_bulletin uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select est_gestion() or exists (
    select 1 from bulletins b
    where b.id = p_bulletin
      and a_role('enseignant')
      and enseigne_classe(b.classe_id)
  );
$$;
revoke execute on function public.peut_editer_bulletin(uuid) from public, anon;
grant execute on function public.peut_editer_bulletin(uuid) to authenticated;

do $$
declare pred text := '(peut_editer_bulletin(bulletin_id))';
begin
  drop policy if exists bulletin_lignes_ins on public.bulletin_lignes;
  drop policy if exists bulletin_lignes_upd on public.bulletin_lignes;
  drop policy if exists bulletin_lignes_del on public.bulletin_lignes;
  execute format('create policy bulletin_lignes_ins on public.bulletin_lignes for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
  execute format('create policy bulletin_lignes_upd on public.bulletin_lignes for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy bulletin_lignes_del on public.bulletin_lignes for delete using (est_super_admin() or (ecole_id = ecole_courante() and %s));', pred);
end $$;

notify pgrst, 'reload schema';
