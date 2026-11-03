-- =====================================================================
--  Essai de la migration 224 (les modules souscrits contrôlés par la base).
--  À lancer APRÈS la 224, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout (y compris les
--  modules retirés le temps de l'essai). Rien ne reste.
--
--  Attendu : « ESSAI 224 — 7/7 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole    constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';
  c_primaire constant uuid := '615ad263-8e75-43a8-89e7-532e348d7bd7';  -- direction + comptable, a la case cantine
  c_bureau   constant uuid := 'abca71ab-1beb-4803-8a8c-6465a0e83e30';
  c_parent   constant uuid := '8a17ce8c-e978-493f-a191-f868d1cba43c';
  v_promoteur uuid; v_rh uuid; v_res text[] := '{}'; v_ok int := 0; n bigint; n_avant bigint;
begin
  select pr.profil_id into v_promoteur from profil_roles pr join profils p on p.id = pr.profil_id
   where p.email = 'tuttank.kounoune@gmail.com' limit 1;
  select p.id into v_rh from profils p where p.email = 'gueyeniagna@gmail.com';

  -- 1. Une case cochée ne suffit plus si le module n'est pas souscrit.
  perform set_config('request.jwt.claims', json_build_object('sub', c_primaire, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not a_acces('cantine') then v_ok := v_ok + 1; v_res := v_res || '1. cantine non souscrite fermée : OK'::text;
  else v_res := v_res || '1. cantine : KO (ouverte)'::text; end if;
  execute 'reset role';

  -- 2 et 3. Le promoteur aussi : fermé hors offre, ouvert dans l'offre.
  perform set_config('request.jwt.claims', json_build_object('sub', v_promoteur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not a_acces('transport') then v_ok := v_ok + 1; v_res := v_res || '2. promoteur, transport fermé : OK'::text;
  else v_res := v_res || '2. promoteur, transport : KO (ouvert)'::text; end if;
  if a_acces('encaissement') and a_acces('rh') and a_acces('parametres') then
    v_ok := v_ok + 1; v_res := v_res || '3. promoteur, modules souscrits ouverts : OK'::text;
  else v_res := v_res || '3. promoteur, modules souscrits : KO (fermés)'::text; end if;
  execute 'reset role';

  -- 4. Retirer le module RH coupe les DONNÉES du personnel à la RH.
  perform set_config('request.jwt.claims', json_build_object('sub', v_rh, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n_avant from personnels;
  execute 'reset role';
  -- Sans compte (claims vidés) : le garde-fou de la 223 laisse passer l'essai.
  perform set_config('request.jwt.claims', '', true);
  update ecoles set modules_actifs = array_remove(modules_actifs, 'rh') where id = c_ecole;
  perform set_config('request.jwt.claims', json_build_object('sub', v_rh, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from personnels;
  if n_avant > 0 and n = 0 then v_ok := v_ok + 1; v_res := v_res || ('4. RH retirée, personnel invisible (' || n_avant || ' → 0) : OK');
  else v_res := v_res || ('4. RH retirée : KO (' || n_avant || ' → ' || n || ')'); end if;
  execute 'reset role';

  -- 5. Les modules du cœur restent ouverts sans souscription (paramètres, membres).
  perform set_config('request.jwt.claims', json_build_object('sub', c_bureau, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if a_acces('parametres') and a_acces('presence_vie') then
    v_ok := v_ok + 1; v_res := v_res || '5. cases hors module ouvertes : OK'::text;
  else v_res := v_res || '5. cases hors module : KO (fermées)'::text; end if;
  execute 'reset role';

  -- 6. Modules NULL = tout ouvert (comportement historique).
  perform set_config('request.jwt.claims', '', true);
  update ecoles set modules_actifs = null where id = c_ecole;
  perform set_config('request.jwt.claims', json_build_object('sub', v_promoteur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if a_acces('transport') then v_ok := v_ok + 1; v_res := v_res || '6. modules non renseignés = tout ouvert : OK'::text;
  else v_res := v_res || '6. modules non renseignés : KO (fermé)'::text; end if;
  execute 'reset role';

  -- 7. Le parent ne dépend pas des modules : ses enfants restent visibles.
  perform set_config('request.jwt.claims', json_build_object('sub', c_parent, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from mes_enfants();
  if n > 0 then v_ok := v_ok + 1; v_res := v_res || ('7. parent, ' || n || ' enfants visibles : OK');
  else v_res := v_res || '7. parent : KO (aucun enfant)'::text; end if;
  execute 'reset role';

  raise exception 'ESSAI 224 — %/7 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
