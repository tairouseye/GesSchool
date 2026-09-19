-- =====================================================================
--  JEU DE TEST — Bibliothèque universitaire (SIGB)
--
--  À exécuter dans l'éditeur SQL Supabase. Ce n'est PAS une migration :
--  le fichier ne porte pas de numéro et ne doit pas être rejoué en
--  production. Il remplit une bibliothèque de démonstration pour tester
--  le catalogue, la circulation, les dépôts, les acquisitions et
--  l'inventaire avec des données crédibles.
--
--  ► Établissement visé : le premier en mode « supérieur ».
--    Pour en cibler un autre, renseignez v_nom_ecole ci-dessous.
--
--  ► TOUT est marqué par le mot-clé « jeu-test » et les codes-barres
--    commencent par « DEMO- » : le bloc de SUPPRESSION en fin de fichier
--    enlève l'intégralité du jeu en une commande.
--
--  ► Rejouable : relancer le script ne crée pas de doublons (il sort si
--    le jeu est déjà en place).
-- =====================================================================

do $$
declare
  v_nom_ecole text := null;       -- ex. 'UCAD' ; null = 1re école « supérieur »
  v_ecole     uuid;
  v_bib       uuid;
  v_salle     uuid;
  v_rayon     uuid;
  v_rayons    jsonb := '{}'::jsonb;
  v_res       uuid;
  v_aut       uuid;
  v_ex        uuid;
  v_ex_pris   uuid;
  v_eleves    uuid[];
  v_profil    uuid;
  v_four      uuid;
  v_cmd       uuid;
  v_nb_notices int := 0;
  r           record;
  a           text;
  i           int;
