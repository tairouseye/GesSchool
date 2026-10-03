-- =====================================================================
--  JEU DE DÉMONSTRATION — les fonctions livrées en 164 → 172
--
--  But : pouvoir éprouver dans l'application tout ce qui a été construit
--  après la visite, sans attendre que les écoles saisissent leurs données.
--
--  🔴 CE SCRIPT NE TOUCHE QUE LES ÉCOLES `demonstration = true`.
--  Chaque bloc le vérifie. La vraie Tut'Tank, l'UCAD, Ourson School,
--  Bakany Soucko et le Centre de Diamniadio ne sont JAMAIS modifiés — c'est
--  la règle « ne crée pas de données de test dans la production », et le
--  marqueur `demonstration` de la migration 156 existe précisément pour la
--  tenir.
--
--  ⚠️ REJOUABLE SANS DOMMAGE. Chaque insertion est précédée d'un test
--  d'existence : relancer le script ne duplique rien et n'écrase aucune
--  saisie faite entre-temps. Si vous avez commencé à remplir une
--  fonctionnalité à la main, le script la laisse tranquille.
--
--  ⚠️ À EXÉCUTER DANS L'ÉDITEUR SQL, et non depuis l'application. Deux
--  raisons : `ecole_courante()` vaut NULL dans l'éditeur, donc on écrit en
--  direct plutôt que par les RPC (qui, elles, exigent une session) ; et
--  l'éditeur s'exécute en propriétaire, ce qui traverse la RLS — c'est
--  nécessaire pour poser, par exemple, DEUX signatures de PV alors qu'une
--  seule personne serait connectée.
--
--  Ce qui n'est PAS fait ici, et pourquoi :
--   • les PHOTOS d'élèves : un fichier binaire ne s'insère pas en SQL.
--     C'est de toute façon l'écran de prise de vue qu'il faut éprouver,
--     au téléphone.
--   • les pièces du rayon réglementaire (mig. 159) : même raison.
--
--  ⚠️ CE SCRIPT A ÉTÉ EXÉCUTÉ ET VÉRIFIÉ le 03/10/2026 sur GeScola. Les
--  deux écoles de démonstration ont été alimentées ; les CINQ écoles de
--  production sont restées à zéro sur toutes les nouvelles tables, et leur
--  `pedagogie_elementaire` est toujours NULL. Il est conservé ici pour
--  pouvoir rejouer l'opération après une remise à zéro.
--
--  Prérequis : migrations 001 → 172 appliquées.
-- =====================================================================

-- --- Garde-fou --------------------------------------------------------
do $$
begin
  if not exists (select 1 from ecoles where demonstration = true) then
    raise exception 'Aucune école marquée « démonstration » : script interrompu pour ne rien toucher en production.';
  end if;
  raise notice 'Écoles de démonstration trouvées : %',
    (select string_agg(nom, ', ') from ecoles where demonstration = true);
end $$;

-- =====================================================================
--  1. Pédagogie Montessori, et des périodes DATÉES
-- =====================================================================
--  La pédagogie (mig. 168) ne se devine pas : on la pose sur les démos qui
--  couvrent l'élémentaire, pour que le choix soit visible à l'écran.
update ecoles set pedagogie_elementaire = 'montessori'
 where demonstration = true
   and pedagogie_elementaire is null
   and paliers @> array['elementaire']::text[];

--  ⚠️ SANS DATES, LES ABSENCES NE SE COMPTENT PAS SUR LES BULLETINS
--  (mig. 162/163) : les compteurs valent NULL et l'écran affiche
--  « absences non comptabilisées ». La démo RDC avait ses trois trimestres
--  non datés — on les date, sinon la fonction paraît cassée alors qu'elle
--  dit simplement la vérité.
update periodes p
   set date_debut = d.deb, date_fin = d.fin
  from (values
    (1, '2025-10-01'::date, '2025-12-20'::date),
    (2, '2026-01-05'::date, '2026-03-28'::date),
    (3, '2026-04-06'::date, '2026-06-30'::date)
  ) as d(ordre, deb, fin)
 where p.ordre = d.ordre
   and p.date_debut is null
   and exists (select 1 from ecoles e where e.id = p.ecole_id and e.demonstration = true);

