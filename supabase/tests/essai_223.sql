-- =====================================================================
--  Essai de la migration 223 (durcissement de sécurité, audit du 02/11/2026).
--  À lancer APRÈS la 223, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout ce qu'il a écrit
--  (offre et abonnement de test, code, invitation, fichiers). Rien ne reste.
--
--  Attendu : « ESSAI 223 — 12/12 OK (tout est annulé) ».
--  Comptes joués (Tut'Tank) : le promoteur, bureau.tuttank (direction),
--  et un parent.
-- =====================================================================
do $$
declare
  c_ecole  constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';
  c_bureau constant uuid := 'abca71ab-1beb-4803-8a8c-6465a0e83e30';
  c_parent constant uuid := '8a17ce8c-e978-493f-a191-f868d1cba43c';
  v_promoteur uuid; v_autre uuid; v_plan uuid; v_tuteur uuid; v_code text; v_err text;
  v_res text[] := '{}'; v_ok int := 0;
begin
  -- Préparation, en super-utilisateur (annulée à la fin).
  select pr.profil_id into v_promoteur from profil_roles pr join profils p on p.id = pr.profil_id
   where p.email = 'tuttank.kounoune@gmail.com' limit 1;
  select id into v_autre from ecoles where id <> c_ecole limit 1;
  select id into v_tuteur from tuteurs where ecole_id = c_ecole and profil_id is null limit 1;
  insert into plans_abonnement (code, libelle, fonctions) values ('essai223', 'Essai 223', '{"modules":["pedagogie","vie_scolaire"]}')
  returning id into v_plan;
  insert into abonnements (ecole_id, plan_id, statut, debut) values (c_ecole, v_plan, 'actif', current_date + 1);
  insert into invitations (ecole_id, role, code, statut, created_at) values (c_ecole, 'direction', 'ESSAI223XX', 'active', now() - interval '8 days');

  -- ===== Le promoteur =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_promoteur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Modules de son offre : accepté.
  begin
    update ecoles set modules_actifs = array['pedagogie'] where id = c_ecole;
    v_ok := v_ok + 1; v_res := v_res || '1. module de l''offre accepté : OK'::text;
  exception when others then v_res := v_res || ('1. module de l''offre : KO (' || sqlerrm || ')'); end;
  -- 2. Module hors offre : refusé.
  begin
    update ecoles set modules_actifs = array['pedagogie', 'comptabilite'] where id = c_ecole;
    v_res := v_res || '2. module hors offre : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '2. module hors offre refusé : OK'::text; end;
  -- 3. « Tous les modules » (null) : refusé quand l'offre en liste.
  begin
    update ecoles set modules_actifs = null where id = c_ecole;
    v_res := v_res || '3. tous les modules : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '3. tous les modules refusé : OK'::text; end;
  -- 4. Le reste des paramètres passe toujours.
  begin
    update ecoles set ville = ville where id = c_ecole;
    v_ok := v_ok + 1; v_res := v_res || '4. autre paramètre accepté : OK'::text;
  exception when others then v_res := v_res || ('4. autre paramètre : KO (' || sqlerrm || ')'); end;
  -- 5. Le statut de démonstration : refusé.
  begin
    update ecoles set demonstration = not coalesce(demonstration, false) where id = c_ecole;
    v_res := v_res || '5. démonstration : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '5. démonstration refusée : OK'::text; end;
  execute 'reset role';

  -- ===== bureau.tuttank (direction) =====
  perform set_config('request.jwt.claims', json_build_object('sub', c_bureau, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 6. Logo dans le dossier de son école : accepté.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('ecoles', c_ecole || '/essai223.png', c_bureau);
    v_ok := v_ok + 1; v_res := v_res || '6. logo de son école accepté : OK'::text;
  exception when others then v_res := v_res || ('6. logo de son école : KO (' || sqlerrm || ')'); end;
  -- 7. Fichier dans le dossier d'une autre école : refusé.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('ecoles', v_autre || '/essai223.png', c_bureau);
    v_res := v_res || '7. dossier d''une autre école : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '7. dossier d''une autre école refusé : OK'::text; end;
  -- 8. Nouveau code parent : 10 caractères, alphabet sans ambiguïté.
  v_code := generer_code_tuteur(v_tuteur);
  if v_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$' then v_ok := v_ok + 1; v_res := v_res || '8. code de 10 caractères : OK'::text;
  else v_res := v_res || ('8. code : KO (' || v_code || ')'); end if;
  execute 'reset role';

  -- ===== Un parent =====
  perform set_config('request.jwt.claims', json_build_object('sub', c_parent, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 9. Un parent ne touche pas au dossier de son école.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('ecoles', c_ecole || '/cachet-pirate.png', c_parent);
    v_res := v_res || '9. parent écrit un cachet : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '9. parent ne peut pas écrire un cachet : OK'::text; end;
  -- 10. Le code sert une fois (saisi en minuscules, avec espaces)…
  begin
    perform lier_parent(' ' || lower(v_code) || ' ');
    if (select code_acces from tuteurs where id = v_tuteur) is null then
      v_ok := v_ok + 1; v_res := v_res || '10. code utilisé puis effacé : OK'::text;
    else v_res := v_res || '10. code utilisé : KO (pas effacé)'::text; end if;
  exception when others then v_res := v_res || ('10. code utilisé : KO (' || sqlerrm || ')'); end;
  -- 11. … et pas deux.
  begin
    perform lier_parent(v_code);
    v_res := v_res || '11. second usage du code : KO (accepté)'::text;
  exception when others then v_ok := v_ok + 1; v_res := v_res || '11. second usage du code refusé : OK'::text; end;
  -- 12. Une invitation de plus de 7 jours : refusée.
  begin
    perform rejoindre('ESSAI223XX');
    v_res := v_res || '12. invitation périmée : KO (acceptée)'::text;
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%expiré%' then v_ok := v_ok + 1; v_res := v_res || '12. invitation périmée refusée : OK'::text;
    else v_res := v_res || ('12. invitation périmée : KO (' || v_err || ')'); end if;
  end;
  execute 'reset role';

  raise exception 'ESSAI 223 — %/12 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