begin
  -- --- 1. Établissement -----------------------------------------------
  if v_nom_ecole is null then
    select id into v_ecole from ecoles
     where type_etablissement = 'superieur' order by created_at limit 1;
  else
    select id into v_ecole from ecoles
     where nom ilike '%' || v_nom_ecole || '%' limit 1;
  end if;

  if v_ecole is null then
    raise exception 'Aucun établissement en mode « supérieur ». Passez-en un en Supérieur dans Paramètres, ou renseignez v_nom_ecole.';
  end if;

  if exists (select 1 from biblio_ressources
              where ecole_id = v_ecole and 'jeu-test' = any(mots_cles)) then
    raise notice 'Le jeu de test est déjà en place pour cet établissement. Rien à faire.';
    return;
  end if;

  -- Emprunteurs : on réutilise de vrais étudiants de l'établissement.
  select array_agg(id) into v_eleves
    from (select id from eleves where ecole_id = v_ecole order by created_at limit 4) s;

  select pr.profil_id into v_profil
    from profil_roles pr where pr.ecole_id = v_ecole limit 1;

  -- --- 2. Bibliothèque et localisations --------------------------------
  insert into biblio_bibliotheques (ecole_id, nom, type, adresse)
  values (v_ecole, 'Bibliothèque centrale', 'centrale', 'Campus principal')
  returning id into v_bib;

  insert into biblio_localisations (ecole_id, bibliotheque_id, type, libelle, code)
  values (v_ecole, v_bib, 'salle', 'Salle de lecture', 'SL')
  returning id into v_salle;

  foreach a in array array['Droit', 'Économie & Gestion', 'Sciences & Santé', 'Lettres & Sciences humaines']
  loop
    insert into biblio_localisations (ecole_id, bibliotheque_id, parent_id, type, libelle, code)
    values (v_ecole, v_bib, v_salle, 'rayon', 'Rayon ' || a, upper(left(a, 3)))
    returning id into v_rayon;
    v_rayons := v_rayons || jsonb_build_object(a, v_rayon::text);
  end loop;

  -- --- 3. Notices, auteurs et exemplaires ------------------------------
  --  ISBN réels : ils permettent aussi de tester l'enrichissement 🔎.
  for r in
    select * from (values
      ('Droit des sociétés commerciales OHADA', 'Droit', 'Issa-Sayegh, Joseph', 'Bruylant', 2019, '9782802763475', 'DRT-001', 4),
      ('Introduction au droit africain', 'Droit', 'Melone, Stanislas', 'Karthala', 2016, '9782811116705', 'DRT-002', 3),
      ('Les institutions de l Union africaine', 'Droit', 'Bourgi, Albert', 'LGDJ', 2018, '9782275062204', 'DRT-003', 2),
      ('Économie du développement', 'Économie & Gestion', 'Assidon, Elsa', 'La Découverte', 2020, '9782707169655', 'ECO-001', 5),
      ('Comptabilité générale SYSCOHADA', 'Économie & Gestion', 'Sambe, Oumar ; Diallo, Mamadou', 'Editions Comptables', 2018, '9782359300543', 'ECO-002', 6),
      ('Microéconomie', 'Économie & Gestion', 'Varian, Hal R.', 'De Boeck', 2015, '9782804190606', 'ECO-003', 4),
      ('Marketing management', 'Économie & Gestion', 'Kotler, Philip ; Keller, Kevin', 'Pearson', 2019, '9782326002128', 'ECO-004', 3),
      ('Analyse financière des entreprises', 'Économie & Gestion', 'Thibierge, Christophe', 'Vuibert', 2017, '9782311404739', 'ECO-005', 2),
      ('Anatomie humaine descriptive', 'Sciences & Santé', 'Kamina, Pierre', 'Maloine', 2019, '9782224035488', 'SCI-001', 4),
      ('Biochimie de Harper', 'Sciences & Santé', 'Murray, Robert', 'De Boeck', 2017, '9782804194208', 'SCI-002', 3),
      ('Maladies tropicales', 'Sciences & Santé', 'Gentilini, Marc', 'Lavoisier', 2018, '9782257206732', 'SCI-003', 2),
      ('Santé publique en Afrique', 'Sciences & Santé', 'Fassin, Didier', 'PUF', 2016, '9782130734239', 'SCI-004', 3),
      ('Algorithmique', 'Sciences & Santé', 'Cormen, Thomas', 'Dunod', 2017, '9782100545261', 'SCI-005', 5),
      ('Bases de données relationnelles', 'Sciences & Santé', 'Gardarin, Georges', 'Eyrolles', 2015, '9782212112818', 'SCI-006', 4),
      ('Réseaux', 'Sciences & Santé', 'Tanenbaum, Andrew', 'Pearson', 2016, '9782744076015', 'SCI-007', 3),
      ('Mathématiques pour économistes', 'Sciences & Santé', 'Simon, Carl', 'De Boeck', 2018, '9782807307384', 'SCI-008', 2),
      ('Une si longue lettre', 'Lettres & Sciences humaines', 'Bâ, Mariama', 'NEAS', 2015, '9782723604536', 'LET-001', 8),
      ('L aventure ambiguë', 'Lettres & Sciences humaines', 'Kane, Cheikh Hamidou', 'Julliard', 2014, '9782260005841', 'LET-002', 8),
      ('Les bouts de bois de Dieu', 'Lettres & Sciences humaines', 'Sembène, Ousmane', 'Presses Pocket', 2013, '9782266138437', 'LET-003', 6),
      ('Cahier d un retour au pays natal', 'Lettres & Sciences humaines', 'Césaire, Aimé', 'Présence Africaine', 2014, '9782708707405', 'LET-004', 5),
      ('Nations nègres et culture', 'Lettres & Sciences humaines', 'Diop, Cheikh Anta', 'Présence Africaine', 2015, '9782708705678', 'LET-005', 4),
      ('Histoire générale de l Afrique', 'Lettres & Sciences humaines', 'Ki-Zerbo, Joseph', 'UNESCO', 2016, '9789232017079', 'LET-006', 3),
      ('Sociologie générale', 'Lettres & Sciences humaines', 'Bourdieu, Pierre', 'Seuil', 2016, '9782021316568', 'LET-007', 2),
      ('Méthodologie de la recherche', 'Lettres & Sciences humaines', 'Quivy, Raymond ; Van Campenhoudt, Luc', 'Dunod', 2017, '9782100756223', 'LET-008', 6),
      ('Le Petit Prince', 'Lettres & Sciences humaines', 'Saint-Exupéry, Antoine de', 'Gallimard', 2013, '9782070612758', 'LET-009', 3)
    ) as t(titre, discipline, auteurs, editeur, annee, isbn, cote, nb)
  loop
    insert into biblio_ressources
      (ecole_id, titre, type_ressource, langue, editeur, annee_pub, isbn, discipline, mots_cles, resume, visible)
    values (v_ecole, r.titre, 'livre', 'fr', r.editeur, r.annee, r.isbn, r.discipline,
            array['jeu-test', lower(r.discipline)],
            'Exemplaire du fonds de démonstration, discipline ' || r.discipline || '.', true)
    returning id into v_res;
    v_nb_notices := v_nb_notices + 1;

    -- Auteurs : « Nom, Prénom », séparés par « ; ». Réutilisés s'ils existent.
    i := 0;
    foreach a in array string_to_array(r.auteurs, ';')
    loop
      a := btrim(a);
      select id into v_aut from biblio_auteurs
       where ecole_id = v_ecole
         and lower(nom) = lower(btrim(split_part(a, ',', 1)))
         and coalesce(lower(prenom), '') = coalesce(lower(btrim(nullif(split_part(a, ',', 2), ''))), '')
       limit 1;

      if v_aut is null then
        insert into biblio_auteurs (ecole_id, nom, prenom)
        values (v_ecole, btrim(split_part(a, ',', 1)), btrim(nullif(split_part(a, ',', 2), '')))
        returning id into v_aut;
      end if;

      insert into biblio_ressource_auteurs (ecole_id, ressource_id, auteur_id, role, ordre)
      values (v_ecole, v_res, v_aut, 'auteur', i)
      on conflict do nothing;
      i := i + 1;
      v_aut := null;
    end loop;

    -- Exemplaires, rangés dans le rayon de leur discipline.
    for i in 1 .. r.nb loop
      insert into biblio_exemplaires
        (ecole_id, ressource_id, code_barres, cote, bibliotheque_id, localisation_id,
         etat, statut, date_acquisition, prix)
      values (v_ecole, v_res, 'DEMO-' || r.cote || '-' || lpad(i::text, 2, '0'),
              r.cote, v_bib, (v_rayons ->> r.discipline)::uuid,
              case when i = 1 then 'neuf' else 'bon' end, 'disponible',
              current_date - (30 + i * 7), 12000 + i * 500);
    end loop;
  end loop;

  -- --- 4. Règles de prêt -----------------------------------------------
  insert into biblio_regles_pret
    (ecole_id, role, max_emprunts, duree_jours, renouvellements_max, penalite_jour, penalites_actives)
  values
    (v_ecole, 'etudiant',   3, 14, 1, 100, true),
    (v_ecole, 'enseignant', 6, 30, 2,   0, false)
  on conflict (ecole_id, role) do nothing;

  -- --- 5. Circulation ---------------------------------------------------
  if v_eleves is not null and array_length(v_eleves, 1) >= 1 then
    -- (a) Emprunt en cours, dans les temps.
    select id into v_ex from biblio_exemplaires
     where ecole_id = v_ecole and code_barres = 'DEMO-ECO-001-01';
    insert into biblio_emprunts
      (ecole_id, exemplaire_id, emprunteur_eleve_id, date_emprunt, date_echeance, statut, agent_profil_id)
    values (v_ecole, v_ex, v_eleves[1], current_date - 4, current_date + 10, 'en_cours', v_profil);

    -- (b) Emprunt EN RETARD : de quoi tester la pénalité proposée au retour.
    select id into v_ex from biblio_exemplaires
     where ecole_id = v_ecole and code_barres = 'DEMO-LET-001-01';
    insert into biblio_emprunts
      (ecole_id, exemplaire_id, emprunteur_eleve_id, date_emprunt, date_echeance, statut, agent_profil_id)
    values (v_ecole, v_ex, v_eleves[1], current_date - 25, current_date - 11, 'en_cours', v_profil);

    -- (c) Emprunt déjà rendu (historique).
    select id into v_ex from biblio_exemplaires
     where ecole_id = v_ecole and code_barres = 'DEMO-SCI-005-01';
    insert into biblio_emprunts
      (ecole_id, exemplaire_id, emprunteur_eleve_id, date_emprunt, date_echeance, date_retour, statut)
    values (v_ecole, v_ex, v_eleves[1], current_date - 40, current_date - 26, current_date - 28, 'rendu');

    if array_length(v_eleves, 1) >= 2 then
      -- (d) Tous les exemplaires d'un titre sortis => la réservation a du sens.
      for v_ex_pris in
        select e.id from biblio_exemplaires e
         where e.ecole_id = v_ecole and e.cote = 'LET-007'
      loop
        insert into biblio_emprunts
          (ecole_id, exemplaire_id, emprunteur_eleve_id, date_emprunt, date_echeance, statut)
        values (v_ecole, v_ex_pris, v_eleves[2], current_date - 3, current_date + 11, 'en_cours');
      end loop;

      select id into v_res from biblio_ressources
       where ecole_id = v_ecole and titre = 'Sociologie générale';
      insert into biblio_reservations (ecole_id, ressource_id, eleve_id, rang, statut, expire_le)
      values (v_ecole, v_res, v_eleves[1], 1, 'active', now() + interval '7 days');
    end if;
  else
    raise notice 'Aucun étudiant dans cet établissement : emprunts et réservations non créés.';
  end if;

  -- --- 6. Dépôts institutionnels ----------------------------------------
  if v_eleves is not null and array_length(v_eleves, 1) >= 1 then
    insert into biblio_depots
      (ecole_id, type, titre, resume, mots_cles, annee_academique,
       deposant_profil_id, deposant_eleve_id, fichier_chemin, fichier_nom, statut, soumis_le)
    values
      (v_ecole, 'memoire', 'Impact du mobile money sur l inclusion financière au Sénégal',
       'Mémoire de master analysant la progression du mobile money entre 2015 et 2025.',
       array['jeu-test','mobile money','inclusion financière'], '2025-2026',
       v_profil, v_eleves[1], null, null, 'soumis', now() - interval '3 days'),
      (v_ecole, 'these', 'Résistance aux antipaludiques en zone sahélienne',
       'Thèse de doctorat portant sur l évolution des résistances observées en milieu rural.',
       array['jeu-test','paludisme','santé publique'], '2024-2025',
       v_profil, coalesce(v_eleves[2], v_eleves[1]), null, null, 'verification', now() - interval '12 days'),
      (v_ecole, 'pfe', 'Plateforme de gestion des stages universitaires',
       'Projet de fin d études : conception et développement d une plateforme de suivi des stages.',
       array['jeu-test','génie logiciel'], '2025-2026',
       v_profil, coalesce(v_eleves[3], v_eleves[1]), null, null, 'valide', now() - interval '20 days');

    raise notice 'Dépôts créés SANS fichier : la publication au catalogue exigera d en joindre un.';
  end if;

  -- --- 7. Acquisitions ---------------------------------------------------
  insert into biblio_fournisseurs (ecole_id, nom, contact, email, telephone, adresse, note)
  values (v_ecole, 'Librairie Clairafrique', 'M. Ndiaye', 'contact@clairafrique.sn',
          '+221 33 821 00 00', 'Dakar Plateau', 'Fournisseur historique (jeu-test)')
  returning id into v_four;

  insert into biblio_fournisseurs (ecole_id, nom, email, note)
  values (v_ecole, 'Editions Présence Africaine', 'commandes@presenceafricaine.com', 'jeu-test');

  insert into biblio_acquisitions (ecole_id, reference, fournisseur_id, statut, date_commande, note)
  values (v_ecole, 'BC-2026-001', v_four, 'commandee', current_date - 10, 'Commande de rentrée (jeu-test)')
  returning id into v_cmd;

  -- Une ligne RATTACHÉE (réceptionnable) …
  select id into v_res from biblio_ressources
   where ecole_id = v_ecole and titre = 'Une si longue lettre';
  insert into biblio_acquisitions_lignes
    (ecole_id, acquisition_id, ressource_id, titre, auteur, isbn, quantite, quantite_recue, prix_unitaire)
  values (v_ecole, v_cmd, v_res, 'Une si longue lettre', 'Mariama Bâ', '9782723604536', 5, 0, 4500);

  -- … et une ligne NON rattachée : la réception doit être refusée tant qu'on
  -- ne l'a pas reliée à une notice du catalogue.
  insert into biblio_acquisitions_lignes
    (ecole_id, acquisition_id, titre, auteur, isbn, quantite, quantite_recue, prix_unitaire)
  values (v_ecole, v_cmd, 'Précis de droit fiscal sénégalais', 'Diouf, Alioune', '9782912345678', 3, 0, 18000);

  insert into biblio_suggestions (ecole_id, demandeur_profil_id, titre, auteur, editeur, motif, statut)
  values
    (v_ecole, v_profil, 'Intelligence artificielle : une approche moderne', 'Russell & Norvig', 'Pearson',
     'Ouvrage de référence réclamé par les étudiants de master informatique.', 'soumise'),
    (v_ecole, v_profil, 'Précis de finances publiques', 'Bouvier, Michel', 'LGDJ',
     'Le seul exemplaire disponible est constamment emprunté.', 'soumise');

  -- --- 8. Inventaire -----------------------------------------------------
  insert into biblio_inventaires (ecole_id, libelle, bibliotheque_id, localisation_id, statut, note, cree_par)
  values (v_ecole, 'Récolement 2026 — Rayon Lettres', v_bib,
          (v_rayons ->> 'Lettres & Sciences humaines')::uuid, 'en_cours',
          'Campagne de démonstration (jeu-test)', v_profil);

  raise notice 'Jeu de test installé : % notices, bibliothèque « Bibliothèque centrale ».', v_nb_notices;
