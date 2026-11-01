-- =====================================================================
--  ESSAI RÉEL 221 — 1/2 : PRÉPARER un parent de test (école de démo)
--
--  Crée un parent fictif « Test Téléphone », numéro 77 000 99 01, code
--  ESSAI221, relié à un élève de l'école de démonstration. Claude fait
--  ensuite le parcours complet dans le navigateur (activation, connexion,
--  espace parent). À nettoyer avec essai_reel_221_nettoyer.sql.
-- =====================================================================
with t as (
  insert into tuteurs (ecole_id, prenom, nom, telephone, code_acces)
  values ('c9b85c0e-f19d-41de-8d94-3b4386cb6795', 'Test', 'Téléphone', '77 000 99 01', 'ESSAI221')
  returning id, ecole_id
), e as (
  select id from eleves where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795' order by nom, prenom limit 1
)
insert into eleve_tuteurs (ecole_id, eleve_id, tuteur_id, lien_parente, responsable_legal, responsable_paiement)
select t.ecole_id, e.id, t.id, 'Parent (essai)', true, true from t, e
returning (select prenom || ' ' || nom from eleves where id = eleve_id) as enfant_relie;