-- =====================================================================
--  2. Le référentiel des acquis, et de vraies observations (mig. 172)
-- =====================================================================
do $$
declare ec record; v_cycle uuid; v_n int;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    v_cycle := null;
    select c.id into v_cycle from cycles c
     where c.ecole_id = ec.id and c.type = 'prescolaire' limit 1;
    if v_cycle is null then
      raise notice '% : aucun cycle préscolaire, suivi des acquis ignoré.', ec.nom;
      continue;
    end if;
    if exists (select 1 from acquis_items ai where ai.cycle_id = v_cycle) then
      raise notice '% : référentiel des acquis déjà présent, laissé intact.', ec.nom;
      continue;
    end if;

    insert into acquis_items (ecole_id, cycle_id, domaine, libelle, ordre) values
      (ec.id, v_cycle, 'Langage et communication', 'Nommer les objets usuels', 1),
      (ec.id, v_cycle, 'Langage et communication', 'Écouter et comprendre une consigne simple', 2),
      (ec.id, v_cycle, 'Langage et communication', 'S''exprimer en phrases compréhensibles', 3),
      (ec.id, v_cycle, 'Langage et communication', 'Redire une comptine apprise', 4),
      (ec.id, v_cycle, 'Activités numériques', 'Compter jusqu''à 10', 1),
      (ec.id, v_cycle, 'Activités numériques', 'Reconnaître les chiffres de 1 à 10', 2),
      (ec.id, v_cycle, 'Activités numériques', 'Trier selon la couleur, la forme, la taille', 3),
      (ec.id, v_cycle, 'Découverte du monde', 'Reconnaître les parties du corps', 1),
      (ec.id, v_cycle, 'Découverte du monde', 'Distinguer les moments de la journée', 2),
      (ec.id, v_cycle, 'Découverte du monde', 'Nommer les animaux familiers', 3),
      (ec.id, v_cycle, 'Vivre ensemble', 'Respecter les règles de la classe', 1),
      (ec.id, v_cycle, 'Vivre ensemble', 'Partager et attendre son tour', 2),
      (ec.id, v_cycle, 'Vivre ensemble', 'Dire bonjour, merci, pardon', 3),
      (ec.id, v_cycle, 'Vivre ensemble', 'Aller aux toilettes seul(e)', 4),
      (ec.id, v_cycle, 'Activités physiques', 'Courir, sauter, grimper sans danger', 1),
      (ec.id, v_cycle, 'Activités physiques', 'Tenir correctement un crayon', 2),
      (ec.id, v_cycle, 'Activités physiques', 'Découper, coller, enfiler', 3),
      (ec.id, v_cycle, 'Activités artistiques', 'Chanter avec le groupe', 1),
      (ec.id, v_cycle, 'Activités artistiques', 'Dessiner, peindre librement', 2);
    get diagnostics v_n = row_count;
    raise notice '% : % items d''observation chargés.', ec.nom, v_n;
  end loop;
end $$;

--  Des observations RÉELLEMENT variées : sans elles, l'écran est une
--  grille vide et l'on ne voit ni les trois valeurs, ni l'avancement, ni
--  ce que la famille lit.
--
--  ⚠️ ON N'OBSERVE PAS TOUT. On en laisse volontairement une partie non
--  renseignée : c'est l'état NORMAL d'un suivi en cours, et c'est
--  justement ce que l'écran doit savoir montrer (« 7 / 19 observés »).
do $$
declare ec record; v_cycle uuid; v_periode uuid; v_eleve record; it record; i int; v_val text;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    v_cycle := null; v_periode := null;
    select c.id into v_cycle from cycles c where c.ecole_id = ec.id and c.type = 'prescolaire' limit 1;
    select p.id into v_periode from periodes p
      join annees_scolaires a on a.id = p.annee_id
     where a.ecole_id = ec.id and a.courante = true order by p.ordre limit 1;
    if v_cycle is null or v_periode is null then continue; end if;
    if exists (select 1 from acquis_observations o
                join acquis_items ai on ai.id = o.item_id
               where ai.cycle_id = v_cycle) then
      raise notice '% : observations déjà présentes, laissées intactes.', ec.nom;
      continue;
    end if;

    --  Les enfants d'une classe du préscolaire.
    for v_eleve in
      select e.id, row_number() over (order by e.nom, e.prenom) as rang
        from inscriptions ins
        join eleves e on e.id = ins.eleve_id
        join classes cl on cl.id = ins.classe_id
        join niveaux n on n.id = cl.niveau_id
       where ins.ecole_id = ec.id and n.cycle_id = v_cycle
       limit 8
    loop
      i := 0;
      for it in select id from acquis_items where cycle_id = v_cycle order by domaine, ordre loop
        i := i + 1;
        --  Un enfant n'est pas « bon » ou « mauvais » partout : on fait
        --  varier, et on s'arrête avant la fin du référentiel.
        if i > 7 + (v_eleve.rang % 5) then exit; end if;
        v_val := case ((i + v_eleve.rang) % 5)
                   when 0 then 'non_acquis'
                   when 1 then 'en_cours'
                   when 2 then 'acquis'
                   when 3 then 'acquis'
                   else 'en_cours'
                 end;
        insert into acquis_observations (ecole_id, eleve_id, item_id, periode_id, valeur, observation)
        values (ec.id, v_eleve.id, it.id, v_periode, v_val,
                case when (i + v_eleve.rang) % 7 = 0
                     then 'Progresse bien depuis la rentrée.' else null end)
        on conflict (eleve_id, item_id, periode_id) do nothing;
      end loop;
    end loop;
    raise notice '% : observations posées sur 8 enfants du préscolaire.', ec.nom;
  end loop;
