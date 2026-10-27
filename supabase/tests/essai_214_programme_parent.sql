-- =====================================================================
--  ESSAI — le programme du mois chez le parent (migration 214)
--
--  Prérequis : 214 appliquée. Coller TOUT le fichier, lancer.
--  Verdict : UNE LIGNE (colonne `resultat`) : « OK », « ÉCHEC » ou
--  « IMPOSSIBLE ». Rien n'est conservé : tout est annulé à la fin.
--
--  Décor : un élève de Tut'Tank inscrit avec un niveau réel (sous-niveau)
--  et dont un parent a un compte. On importe, sur le mois d'AOÛT (jamais
--  publié), un programme pour SON niveau réel, un pour l'AUTRE niveau de
--  la classe, et un commun ; puis on lit comme le parent.
-- =====================================================================
drop table if exists pg_temp.essai_214_resultat;
create temp table essai_214_resultat (resultat text);

do $essai$
declare
  v_ecole uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';
  v_annee uuid; v_admin uuid; v_parent uuid; v_autre uuid;
  v_eleve uuid; v_niveau uuid; v_sn uuid; v_sn2 uuid; v_sn_ext uuid;
  v_err text := ''; v_resultat text; v_j jsonb; v_doms text; v_n int;
  dom jsonb := '[{"lignes":[{"contenu":"ESSAI-214","semaine":1,"ordre":1}]}]';
begin
  begin
    select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante;
    select p.id into v_admin from profils p join profil_roles pr on pr.profil_id = p.id
     where p.ecole_id = v_ecole and p.actif and pr.role = 'admin_ecole' limit 1;
    select i.eleve_id, c.niveau_id, i.sous_niveau_id, t.profil_id
      into v_eleve, v_niveau, v_sn, v_parent
      from inscriptions i
      join classes c on c.id = i.classe_id
      join eleve_tuteurs et on et.eleve_id = i.eleve_id
      join tuteurs t on t.id = et.tuteur_id and t.profil_id is not null
     where i.annee_id = v_annee and i.sous_niveau_id is not null
       and i.statut::text not in ('abandon', 'exclu', 'transfere')
     limit 1;
    select sn.id into v_sn2 from sous_niveaux sn where sn.niveau_id = v_niveau and sn.id <> v_sn limit 1;
    select sn.id into v_sn_ext from sous_niveaux sn where sn.ecole_id = v_ecole and sn.niveau_id <> v_niveau limit 1;
    select t.profil_id into v_autre from tuteurs t
     where t.profil_id is not null and t.profil_id <> v_parent
       and not exists (select 1 from eleve_tuteurs et join tuteurs t2 on t2.id = et.tuteur_id
                        where et.eleve_id = v_eleve and t2.profil_id = t.profil_id)
     limit 1;
    if v_admin is null or v_eleve is null or v_sn2 is null then
      v_resultat := 'IMPOSSIBLE — il faut un admin, un élève avec niveau réel et parent connecté, et une classe double.';
      raise exception 'ESSAI_FIN';
    end if;

    -- --- 1. Import comme la direction : CI, CP et commun coexistent ---------
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    execute 'set local role authenticated';
    perform public.importer_programmation(v_niveau, v_annee, 8, 'essai', jsonb_set(dom, '{0,domaine}', '"ESSAI MIEN"'), v_sn);
    perform public.importer_programmation(v_niveau, v_annee, 8, 'essai', jsonb_set(dom, '{0,domaine}', '"ESSAI MIEN"'), v_sn2);
    perform public.importer_programmation(v_niveau, v_annee, 8, 'essai', jsonb_set(dom, '{0,domaine}', '"ESSAI COMMUN"'), null);
    --  Réimporter le sien ne doit pas effacer celui de l'autre niveau.
    perform public.importer_programmation(v_niveau, v_annee, 8, 'essai', jsonb_set(dom, '{0,domaine}', '"ESSAI MIEN"'), v_sn);
    begin
      perform public.importer_programmation(v_niveau, v_annee, 8, 'essai', jsonb_set(dom, '{0,domaine}', '"ESSAI X"'), v_sn_ext);
      if v_sn_ext is not null then v_err := v_err || ' | 1. sous-niveau d''un autre niveau accepté'; end if;
    exception when others then null; end;
    execute 'reset role';
    select count(*) into v_n from programmations
     where niveau_id = v_niveau and annee_id = v_annee and mois = 8 and domaine like 'ESSAI%';
    if v_n <> 3 then v_err := v_err || format(' | 1. %s programmations au lieu de 3 (CI, CP, commun)', v_n); end if;

    -- --- 2. Lecture comme le parent : le sien + le commun, pas l'autre ------
    perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_parent::text, true);
    execute 'set local role authenticated';
    v_j := public.enfant_programme(v_eleve, 8);
    execute 'reset role';
    select string_agg(x ->> 'domaine', ',' order by x ->> 'domaine') into v_doms
      from jsonb_array_elements(v_j -> 'domaines') x where x ->> 'domaine' like 'ESSAI%';
    if v_doms is distinct from 'ESSAI COMMUN,ESSAI MIEN' then
      v_err := v_err || format(' | 2. domaines lus : %s (attendu ESSAI COMMUN,ESSAI MIEN)', coalesce(v_doms, 'aucun'));
    end if;
    if jsonb_array_length((select x -> 'lignes' from jsonb_array_elements(v_j -> 'domaines') x
                            where x ->> 'domaine' = 'ESSAI MIEN')) <> 1 then
      v_err := v_err || ' | 2. le programme de l''autre niveau réel a fuité (ou manque)';
    end if;
    if not ((v_j -> 'mois_disponibles') @> '8'::jsonb) then
      v_err := v_err || ' | 2. août absent des mois disponibles';
    end if;
    if v_j ->> 'niveau' is null then v_err := v_err || ' | 2. niveau non rendu'; end if;

    -- --- 3. Un autre parent est refusé ------------------------------------
    if v_autre is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_autre, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_autre::text, true);
      execute 'set local role authenticated';
      begin
        perform public.enfant_programme(v_eleve, 8);
        v_err := v_err || ' | 3. enfant_programme accepté pour un autre parent';
      exception when others then
        if sqlerrm <> 'Accès refusé.' then v_err := v_err || ' | 3. refus inattendu : ' || sqlerrm; end if;
      end;
      execute 'reset role';
    end if;

    if has_function_privilege('anon', 'public.enfant_programme(uuid, int)', 'execute') then
      v_err := v_err || ' | 0. enfant_programme exécutable par anon';
    end if;

    if v_err <> '' then
      v_resultat := 'ÉCHEC —' || v_err;
    else
      v_resultat := 'OK — CI, CP et commun coexistent, réimport sans écrasement, sous-niveau étranger refusé ; '
        || 'le parent lit son niveau réel + le commun, jamais l''autre'
        || case when v_autre is null then ' (refus autre parent non testé).' else ' ; autre parent refusé.' end;
    end if;
    raise exception 'ESSAI_FIN';
  exception when others then
    if sqlerrm <> 'ESSAI_FIN' then
      v_resultat := 'ÉCHEC — erreur inattendue : ' || sqlerrm;
    end if;
  end;
  insert into pg_temp.essai_214_resultat values (v_resultat);
end
$essai$;

select resultat from pg_temp.essai_214_resultat;
