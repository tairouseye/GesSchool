-- =====================================================================
--  Essai de la migration 227 (la structure type en un clic).
--  À lancer APRÈS la 227, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout. Rien ne reste :
--  ni les niveaux créés à Bakany Soucko, ni le collège ajouté pour l'essai.
--
--  Attendu : « ESSAI 227 — 6/6 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_bakany   constant uuid := '39414ebd-6f29-462a-9ec6-515b60d69c38';  -- école vide (préscolaire)
  c_promo_b  constant uuid := '9f0dd3d2-bbdc-4646-8c45-eac9f5e67afa';
  c_promo_t  constant uuid := '811376d9-b2e0-469f-9a54-981dba3d775c';  -- Tut'Tank, déjà paramétrée
  c_rh_t     constant uuid := '94812847-eb62-485d-9a44-ff461f5d9e28';  -- Tut'Tank, sans la structure
  r jsonb; v_res text[] := '{}'; v_ok int := 0; v_err text; v_t1 date; v_an date;
begin
  -- 1. École vide : niveaux, classes, matières et trimestres datés.
  perform set_config('request.jwt.claims', json_build_object('sub', c_promo_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := appliquer_structure_type();
  execute 'reset role';
  if (r->>'niveaux')::int = 4 and (r->>'classes')::int = 4 and (r->>'matieres')::int = 5 and (r->>'periodes')::int = 3 then
    v_ok := v_ok + 1; v_res := v_res || ('1. école vide remplie ' || r::text || ' : OK');
  else v_res := v_res || ('1. école vide : KO ' || r::text); end if;

  -- 2. Les trimestres suivent l'année (T1 commence avec elle).
  select p.date_debut, a.date_debut into v_t1, v_an from periodes p join annees_scolaires a on a.id = p.annee_id
   where p.ecole_id = c_bakany and a.courante and p.ordre = 1;
  if v_t1 = v_an then v_ok := v_ok + 1; v_res := v_res || ('2. trimestre 1 au ' || v_t1 || ' : OK');
  else v_res := v_res || ('2. dates : KO (' || coalesce(v_t1::text, 'vide') || ')'); end if;

  -- 3. Relancer ne crée rien de plus.
  perform set_config('request.jwt.claims', json_build_object('sub', c_promo_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := appliquer_structure_type();
  execute 'reset role';
  if r = '{"niveaux":0,"classes":0,"matieres":0,"coefficients":0,"periodes":0}'::jsonb then
    v_ok := v_ok + 1; v_res := v_res || '3. relancée : rien de plus : OK'::text;
  else v_res := v_res || ('3. relancée : KO ' || r::text); end if;

  -- 4. Une école déjà paramétrée n'est pas touchée.
  perform set_config('request.jwt.claims', json_build_object('sub', c_promo_t, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := appliquer_structure_type();
  execute 'reset role';
  if r = '{"niveaux":0,"classes":0,"matieres":0,"coefficients":0,"periodes":0}'::jsonb then
    v_ok := v_ok + 1; v_res := v_res || '4. Tut''Tank inchangée : OK'::text;
  else v_res := v_res || ('4. Tut''Tank : KO ' || r::text); end if;

  -- 5. Sans droit sur la structure : refusé.
  perform set_config('request.jwt.claims', json_build_object('sub', c_rh_t, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_err := null;
  begin r := appliquer_structure_type(); exception when others then v_err := sqlerrm; end;
  execute 'reset role';
  if v_err like 'Réservé%' then v_ok := v_ok + 1; v_res := v_res || '5. RH refusée : OK'::text;
  else v_res := v_res || ('5. RH : KO (' || coalesce(v_err, 'acceptée') || ')'); end if;

  -- 6. Un collège : 4 niveaux, 9 matières, coefficients par niveau (9 × 4).
  perform set_config('request.jwt.claims', '', true);
  insert into cycles (ecole_id, type, libelle, ordre) values (c_bakany, 'second_cycle', 'Collège', 3);
  perform set_config('request.jwt.claims', json_build_object('sub', c_promo_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := appliquer_structure_type(array['second_cycle']);
  execute 'reset role';
  if (r->>'niveaux')::int = 4 and (r->>'matieres')::int = 9 and (r->>'coefficients')::int = 36 then
    v_ok := v_ok + 1; v_res := v_res || ('6. collège ' || r::text || ' : OK');
  else v_res := v_res || ('6. collège : KO ' || r::text); end if;

  raise exception 'ESSAI 227 — %/6 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