end $$;

-- =====================================================================
--  3. La programmation officielle de l'IEF (mig. 165)
-- =====================================================================
--  Ces 50 contenus sont ceux du VRAI document fourni par l'école —
--  planification mensuelle de l'IEF de Sangalkam, CM1, avril — lus par
--  l'analyseur du point 15 puis transcrits ici.
--
--  ⚠️ C'est volontaire : un jeu de démonstration inventé n'aurait pas les
--  irrégularités du document réel (cellules fusionnées, paliers de
--  183 caractères, quatre domaines dans un seul tableau). On teste donc
--  l'écran sur ce qui existe vraiment, pas sur un cas idéalisé.
--
--  Ne s'applique qu'aux démos possédant un niveau CM1.
do $$
declare v_ecole uuid; v_cm1 uuid; v_annee uuid; v_prog uuid; ec record;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    v_ecole := ec.id;
    --  🔴 REMISE A NULL OBLIGATOIRE. « select into » laisse la variable
    --  INCHANGEE quand la requete ne rend aucune ligne : sans cette ligne,
    --  le CM1 de l ecole precedente survivrait, et l on ecrirait une
    --  programmation sur le niveau d une AUTRE ecole.
    v_cm1 := null; v_annee := null;
    select n.id into v_cm1 from niveaux n where n.ecole_id = v_ecole and n.libelle = 'CM1' limit 1;
    select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante = true limit 1;
    if v_cm1 is null or v_annee is null then
      raise notice '% : pas de niveau CM1 (ou pas d''annee courante), programmation ignoree.', ec.nom;
      continue;
    end if;
    if exists (select 1 from programmations pg
                where pg.niveau_id = v_cm1 and pg.annee_id = v_annee and pg.mois = 4) then
      raise notice '% : programmation d''avril deja presente, laissee intacte.', ec.nom;
      continue;
    end if;

  --  Domaine « Langue et communication » : 33 contenus
  insert into programmations (ecole_id, niveau_id, annee_id, mois, domaine, source)
  values (v_ecole, v_cm1, v_annee, 4, 'Langue et communication', 'Planification IEF (jeu de démonstration)')
  returning id into v_prog;
  insert into programmation_lignes (ecole_id, programmation_id, sous_domaine, theme, rubrique, activite, palier, semaine, contenu, ordre) values
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 1, 'OA Faire agir', 1),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 2, 'OA Faire agir', 2),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 3, 'OA Faire agir', 3),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 4, 'Intégration', 4),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 1, 'OS Donner des conseils pratiques pour balayer la classe', 5),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 2, 'OS Donner des conseils pratiques pour nettoyer les toilettes', 6),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 3, 'OS Donner des conseils pratiques avoir une école boisée', 7),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Expression orale', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 4, 'Amener les élèves à énumérer différentes actions action en vue de réussir une tâche.', 8),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Récitation', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 1, 'Apprendre une récitation sur l’environnement', 9),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Récitation', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 2, 'Apprendre une récitation sur l’environnement', 10),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Récitation', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 3, 'Apprendre une récitation sur l’environnement', 11),
    (v_ecole, v_prog, 'COMMUNICATION ORALE', null, null, 'Récitation', 'Palier 3 : intégrer le vocabulaire adéquat, les comportements non verbaux, le schéma intonatif et des règles syntaxiques dans des situations de transmission d’informations de type injonctif', 4, 'Restituer la récitation sur l’environnement', 12),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Manifester sa compréhension d’un texte injonctif', null, 1, '- Cerner l’information importante dans chaque instruction / consigne d’un texte injonctif-Identifier l’ordre logique et la succession des actions à réaliser ou à respecter', 13),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Manifester sa compréhension d’un texte injonctif', null, 2, '- Identifier la complémentarité des informations fournies entre le texte et les supports iconiques (schémas, croquis, photos, illustrations, etc.) - Reformuler avec ses propres mots la procédure attendue et/ou les actions à accomplir', 14),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Manifester sa compréhension d’un texte injonctif', null, 3, '- Répondre à des questions en sélectionnant des informations dans un texte injonctif- Traiter efficacement les éléments d’information et les instructions d’un texte injonctif pour accomplir une tâche', 15),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Maîtriser des correspondances graphophonologiques', null, 1, 'Renforcer la combinatoire à partir des difficultés constatées chez des élèves lors des leçons.', 16),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Maîtriser des correspondances graphophonologiques', null, 2, 'Renforcer la combinatoire à partir des difficultés constatées chez des élèves lors des leçons.', 17),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'LECTURE', 'Maîtriser des correspondances graphophonologiques', null, 3, 'Renforcer la combinatoire à partir des difficultés constatées chez des élèves lors des leçons.', 18),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Vocabulaire', null, 2, '- Acquérir le sens de mots liés au thème du texte à produire et les employer dans des phrases qui en illustrent le sens.- Acquérir la notion de préfixes et identifier le sens de quelques-uns : « in/im »- Employer des prépositions courantes - Se familiariser à l’utilisation du dictionnaire : rechercher un mot en se référant à l’ordre alphabétique', 19),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Vocabulaire', null, 3, '- Acquérir le sens de mots liés au thème du texte à produire et les employer dans des phrases qui en illustrent le sens.- Acquérir la notion de préfixes et identifier le sens de quelques-uns « re »- Employer des prépositions courantes - Se familiariser à l’utilisation du dictionnaire : rechercher un mot en se référant à l’ordre alphabétique', 20),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Grammaire', null, 2, '- Employer une phrase infinitive- Modifier le sens d’un verbe en ajoutant un autre mot (approche de l’adverbe)', 21),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Grammaire', null, 3, '- Appliquer la règle de l’accord du verbe avec son sujet - Appliquer la règle de l’accord du verbe avec son sujet', 22),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Conjugaison', null, 2, '- Employer l’impératif présent de verbes du premier groupe-Employer l’impératif présent de verbes du premier groupe', 23),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Conjugaison', null, 3, '- Employer des déterminants démonstratifs- Transformer un texte en changeant le temps des verbes', 24),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Orthographe', null, 2, '- Orthographier sans erreur des mots fréquents - Ecrire sous la dictée', 25),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Orthographe', null, 3, '- Orthographier sans erreur des mots fréquents - Ecrire sous la dictée', 26),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Copier des textes', null, 1, 'Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)', 27),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Copier des textes', null, 2, 'Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)', 28),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUCTION DE TEXTES', 'Copier des textes', null, 3, 'Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)Copier le texte 1 dans les cahiers de production d’écrits (sans rature, sans mélange de cursives et de scripts et sans sortir des « chemins »)', 29),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUIRE DES TEXTES INJONCTIFS AVEC LE MODE IMPERATIF', 'OS1 : Identifier les caractéristiques d’un texte injonctif', null, 4, '(Lundi), Cet OS doit être évalué dans les cahiers de devoir après la leçon', 30),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUIRE DES TEXTES INJONCTIFS AVEC LE MODE IMPERATIF', 'OS2 : Constituer un référentiel', null, 4, '(Mardi), Cet OS doit être évalué dans les cahiers de devoir après la leçon', 31),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUIRE DES TEXTES INJONCTIFS AVEC LE MODE IMPERATIF', 'OS3 : Etablir une fiche de critère de réussite', null, 4, '(Mardi), Cet OS doit être évalué dans les cahiers de devoir après la leçon', 32),
    (v_ecole, v_prog, 'COMMUNICATION ECRITE', 'LECTURE DE TEXTES INJONCTIFS', 'PRODUIRE DES TEXTES INJONCTIFS AVEC LE MODE IMPERATIF', 'OS4 : S’exercer à rédiger des textes …', null, 4, 'Mercredi, jeudi et vendrediApprentissage de l’intégration', 33);

  --  Domaine « MATHEMATIQUES » : 6 contenus
  insert into programmations (ecole_id, niveau_id, annee_id, mois, domaine, source)
  values (v_ecole, v_cm1, v_annee, 4, 'MATHEMATIQUES', 'Planification IEF (jeu de démonstration)')
  returning id into v_prog;
  insert into programmation_lignes (ecole_id, programmation_id, sous_domaine, theme, rubrique, activite, palier, semaine, contenu, ordre) values
    (v_ecole, v_prog, null, null, null, 'Activités numériques', null, 1, 'Découvrir les caractères de divisibilité par 5Découvrir les caractères de divisibilité par 10', 34),
    (v_ecole, v_prog, null, null, null, 'Calcul mental', null, null, 'A. Numériques', 35),
    (v_ecole, v_prog, null, null, null, 'Calcul mental', null, 1, 'A géométriques', 36),
    (v_ecole, v_prog, null, null, null, 'Calcul mental', null, 1, 'A.de mesure', 37),
    (v_ecole, v_prog, null, null, null, 'Calcul mental', null, 1, 'A. de résolution de problème', 38),
    (v_ecole, v_prog, null, null, null, 'Activités de mesure', 'Palier 3 : Intégrer les notions de longueur et de monnaie ainsi que des techniques d’utilisation d’instruments conventionnels dans des situations de résolution de problèmes de calcul de périmètre et de prix.', 1, 'Intégration palier 3', 39);

  --  Domaine « ESVS » : 1 contenus
  insert into programmations (ecole_id, niveau_id, annee_id, mois, domaine, source)
  values (v_ecole, v_cm1, v_annee, 4, 'ESVS', 'Planification IEF (jeu de démonstration)')
  returning id into v_prog;
  insert into programmation_lignes (ecole_id, programmation_id, sous_domaine, theme, rubrique, activite, palier, semaine, contenu, ordre) values
    (v_ecole, v_prog, 'DECOUVERTE DU MONDE', null, null, 'Géographie', null, null, 'Programme épuisé', 40);

  --  Domaine « EPSA » : 10 contenus
  insert into programmations (ecole_id, niveau_id, annee_id, mois, domaine, source)
  values (v_ecole, v_cm1, v_annee, 4, 'EPSA', 'Planification IEF (jeu de démonstration)')
  returning id into v_prog;
  insert into programmation_lignes (ecole_id, programmation_id, sous_domaine, theme, rubrique, activite, palier, semaine, contenu, ordre) values
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 1, 'Dramatiser une scène burlesque', 41),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 2, 'Dramatiser une scène burlesque', 42),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 3, 'Dramatiser une scène burlesque', 43),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 4, 'INTEGRATION PALIER 2', 44),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 1, 'Jouer le rôle d’un vantard', 45),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 2, 'Jouer le rôle d’un vantard', 46),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 3, 'Jouer le rôle d’un charlatan démasqué', 47),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 1, 'situations à construire : se vanter de n’avoir peur de rien quand tout à coup surgit un chien (le vantard qui s’enfuit) ; se vanter d’être le (la) premier(ère) à la composition sans se rendre compte que le (la) meilleur(e) élève de la classe est à l’écoute ; etc.- traits à traduire : maintien corporel, manières de parler, de regarder, de se déplacer, la gestuelle, expression du visage, la vanité, la suffisance, la prétention, etc.', 48),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 2, 'situations à construire : se vanter de n’avoir peur de rien quand tout à coup surgit un chien (le vantard qui s’enfuit) ; se vanter d’être le (la) premier(ère) à la composition sans se rendre compte que le (la) meilleur(e) élève de la classe est à l’écoute ; etc.- traits à traduire : maintien corporel, manières de parler, de regarder, de se déplacer, la gestuelle, expression du visage, la vanité, la suffisance, la prétention, etc.', 49),
    (v_ecole, v_prog, 'Education artistique', null, null, 'Arts scéniques', 'PALIER 2 : intégrer les registres de la voix, des gestes, des attitudes, des mimes et des déguisements dans des situations de dramatisation de scènes de vie du milieu proche', 3, 'situations à construire : Situation 1 : le charlatan qui fait sa propre publicité (il vante ses pouvoirs, ses produits ; son héritage mystique ; qui énumère les personnes satisfaites de ses prestations...)Situations 2 et 3 (au choix) : - le charlatan rencontre dans la rue quelqu’un à qui il a promis, contre rétribution, des choses qui ne se sont pas réalisées - le charlatan vante ses pouvoirs avant d’être démasqué par une connaissance dans l’assistance ; etc.- sentiments à traduire : Situation 1 : l’assurance, l’audace, la véhémence, le ton péremptoire, la gestuelle autoritaire, les déplacements, le déguisementSituations 2 et 3 : la surprise, la peur, le désarroi, la crainte, la confusion, la honte, l’abattement, etc.', 50);

    raise notice '% : programmation d''avril chargee (4 domaines, 50 contenus).', ec.nom;
  end loop;
