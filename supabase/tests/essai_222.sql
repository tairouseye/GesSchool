-- =====================================================================
--  Essai de la migration 222 (EDT lu dans un PDF + import du fichier de suivi).
--  À lancer APRÈS la 222, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU. Le bloc se termine
--  par une exception qui affiche les contrôles ET annule tout ce que
--  l'essai a écrit. Rien ne reste en base, quel que soit l'éditeur (pas de
--  begin/rollback ni de table temporaire, que l'éditeur Supabase ne garde
--  pas d'une instruction à l'autre).
--
--  Attendu : « ESSAI 222 — 4/4 OK (tout est annulé) » suivi du détail.
--  Joue le compte bureau.tuttank (direction + comptable, Tut'Tank).
-- =====================================================================
do $$
declare v_classe uuid; v_autre uuid; v_annee uuid; v_n int; v_eleve uuid; v_mois text;
        v_montant numeric; v_paye numeric; v_err text;
        v_res text[] := '{}'; v_ok int := 0;
begin
  -- Repérés AVANT de changer de compte : les policies filtreraient ensuite.
  select id into v_classe from classes
   where libelle = 'CM1' and ecole_id = '72e0a623-1a12-4b57-b8c8-62e57b00fa61' limit 1;
  select id into v_autre from matieres where ecole_id <> '72e0a623-1a12-4b57-b8c8-62e57b00fa61' limit 1;
  select id into v_annee from annees_scolaires
   where ecole_id = '72e0a623-1a12-4b57-b8c8-62e57b00fa61' and courante;

  perform set_config('request.jwt.claims',
    '{"sub":"abca71ab-1beb-4803-8a8c-6465a0e83e30","role":"authenticated"}', true);
  execute 'set local role authenticated';

  -- 1. Remplacer la grille d'une classe (CM1) par deux créneaux.
  v_n := remplacer_emploi_classe(v_classe,
    '[{"jour":1,"heure_debut":"08:00","heure_fin":"08:30","activite":"Lecture"},
      {"jour":1,"heure_debut":"10:00","heure_fin":"10:30","activite":"Pause goûter – Récréation"}]');
  if v_n = 2 then v_ok := v_ok + 1; v_res := v_res || '1. remplacer l''EDT : OK'::text;
  else v_res := v_res || ('1. remplacer l''EDT : KO (' || v_n || ')'); end if;

  -- 2. Une matière d'une autre école est refusée.
  begin
    perform remplacer_emploi_classe(v_classe,
      jsonb_build_array(jsonb_build_object('jour', 1, 'heure_debut', '08:00', 'heure_fin', '09:00', 'matiere_id', v_autre)));
    v_res := v_res || '2. matière étrangère : KO (acceptée)'::text;
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like 'Matière ou enseignant%' then v_ok := v_ok + 1; v_res := v_res || '2. matière étrangère refusée : OK'::text;
    else v_res := v_res || ('2. matière étrangère : KO (' || v_err || ')'); end if;
  end;

  -- 3. Encaisser un mois non payé, avec un montant trop fort : plafonné au dû.
  select g.eleve_id, k.key, (k.value->>'montant')::numeric into v_eleve, v_mois, v_montant
    from grille_mensualites(v_annee) g, jsonb_each(g.mois) k
   where (k.value->>'paye')::numeric = 0
   order by k.key desc limit 1;
  v_paye := encaisser_mois_suivi(v_eleve, v_mois, v_montant + 99999);
  if v_paye = v_montant then v_ok := v_ok + 1; v_res := v_res || ('3. encaissement plafonné au dû (' || v_mois || ') : OK');
  else v_res := v_res || ('3. encaissement : KO (' || v_paye || ' / ' || v_montant || ')'); end if;

  -- 4. Le même mois une seconde fois : refusé (jamais payé deux fois).
  begin
    perform encaisser_mois_suivi(v_eleve, v_mois, v_montant);
    v_res := v_res || '4. second encaissement : KO (accepté)'::text;
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like 'Rien à encaisser%' then v_ok := v_ok + 1; v_res := v_res || '4. second encaissement refusé : OK'::text;
    else v_res := v_res || ('4. second encaissement : KO (' || v_err || ')'); end if;
  end;

  -- Affiche ET annule tout.
  raise exception 'ESSAI 222 — %/4 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