end $$;

-- =====================================================================
--  VÉRIFICATION RAPIDE
-- =====================================================================
select
  (select count(*) from biblio_ressources  where 'jeu-test' = any(mots_cles)) as notices,
  (select count(*) from biblio_exemplaires where code_barres like 'DEMO-%')   as exemplaires,
  (select count(*) from biblio_emprunts e
     join biblio_exemplaires x on x.id = e.exemplaire_id
    where x.code_barres like 'DEMO-%')                                        as emprunts,
  (select count(*) from biblio_depots      where 'jeu-test' = any(mots_cles)) as depots;

-- =====================================================================
--  SUPPRESSION DU JEU DE TEST  (à exécuter séparément, si besoin)
-- =====================================================================
-- Les emprunts, réservations, exemplaires et liaisons partent en cascade
-- avec les notices ; le reste est retiré explicitement.
--
-- delete from biblio_depots       where 'jeu-test' = any(mots_cles);
-- delete from biblio_ressources   where 'jeu-test' = any(mots_cles);
-- delete from biblio_inventaires  where note like '%jeu-test%';
-- delete from biblio_acquisitions where note like '%jeu-test%';
-- delete from biblio_fournisseurs where note like '%jeu-test%';
-- delete from biblio_suggestions  where titre in (
--   'Intelligence artificielle : une approche moderne', 'Précis de finances publiques');
-- delete from biblio_bibliotheques where nom = 'Bibliothèque centrale'
--   and not exists (select 1 from biblio_exemplaires x where x.bibliotheque_id = biblio_bibliotheques.id);
-- delete from biblio_auteurs a where not exists (
--   select 1 from biblio_ressource_auteurs ra where ra.auteur_id = a.id);
