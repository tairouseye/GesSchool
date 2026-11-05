-- =====================================================================
--  Essai de la migration 231 (savoir qu'un appel a été fait). À lancer
--  APRÈS la 231, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout.
--
--  Attendu : « ESSAI 231 — 5/5 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';   -- Tut'Tank
  v_annee uuid; v_classe uuid; v_promoteur uuid; v_parent uuid; v_autre uuid;
  v_res text[] := '{}'; v_ok int := 0; n int; refuse boolean;
begin
  select id into v_annee from annees_scolaires where ecole_id = c_ecole and courante;
  select id into v_classe from classes where ecole_id = c_ecole and annee_id = v_annee limit 1;
  --  Jamais un super-admin : il a le droit d'écrire partout, l'essai ne prouverait rien.
  select p.profil_id into v_promoteur from proprietaires p where p.ecole_id = c_ecole
     and not exists (select 1 from profil_roles r where r.profil_id = p.profil_id and r.role = 'super_admin') limit 1;
  select t.profil_id into v_parent from tuteurs t where t.ecole_id = c_ecole and t.profil_id is not null limit 1;
  select p.profil_id into v_autre from proprietaires p where p.ecole_id <> c_ecole
     and not exists (select 1 from profil_roles r where r.profil_id = p.profil_id and r.role = 'super_admin')
     and not exists (select 1 from proprietaires q where q.profil_id = p.profil_id and q.ecole_id = c_ecole) limit 1;

  -- 1. La direction de l'école valide un appel.
  perform set_config('request.jwt.claims', json_build_object('sub', v_promoteur, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into appels_valides (ecole_id, classe_id, date_appel) values (c_ecole, v_classe, current_date);
  select count(*) into n from appels_valides where classe_id = v_classe and date_appel = current_date;
  if n = 1 then v_ok := v_ok + 1; v_res := v_res || '1. appel validé et relu : OK'::text;
  else v_res := v_res || format('1. appel validé : KO (%s)', n); end if;

  -- 2. Valider deux fois ne crée pas deux lignes.
  insert into appels_valides (ecole_id, classe_id, date_appel) values (c_ecole, v_classe, current_date)
    on conflict (classe_id, date_appel) do update set valide_le = now();
  select count(*) into n from appels_valides where classe_id = v_classe and date_appel = current_date;
  if n = 1 then v_ok := v_ok + 1; v_res := v_res || '2. une seule ligne par classe et par jour : OK'::text;
  else v_res := v_res || format('2. doublon : KO (%s)', n); end if;
  reset role;

  -- 3. Un parent ne lit rien.
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from appels_valides;
  if n = 0 then v_ok := v_ok + 1; v_res := v_res || '3. un parent ne lit rien : OK'::text;
  else v_res := v_res || format('3. parent : KO (%s lignes)', n); end if;

  -- 4. Un parent n'écrit pas.
  refuse := false;
  begin
    insert into appels_valides (ecole_id, classe_id, date_appel) values (c_ecole, v_classe, current_date - 1);
  exception when others then refuse := true;
  end;
  if refuse then v_ok := v_ok + 1; v_res := v_res || '4. un parent n''écrit pas : OK'::text;
  else v_res := v_res || '4. parent : KO (écriture acceptée)'::text; end if;
  reset role;

  -- 5. La direction d'une autre école n'écrit pas ici.
  perform set_config('request.jwt.claims', json_build_object('sub', v_autre, 'role', 'authenticated')::text, true);
  set local role authenticated;
  refuse := false;
  begin
    insert into appels_valides (ecole_id, classe_id, date_appel) values (c_ecole, v_classe, current_date - 2);
  exception when others then refuse := true;
  end;
  if refuse then v_ok := v_ok + 1; v_res := v_res || '5. une autre école n''écrit pas : OK'::text;
  else v_res := v_res || '5. autre école : KO (écriture acceptée)'::text; end if;
  reset role;

  raise exception 'ESSAI 231 — %/5 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
