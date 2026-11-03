-- =====================================================================
--  Essai de la migration 225 (les modules de la bibliothèque contrôlés
--  par la base). À lancer APRÈS la 225, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout (rôle de test,
--  modules retirés le temps de l'essai). Rien ne reste.
--
--  Joue l'université de test (UCAD), qui a les trois modules : un de ses
--  comptes reçoit le rôle direction le temps de l'essai.
--  Attendu : « ESSAI 225 — 6/6 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ucad constant uuid := '3363c4c7-956c-4412-a9fc-d1c821652e5b';
  c_compte constant uuid := '5f05184b-86f3-4367-87d1-bbe53c35fbdb';
  v_mods text[]; v_res text[] := '{}'; v_ok int := 0; n_dep bigint; n_not bigint; n_ex bigint;
begin
  select modules_actifs into v_mods from ecoles where id = c_ucad;
  insert into profil_roles (profil_id, ecole_id, role) values (c_compte, c_ucad, 'direction') on conflict do nothing;

  -- 1. Avec les trois modules : la gestion voit tout.
  perform set_config('request.jwt.claims', json_build_object('sub', c_compte, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n_dep from biblio_depots; select count(*) into n_not from biblio_ressources;
  if _biblio_gestion(c_ucad) and n_not > 0 then
    v_ok := v_ok + 1; v_res := v_res || ('1. avec les modules : ' || n_not || ' notices, ' || n_dep || ' dépôts : OK');
  else v_res := v_res || '1. avec les modules : KO'::text; end if;
  execute 'reset role';

  -- 2 à 4. Sans aucun module bibliothèque : gestion, lecture et catalogue fermés.
  perform set_config('request.jwt.claims', '', true);
  update ecoles set modules_actifs = array(select unnest(v_mods)
    except select unnest(array['bibliotheque', 'bibliotheque_numerique', 'memoires_theses'])) where id = c_ucad;
  perform set_config('request.jwt.claims', json_build_object('sub', c_compte, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not _biblio_gestion(c_ucad) and not _biblio_lecteur(c_ucad) then
    v_ok := v_ok + 1; v_res := v_res || '2. sans module, gestion et lecture fermées : OK'::text;
  else v_res := v_res || '2. sans module : KO (ouvert)'::text; end if;
  select count(*) into n_not from biblio_ressources; select count(*) into n_ex from biblio_exemplaires;
  if n_not = 0 and n_ex = 0 then v_ok := v_ok + 1; v_res := v_res || '3. sans module, catalogue invisible : OK'::text;
  else v_res := v_res || ('3. sans module : KO (' || n_not || ' notices, ' || n_ex || ' exemplaires)'); end if;
  select count(*) into n_dep from biblio_depots;
  if n_dep = 0 then v_ok := v_ok + 1; v_res := v_res || '4. sans module, dépôts invisibles : OK'::text;
  else v_res := v_res || ('4. sans module : KO (' || n_dep || ' dépôts)'); end if;
  execute 'reset role';

  -- 5 et 6. Catalogue seul : les notices reviennent, pas les dépôts.
  perform set_config('request.jwt.claims', '', true);
  update ecoles set modules_actifs = array_append(modules_actifs, 'bibliotheque') where id = c_ucad;
  perform set_config('request.jwt.claims', json_build_object('sub', c_compte, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n_not from biblio_ressources; select count(*) into n_dep from biblio_depots;
  if n_not > 0 then v_ok := v_ok + 1; v_res := v_res || '5. catalogue seul, notices visibles : OK'::text;
  else v_res := v_res || '5. catalogue seul : KO (aucune notice)'::text; end if;
  if n_dep = 0 then v_ok := v_ok + 1; v_res := v_res || '6. catalogue seul, dépôts fermés : OK'::text;
  else v_res := v_res || ('6. catalogue seul : KO (' || n_dep || ' dépôts)'); end if;
  execute 'reset role';

  raise exception 'ESSAI 225 — %/6 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
