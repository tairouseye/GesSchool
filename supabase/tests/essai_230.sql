-- =====================================================================
--  Essai de la migration 230 (mois dus payables, âge et téléphone de
--  l'école sur l'accueil parent). À lancer APRÈS la 230, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout.
--
--  Attendu : « ESSAI 230 — 5/5 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';   -- Tut'Tank
  v_annee uuid; v_retard uuid; v_parent uuid; v_enfant uuid; v_autre uuid;
  v_res text[] := '{}'; v_ok int := 0; n int; r record; refuse boolean := false;
  v_tel text; v_nais date;
begin
  select id into v_annee from annees_scolaires where ecole_id = c_ecole and courante;

  --  Un élève en retard sur un mois passé, sans facture pour ce mois.
  select i.eleve_id into v_retard
    from inscriptions i, public._echeancier(i.eleve_id, v_annee) x
   where i.annee_id = v_annee and x.etat = 'en_retard' and x.recurrent and not x.facture
     and x.mois < to_char(current_date, 'YYYY-MM') limit 1;

  -- 1. Ce mois dû se paie désormais.
  select count(*) into n from public._lignes_avance(v_retard) l
   where l.mois < to_char(current_date, 'YYYY-MM');
  if n > 0 then v_ok := v_ok + 1; v_res := v_res || format('1. %s mois passé(s) dû(s) proposé(s) : OK', n);
  else v_res := v_res || '1. mois dû : KO (absent)'::text; end if;

  -- 2. Un mois facturé ou payé n'est jamais proposé.
  select count(*) into n from public._lignes_avance(v_retard) l
    join public._echeancier(v_retard, v_annee) x on x.libelle = l.libelle
   where x.facture or x.etat = 'paye';
  if n = 0 then v_ok := v_ok + 1; v_res := v_res || '2. rien de facturé ni de payé proposé : OK'::text;
  else v_res := v_res || format('2. facturé proposé : KO (%s)', n); end if;

  --  Un parent relié, et un élève qui n'est pas le sien.
  select t.profil_id, et.eleve_id into v_parent, v_enfant
    from tuteurs t join eleve_tuteurs et on et.tuteur_id = t.id
    join eleves e on e.id = et.eleve_id
   where t.profil_id is not null and e.ecole_id = c_ecole limit 1;
  select e.id into v_autre from eleves e
   where e.ecole_id = c_ecole
     and not exists (select 1 from eleve_tuteurs et join tuteurs t on t.id = et.tuteur_id
                      where et.eleve_id = e.id and t.profil_id = v_parent) limit 1;

  --  Lus AVANT de jouer le parent : il ne lit ni `ecoles` ni `eleves` en direct.
  select telephone into v_tel from ecoles where id = c_ecole;
  select date_naissance into v_nais from eleves where id = v_enfant;

  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 3. Le parent reçoit l'âge et le téléphone de l'école de SES enfants.
  select * into r from public.mes_enfants() m where m.eleve_id = v_enfant;
  if r.eleve_id is not null and r.telephone_ecole is not distinct from v_tel
     and r.date_naissance is not distinct from v_nais then
    v_ok := v_ok + 1; v_res := v_res || '3. âge et téléphone de l''école rendus : OK'::text;
  else v_res := v_res || '3. mes_enfants : KO'::text; end if;

  -- 4. Il ne reçoit que les siens.
  if not exists (select 1 from public.mes_enfants() m where m.eleve_id = v_autre) then
    v_ok := v_ok + 1; v_res := v_res || '4. pas d''enfant d''une autre famille : OK'::text;
  else v_res := v_res || '4. cloisonnement : KO'::text; end if;

  -- 5. Il ne peut pas lister les mois d'un autre enfant.
  begin
    perform * from public.avance_options(v_autre);
  exception when others then refuse := true;
  end;
  if refuse then v_ok := v_ok + 1; v_res := v_res || '5. mois d''un autre enfant refusés : OK'::text;
  else v_res := v_res || '5. avance_options : KO (accepté)'::text; end if;

  reset role;
  raise exception 'ESSAI 230 — %/5 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
