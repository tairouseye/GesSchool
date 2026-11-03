-- =====================================================================
--  Essai de la migration 228 (les enseignants se connectent par leur
--  numéro). À lancer APRÈS la 228, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout. Les numéros
--  d'essai (33 000 01 0x), les codes et le compte créé disparaissent.
--
--  Attendu : « ESSAI 228 — 6/6 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';   -- Tut'Tank
  c_ens1  constant uuid := '4bac1d79-56cc-4b2d-b45e-3d19628cc068';   -- enseignant seul sur son numéro
  c_ens2  constant uuid := 'cecfd7c4-8e51-4a9a-955c-e4c8fb94d417';   -- enseignant qui partage un numéro
  c_tut1  constant uuid := 'c09787e6-b1ee-4939-b739-393b0775f2ef';   -- parent qui partage ce numéro
  c_tut2  constant uuid := '245a4ab0-1e67-45d6-8b2c-40fea5efb7ae';   -- parent seul sur son numéro
  v_uid uuid := gen_random_uuid();
  r jsonb; v_res text[] := '{}'; v_ok int := 0; v_e record;
begin
  update enseignants set telephone = '33 000 01 01', code_acces = 'ESSAIENS28' where id = c_ens1;
  update enseignants set telephone = '33 000 01 02', code_acces = 'ESSAIENS2B' where id = c_ens2;
  update tuteurs     set telephone = '33 000 01 02', code_acces = 'ESSAIPAR28' where id = c_tut1;
  update tuteurs     set telephone = '33 000 01 03', code_acces = 'ESSAIPAR2B' where id = c_tut2;

  -- 1. Un code enseignant + son numéro : accepté, type enseignant.
  r := _verifier_activation_telephone('33 000 01 01', 'essaiens28');
  if r->>'statut' = 'ok' and r->>'type' = 'enseignant' then v_ok := v_ok + 1; v_res := v_res || '1. code enseignant reconnu : OK'::text;
  else v_res := v_res || ('1. code enseignant : KO ' || r::text); end if;

  -- 2. Le bon code avec un autre numéro : refusé.
  r := _verifier_activation_telephone('33 000 01 03', 'ESSAIENS28');
  if r->>'statut' = 'code_invalide' then v_ok := v_ok + 1; v_res := v_res || '2. code + mauvais numéro refusé : OK'::text;
  else v_res := v_res || ('2. mauvais numéro : KO ' || r::text); end if;

  -- 3. Un parent et un enseignant différents sur un même numéro : à vérifier,
  --    des deux côtés (sinon ils partageraient un compte).
  if _verifier_activation_telephone('33 000 01 02', 'ESSAIPAR28')->>'statut' = 'a_verifier'
     and _verifier_activation_telephone('33 000 01 02', 'ESSAIENS2B')->>'statut' = 'a_verifier' then
    v_ok := v_ok + 1; v_res := v_res || '3. numéro partagé parent / enseignant bloqué : OK'::text;
  else v_res := v_res || '3. numéro partagé : KO'::text; end if;

  -- 4. Un parent seul sur son numéro : inchangé.
  r := _verifier_activation_telephone('33 000 01 03', 'ESSAIPAR2B');
  if r->>'statut' = 'ok' and r->>'type' = 'parent' then v_ok := v_ok + 1; v_res := v_res || '4. parent inchangé : OK'::text;
  else v_res := v_res || ('4. parent : KO ' || r::text); end if;

  -- 5. Relier l'enseignant (comme le fait la fonction Edge) : fiche, rôle, école, code effacé.
  insert into auth.users (id, email, aud, role) values (v_uid, '221330000101@tel.gesprosn.org', 'authenticated', 'authenticated');
  r := _lier_parent_telephone(v_uid, '330000101', 'ESSAIENS28');
  select * into v_e from enseignants where id = c_ens1;
  if r->>'statut' = 'ok' and v_e.profil_id = v_uid and v_e.code_acces is null
     and exists (select 1 from profil_roles where profil_id = v_uid and ecole_id = c_ecole and role = 'enseignant')
     and (select ecole_id from profils where id = v_uid) = c_ecole then
    v_ok := v_ok + 1; v_res := v_res || '5. enseignant relié (fiche, rôle, école) : OK'::text;
  else v_res := v_res || ('5. liaison : KO ' || r::text); end if;

  -- 6. Le code a servi : il ne peut plus changer le mot de passe.
  if _verifier_activation_telephone('33 000 01 01', 'ESSAIENS28')->>'statut' = 'code_invalide' then
    v_ok := v_ok + 1; v_res := v_res || '6. code usagé refusé : OK'::text;
  else v_res := v_res || '6. code usagé : KO (accepté)'::text; end if;

  raise exception 'ESSAI 228 — %/6 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
