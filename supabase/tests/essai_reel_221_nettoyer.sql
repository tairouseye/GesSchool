-- =====================================================================
--  ESSAI RÉEL 221 — 2/2 : NETTOYER le parent de test
--
--  Retire tout ce que l'essai a créé : la fiche « Test Téléphone », son lien
--  à l'élève, le compte 221770009901@tel.gesprosn.org, son profil et son rôle.
--  Le dernier tableau doit afficher 0 partout.
-- =====================================================================
delete from profil_roles where profil_id in (select id from auth.users where email = '221770009901@tel.gesprosn.org');
delete from profils      where id         in (select id from auth.users where email = '221770009901@tel.gesprosn.org');
delete from tuteurs where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795' and prenom = 'Test' and nom = 'Téléphone';
delete from auth.users where email = '221770009901@tel.gesprosn.org';

select (select count(*) from tuteurs where prenom = 'Test' and nom = 'Téléphone') as fiches_restantes,
       (select count(*) from auth.users where email = '221770009901@tel.gesprosn.org') as comptes_restants;