end $$;

-- =====================================================================
--  4. Responsables de cycle, et un PV réellement signé (mig. 166/167)
-- =====================================================================
--  ⚠️ POURQUOI ON ÉCRIT LES SIGNATURES EN DIRECT. La RPC `signer_conseil`
--  exige que `ecole_courante()` du signataire soit l'école du PV, et une
--  même personne ne peut pas poser les deux signatures. Dans une démo, une
--  seule personne a son `profils.ecole_id` sur l'école : on insère donc les
--  deux signatures ici, pour que l'écran montre un PV COMPLET. C'est le
--  seul moyen de voir l'état « signé » sans créer de faux comptes.
do $$
declare ec record; v_cycle record; v_profils uuid[]; v_classe uuid; v_periode uuid; v_pv uuid;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    --  Les comptes de l'école, pour servir de signataires.
    v_profils := null; v_classe := null; v_periode := null;
    select array_agg(pr.profil_id) into v_profils
      from profil_roles pr
     where pr.ecole_id = ec.id and pr.role in ('admin_ecole', 'direction', 'secretaire');
    if v_profils is null or array_length(v_profils, 1) < 1 then
      raise notice '% : aucun compte de direction, PV ignoré.', ec.nom;
      continue;
    end if;

    --  Un responsable par cycle : c'est ce qui permet la signature
    --  pédagogique du BON cycle (mig. 166).
    for v_cycle in select c.id, c.libelle from cycles c where c.ecole_id = ec.id loop
      insert into responsables_cycle (ecole_id, cycle_id, profil_id)
      select ec.id, v_cycle.id, v_profils[1]
       where not exists (select 1 from responsables_cycle r where r.cycle_id = v_cycle.id);
    end loop;

    --  Un PV complet sur une classe, pour voir l'état « signé ».
    select cl.id, p.id into v_classe, v_periode
      from classes cl
      join annees_scolaires a on a.id = cl.annee_id and a.courante = true
      join periodes p on p.annee_id = a.id and p.ordre = 1
     where cl.ecole_id = ec.id
       and exists (select 1 from inscriptions i where i.classe_id = cl.id)
     order by cl.libelle limit 1;
    if v_classe is null then continue; end if;

    if not exists (select 1 from conseils_classe cc
                    where cc.classe_id = v_classe and cc.periode_id = v_periode) then
      insert into conseils_classe (ecole_id, classe_id, periode_id, tenu_le, observations, cree_par)
      values (ec.id, v_classe, v_periode, current_date - 7,
              'Conseil de classe du 1er trimestre. Ensemble satisfaisant ; quelques absences à surveiller.',
              v_profils[1])
      returning id into v_pv;

      insert into conseil_signatures (ecole_id, conseil_id, profil_id, qualite)
      values (ec.id, v_pv, v_profils[1], 'pedagogique');
      --  La seconde signature vient d'une AUTRE personne si l'école en a
      --  une ; sinon le PV reste incomplet, et c'est honnête : l'écran
      --  montrera « 1 signature manquante ».
      if array_length(v_profils, 1) > 1 then
        insert into conseil_signatures (ecole_id, conseil_id, profil_id, qualite)
        values (ec.id, v_pv, v_profils[2], 'gestion');
        raise notice '% : PV signé par deux personnes.', ec.nom;
      else
        raise notice '% : PV signé une fois (un seul compte de direction) — l''écran montrera la signature manquante.', ec.nom;
      end if;
    end if;
  end loop;
