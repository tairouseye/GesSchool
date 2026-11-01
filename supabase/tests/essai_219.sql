-- =====================================================================
--  Essai de la migration 219 — notifications du personnel
--
--  Simule, sur l'école de démonstration, les quatre événements qui
--  doivent prévenir le personnel, compte les notifications créées, puis
--  ANNULE TOUT : le script se termine volontairement par une erreur
--  « RÉSULTAT… », qui fait revenir la base exactement à l'état d'avant
--  (aucune notification gardée, aucun push envoyé).
--
--  ⚠️ L'ERREUR FINALE EST ATTENDUE : c'est elle qui porte le résultat.
--  Attendu : chacune des 4 catégories ≥ 1, et « doublon » = 0.
-- =====================================================================
do $$
declare
  v_ecole uuid;
  v_fac record;
  v_tuteur uuid;
  v_abs uuid;
  v_res text;
  v_avant timestamptz := now();   -- `created_at` vaut now() : le début de CETTE transaction
begin
  select id into v_ecole from ecoles where nom = 'TutTank_Demo';
  if v_ecole is null then raise exception 'École TutTank_Demo introuvable.'; end if;

  -- 1. Paiement mobile déclaré
  select id, eleve_id into v_fac from factures where ecole_id = v_ecole and statut <> 'annulee' limit 1;
  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx)
  values (v_ecole, v_fac.id, v_fac.eleve_id, 1000, 'wave', 'ESSAI-219');

  -- 2. Justificatif d'absence (passage à « en attente »)
  select id into v_abs from absences where ecole_id = v_ecole and statut = 'non_justifie' limit 1;
  if v_abs is not null then
    update absences set statut = 'en_attente', justification = 'Essai 219' where id = v_abs;
  end if;

  -- 3. Deux messages du même parent : UNE seule alerte attendue par destinataire
  select id into v_tuteur from tuteurs where ecole_id = v_ecole limit 1;
  insert into messages (ecole_id, tuteur_id, expediteur, contenu) values (v_ecole, v_tuteur, 'parent', 'Essai 219 (1)');
  insert into messages (ecole_id, tuteur_id, expediteur, contenu) values (v_ecole, v_tuteur, 'parent', 'Essai 219 (2)');
  -- Un message de l'école ne prévient personne.
  insert into messages (ecole_id, tuteur_id, expediteur, contenu) values (v_ecole, v_tuteur, 'ecole', 'Essai 219 (école)');

  -- 4. Demande de document
  insert into demandes_documents (ecole_id, eleve_id, tuteur_id, type)
  values (v_ecole, v_fac.eleve_id, v_tuteur, 'scolarite');

  select string_agg(format('%s = %s', categorie, n), ' · ' order by categorie) into v_res from (
    select categorie, count(*) n from notifications
     where ecole_id = v_ecole and created_at >= v_avant
       and categorie in ('paiement_declare', 'justificatif', 'message_parent', 'demande_document')
     group by categorie
    union all
    select 'doublon', count(*) from (
      select destinataire_id from notifications
       where ecole_id = v_ecole and created_at >= v_avant and categorie = 'message_parent'
       group by destinataire_id having count(*) > 1) d
  ) t;

  raise exception 'RÉSULTAT (tout est annulé) : %', coalesce(v_res, 'aucune notification');
end $$;
