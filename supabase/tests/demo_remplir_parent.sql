-- =====================================================================
--  Démo sans compte — remplir les rubriques VIDES des enfants du parent démo
--
--  Constat (diagnostic_demo_parent.sql, 31/10/2026) : Aminata (CM1) et
--  Nafissatou (CE1) n'avaient ni bulletin, ni absence, ni transport, ni
--  demande de document, ni alerte ; Aminata n'avait pas de cahier de textes.
--
--  Contenu FICTIF et crédible, dans TutTank_Demo seulement :
--    - bulletin du 1er trimestre PUBLIÉ, une ligne par matière de l'emploi
--      du temps, moyennes tirées des notes existantes (sinon vraisemblables),
--      appréciations et décision ;
--    - 1 absence justifiée + 1 retard en attente de justification ;
--    - 5 séances de cahier de textes (si la classe n'en a aucune) ;
--    - transport : un circuit, deux arrêts, l'aînée abonnée ;
--    - 1 attestation prête + 1 certificat en cours ;
--    - un échange avec l'école dans la messagerie ;
--    - des alertes non lues, pour que les pastilles s'allument.
--
--  Prérequis : migrations 216 et 217, demo_comptes.sql.
--  Rejouable : ce que le script a posé est effacé puis reposé.
--  À coller EN ENTIER dans l'éditeur SQL Supabase.
-- =====================================================================
do $$
declare
  v_ecole   uuid;
  v_parent  uuid;
  v_tuteur  uuid;
  v_annee   uuid;
  v_periode uuid;
  v_circuit uuid;
  v_arret   uuid;
  v_aine    uuid;
  e         record;
  m         record;
  v_bull    uuid;
  v_moy     numeric;
  v_eff     int;
  v_rang    int;
  v_i       int := 0;
begin
  select id into v_ecole from ecoles where nom = 'TutTank_Demo' and demonstration;
  select id into v_parent from auth.users where email = 'demo.parent@gesprosn.org';
  select id into v_tuteur from tuteurs where profil_id = v_parent and ecole_id = v_ecole;
  if v_ecole is null or v_tuteur is null then
    raise exception 'Lancer d''abord demo_comptes.sql (école ou tuteur démo introuvable).';
  end if;

  select id into v_annee from annees_scolaires where ecole_id = v_ecole and courante;
  select id into v_periode from periodes where annee_id = v_annee order by ordre limit 1;
  if v_periode is null then raise exception 'Aucune période dans l''année courante de TutTank_Demo.'; end if;

  -- --- 0. Effacer ce qu'un passage précédent a posé ------------------------
  delete from bulletins b using eleve_tuteurs et
   where et.tuteur_id = v_tuteur and b.eleve_id = et.eleve_id and b.periode_id = v_periode;
  delete from absences a using eleve_tuteurs et
   where et.tuteur_id = v_tuteur and a.eleve_id = et.eleve_id;
  delete from transport_abonnements ab using eleve_tuteurs et
   where et.tuteur_id = v_tuteur and ab.eleve_id = et.eleve_id;
  delete from transport_circuits where ecole_id = v_ecole and nom = 'Circuit Mermoz – Sacré-Cœur';
  delete from demandes_documents where tuteur_id = v_tuteur;
  delete from messages where tuteur_id = v_tuteur;
  delete from notifications where destinataire_id = v_parent;

  -- --- 1. Bulletins publiés -------------------------------------------------
  --  Un bulletin naît en brouillon (mig. 166) ; seule la direction publie.
  --  L'éditeur SQL n'a pas de rôle : on suspend ce contrôle le temps du
  --  script (la transaction l'annule si quoi que ce soit échoue).
  alter table bulletins disable trigger trg_statut_bulletin_ins;

  for e in
    select el.id, el.prenom, ins.classe_id
      from eleve_tuteurs et
      join eleves el on el.id = et.eleve_id
      join inscriptions ins on ins.eleve_id = el.id and ins.annee_id = v_annee
     where et.tuteur_id = v_tuteur
     order by el.prenom
  loop
    select count(*) into v_eff from inscriptions where classe_id = e.classe_id and annee_id = v_annee;
    insert into bulletins (ecole_id, eleve_id, classe_id, periode_id, effectif, statut, publie_le, genere_le)
    values (v_ecole, e.id, e.classe_id, v_periode, v_eff, 'publie', now(), now())
    returning id into v_bull;

    for m in
      select distinct ed.matiere_id from emplois_du_temps ed
       where ed.classe_id = e.classe_id and ed.matiere_id is not null
    loop
      select round(avg(n.valeur * 20 / nullif(ev.bareme, 0)), 2) into v_moy
        from notes n join evaluations ev on ev.id = n.evaluation_id
       where n.eleve_id = e.id and ev.matiere_id = m.matiere_id and n.valeur is not null;
      --  Sans note : une moyenne vraisemblable, stable d'un passage à l'autre.
      v_moy := coalesce(v_moy, 11 + (abs(hashtext(e.id::text || m.matiere_id::text)) % 70) / 10.0);
      insert into bulletin_lignes (ecole_id, bulletin_id, matiere_id, moyenne, coefficient, appreciation)
      values (v_ecole, v_bull, m.matiere_id, v_moy, 1,
        case when v_moy >= 16 then 'Excellent travail, continue ainsi.'
             when v_moy >= 14 then 'Très bon trimestre.'
             when v_moy >= 12 then 'Bon travail, des progrès réguliers.'
             when v_moy >= 10 then 'Résultats corrects, peut mieux faire.'
             else 'Des efforts sont attendus.' end);
    end loop;

    select round(avg(moyenne), 2) into v_moy from bulletin_lignes where bulletin_id = v_bull;
    v_rang := greatest(1, least(v_eff, 1 + (abs(hashtext(e.id::text)) % greatest(v_eff / 3, 1))));
    update bulletins set
      moyenne_generale = v_moy,
      rang = v_rang,
      mention = case when v_moy >= 16 then 'Très bien' when v_moy >= 14 then 'Bien'
                     when v_moy >= 12 then 'Assez bien' when v_moy >= 10 then 'Passable' end,
      appreciation_generale = e.prenom || ' est une élève sérieuse et appliquée. Bon premier trimestre : '
                              || 'il faut maintenir cet effort jusqu''à la fin de l''année.',
      decision = 'Félicitations du conseil des maîtres'
     where id = v_bull;
  end loop;

  alter table bulletins enable trigger trg_statut_bulletin_ins;

  -- --- 2. Absences (le trigger d'absence crée l'alerte du parent) ----------
  for e in
    select el.id, ins.classe_id from eleve_tuteurs et
      join eleves el on el.id = et.eleve_id
      join inscriptions ins on ins.eleve_id = el.id and ins.annee_id = v_annee
     where et.tuteur_id = v_tuteur order by el.prenom
  loop
    v_i := v_i + 1;
    insert into absences (ecole_id, eleve_id, classe_id, type, date_abs, motif, statut, justification)
    values (v_ecole, e.id, e.classe_id, 'absence', current_date - (6 + v_i), 'Fièvre', 'justifie',
            'Certificat médical remis par la famille.');
    insert into absences (ecole_id, eleve_id, classe_id, type, date_abs, heure_debut, statut)
    values (v_ecole, e.id, e.classe_id, 'retard', current_date - v_i, '08:20', 'non_justifie');
  end loop;

  -- --- 3. Cahier de textes : les classes qui n'en ont pas ------------------
  for e in
    select distinct ins.classe_id from eleve_tuteurs et
      join inscriptions ins on ins.eleve_id = et.eleve_id and ins.annee_id = v_annee
     where et.tuteur_id = v_tuteur
       and not exists (select 1 from cahier_textes ct where ct.classe_id = ins.classe_id)
  loop
    insert into cahier_textes (ecole_id, classe_id, matiere_id, date_seance, contenu, devoirs, date_pour)
    select v_ecole, e.classe_id, x.matiere_id, current_date - x.recul, x.contenu, x.devoirs,
           case when x.devoirs is null then null else current_date - x.recul + 2 end
      from (
        select row_number() over (order by ed.matiere_id) as k, ed.matiere_id
          from (select distinct matiere_id from emplois_du_temps
                 where classe_id = e.classe_id and matiere_id is not null) ed
      ) mt
      join (values
        (1, 1,  'Lecture : « Le petit marchand de Sandaga », compréhension du texte.', 'Relire le texte et répondre aux questions 1 à 4.'),
        (2, 2,  'Les fractions : partager une unité en parts égales.', 'Exercices 3 et 5 page 42.'),
        (3, 3,  'Le cycle de l''eau : évaporation, condensation, précipitations.', null),
        (4, 6,  'Conjugaison : le passé composé des verbes du 1er groupe.', 'Apprendre la leçon.'),
        (5, 8,  'Géographie : les régions du Sénégal.', 'Colorier la carte des régions.')
      ) as x(k, recul, contenu, devoirs) on x.k = ((mt.k - 1) % 5) + 1
     where mt.k <= 5;
  end loop;

  -- --- 4. Transport : un circuit, l'aînée abonnée --------------------------
  insert into transport_circuits (ecole_id, nom, vehicule, chauffeur, chauffeur_tel, heure_depart)
  values (v_ecole, 'Circuit Mermoz – Sacré-Cœur', 'Minibus 15 places', 'Modou Diouf', '70 000 09 01', '07:00')
  returning id into v_circuit;
  insert into transport_arrets (ecole_id, circuit_id, libelle, ordre, heure)
  values (v_ecole, v_circuit, 'Rond-point Mermoz', 1, '07:10');
  insert into transport_arrets (ecole_id, circuit_id, libelle, ordre, heure)
  values (v_ecole, v_circuit, 'Sacré-Cœur 3, pharmacie', 2, '07:25')
  returning id into v_arret;

  select el.id into v_aine from eleve_tuteurs et join eleves el on el.id = et.eleve_id
   where et.tuteur_id = v_tuteur order by el.date_naissance nulls last, el.prenom limit 1;
  insert into transport_abonnements (ecole_id, eleve_id, circuit_id, arret_id, trajet, tarif)
  values (v_ecole, v_aine, v_circuit, v_arret, 'aller_retour', 15000);

  -- --- 5. Demandes de documents ---------------------------------------------
  insert into demandes_documents (ecole_id, eleve_id, tuteur_id, type, message, statut, reponse, traite_le, created_at)
  select v_ecole, v_aine, v_tuteur, 'inscription', 'Pour le dossier de bourse.', 'pret',
         'Votre attestation est prête : vous pouvez la retirer au secrétariat.', now() - interval '1 day', now() - interval '3 days';
  insert into demandes_documents (ecole_id, eleve_id, tuteur_id, type, message, statut, created_at)
  select v_ecole, et.eleve_id, v_tuteur, 'scolarite', null, 'en_cours', now() - interval '1 day'
    from eleve_tuteurs et where et.tuteur_id = v_tuteur and et.eleve_id <> v_aine limit 1;

  -- --- 6. Messagerie ---------------------------------------------------------
  insert into messages (ecole_id, tuteur_id, expediteur, contenu, lu, created_at) values
    (v_ecole, v_tuteur, 'parent', 'Bonjour, Aminata sera absente vendredi matin pour un rendez-vous médical. Merci.', true,  now() - interval '4 days'),
    (v_ecole, v_tuteur, 'ecole',  'Bien reçu, merci de nous avoir prévenus. Pensez à remettre le justificatif à son retour.', true,  now() - interval '4 days' + interval '2 hours'),
    (v_ecole, v_tuteur, 'ecole',  'Bonjour, la réunion parents-enseignants du 1er trimestre aura lieu samedi à 10 h dans la grande salle.', false, now() - interval '5 hours');

  -- --- 7. Alertes non lues (en plus de celles des absences) -----------------
  insert into notifications (ecole_id, destinataire_id, eleve_id, categorie, titre, message, created_at)
  select v_ecole, v_parent, et.eleve_id, x.categorie, x.titre, x.message, now() - x.recul
    from eleve_tuteurs et
    cross join (values
      ('note',    'Nouvelle note', 'Une note de mathématiques vient d''être publiée.', interval '2 days'),
      ('facture', 'Mensualité de novembre', 'La facture de novembre est disponible. À régler au plus tard le 5.', interval '1 day')
    ) as x(categorie, titre, message, recul)
   where et.tuteur_id = v_tuteur;
  insert into notifications (ecole_id, destinataire_id, categorie, titre, message, created_at)
  values (v_ecole, v_parent, 'message', 'Nouveau message de l''école', 'Réunion parents-enseignants samedi à 10 h.', now() - interval '5 hours');

  raise notice 'Démo parent remplie.';
end $$;

-- Contrôle : relancer ensuite diagnostic_demo_parent.sql — plus aucun 0
-- attendu, sauf « acquis » (réservé au préscolaire).