end $$;

-- =====================================================================
--  5. Des bulletins dans les TROIS états du circuit (mig. 166)
-- =====================================================================
--  ⚠️ TROIS CLASSES, TROIS ÉTATS. Le circuit ne se voit pas sur un seul
--  bulletin : il faut une classe en relecture, une arrêtée, une diffusée.
--  Et une diffusée DÉJÀ CONSULTÉE, pour que le compteur « consulté par les
--  familles » ne soit pas à zéro.
do $$
declare ec record; cl record; v_periode uuid; v_etat text; v_i int := 0; v_eff int; v_prof uuid;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    v_periode := null; v_prof := null;
    select p.id into v_periode from periodes p
      join annees_scolaires a on a.id = p.annee_id and a.courante = true
     where a.ecole_id = ec.id order by p.ordre limit 1;
    select pr.profil_id into v_prof from profil_roles pr
     where pr.ecole_id = ec.id and pr.role in ('admin_ecole','direction') limit 1;
    if v_periode is null or v_prof is null then continue; end if;

    --  🔴 MON PROPRE GARDE-FOU A ARRÊTÉ CE SCRIPT, et il avait raison.
    --  Le déclencheur de la migration 166 refuse qu'un bulletin NAISSE en
    --  « validé » ou « publié » : seule la direction fait avancer le
    --  circuit. Or dans l'éditeur SQL `auth.uid()` est NULL, donc aucun
    --  rôle n'est reconnu, et l'insertion était refusée —
    --  « Un bulletin se crée en brouillon ; seule la direction le publie. »
    --
    --  ⚠️ ON NE DÉSACTIVE PAS LE DÉCLENCHEUR. On ENDOSSE le promoteur de
    --  l'école le temps de la transaction : `auth.uid()` renvoie alors son
    --  identifiant, le contrôle s'exerce pour de vrai, et l'horodatage des
    --  actes porte un acteur réel au lieu de NULL. Désactiver la garde
    --  aurait produit des données que l'application n'aurait jamais pu
    --  créer elle-même — un jeu de démonstration menteur.
    --  Le troisième argument `true` limite le réglage à la transaction.
    perform set_config('request.jwt.claims', json_build_object('sub', v_prof)::text, true);

    v_i := 0;
    for cl in
      select c.id, c.libelle, count(i.id) as n
        from classes c
        join annees_scolaires a on a.id = c.annee_id and a.courante = true
        left join inscriptions i on i.classe_id = c.id
       where c.ecole_id = ec.id
       group by c.id, c.libelle
      having count(i.id) >= 2
       order by c.libelle
       limit 3
    loop
      v_i := v_i + 1;
      v_etat := case v_i when 1 then 'brouillon' when 2 then 'valide' else 'publie' end;
      v_eff := cl.n;

      --  On ne touche pas une classe qui a déjà des bulletins : l'école a
      --  peut-être commencé son travail.
      if exists (select 1 from bulletins b where b.classe_id = cl.id and b.periode_id = v_periode) then
        raise notice '% / % : bulletins déjà présents, laissés intacts.', ec.nom, cl.libelle;
        continue;
      end if;

      --  ⚠️ NAÎTRE EN BROUILLON, PUIS AVANCER. On n'écrit pas l'état final
      --  d'emblée : on suit le circuit, comme le ferait la direction depuis
      --  l'écran. Le jeu de démonstration reproduit ainsi un chemin
      --  réellement possible dans l'application.
      insert into bulletins (ecole_id, eleve_id, classe_id, periode_id, moyenne_generale,
                             rang, effectif, mention, appreciation_generale, genere_le, statut)
      select ec.id, i.eleve_id, cl.id, v_periode,
             --  Des moyennes plausibles et VARIÉES : une classe entière à
             --  12,00 ne permet pas de voir le classement ni les mentions.
             round((8 + (row_number() over (order by e.nom))::numeric * 1.3)::numeric, 2),
             row_number() over (order by e.nom desc),
             v_eff,
             case when (8 + row_number() over (order by e.nom) * 1.3) >= 16 then 'Très bien'
                  when (8 + row_number() over (order by e.nom) * 1.3) >= 14 then 'Bien'
                  when (8 + row_number() over (order by e.nom) * 1.3) >= 12 then 'Assez bien'
                  when (8 + row_number() over (order by e.nom) * 1.3) >= 10 then 'Passable'
                  else 'Insuffisant' end,
             'Trimestre encourageant. Poursuivre les efforts.',
             now(), 'brouillon'
        from inscriptions i
        join eleves e on e.id = i.eleve_id
       where i.classe_id = cl.id;

      if v_etat <> 'brouillon' then
        update bulletins set statut = 'valide', valide_le = now(), valide_par = v_prof
         where classe_id = cl.id and periode_id = v_periode;
      end if;
      if v_etat = 'publie' then
        update bulletins set statut = 'publie', publie_le = now(), publie_par = v_prof
         where classe_id = cl.id and periode_id = v_periode;
        --  Un bulletin publié sur deux a été lu par la famille : sans cela,
        --  le compteur « consulté » reste à zéro et l'on ne voit pas la
        --  fonction.
        update bulletins b set consulte_le = now()
         where b.classe_id = cl.id and b.periode_id = v_periode
           and (select count(*) from bulletins x
                 where x.classe_id = cl.id and x.periode_id = v_periode
                   and x.eleve_id <= b.eleve_id) % 2 = 1;
      end if;
      raise notice '% / % : bulletins en « % ».', ec.nom, cl.libelle, v_etat;
    end loop;
  end loop;
