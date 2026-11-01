-- =====================================================================
--  DIAGNOSTIC — les numéros de téléphone des parents (LECTURE SEULE)
--
--  Avant de faire du numéro l'identifiant de connexion d'un parent, on
--  mesure : combien de numéros reviennent sur plusieurs fiches, et s'il
--  s'agit de la MÊME personne (fiche en double, sans danger) ou de
--  personnes DIFFÉRENTES (deux familles verraient leurs enfants respectifs).
--
--  Ne modifie rien. Écoles de démonstration exclues.
--  L'éditeur n'affiche que le DERNIER résultat : tout tient dans un seul
--  tableau, le résumé en tête (catégorie « 0 · … »), puis le détail.
--
--  Normalisation : chiffres seuls, indicatif 221 / 00221 retiré
--  (« 77 123 45 67 », « +221771234567 » et « 771234567 » = même numéro).
-- =====================================================================
with t as (
  select tu.id, tu.ecole_id, ec.nom as ecole, tu.prenom, tu.nom, tu.profil_id,
         regexp_replace(coalesce(tu.telephone, ''), '\D', '', 'g') as brut
    from tuteurs tu
    join ecoles ec on ec.id = tu.ecole_id
   where ec.nom not ilike '%demo%'
), n as (
  select *,
         case when length(brut) = 14 and brut like '00221%' then substr(brut, 6)
              when length(brut) = 12 and brut like '221%'   then substr(brut, 4)
              else brut end as tel,
         lower(trim(prenom) || ' ' || trim(nom)) as qui
    from t
), groupes as (
  select n.ecole, n.tel,
         count(*)                         as fiches,
         count(distinct n.qui)            as personnes,
         count(n.profil_id)               as comptes,
         string_agg(distinct n.prenom || ' ' || n.nom, ' / ') as noms,
         (select string_agg(distinct e.prenom || ' ' || e.nom, ', ')
            from eleve_tuteurs et join eleves e on e.id = et.eleve_id
           where et.tuteur_id = any (array_agg(n.id))) as enfants
    from n
   where n.tel <> ''
   group by n.ecole, n.tel
), classes as (
  select g.*,
         case when length(g.tel) <> 9 or g.tel !~ '^(7[05678]|3[03])' then '3 · numéro mal formé'
              when g.fiches = 1 then '1 · numéro unique'
              when g.personnes = 1 then '2 · même personne en double'
              else '4 · NOMS DIFFÉRENTS — à trancher' end as categorie
    from groupes g
)
select '0 · RÉSUMÉ' as categorie, ecole, null as telephone,
       count(*) filter (where categorie like '1%') || ' uniques · '
       || count(*) filter (where categorie like '2%') || ' doublons même personne · '
       || count(*) filter (where categorie like '4%') || ' noms différents · '
       || count(*) filter (where categorie like '3%') || ' mal formés · '
       || (select count(*) from n where n.ecole = c.ecole and n.tel = '') || ' fiches sans numéro · '
       || sum(comptes) || ' comptes parent déjà ouverts' as detail,
       null::bigint as fiches, null as enfants
  from classes c
 group by ecole
union all
select categorie, ecole,
       regexp_replace(tel, '(\d{2})(\d{3})(\d{2})(\d{2})', '\1 \2 \3 \4'),
       noms || case when comptes > 0 then ' · ' || comptes || ' compte(s) ouvert(s)' else '' end,
       fiches, enfants
  from classes
 where categorie not like '1%'
 order by 1, 2, 3;
