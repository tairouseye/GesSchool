-- =====================================================================
--  Démo : renommer les deux fiches tuteurs encore réelles (31/10/2026)
--
--  La messagerie de la démo direction affichait « Abdou Fall » et
--  « Coumba SEYE ». Leur nom vient de la table `tuteurs` (fiche de la
--  famille DANS l'école de démo), pas des comptes : on renomme donc les
--  fiches de TutTank_Demo seulement. Les comptes eux-mêmes (`profils`)
--  et toute autre école ne sont pas touchés.
--  La fiche « Coumba SEYE » portait aussi une adresse e-mail réelle :
--  elle est remplacée par une adresse fictive, comme les autres tuteurs.
--
--  Rejouable : après un premier passage, les deux UPDATE ne trouvent plus
--  rien. À coller dans l'éditeur SQL de Supabase.
-- =====================================================================

update tuteurs t
   set prenom = 'Ousmane', nom = 'Diop', email = 'parent-demo-1@exemple.sn'
  from ecoles e
 where e.id = t.ecole_id and e.nom = 'TutTank_Demo'
   and t.prenom = 'Abdou' and t.nom = 'Fall';

update tuteurs t
   set prenom = 'Awa', nom = 'Ndiaye', email = 'parent-demo-2@exemple.sn'
  from ecoles e
 where e.id = t.ecole_id and e.nom = 'TutTank_Demo'
   and t.prenom = 'Coumba' and t.nom = 'SEYE';

-- Vérification (seul résultat affiché par l'éditeur) : 0 ligne attendue
-- pour les anciens noms, 2 pour les nouveaux, 0 adresse hors exemple.sn.
select
  (select count(*) from tuteurs t join ecoles e on e.id = t.ecole_id
    where e.nom = 'TutTank_Demo'
      and ((t.prenom = 'Abdou' and t.nom = 'Fall') or (t.prenom = 'Coumba' and t.nom = 'SEYE'))) as anciens_noms,
  (select count(*) from tuteurs t join ecoles e on e.id = t.ecole_id
    where e.nom = 'TutTank_Demo'
      and ((t.prenom = 'Ousmane' and t.nom = 'Diop') or (t.prenom = 'Awa' and t.nom = 'Ndiaye'))) as nouveaux_noms,
  (select count(*) from tuteurs t join ecoles e on e.id = t.ecole_id
    where e.nom = 'TutTank_Demo' and t.email is not null and t.email not ilike '%exemple.sn') as adresses_reelles;