end $$;

-- =====================================================================
--  6. Le quotidien : cahier de textes, progression, fournitures, incidents
-- =====================================================================
--  Ces écrans étaient vides sur la démo sénégalaise, et un écran vide ne
--  permet pas de juger une fonctionnalité.
do $$
declare ec record; cl record; v_mat uuid; v_ens uuid; v_periode uuid; v_ligne uuid; j int;
begin
  for ec in select id, nom from ecoles where demonstration = true loop
    v_periode := null;
    select p.id into v_periode from periodes p
      join annees_scolaires a on a.id = p.annee_id and a.courante = true
     where a.ecole_id = ec.id order by p.ordre limit 1;

    for cl in
      select c.id, c.libelle from classes c
        join annees_scolaires a on a.id = c.annee_id and a.courante = true
       where c.ecole_id = ec.id order by c.libelle limit 4
    loop
      v_mat := null; v_ens := null;
      select m.id into v_mat from matieres m where m.ecole_id = ec.id order by m.libelle limit 1;
      select en.id into v_ens from enseignants en where en.ecole_id = ec.id limit 1;

      -- Cahier de textes : six séances, dont certaines RELIÉES à la
      -- programmation officielle — c'est tout l'objet du point 15, et on
      -- ne le verra pas si aucune séance n'est reliée.
      if not exists (select 1 from cahier_textes ct where ct.classe_id = cl.id) then
        for j in 1..6 loop
          --  Idem : sans remise a null, une seance serait reliee a la
          --  ligne de programmation de l iteration precedente.
          v_ligne := null;
          select pl.id into v_ligne
            from programmation_lignes pl
            join programmations pg on pg.id = pl.programmation_id
           where pg.ecole_id = ec.id and pl.semaine is not null
           order by pl.ordre offset (j - 1) limit 1;
          insert into cahier_textes (ecole_id, classe_id, matiere_id, enseignant_id,
                                     date_seance, contenu, devoirs, date_pour, programmation_ligne_id)
          values (ec.id, cl.id, v_mat, v_ens, current_date - (j * 3),
                  coalesce((select pl2.contenu from programmation_lignes pl2 where pl2.id = v_ligne),
                           'Séance : révision et exercices d''application.'),
                  case when j % 2 = 0 then 'Exercices 1 à 4 page 32.' else null end,
                  case when j % 2 = 0 then current_date - (j * 3) + 2 else null end,
                  v_ligne);
        end loop;
      end if;

      -- Progression : trois étapes, dans les trois états.
      if not exists (select 1 from progressions pg where pg.classe_id = cl.id) then
        insert into progressions (ecole_id, classe_id, matiere_id, enseignant_id, periode_id,
                                  titre, description, date_prevue, statut) values
          (ec.id, cl.id, v_mat, v_ens, v_periode, 'Chapitre 1 — Les bases',
           'Notions introductives et vocabulaire.', current_date - 30, 'fait'),
          (ec.id, cl.id, v_mat, v_ens, v_periode, 'Chapitre 2 — Approfondissement',
           'Exercices guidés puis autonomes.', current_date - 5, 'en_cours'),
          (ec.id, cl.id, v_mat, v_ens, v_periode, 'Chapitre 3 — Intégration',
           'Situation d''intégration et évaluation.', current_date + 20, 'a_faire');
      end if;
    end loop;

    -- Fournitures : par niveau, avec des cas qui comptent — un article
    -- optionnel, et un « fourni par l'école » (affiché en rouge chez le
    -- parent, pour qu'il n'achète pas deux fois).
    if not exists (select 1 from fournitures f where f.ecole_id = ec.id) then
      insert into fournitures (ecole_id, niveau_id, libelle, quantite, obligatoire, note, fourni_ecole, categorie)
      select ec.id, n.id, x.libelle, x.q, x.oblig, x.note, x.fourni, x.cat
        from niveaux n
        cross join (values
          ('Cahier 96 pages grands carreaux', 4, true,  null, false, 'Cahiers'),
          ('Ardoise + chiffon',               1, true,  null, false, 'Divers'),
          ('Boîte de crayons de couleur',     1, true,  null, false, 'Stylos & crayons'),
          ('Blouse de l''école',              2, true,  'Disponible au secrétariat', true, 'Divers'),
          ('Dictionnaire illustré',           1, false, 'Conseillé à partir du CE1', false, 'Livres & manuels')
        ) as x(libelle, q, oblig, note, fourni, cat)
       where n.ecole_id = ec.id;
    end if;

    -- Vie scolaire : des incidents de tous registres, félicitation comprise
    -- — la fonction ne sert pas qu'à sanctionner.
    if not exists (select 1 from incidents inc where inc.ecole_id = ec.id) then
      insert into incidents (ecole_id, eleve_id, type, gravite, description, date_incident)
      select ec.id, e.id, x.t, x.g, x.d, current_date - x.j
        from (select i.eleve_id from inscriptions i where i.ecole_id = ec.id limit 3) s
        join eleves e on e.id = s.eleve_id
        cross join (values
          ('félicitation', 1, 'Progrès remarquables en lecture ce trimestre.', 10),
          ('observation',  2, 'Bavardages répétés pendant la séance de calcul.', 20),
          ('sanction',     3, 'Retard répété non justifié : avertissement notifié à la famille.', 30)
        ) as x(t, g, d, j);
    end if;
  end loop;
end $$;

-- =====================================================================
--  CONTRÔLE — à passer après exécution
-- =====================================================================
--  select nom, pedagogie_elementaire, paliers from ecoles where demonstration;
--  select e.nom, count(*) from acquis_items ai join ecoles e on e.id = ai.ecole_id group by 1;
--  select e.nom, count(*) from acquis_observations o join ecoles e on e.id = o.ecole_id group by 1;
--  select e.nom, p.domaine, count(*) from programmation_lignes l
--    join programmations p on p.id = l.programmation_id join ecoles e on e.id = p.ecole_id group by 1,2;
--  select e.nom, b.statut, count(*) from bulletins b join ecoles e on e.id = b.ecole_id group by 1,2;
--  select e.nom, count(*) from conseil_signatures s join ecoles e on e.id = s.ecole_id group by 1;
--  select e.nom, count(*) from cahier_textes c join ecoles e on e.id = c.ecole_id
--    where c.programmation_ligne_id is not null group by 1;
--
--  🔴 ET SURTOUT, la vérification qui compte :
--  select nom, demonstration from ecoles order by demonstration desc, nom;
--  → aucune école à `demonstration = false` ne doit avoir changé.
-- =====================================================================
