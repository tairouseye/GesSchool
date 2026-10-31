-- =====================================================================
--  Diagnostic — que contiennent les écoles de DÉMONSTRATION ?
--  À coller dans l'éditeur SQL Supabase (lecture seule, ne modifie rien).
--
--  But : la démo sans compte (mig. 216) ouvre une école de démonstration à
--  N'IMPORTE QUI. Elle ne doit contenir AUCUNE personne réelle. On vérifie :
--    1. ce qu'il y a dedans (de quoi faire une démo vivante) ;
--    2. si des élèves ou des tuteurs portent le même nom qu'une personne
--       d'une école RÉELLE (signe d'une copie de vraies données) ;
--    3. un échantillon de noms, à juger à l'œil.
-- =====================================================================

-- 1. Contenu de chaque école de démonstration
select e.nom as ecole,
  (select count(*) from classes c       where c.ecole_id = e.id) as classes,
  (select count(*) from eleves el       where el.ecole_id = e.id) as eleves,
  (select count(*) from tuteurs t       where t.ecole_id = e.id) as tuteurs,
  (select count(*) from tuteurs t       where t.ecole_id = e.id and t.profil_id is not null) as tuteurs_avec_compte,
  (select count(*) from profils p       where p.ecole_id = e.id) as comptes_personnel,
  (select count(*) from evaluations ev  where ev.ecole_id = e.id) as evaluations,
  (select count(*) from bulletins b     where b.ecole_id = e.id) as bulletins,
  (select count(*) from absences a      where a.ecole_id = e.id) as absences,
  (select count(*) from factures f      where f.ecole_id = e.id) as factures,
  (select count(*) from paiements pa    where pa.ecole_id = e.id) as paiements,
  (select count(*) from annonces an     where an.ecole_id = e.id) as annonces,
  (select count(*) from emplois_du_temps ed where ed.ecole_id = e.id) as creneaux_edt
from ecoles e
where e.demonstration
order by e.nom;

-- 2. Homonymes avec une école réelle (0 attendu partout)
select d.nom as ecole_demo,
  (select count(*) from eleves x join eleves y
      on lower(x.nom) = lower(y.nom) and lower(x.prenom) = lower(y.prenom)
     join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
   where x.ecole_id = d.id) as eleves_homonymes,
  (select count(*) from tuteurs x join tuteurs y
      on lower(x.nom) = lower(y.nom) and lower(x.prenom) = lower(y.prenom)
     join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
   where x.ecole_id = d.id) as tuteurs_homonymes,
  (select count(*) from tuteurs x join tuteurs y
      on x.telephone = y.telephone and x.telephone is not null
     join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
   where x.ecole_id = d.id) as telephones_communs
from ecoles d
where d.demonstration
order by d.nom;

-- 3. Échantillon de noms (10 élèves, 10 tuteurs par école de démo)
(select e.nom as ecole, 'eleve' as qui, el.prenom, el.nom, null as telephone
   from eleves el join ecoles e on e.id = el.ecole_id
  where e.demonstration order by e.nom, el.nom limit 20)
union all
(select e.nom, 'tuteur', t.prenom, t.nom, t.telephone
   from tuteurs t join ecoles e on e.id = t.ecole_id
  where e.demonstration order by e.nom, t.nom limit 20);
