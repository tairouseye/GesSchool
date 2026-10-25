-- Tut'Tank — vérification avant import (LECTURE SEULE, ne modifie rien)
-- À coller dans l'éditeur SQL Supabase et à exécuter tel quel.
-- Résultat : une ligne par frais, avec les dates de l'année courante.
select
  a.libelle                      as annee,
  a.date_debut, a.date_fin,
  f.libelle                      as frais,
  f.montant,
  case when f.recurrent then 'mensuel' else 'ponctuel' end as rythme,
  case when f.obligatoire then 'obligatoire' else 'optionnel' end as obligation,
  coalesce(n.libelle, 'cycle ' || c.libelle, 'toute l''école') as s_applique_a,
  case when f.annee_id is null then 'toutes années' else 'cette année' end as portee
from ecoles e
join annees_scolaires a on a.ecole_id = e.id and a.courante
left join frais f on f.ecole_id = e.id and (f.annee_id = a.id or f.annee_id is null)
left join niveaux n on n.id = f.niveau_id
left join cycles c on c.id = f.cycle_id
where e.id = '72e0a623-1a12-4b57-b8c8-62e57b00fa61'
order by s_applique_a, rythme, f.libelle;
