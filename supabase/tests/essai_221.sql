-- =====================================================================
--  ESSAI 221 — connexion des parents par numéro (TOUT EST ANNULÉ à la fin)
--
--  À coller APRÈS la migration 221. Crée des parents d'essai dans l'école
--  de démonstration, vérifie chaque règle, puis lève une exception qui
--  annule tout : rien ne reste en base. Le message final donne le résultat.
-- =====================================================================
do $$
declare
  v_ecole uuid := 'c9b85c0e-f19d-41de-8d94-3b4386cb6795';  -- TutTank_Demo
  v_uid uuid := gen_random_uuid();
  v_t1 uuid; v_t2 uuid; v_t3 uuid;
  r text := '';
  v jsonb;
begin
  -- 1. Les formats d'un même numéro
  r := r || 'normalise=' || (
    public.tel_normalise('77 000 99 01') = '770009901' and public.tel_normalise('+221 77 000 99 01') = '770009901'
    and public.tel_normalise('00221770009901') = '770009901' and public.tel_normalise('') is null)::text;

  -- 2. La même personne sur deux fiches (une par enfant), deux écritures du numéro
  insert into tuteurs (ecole_id, prenom, nom, telephone, code_acces)
  values (v_ecole, 'Essai', 'Parent', '77 000 99 01', 'ESSAI221') returning id into v_t1;
  insert into tuteurs (ecole_id, prenom, nom, telephone)
  values (v_ecole, 'ESSAI', 'PARENT', '+221770009901') returning id into v_t2;

  v := public._verifier_activation_telephone('770009901', 'essai221');
  r := r || ' · ok=' || (v->>'statut');
  v := public._verifier_activation_telephone('770009901', 'MAUVAIS1');
  r := r || ' · mauvais_code=' || (v->>'statut');
  v := public._verifier_activation_telephone('770009902', 'ESSAI221');
  r := r || ' · autre_numero=' || (v->>'statut');

  -- 3. Une autre personne sur le même numéro : bloqué
  insert into tuteurs (ecole_id, prenom, nom, telephone)
  values (v_ecole, 'Autre', 'Famille', '770009901') returning id into v_t3;
  v := public._verifier_activation_telephone('770009901', 'ESSAI221');
  r := r || ' · deux_familles=' || (v->>'statut');
  delete from tuteurs where id = v_t3;

  -- 4. Le compte relié à ses deux fiches, le code effacé
  insert into auth.users (id, email, aud, role)
  values (v_uid, '221770009901@tel.gesprosn.org', 'authenticated', 'authenticated');
  v := public._lier_parent_telephone(v_uid, '770009901', 'ESSAI221');
  r := r || ' · lier=' || (v->>'statut') || ' fiches=' || coalesce(v->>'fiches', '?')
    || ' · relies=' || (select count(*) from tuteurs where profil_id = v_uid)
    || ' · role_parent=' || (select count(*) from profil_roles where profil_id = v_uid and role = 'parent')
    || ' · code_efface=' || ((select code_acces from tuteurs where id = v_t1) is null)::text;
  v := public._verifier_activation_telephone('770009901', 'ESSAI221');
  r := r || ' · code_reutilise=' || (v->>'statut');

  -- 5. Les fonctions d'activation sont fermées à l'appli
  r := r || ' · fermees_au_public=' || (not has_function_privilege('authenticated', 'public._lier_parent_telephone(uuid, text, text)', 'execute')
    and not has_function_privilege('anon', 'public._verifier_activation_telephone(text, text)', 'execute'))::text;

  raise exception 'RÉSULTAT (tout est annulé) : %', r;
end $$;
-- Attendu : normalise=true · ok=ok · mauvais_code=code_invalide · autre_numero=code_invalide
--   · deux_familles=a_verifier · lier=ok fiches=2 · relies=2 · role_parent=1 · code_efface=true
--   · code_reutilise=code_invalide · fermees_au_public=true
