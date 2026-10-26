-- =====================================================================
--  Essai de la migration 212 (détail des paiements : date, mode, autres
--  frais). LECTURE SEULE — à lancer APRÈS la 212. Une seule ligne de
--  résultat : « OK — … » ou « ÉCHEC — … ».
-- =====================================================================
with ec as (select '72e0a623-1a12-4b57-b8c8-62e57b00fa61'::uuid as id),
an as (select a.id from annees_scolaires a, ec where a.ecole_id = ec.id and a.courante limit 1),
el as (
  select i.eleve_id from inscriptions i, an, ec
   where i.annee_id = an.id and i.ecole_id = ec.id
),
j as (select el.eleve_id, public._echeancier_json(el.eleve_id, (select id from an)) as d from el),
l as (select x from j, jsonb_array_elements(j.d -> 'lignes') x),
c as (
  select
    (select count(*) from j) as eleves,
    (select count(*) from j where j.d ? 'autres') as avec_autres,
    (select count(*) from l where x ->> 'etat' = 'paye') as payees,
    (select count(*) from l where x ->> 'etat' = 'paye' and (x ->> 'date_paiement' is null or x ->> 'mode' is null)) as payees_sans_date,
    (select count(*) from l where x ->> 'etat' <> 'paye' and x ->> 'date_paiement' is not null) as dues_avec_date,
    has_function_privilege('authenticated', 'public._echeancier_json(uuid, uuid)', 'execute')
      or has_function_privilege('anon', 'public._echeancier_json(uuid, uuid)', 'execute') as ouverte
)
select case
  when ouverte then 'ÉCHEC — _echeancier_json est exécutable par un utilisateur.'
  when eleves = 0 then 'ÉCHEC — aucun élève inscrit trouvé pour Tut''Tank.'
  when avec_autres < eleves then 'ÉCHEC — la 212 n''est pas appliquée (pas de rubrique « autres »).'
  when payees_sans_date > 0 then format('ÉCHEC — %s lignes payées sans date ou sans mode.', payees_sans_date)
  when dues_avec_date > 0 then format('ÉCHEC — %s lignes non payées portent une date.', dues_avec_date)
  else format('OK — %s élèves, %s lignes payées, toutes avec date et mode ; fonction fermée aux utilisateurs.', eleves, payees)
end as resultat
from c;
