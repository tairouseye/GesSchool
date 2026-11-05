-- =====================================================================
--  Essai de la migration 229 (paiements mois par mois : la facture et le
--  reçu de chaque mois). À lancer APRÈS la 229, dans l'éditeur SQL.
--
--  ⚠️ LE RÉSULTAT S'AFFICHE EN « ERREUR », C'EST VOULU : le bloc finit par
--  une exception qui affiche les contrôles ET annule tout. Rien n'est
--  modifié : l'essai ne fait que lire.
--
--  Attendu : « ESSAI 229 — 4/4 OK (tout est annulé) ».
-- =====================================================================
do $$
declare
  c_ecole constant uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';   -- Tut'Tank
  v_annee uuid;
  v_eleve uuid;
  j jsonb;
  v_res text[] := '{}'; v_ok int := 0; n_payes int; n_avec int; n_sans int;
begin
  select id into v_annee from annees_scolaires where ecole_id = c_ecole and courante;
  --  L'élève de Tut'Tank qui a le plus de paiements.
  select f.eleve_id into v_eleve from factures f join paiements p on p.facture_id = f.id
   where f.ecole_id = c_ecole group by f.eleve_id order by count(*) desc limit 1;
  j := public._echeancier_json(v_eleve, v_annee);

  -- 1. Chaque mois payé porte sa facture et son reçu.
  select count(*) filter (where l->>'etat' = 'paye'),
         count(*) filter (where l->>'etat' = 'paye' and l->>'facture_id' is not null and l->>'paiement_id' is not null)
    into n_payes, n_avec from jsonb_array_elements(j->'lignes') l;
  if n_payes > 0 and n_payes = n_avec then v_ok := v_ok + 1; v_res := v_res || format('1. %s mois payés, tous avec facture et reçu : OK', n_payes);
  else v_res := v_res || format('1. facture/reçu : KO (%s payés, %s complets)', n_payes, n_avec); end if;

  -- 2. Le reçu désigne bien un paiement de CETTE facture, pour CET élève.
  select count(*) into n_sans from jsonb_array_elements(j->'lignes') l
   where l->>'paiement_id' is not null
     and not exists (select 1 from paiements p join factures f on f.id = p.facture_id
                      where p.id = (l->>'paiement_id')::uuid and f.id = (l->>'facture_id')::uuid and f.eleve_id = v_eleve);
  if n_sans = 0 then v_ok := v_ok + 1; v_res := v_res || '2. reçus cohérents (bonne facture, bon élève) : OK'::text;
  else v_res := v_res || format('2. reçus incohérents : KO (%s)', n_sans); end if;

  -- 3. Un mois non payé n'a pas de reçu.
  select count(*) into n_sans from jsonb_array_elements(j->'lignes') l
   where l->>'etat' in ('a_venir', 'en_retard') and l->>'paiement_id' is not null
     and coalesce((l->>'paye')::numeric, 0) = 0;
  if n_sans = 0 then v_ok := v_ok + 1; v_res := v_res || '3. pas de reçu sur un mois non payé : OK'::text;
  else v_res := v_res || format('3. reçu sur un mois non payé : KO (%s)', n_sans); end if;

  -- 4. Rien d'autre ne change : statut et nombre de lignes identiques à l'échéancier.
  if j->>'statut' = public._statut_paiement(v_eleve, v_annee)
     and jsonb_array_length(j->'lignes') = (select count(*) from public._echeancier(v_eleve, v_annee)) then
    v_ok := v_ok + 1; v_res := v_res || '4. statut et lignes inchangés : OK'::text;
  else v_res := v_res || '4. statut ou lignes : KO'::text; end if;

  raise exception 'ESSAI 229 — %/4 OK (tout est annulé) : %', v_ok, array_to_string(v_res, ' · ');
end $$;
