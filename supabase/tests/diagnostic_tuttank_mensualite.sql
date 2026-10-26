-- =====================================================================
--  Tut'Tank — diagnostic « Mensualité 50000 dans l'appli, 55000 dans le
--  fichier » (répétition de l'import, 26/10/2026).
--  LECTURE SEULE, aucune donnée nominative : la grille de frais, les
--  règles de fratrie, et les frais mensuels que l'appli retient par niveau.
--  Un seul tableau en sortie (colonne « quoi »).
-- =====================================================================
with ec as (select '72e0a623-1a12-4b57-b8c8-62e57b00fa61'::uuid as id),
an as (
  select a.id from annees_scolaires a, ec
   where a.ecole_id = ec.id and a.date_debut = '2026-10-01' limit 1
)
select 1 as ordre, 'frais' as quoi,
       f.libelle || case when f.recurrent then ' (mensuel)' else '' end as libelle,
       f.montant,
       concat_ws(' · ', coalesce(n.libelle, cy.libelle, 'toute l''école'),
                 case when f.obligatoire then 'obligatoire' else 'optionnel' end,
                 'pour : ' || f.public,
                 case when f.annee_id is null then 'toutes années'
                      when f.annee_id = (select id from an) then 'année 2026-2027'
                      else 'AUTRE année' end) as detail
  from frais f
  left join niveaux n on n.id = f.niveau_id
  left join cycles cy on cy.id = f.cycle_id, ec
 where f.ecole_id = ec.id
union all
select 2, 'règle fratrie', r.nb_enfants || ' enfants et plus', r.valeur,
       r.type || ' · ' || coalesce(cy.libelle, 'tous cycles')
  from regles_fratrie r left join cycles cy on cy.id = r.cycle_id, ec
 where r.ecole_id = ec.id
union all
select 3, 'mensuels retenus : ' || n.libelle || case when nv then ' (nouveau)' else ' (ancien)' end,
       x.libelle, x.montant, null
  from niveaux n
  cross join (values (true), (false)) v(nv)
  cross join lateral public._frais_eleve((select id from ec), (select id from an), n.id, n.cycle_id, v.nv) x
 where n.ecole_id = (select id from ec) and x.recurrent
order by 1, 2, 3;
