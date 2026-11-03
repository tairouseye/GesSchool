-- =====================================================================
--  Essai de la migration 226 (les relances et l'état de paiement sous
--  contrôle du module Encaissements). À lancer APRÈS la 226.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout (module retiré le
--  temps de l'essai). Rien ne reste, aucun rappel n'est envoyé.
--
--  Attendu : « ESSAI 226 — 7/7 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole    constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';
  c_comptable constant uuid := '615ad263-8e75-43a8-89e7-532e348d7bd7';  -- direction + comptable
  c_rh       constant uuid := '94812847-eb62-485d-9a44-ff461f5d9e28';  -- RH, sans pouvoir de paiement
  v_classe uuid; v_annee uuid; v_eleve uuid;
  v_res text[] := '{}'; v_ok int := 0; n bigint; n_rel bigint; v_err text;
begin
  select f.eleve_id, i.classe_id, i.annee_id into v_eleve, v_classe, v_annee
    from factures f join inscriptions i on i.eleve_id = f.eleve_id and i.annee_id = f.annee_id
   where f.ecole_id = c_ecole and f.statut not in ('payee', 'annulee') and f.montant_total > f.montant_paye limit 1;

  -- 1. Le comptable voit le journal des relances.
  perform set_config('request.jwt.claims', json_build_object('sub', c_comptable, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n_rel from relances;
  if n_rel > 0 then v_ok := v_ok + 1; v_res := v_res || ('1. comptable, ' || n_rel || ' relances visibles : OK');
  else v_res := v_res || '1. comptable : KO (aucune relance)'::text; end if;

  -- 2. Il voit l'indicateur de paiement d'une classe.
  select count(*) into n from statut_paiement_classe(v_classe, v_annee);
  if n > 0 then v_ok := v_ok + 1; v_res := v_res || ('2. comptable, indicateur de paiement (' || n || ' élèves) : OK');
  else v_res := v_res || '2. comptable, indicateur : KO (vide)'::text; end if;
  execute 'reset role';

  -- 3. La RH (aucun pouvoir de paiement) ne voit plus les relances.
  perform set_config('request.jwt.claims', json_build_object('sub', c_rh, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from relances;
  if n = 0 then v_ok := v_ok + 1; v_res := v_res || '3. RH, relances invisibles : OK'::text;
  else v_res := v_res || ('3. RH : KO (' || n || ' relances visibles)'); end if;
  execute 'reset role';

  -- 4 à 7. Sans le module Encaissements.
  perform set_config('request.jwt.claims', '', true);
  update ecoles set modules_actifs = array_remove(modules_actifs, 'encaissement') where id = c_ecole;
  perform set_config('request.jwt.claims', json_build_object('sub', c_comptable, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from relances;
  if n = 0 then v_ok := v_ok + 1; v_res := v_res || '4. sans module, journal invisible : OK'::text;
  else v_res := v_res || ('4. sans module : KO (' || n || ' relances)'); end if;

  v_err := null;
  begin perform relancer_eleve(v_eleve); exception when others then v_err := sqlerrm; end;
  if v_err like '%Encaissements%' then v_ok := v_ok + 1; v_res := v_res || '5. sans module, relance manuelle refusée : OK'::text;
  else v_res := v_res || ('5. sans module, relance : KO (' || coalesce(v_err, 'envoyée') || ')'); end if;

  v_err := null;
  begin perform * from statut_paiement_classe(v_classe, v_annee); exception when others then v_err := sqlerrm; end;
  if v_err like '%Encaissements%' then v_ok := v_ok + 1; v_res := v_res || '6. sans module, indicateur fermé : OK'::text;
  else v_res := v_res || ('6. sans module, indicateur : KO (' || coalesce(v_err, 'ouvert') || ')'); end if;
  execute 'reset role';

  -- 7. Le passage automatique saute l'école (rien n'est envoyé).
  perform set_config('request.jwt.claims', '', true);
  if executer_relances(c_ecole) = 0 then v_ok := v_ok + 1; v_res := v_res || '7. sans module, relances auto sautées : OK'::text;
  else v_res := v_res || '7. sans module, relances auto : KO (envoyées)'::text; end if;

  raise exception 'ESSAI 226 — %/7 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
