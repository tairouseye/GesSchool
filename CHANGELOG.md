# Journal des modifications — GesSchool

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version la plus récente en haut.
La version applicative est celle de `package.json` (affichée dans l'app). Migrations dans [`supabase/migrations/`](supabase/migrations).

> Historique antérieur à `2.109.0` : voir l'historique git. Ce journal démarre au chantier **Comptabilité / RH & Paie**.

## [2.187.2] — aucune migration
- **Communication devient une section repliable dans Gestion** aussi. Annonces et Messagerie y figuraient depuis toujours, mais en entrées libres au milieu de la liste ; elles sont désormais présentées des deux côtés de la même façon. Elles restent dans **les deux** espaces à dessein : la direction en a le droit sans accéder à Gestion, et une annonce peut être administrative (échéance de frais) comme pédagogique (report d'examen).

## [2.187.1] — aucune migration
- **Les entrées d'une section repliable sont décalées** vers la droite et soulignées d'un filet vertical. Elles s'alignaient exactement sur les entrées de premier niveau : rien ne distinguait un sous-menu d'un menu, il fallait relire les intitulés pour comprendre la hiérarchie.

## [2.187.0] — aucune migration
- **La bibliothèque quitte son espace dédié et se range sous Pédagogie ET Gestion**, en section repliable comme Évaluation ou Communication. Le découpage suit la nature des données, pas la commodité :
  - **Pédagogie** — *Catalogue*, *Prêts & retours*, *Mémoires & thèses* : ce qui se consulte, se prête et se publie.
  - **Gestion** — *Catalogue* (le secrétariat doit pouvoir chercher), *Acquisitions*, *Inventaire* : les acquisitions portent **prix d'achat et fournisseurs** — c'est d'ailleurs pourquoi leur RLS était déjà réservée à la gestion — et l'inventaire compte des biens.
- **⚠️ Deux pièges traités.** Le rôle `bibliothecaire` aurait de nouveau perdu toute navigation en dissolvant son espace : il est rattaché aux deux espaces. Et le **comptable** ne voyait pas *Acquisitions* ni *Inventaire* (`ACCES` ne listait que direction et bibliothécaire) — placer ces entrées dans son espace sans lui en ouvrir le droit aurait produit des entrées invisibles. Les deux lui sont ouvertes.
- Effet de bord positif : sans le module Bibliothèque, un bibliothécaire n'est plus en cul-de-sac. Il retombe sur les transverses au lieu de l'écran « sans accès ».

## [2.186.1] — aucune migration
- **Retour en arrière : la grille de tuiles redevient propre au mobile.** Exposée sur ordinateur en 2.181.0, elle recouvrait toute la zone de contenu au chargement — ce n'est pas ce qu'on attend d'un menu sur grand écran, où la barre latérale suffit et laisse la page visible. Le bouton **▦** ajouté à la barre latérale n'a plus d'objet et disparaît. Les sections repliables (2.186.0), elles, restent : c'est là qu'était le vrai besoin.

## [2.186.0] — aucune migration
- **Pédagogie se replie en sections.** Ses 25 entrées — six fois plus que RH & Paie — formaient une liste illisible. Elles sont désormais rangées en cinq sections repliables : **Au quotidien**, **Élèves & structure**, **Évaluation**, **Vie scolaire**, **Communication**. L'accueil et les transverses (Membres, À signer, Paramètres) restent hors section.
  - Le regroupement s'applique **aussi à la grille de tuiles**, pour que la barre latérale et les tuiles racontent la même chose.
  - Une section **s'ouvre d'office quand la page courante s'y trouve** : on ne cache jamais à l'utilisateur où il est. Sinon son état est mémorisé, le menu se retrouve comme on l'a laissé.
  - Repliée, une section affiche en pastille le total des compteurs qu'elle contient — un document à signer ne disparaît pas parce qu'on a fermé sa section.
  - Les entrées ont dû être **réordonnées** : l'ordre de déclaration fragmentait « Évaluation » et « Élèves & structure » en deux morceaux chacun, ce qui aurait affiché le même en-tête deux fois. Un test vérifie désormais la contiguïté des groupes, pour les deux types d'établissement.

## [2.185.0] — aucune migration · **revue de la structure des menus**
Revue des cinq espaces et de leurs sous-menus, croisée avec les droits (`ACCES`). Trois incohérences corrigées.

- **⚠️ La direction avait le droit de publier des annonces et d'écrire aux familles, sans aucune porte d'entrée.** `annonces` et `messagerie` lui sont ouverts par `ACCES`, mais ces deux pages ne vivaient que dans l'espace **Gestion** — réservé aux rôles `comptable` et `secretaire`, auxquels la direction n'appartient pas (elle n'est pas un rôle complet). Un droit sans menu est un droit inexistant : les deux entrées rejoignent **Pédagogie**.
- **⚠️ « Emploi du temps » menait à une page inutilisable au supérieur.** `emplois_du_temps.classe_id` est `NOT NULL` et l'université n'a pas de classes : aucun emploi du temps LMD n'existe. L'entrée est désormais gatée `types:["ecole"]` — à rouvrir le jour où le modèle LMD sera fait.
- **⚠️ Les demandes de documents déposées par un étudiant s'affichaient sans demandeur.** L'écran du personnel n'affichait que le tuteur ; une demande étudiante (sans tuteur) donnait « Demandé par · <date> ». Corrigé en « Demandé par l'étudiant lui-même ». Les demandes remontaient bien, seul l'affichage était muet.

## [2.184.0] — migration 132
- **L'étudiant édite lui-même son relevé de notes officiel** : en-tête de l'établissement (logo, adresse, ville), identité, tableau des UE avec crédits et résultat, moyenne, décision, mention, emplacement de signature, et **QR d'authentification**.
  - Le composant existait déjà, mais **enfermé dans `Deliberations.jsx`**, donc hors de portée de l'étudiant. Il est **extrait dans `composants/ReleveImprimable.jsx`** et partagé : le relevé imprimé par l'étudiant est rigoureusement identique à celui du secrétariat. Écrire un second format aurait garanti la divergence.
  - `mon_dossier_etudiant()` renvoie désormais l'adresse, la ville et le pays (migration 132) : sans eux, l'en-tête et la mention « Fait à … » restaient vides côté étudiant, `useAuth().ecole` étant NULL pour lui.
- **⚠️ Correctif — la carte d'étudiant s'imprimait en page blanche.** La feuille de style masque tout sauf `.zone-impression` à l'impression ; la carte, livrée en 2.183.0, n'y était pas. Le bouton 🖨 ne sortait rien.

## [2.183.1] — aucune migration
- **Annonces : cible « Étudiants » ajoutée.** Il n'en existait aucune — une université ne pouvait atteindre ses étudiants qu'en visant « Toute l'école ». La RPC `mes_annonces()` l'acceptait déjà ; seule l'option manquait au formulaire de publication.

## [2.183.0] — migration 131
- **Carte d'étudiant vérifiable par QR.** L'étudiant l'affiche sur son téléphone ou l'imprime ; le QR renvoie vers la page publique de vérification, comme les factures, bulletins et relevés. La branche `etu` **ne répond que si l'inscription est ACTIVE** : une carte périmée ou un étudiant radié se signalent d'eux-mêmes — c'est tout l'intérêt d'un contrôle à l'entrée d'un campus ou d'une bibliothèque. Elle n'expose que ce qui figure déjà sur une carte physique : nom, matricule, filière, établissement.
  - `verifier_document()` a dû être **reproduite en entier** (`create or replace` remplace tout le corps) ; les six branches existantes sont conservées à l'identique, ce qu'un contrôle automatique a vérifié avant livraison.
- **⚠️ Correctif — devise figée à XOF dans l'espace étudiant.** `useAuth().ecole` est NULL pour un étudiant, son `profils.ecole_id` l'étant aussi : la page scolarité affichait « XOF » en dur, faux pour un établissement en USD ou CDF (démo RDC). `mon_dossier_etudiant()` renvoie désormais l'établissement, sa devise, son logo, l'année académique et la photo.

## [2.182.0] — migration 130 · **l'espace étudiant devient un vrai portail**
Audit de l'espace étudiant : il ne comptait que 4 entrées. Constat de fond — un parent dispose de **26 RPC**, et **aucune n'est réutilisable** par un étudiant, toutes étant gardées par `_parent_possede()` ou une jointure sur `tuteurs`. La donnée existait donc déjà partout ; c'est le chemin d'accès qui manquait.

- **Ma scolarité** : factures, reste dû, et **déclaration de paiement mobile par l'étudiant lui-même**. Un étudiant est majeur et paie sa scolarité — le faire passer par un tuteur pour voir sa facture était une incohérence du modèle. Les coordonnées de paiement de l'établissement s'affichent dans le formulaire, et la déclaration reste soumise à la validation de la comptabilité.
- **Mes documents** : demande de certificat de scolarité, attestation d'inscription ou de fréquentation, duplicata de relevé, avec suivi du statut et réponse du secrétariat. C'est la principale raison des files d'attente au secrétariat d'une université. Plafonné à 5 demandes en cours, pour éviter le flood.
- **Actualités** : notifications personnelles et annonces de l'établissement. La table `notifications` et sa policy (`destinataire_id = auth.uid()`) fonctionnaient déjà pour un étudiant — **seule l'émission manquait**, `_notifier_parents` ne visant que les tuteurs. Trois déclencheurs ajoutés : nouvelle facture, relevé validé par le jury, décision sur un dépôt.
- L'accueil passe de 3 à 6 tuiles.

**Non traités, faute de modèle de données** — ce sont des chantiers, pas des ajouts : l'**emploi du temps** (`emplois_du_temps.classe_id` est NOT NULL ; il n'existe aucune notion d'emploi du temps LMD par filière/semestre) et la **messagerie** (`messages.tuteur_id` est NOT NULL, la messagerie est arrimée aux tuteurs, et la partie personnel devrait aussi évoluer).

## [2.181.1] — aucune migration
- **Espace étudiant : la barre de navigation disparaît.** Elle répétait mot pour mot les tuiles affichées juste en dessous. Le menu, ce sont désormais les tuiles. Comme elles ne sont visibles que sur l'accueil, un lien **« ← Accueil »** apparaît dès qu'on entre dans une section — sans lui on resterait enfermé dans la page ouverte.

## [2.181.0] — aucune migration
- **Tuiles partout, dans les trois espaces.** Suite du passage en tuiles, étendu au personnel et aux parents.
- **Personnel** : la grille de tuiles existait déjà, mais **uniquement sur mobile** (`lg:hidden`) — sur ordinateur, seul le menu latéral était disponible. Elle s'affiche désormais aussi sur grand écran, sur 3 à 4 colonnes, et se rappelle par un bouton **▦** ajouté dans l'en-tête de la barre latérale (il n'existait que dans la barre du haut, elle-même réservée au mobile). La barre latérale reste en place : la grille ne recouvre que la zone de contenu.
- **Parents** : Messages, Alertes et Mon compte remontent en tuiles sur l'accueil. Ils n'étaient que de petites icônes dans l'en-tête, pratiquement invisibles sur téléphone. Les enfants et les sections de chaque enfant étaient déjà en grille.

## [2.180.0] — aucune migration
- **Espace étudiant : menu en tuiles.** L'accueil présente désormais *Mes résultats*, *Bibliothèque* et *Mon dépôt* en grandes tuiles tactiles (navy sombre, icône dorée), reprenant exactement le traitement de l'espace parent pour que les deux se ressemblent. La barre de navigation reste en haut : elle sert une fois qu'on est entré dans une section, là où les tuiles ne sont plus visibles.
- Une **tuile d'alerte** apparaît quand des demandes d'accès parentales attendent une réponse, avec leur nombre en pastille. La décision se prenait plus bas dans la page : sans rappel en haut, personne n'y répondait.
- `Carte` transmet désormais les attributs restants (`id`, `aria-*`, `onClick`…) à son conteneur. Ils étaient silencieusement perdus — une ancre ou un libellé d'accessibilité posé sur une Carte n'avait aucun effet.

## [2.179.0] — migration 129
- **⚠️ Un étudiant ne pouvait pas voir ses propres notes.** `notes_lmd`, `deliberations` et `releves` se lisent avec `ecole_id = ecole_courante()` — or `profils.ecole_id` est NULL pour un étudiant, donc `ecole_courante()` aussi. Il n'existait **aucun chemin de lecture** vers ses résultats : l'espace étudiant se limitait à la bibliothèque, alors que c'est la première chose qu'on vient y chercher.
- **Espace étudiant — « Mes résultats »** : notes par semestre et par UE (détail CC / examen / note finale par ECUE, crédits acquis, moyenne et mention indicatives), et **relevés officiels** avec décision, mention et détail des UE.
  - Passage par deux **RPC** (`mes_notes_lmd`, `mes_releves`) plutôt que par de nouvelles policies : un relevé lisible exige aussi `ue`, `ecue`, `semestres` et `filieres`, toutes fermées de la même façon. Ouvrir cinq tables de plus aurait élargi la surface bien au-delà du besoin.
  - **Deux régimes de publication distincts**, assumés : les **notes** sont visibles dès la saisie — l'étudiant est le sujet de la donnée, et attendre la délibération rendrait l'espace inutile pendant tout le semestre ; les **relevés** ne le sont qu'une fois `valide`, un relevé non validé étant un document de travail du jury. Les moyennes affichées côté notes sont explicitement marquées **indicatives**.

## [2.178.0] — migrations 126 → 127 · **audit de sécurité du module Bibliothèque**
Audit complet des migrations 115→125. Ce qui suit corrige ce qu'il a trouvé.

**Vérifié et sain** : le cloisonnement des fichiers tient. `_biblio_peut_lire` impose `est_membre_ecole()` avant toute autre condition et les quatre policies Storage sont préfixées `bucket_id`. Un utilisateur de l'institution A ne peut pas lire un fichier de B, même en connaissant le chemin.

- **🔴 Un étudiant pouvait auto-valider son mémoire.** Dans une policy `UPDATE`, `using` juge la ligne *avant* modification et `with check` la ligne *après* ; j'y contrôlais l'identité sans contrôler l'état. Le déposant pouvait donc passer son dépôt à `valide` ou `publie` — et tout ce qui est `publie` est visible de l'établissement entier. Un travail non relu s'affichait comme validé par la bibliothèque. Même trou à la création : un dépôt pouvait naître `publie`. Le déposant n'écrit plus que `brouillon` et `soumis`.
- **🟠 La file d'attente des réservations ne fonctionnait pas.** Le rang était calculé côté client en lisant les réservations actives de la ressource — mais la RLS ne montre à l'usager **que les siennes**. Il lisait une file vide et repartait au rang 1 : tous les étudiants étaient premiers. On ne peut pas faire calculer une file par quelqu'un qui n'a pas le droit de la voir — le rang est désormais attribué **en base**, par trigger.
- **🟠 Suggestions d'achat : auto-acceptation.** Le demandeur pouvait passer sa suggestion à `acceptee` et rédiger la « réponse de la bibliothèque ».
- **🟡 Resquillage.** L'usager pouvait réécrire sa propre réservation, donc son rang. Il ne lui reste que l'annulation.
- **🟡 Ciblage par rôle indifférent à l'établissement.** `_biblio_peut_lire` acceptait n'importe quel `profil_roles` sans vérifier l'école : un enseignant de B, simple membre de A, ouvrait un document de A ciblé « enseignants ».
- **🟠 Import : les exemplaires pouvaient être attachés aux mauvaises notices.** Le rattachement supposait que `INSERT…RETURNING` rende les lignes dans l'ordre envoyé — vrai en pratique, jamais garanti. Sur un fichier de plusieurs milliers de lignes, un écart aurait corrompu l'import **sans le moindre signal**. L'alignement est maintenant vérifié, avec repli sur un appariement par (titre, ISBN).
- **🟡 Intégrité multi-établissement** (migration 127) : rien n'imposait qu'une ligne référence une ressource de sa propre école. Remplacé par des **clés étrangères composites** `(id, ecole_id)`, qui rendent l'incohérence impossible à écrire. Le fichier contient une requête de contrôle à passer avant la migration.
- **🟡 Fichiers orphelins** : supprimer une notice laissait ses documents dans le bucket ; un dépôt téléversait avant d'insérer sa ligne, sans reprise en cas d'échec. Les chemins sont relevés avant suppression, et un téléversement suivi d'une erreur est repris. Le fichier d'un dépôt **publié** est préservé : il est partagé avec la notice du catalogue.
- **⚪ Journal d'activité** : la table, sa RLS et la fonction `journaliser` existaient depuis la Phase 1 sans **aucun appelant**. Prêts, retours et publications y sont désormais tracés — une piste d'audit ne se rattrape pas après coup. Lecture dans l'interface encore à faire.

**Reste identifié, non corrigé** : pas de quota de téléversement pour les étudiants sous `depots/` ; les métadonnées d'un document `cible` restent visibles de tout membre (appliquer la règle sur la table créerait une récursion RLS — limite assumée, le fichier lui reste filtré).

## [2.177.0] — aucune migration
- **La bibliothèque devient un espace à part entière**, au même niveau que Pilotage, Gestion, Pédagogie et RH & Paie. Ses cinq pages (Catalogue, Prêts & retours, Mémoires & thèses, Acquisitions, Inventaire) quittent **Pédagogie**, qui en comptait 19 en mode Supérieur et redescend à 14. Le SIGB est un métier distinct, avec son propre responsable : il méritait sa porte d'entrée.
- **⚠️ Correctif — le rôle `bibliothecaire` ne pouvait naviguer nulle part.** Créé en migration 115 et doté de ses droits de page, il n'avait été rattaché à **aucun espace** : le menu restait vide et l'utilisateur tombait sur l'écran « sans accès ». Le défaut avait échappé au test de matrice, dont la prémisse est « *si* un rôle a un espace accessible, alors il a une page ouvrable » — une prémisse fausse ici, donc vraie par vacuité. Deux tests ciblés couvrent désormais ce rôle.
- **Point de vigilance traité** : `direction` n'est pas un rôle complet (seuls `super_admin` et `admin_ecole` le sont). Sortir la bibliothèque de Pédagogie lui en aurait fait perdre l'accès si elle n'avait pas été explicitement rattachée au nouvel espace ; un test le vérifie.
- L'espace **disparaît de lui-même pour une école** : toutes ses entrées étant réservées au Supérieur, le menu écarte les espaces sans item visible. Aucun changement de portée, aucune migration.

## [2.176.0] — migration 125
- **⚠️ Correctif — la recherche ignorait les auteurs.** Le champ du catalogue annonce « Titre, auteur, éditeur, mot-clé… », mais l'index plein texte (migration 117) n'indexait pas les auteurs : chercher « Senghor » ne renvoyait **rien**, alors que les auteurs étaient bien saisis. Les auteurs vivant dans une table de liaison, ils sont invisibles depuis un trigger posé sur la seule notice. Corrigé par **deux** triggers (migration 125) : l'un recalcule l'index de la notice en y incluant ses auteurs, l'autre « touche » la notice dès qu'un auteur est ajouté ou retiré — le cas le plus fréquent, puisqu'on lie les auteurs *après* avoir créé la notice. Les notices existantes sont réindexées par la migration.
- **⚠️ Correctif — aucun moyen d'attacher un auteur depuis l'interface.** La couche données possédait tout le nécessaire depuis la Phase 1, mais aucune page ne l'appelait : le catalogue affichait une colonne « Auteur(s) » qui restait vide à jamais. La fiche d'une notice a désormais une **section Auteurs** (rattacher, choisir le rôle — auteur, co-auteur, directeur, éditeur scientifique, traducteur —, retirer). La saisie **réutilise l'auteur déjà connu** de l'établissement (comparaison insensible à la casse et aux accents) au lieu de créer un homonyme à chaque fois, sans quoi la liste d'autorités devient inexploitable.
- **Import en masse de notices** (Excel / CSV) : les colonnes sont reconnues automatiquement (français et anglais) puis restent corrigeables, et **rien n'est écrit avant un récapitulatif** de ce qui sera créé et de ce qui sera écarté — un import de 5 000 lignes ne se rattrape pas à la main.
  - Normalisation tolérante : ISBN avec ou sans tirets, année extraite de « c2019 » ou d'une date, types synonymes (*ouvrage* → livre, *périodique* → revue), mots-clés séparés par virgule, point-virgule ou barre.
  - **Auteurs** créés et rattachés au passage, avec découpage « Nom, Prénom » et séparateurs multiples ; un nom trop ambigu est gardé entier plutôt que découpé au hasard.
  - Une colonne « nombre d'exemplaires » crée directement les exemplaires physiques (plafonnée à 500 par ligne).
  - **Dédoublonnage à deux niveaux** : les ISBN répétés dans le fichier (le premier est gardé) et, en option, ceux **déjà au catalogue** — sans quoi réimporter le même fichier duplique tout le fonds.
  - Écriture **par lots** avec barre de progression : un fichier entier n'est jamais envoyé en une requête.
  - Règles d'analyse **couvertes par 14 tests unitaires** (`test/biblio.import.test.mjs`).
- **Scan de code-barres par la caméra** au poste de circulation (prêt et retour) et surtout à l'**inventaire**, où l'on pointe les rayons un téléphone à la main. Sans aucune dépendance ajoutée : l'API navigateur `BarcodeDetector` est utilisée quand elle existe (Chrome/Edge, Android et bureau). Ailleurs — **iOS Safari et Firefox ne l'implémentent pas** — le bouton n'apparaît tout simplement pas, plutôt que d'offrir une fonction morte : la saisie clavier reste disponible partout et couvre déjà les douchettes USB.
  - Un même code reste visible plusieurs images d'affilée : un verrou de 2 secondes évite qu'un seul ouvrage soit pointé dix fois.
  - L'arrêt de la caméra est centralisé et rejoué à la fermeture comme au démontage — c'est exactement là que ce genre de composant laisse la caméra allumée.
- **Enrichissement automatique d'une notice par ISBN ou DOI** : saisir l'identifiant et cliquer sur 🔎 remplit titre, sous-titre, éditeur, année, mots-clés et **rattache les auteurs**, depuis **Open Library** (livres) ou **Crossref** (articles) — deux services publics, sans clé ni compte. Le type bascule sur « article » quand un DOI est reconnu.
  - **Aucun champ déjà rempli n'est écrasé** : le catalogueur qui a saisi une information la veut, et une base externe se trompe aussi.
  - Seul l'identifiant sort de l'application ; aucune donnée de l'établissement n'est transmise.
  - Les auteurs ne pouvant être liés qu'après création de la notice, le rattachement se fait à l'enregistrement.
  - Un nom d'auteur sans virgule est **gardé entier** plutôt que coupé au hasard (couper au dernier espace donnerait « de Saint / Exupéry ») — même règle qu'à l'import.
  - Correspondances **couvertes par 8 tests unitaires** sans réseau (`test/biblio.enrichissement.test.mjs`).

## [2.175.0] — migrations 123 → 124
- **Bibliothèque universitaire — Phase 3 : acquisitions et inventaire.** Inclus dans le module **Bibliothèque** existant (pas de nouvelle option à vendre).
- **Acquisitions** (nouvelle page, mode Supérieur) — trois onglets :
  - **Commandes** : suivi `brouillon → commandée → reçue en partie → reçue`, lignes avec quantité et prix unitaire, total recalculé en permanence. Le montant de la commande **n'est jamais stocké** : une valeur dénormalisée finit toujours par diverger de ses lignes.
  - **Réception atomique** (RPC `receptionner_ligne`) : réceptionner une ligne **crée les exemplaires au catalogue** (disponibles, à l'état neuf, avec prix, date et fournisseur), met à jour la quantité reçue et recalcule le statut de la commande — en une transaction. Une ligne peut porter un simple titre, puisqu'on commande souvent un ouvrage **avant** de l'avoir catalogué ; elle doit alors être rattachée à une notice avant réception.
  - **Fournisseurs** : carnet d'adresses des libraires et éditeurs. L'ancien champ texte libre `exemplaires.fournisseur` est **conservé intact** pour l'historique ; un `fournisseur_id` nullable vient à côté.
  - **Suggestions d'achat** : traitement des propositions (accepter / refuser avec réponse au demandeur).
  - ⚠️ Ces données étant commerciales (prix d'achat, fournisseurs), leur RLS est **réservée à la gestion** — contrairement au catalogue, les étudiants n'y ont aucun accès.
- **Espace étudiant — « Suggérer un achat »** : proposer un ouvrage manquant et suivre la réponse de la bibliothèque.
- **Inventaire** (nouvelle page) : campagnes de **récolement** délimitées par bibliothèque ou par localisation, **poste de scan** (code-barres puis Entrée, retour immédiat *compté / déjà scanné / hors périmètre / code inconnu*), compteurs en direct et **liste des ouvrages à rechercher en rayon**.
  - Un exemplaire **emprunté n'est pas compté comme manquant** : il est légitimement absent du rayon, et les confondre ferait conclure à tort à des pertes. Le rapport les sépare, comme les exemplaires retirés ou déjà déclarés perdus.
  - Un code-barres ne peut être compté deux fois dans une même campagne (index unique) ; les **codes inconnus sont tout de même tracés**, ce sont des anomalies à examiner.
  - Le rapprochement réel/catalogue est une **anti-jointure faite en base** (RPC `rapport_inventaire`) : sur un fonds de plusieurs centaines de milliers d'exemplaires, comparer deux listes au navigateur n'est pas envisageable.

## [2.174.0] — migrations 121 → 122
- **Bibliothèque universitaire — Phase 2 : dépôt institutionnel (mémoires, thèses, publications)**. Nouveau module commercial **« Mémoires & thèses »**.
  - **Workflow complet de validation** : `brouillon → soumis → vérification → (à corriger ⟲) → validé → publié`, avec `rejeté` et `archivé`. Chaque décision est horodatée et attribuée à son validateur, et le retour écrit remonte à l'étudiant.
  - **Page staff « Mémoires & thèses »** (Pédagogie, mode Supérieur) : file d'attente filtrée par statut, dossier complet avec ouverture du fichier, saisie des **métadonnées de soutenance** (directeur, jury, date) ou de **publication** (revue, DOI), décisions et **publication au catalogue en un clic** avec choix du niveau d'accès.
  - **Publication atomique** (RPC `publier_depot`) : la notice de catalogue, le document numérique et la mise à jour du dépôt se font **en une seule transaction** — pas de notice orpheline si une écriture échoue.
  - **Espace étudiant — « Mon dépôt »** : l'étudiant dépose son mémoire (fichier + résumé + mots-clés), le modifie tant qu'il est en brouillon ou renvoyé pour correction, le soumet, puis suit son avancement jusqu'à la publication.
  - **⚠️ Sécurité Storage** : jusqu'ici seule la gestion pouvait téléverser dans le bucket `bibliotheque`. L'écriture est désormais ouverte aux membres **uniquement sous le préfixe `<ecole_id>/depots/`**, et la relecture d'un fichier déposé reste limitée à **son auteur et à la gestion** tant qu'il n'est pas publié. Un étudiant ne peut donc ni écrire ailleurs, ni lire le dépôt d'un camarade.
  - Table **`biblio_penalites`** (retard / perte / dommage) posée avec ses règles d'accès — l'usager ne voit que les siennes.
- **Pénalités de retard** (onglet *Pénalités* du poste de circulation) : au retour d'un exemplaire en retard, l'application **propose** le montant calculé depuis la règle du rôle, mais **ne crée jamais la pénalité sans validation** — geste commercial, cas de force majeure, ou école qui ne pénalise pas (les pénalités sont désactivées par défaut). Suivi *à payer / payées / annulées* avec pagination serveur, et la **dette de l'emprunteur s'affiche au guichet avant le prêt** — à titre d'information, sans jamais bloquer le bibliothécaire.
- **Tableau de bord de la bibliothèque** (onglet *Statistiques*) : fonds, exemplaires et taux de disponibilité, emprunts en cours et en retard, réservations, dépôts à traiter, pénalités dues, **volume mensuel sur 12 mois** et **ouvrages les plus empruntés**.
  - Tout est agrégé **en base** par la RPC `biblio_statistiques` (migration 122), en **un seul aller-retour** : le classement des ouvrages exige un `GROUP BY`, et le faire au navigateur aurait imposé de télécharger tous les emprunts — exactement ce que ce module s'interdit. La RPC porte sa propre garde `_biblio_gestion()`, donc un agrégat ne peut pas servir à sonder un autre établissement.

## [2.173.0] — migrations 115 → 120
- **⚠️ Correctif bloquant — comptes étudiants** : le rôle `'etudiant'` était **absent de l'enum `role_systeme`** alors que `lier_etudiant` (113) l'insère : **aucun étudiant ne pouvait activer son compte** (l'erreur ne survenait qu'à l'exécution, la migration 113 ayant été acceptée). Ajouté, avec le rôle **`bibliothecaire`** (migration 115, isolée).
- **Helper générique `est_membre_ecole()`** (migration 116) : détermine l'appartenance à un établissement via `profil_roles`, **fail-closed**. Indispensable car `profils.ecole_id` est NULL pour les **étudiants et les parents** (donc `ecole_courante()` aussi). Réutilisable par tout module ouvert aux étudiants. + index manquants sur `eleves.profil_id` / `code_acces`.
- **Module Bibliothèque universitaire — socle (Phase 1)** : nouvelle page **« Bibliothèque »** (Pédagogie, mode Supérieur).
  - **Catalogue** avec **recherche plein texte et pagination côté serveur** (index GIN) — une première dans le projet : le catalogue peut atteindre des centaines de milliers de notices sans jamais être chargé entièrement.
  - Séparation **notice / exemplaire physique / document numérique** ; auteurs, bibliothèques et localisations (salle → rayon → étagère) ; codes-barres, cotes, états et statuts.
  - **Documents numériques** dans un **bucket privé**, lus par URL signée. La **règle d'accès de chaque document est appliquée dans la policy Storage** (institution / ciblé filière-niveau-rôle / restreint) : impossible d'y accéder depuis une autre institution, même en connaissant le chemin.
  - **Circulation en base** (prêts, retours, renouvellements, réservations avec file d'attente, règles configurables par rôle, pénalités désactivables, favoris, journal), avec synchronisation automatique du statut des exemplaires par trigger.
  - **Poste de circulation** (« Prêts & retours ») : prêt en 2 étapes (emprunteur puis code-barres, validés à la touche Entrée pour un lecteur de codes-barres), retour rapide, renouvellement, liste des emprunts en cours avec mise en évidence des retards, et écran de **règles de prêt configurables par profil** (quota, durée, renouvellements, pénalités désactivables).
  - **Espace étudiant — Bibliothèque** : catalogue consultable, *Mes emprunts*, *Mes réservations*, *Mes favoris*, consultation des documents autorisés. L'espace étudiant reçoit enfin une **navigation** (il n'en avait aucune). Nouvelle RPC `mon_dossier_etudiant()` (migration 120) qui résout l'établissement et le cursus de l'étudiant — nécessaire puisque `profils.ecole_id` est NULL pour lui.
  - Recherche d'emprunteur **bornée côté serveur** (jamais de chargement complet des étudiants).
  - Rôle **bibliothécaire** et modules commerciaux **Bibliothèque** / **Bibliothèque numérique** (activables à la carte). Règles de circulation **testées unitairement** (`test/bibliotheque.test.mjs`).

## [2.172.0]
- **Supérieur — vocabulaire « étudiant »** : en mode Supérieur, le terme « élève » devient « **étudiant** » (helper `lexique.js` selon `type_etablissement`). Première passe sur les écrans les plus visibles : **menu** (Élèves → Étudiants), **page Élèves** (titre, boutons, colonnes, import, création, suppression) et **fiche**. Les autres pages (documents, finances…) suivront. À l'école : inchangé.

## [2.171.0] — migration 114
- **Supérieur — Consentement d'accès parent aux notes (étapes A2 + A3)** :
  - **A2** — le parent (déjà lié à l'étudiant) voit un bouton **« Demander l'accès aux notes »** sur les sections Notes/Bulletins ; l'étudiant reçoit la demande dans son **espace** et l'**autorise / refuse / révoque**.
  - **A3** — au supérieur, les notes et bulletins ne remontent au parent **que si l'accès est autorisé** (RPC `enfant_notes` / `enfant_bulletins` gatées) ; sinon la section affiche l'état de la demande. **À l'école, comportement inchangé** (le parent voit librement).
  - Table `acces_parent_etudiant` + RPC `demander_acces_notes` / `mon_acces_notes` / `mes_demandes_acces` / `decider_acces` (migration 114). **Chantier consentement complet (A1→A3).**

## [2.170.0] — migration 113
- **Supérieur — Comptes étudiants (étape A1)** : l'étudiant majeur a désormais son **compte**, sur le modèle des parents. L'établissement génère un **code étudiant** (page **« Codes étudiants »**, Pédagogie/Supérieur), distribué par **WhatsApp** ; l'étudiant crée son compte, choisit « Je suis un étudiant » et saisit le code → un **espace étudiant** dédié s'ouvre. Socle du consentement d'accès parent (étapes A2 « demande & approbation » et A3 « cloisonnement des notes » à suivre).
  - Rôle `etudiant`, `eleves.profil_id` / `code_acces` / `telephone`, RPC `lier_etudiant` + `generer_code_etudiant` (migration 113). Cloisonné au supérieur ; aucun impact sur les écoles.

## [2.169.0] — migration 112
- **Espace parent — pastilles « nouveau » par menu** : chaque tuile de l'enfant (Notes, Absences, Paiements…) affiche une **pastille** quand il y a du nouveau, alimentée par les notifications déjà générées (nouvelle note, absence, facture). La pastille s'efface à l'ouverture de la section. Les notifications portent désormais l'**élève concerné** et une **catégorie** (migration 112) pour un comptage précis par enfant.

## [2.168.0] — migration 111
- **Supérieur (LMD) — Délibérations & relevés (Phase 4)** : nouvelle page **« Délibérations & relevés »** (Pédagogie / Supérieur).
  - **Arrêté des résultats** : fige (snapshot) les résultats calculés d'une cohorte (filière/niveau/semestre/session) en une **délibération** + un **relevé par étudiant** ; verrouillage possible.
  - **Relevé de notes** imprimable (détail par UE, moyenne, crédits acquis/total, décision, mention) **avec QR d'authentification** — vérifiable sur la page publique `/verifier` (nouveau type `releve` dans `verifier_document`).
  - **PV de délibération** imprimable (liste des décisions du jury).
  - Tables `deliberations` + `releves` (additives, RLS). **Module Supérieur : phases 0 à 4 livrées.**

## [2.167.0] — migration 110
- **Supérieur (LMD) — Notes & moteur de calcul (Phase 3)** : nouvelle page **« Notes »** (espace Pédagogie, mode Supérieur).
  - **Saisie** des notes par UE / ECUE, en **CC + examen**, par **session** (normale / rattrapage). Note finale = CC × pondération + Examen × pondération (réglable/école, défaut 40/60).
  - **Résultats** calculés par le **moteur LMD** : moyenne ECUE→UE→semestre, **capitalisation** (UE ≥ 10 → crédits acquis), **compensation** (semestre ≥ 10 → tout le semestre validé), crédits acquis/total, **décision** (Admis / Admis par compensation / Ajourné) et **mention**.
  - Moteur pur et **testé** (`test/lmd.test.mjs` : note finale, moyennes, capitalisation, compensation, mention). Table `notes_lmd` (additive, RLS).

## [2.166.0] — migration 109
- **Supérieur (LMD) — Inscriptions (Phase 2)** : nouvelle page **« Inscriptions »** (espace Pédagogie, mode Supérieur) pour l'**inscription administrative** (rattacher un étudiant — existant ou nouveau — à une filière + niveau, avec génération optionnelle de la **facture de droits** via le module Paiements) et l'**inscription pédagogique** (choix des **UE** du semestre, avec total de crédits). Filtres par filière/niveau, gestion du statut (active/suspendue).
  - Tables `inscriptions_sup` et `inscriptions_ue` (additives, RLS). Réutilise `eleves`, `annees_scolaires` et la facturation existante.

## [2.165.0] — migration 108
- **Module « Supérieur » (LMD) — fondation** : nouveau **type d'établissement** (École / Enseignement supérieur), réglable dans Paramètres → Établissement. Quand il vaut « Supérieur », l'espace **Pédagogie bascule en mode LMD** : la page **« Filières & maquettes »** (Faculté → Département → Filière → Semestre, puis **UE / ECUE avec crédits et coefficients**, contrôle « /30 crédits ») remplace Niveaux & classes / Notes / Bulletins. Le reste (finances, communication, documents, RH) est identique.
  - 100 % **additif et isolé** : nouvelles tables (`facultes`, `departements`, `filieres`, `semestres`, `ue`, `ecue`) avec RLS ; **aucun impact** sur les écoles existantes (type par défaut = `ecole`). Logique de crédits couverte par des tests unitaires (`test/lmd.test.mjs`).
  - Première brique de la feuille de route LMD (phases 0-1). Suite : inscriptions pédagogiques, moteur de calcul (capitalisation/compensation), délibérations, relevés.

## [2.164.0] — migration 107
- **Documents authentifiables par QR code** : chaque document officiel valide porte désormais un **QR code** en bas de page renvoyant vers une **page publique de vérification** (`/verifier`, accessible sans compte). En scannant, on confirme l'authenticité du document depuis le registre de l'école (établissement, bénéficiaire, référence, date, montant/mention…). Couvre : **factures & reçus de paiement**, **bulletins de notes** (côté gestion et côté parent), **bulletins de paie**, **certificats & attestations**, et un nouveau **reçu de dépense imprimable** (Comptabilité → Dépenses → « 🧾 reçu »).
  - Technique : RPC publique `verifier_document` (lecture seule, `security definer`, accès `anon`) — aucune écriture à l'impression, les documents historiques sont vérifiables sans reprise de données. Le QR encode le type + l'identifiant stable de l'enregistrement. QR généré côté client en SVG (net à l'impression, sans réseau).

## [2.163.0] — migration 106
- **RH — fiche employé complétée** : nouveaux champs **pays, n° fiscal (NINEA), banque, compte bancaire/IBAN, mobile money, personnes à charge** (section « Paiement & coordonnées bancaires » de la fiche). Complète la conformité paie/SYSCOHADA (le n° IPRES existait déjà).

## [2.162.0] — migration 105
- **Fournitures — case « fourni par l'école »** : indicateur explicite par article (colonne `fourni_ecole`), réglable côté staff (bouton « école » sur chaque ligne + case dans le formulaire). L'espace parent affiche ces articles en **rouge gras** selon cette case (plus le mot-clé). Backfill : les articles dont la note mentionnait l'école sont cochés automatiquement.

## [2.161.0]
- **Espace parent — fournitures fournies par l'école en évidence** : dans la liste de fournitures de l'enfant, les articles **fournis ou disponibles à l'école** (note mentionnant l'école) s'affichent en **rouge gras**, avec une légende (« pas besoin de l'acheter ailleurs »).

## [2.160.0]
- **Comptabilité — Plan comptable en arbre repliable** : les classes et comptes parents se **déplient/replient** (cascade), avec bouton « Tout déplier / Tout replier » — fini la longue liste plate.

## [2.159.0]
- **Correctif génération de paie bloquée (gros barème)** : le chargement du barème pour le calcul se fait de nouveau en **une seule requête** (au lieu de ~15 pages) — la pagination introduite en 2.154 pouvait faire **caler la génération en silence** sur un barème volumineux (2013 réel). Le comptage reste un COUNT serveur.

## [2.158.0]
- **UX mobile — fenêtres (modales) adaptées à l'écran** : les fenêtres sont plafonnées à la hauteur visible (`dvh`), en-tête fixe et **contenu qui défile** jusqu'en bas (boutons toujours atteignables), en **portrait comme en paysage** ; prise en compte de la zone sûre iPhone (encoche). Corrige le bas de fenêtre coupé (ex. « Régime », « Préparer la paie »).

## [2.157.0] — migration 104
- **Super_admin — accès à toutes les écoles** : `entrer_ecole` autorise un super_admin à entrer dans **n'importe quelle** école (support/maintenance), sans être propriétaire. Bouton **« entrer »** dans la console SuperAdmin (à côté de « gérer ») → bascule le contexte sur l'école choisie (RH, paie, compta…). Un seul compte pour toutes les écoles.

## [2.156.0]
- **Paie — net TOTAL = salaire de base** : en « base = net », la partie soumise vise *(salaire de base − indemnités non soumises)* ; avec la prime de transport rajoutée après déductions, le **net final égale exactement le salaire de base** saisi.

## [2.155.0]
- **Paie — salaire de base = net exprimé en heures × taux horaire dérivé** : en régime complet « base = net », le brut calculé à l'envers est présenté comme *heures mensuelles × taux horaire*, le **taux étant la variable dérivée** qui fait correspondre le net saisi (Personnel). Le net du bulletin = salaire de base saisi.
- **Prime de transport non soumise** : sortie de l'assiette cotisations/IR, **ajoutée après les déductions** (indemnité non imposable). Réglable par élément (bouton soumis/non soumis).

## [2.154.0]
- **Correctif barème volumineux** : `compterBareme` utilise un **COUNT serveur** (exact, sans charger les lignes) et le chargement du barème (`getBaremePour`) est **paginé**. Un barème réel (ex. 2013 ≈ 14 800 lignes) était tronqué à ~1000 lignes → faux « barème non chargé » à la génération **et** IR faussé pour les hauts revenus. Corrigé.

## [2.153.0] — migration 103
- **RH & Paie — compte comptable par élément (P6 audit)** : chaque élément de paie peut porter son **compte du plan comptable**. La comptabilisation des salaires (`poster_salaire_charge`) répartit alors les **charges (débit)** et les **retenues (crédit)** sur ces comptes, avec repli sur les comptes par défaut (661/423/organismes) et **équilibre garanti**. Sélecteur de compte dans **Éléments de paie**. *(PDF téléchargeable et historique de salaire déjà assurés par l'impression navigateur + dossier employé/piste d'audit existants.)*

## [2.152.0] — migration 102
- **RH & Paie — règles versionnées (P9 audit)** : cotisations et barème IR portent une **date d'effet** (+ date de fin pour les cotisations). La paie d'une période utilise la **version en vigueur ce mois-là** (`getCotisationsPour`/`getBaremePour`, `contexteComplet` et recalcul période-aware). `remplacer_bareme` **ajoute une version datée** (l'historique est conservé) au lieu de tout écraser. UI Régime : colonne « Effet » sur les cotisations, champ « à partir du » à l'import + liste des versions. Non destructif : l'existant prend effet le 2000-01-01.

## [2.151.0]
- **RH & Paie — régularisation IR annuelle (décembre)** : à la génération de **décembre**, une ligne **« Régularisation IR (annuelle) »** compare l'IR dû sur le **revenu annuel** (barème annuel) à la **somme des IR mensuels** déjà retenus → complément à retenir (> 0) ou **trop-perçu restitué** (< 0). Inclut naturellement le 13ᵉ mois s'il est soumis. Fonction pure `regularisationIR` testée. Nécessite le **barème annuel** chargé (mode complet).

## [2.150.0]
- **RH & Paie — congés/absences avant la paie** : « Préparer la paie » liste désormais les **congés en attente** et les **absences** du mois. La **génération est bloquée** tant que des congés du mois ne sont pas validés/refusés (bouton « Aller à Congés & absences »). Les absences non justifiées restent gérées par la retenue (P5).

## [2.149.0]
- **RH & Paie — Retenue sur absences (P5 audit)** : règle configurable par école — **aucune** / **proratisée** (jours × brut soumis ÷ jours-mois) / **forfait** (jours × montant/jour), sur les absences **non justifiées** (absence/maladie) du mois. Ligne « Retenue absences (N j) » ajoutée automatiquement à la génération. Réglage dans **RH & paie → Paie → Régime → « Retenue sur absences »**. Défaut : aucune (comportement inchangé).

## [2.148.0] — migration 101
- **RH & Paie — Éléments périodiques (P4 audit)** : un élément peut être **mensuel** (défaut), **trimestriel** (3/6/9/12), **semestriel** (6/12) ou **annuel / 13ᵉ mois** (décembre). Il ne figure alors que sur ses **mois de déclenchement** → **anti-double** naturel (une fiche par mois). Sélecteur de périodicité dans **Éléments de paie**. Sans effet sur les éléments existants (restent mensuels).

## [2.147.0] — migration 100
- **RH & Paie — Éléments globaux (P3 audit)** : appliquer un élément à une **portée** (tous / une catégorie / une fonction) avec un montant par défaut, et **exclure** des employés précis. Priorité de fusion : `global < régime < individuel` (le plus spécifique l'emporte). Gestion via **RH & paie → Paie → « Global »**.

## [2.146.0] — migration 099
- **RH & Paie — Régimes de rémunération (P2 audit)** : un **régime** nommé regroupe des éléments récurrents (montant par défaut) et s'affecte à un employé (fiche → « Régime de rémunération ») ou **en masse à une catégorie**. À la génération, les éléments de l'employé = régime + affectations individuelles (**l'individuel prime**). Gestion via **RH & paie → Paie → « Régimes »**. Non destructif : un employé sans régime garde le comportement actuel.

## [2.145.0] — migration 098
- **Comptabilité — salaires (P1 audit RH&Paie)** : une paie **validée** génère l'écriture de **constatation** (Débit 661 rémunérations + 664 patronal / Crédit 422 net + 431/432/438 organismes + 441 IR-TRIMF + 447 CFCE + 421 avances + 423 retenues), et le **paiement** génère le **règlement** (Débit 422 / Crédit trésorerie) via la dépense salaire — **sans double comptage**. Réversible : dévalidation et annulation de paiement suppriment les pièces (période ouverte). Triggers **non bloquants**. La **reprise d'exercice** inclut désormais les salaires.

## [2.144.0]
- **Paie — primes après déductions** : les primes/indemnités ajoutées à un bulletin sont **non soumises par défaut** (hors assiette cotisations/IR) et affichées **après les déductions** dans l'éditeur (le brut n'inclut plus que les gains soumis) — cohérent avec le bulletin imprimable. Un élément explicitement « soumis » reste dans le brut.
- **Paie — fin des doublons au recalcul** : le bouton « ↻ Recalculer » supprime désormais les lignes auto (cotisations/impôts + charges patronales) de façon **atomique** et est protégé par un **verrou anti-chevauchement** (plus de double jeu de cotisations). Un clic suffit aussi à nettoyer d'éventuels doublons existants.

## [2.143.0]
- **Paie — salaire de base NET** : en régime complet, le salaire de base d'un salaire fixe peut être traité comme le **net à verser** ; le **brut est calculé à l'envers** (net-to-gross) pour que, cotisations et IR déduits, l'employé touche exactement ce montant. Interrupteur **Net / Brut** dans Régime (défaut : Net). Corrige l'écart « Salaire base » (vue Personnel) vs « Net » (vue Paie) : après régénération du bulletin, les deux coïncident. Sans effet sur les employés payés à l'heure (taux horaire).

## [2.142.0] — migration 097
- **Comptabilité — exercices** : `assurer_exercices()` crée un exercice (+ périodes) pour chaque **année scolaire** sans exercice (094 ne le faisait que pour l'année courante). Dans « Paramètres », **sélecteur d'exercice** pour la reprise + bouton **« Créer les exercices manquants »** — permet de comptabiliser une année dont les opérations ne tombent pas dans l'exercice courant (ex. année en cours de clôture).

## [2.141.0] — migration 096
- **Comptabilité générale (étape 3)** : branchement automatique des opérations en partie double (méthode **engagement**). Facture → *Débit 411 Famille / Crédit 706 Scolarité* ; règlement → *Débit trésorerie / Crédit 411* ; dépense → *Débit charge / Crédit trésorerie* (charge selon la catégorie, mapping configurable). **Activation par école** (opt-in), **règles de mapping** (`regles_ecriture`), lien portefeuille de trésorerie → plan. **Reprise de l'exercice courant** (idempotente) via « Paramètres ». Triggers **non bloquants** (une erreur de comptabilisation n'empêche jamais l'opération métier ; journalisée dans `compta_erreurs`). Salaires branchés à l'étape suivante.

## [2.140.0] — migrations 094, 095
- **Comptabilité générale (étapes 1–2)** : socle SYSCOHADA amorcé par école — **plan comptable** configurable (classes 1→7), **journaux** (CA/BQ/MM/AC/VE/SA/OD), **exercices** + périodes mensuelles. **Moteur d'écritures en partie double** : pièces équilibrées (contrôle Σdébit = Σcrédit côté serveur), idempotence par opération source, verrou de période clôturée. Onglets **Plan comptable** et **Journal** (saisie d'opérations diverses) dans le module Comptabilité. Le livre de caisse existant reste inchangé.

## [2.139.0]
- **Récapitulatif des salaires** (rapport comptable) : net à payer + institutions (VRS, IPRES+CSS, IPM) + total décaissé, imprimable + export Excel.

## [2.138.0]
- **Régimes de paie multi-pays** : modèles de cotisations applicables par école (Sénégal validé ; RDC, Mali, Côte d'Ivoire = structure + taux indicatifs). `src/lib/regimes.js`.

## [2.137.0] · [2.136.0]
- **UX mobile (Phase 5)** : listes de paie et de congés converties en **cartes** (fin du défilement horizontal), actions tactiles.

## [2.135.0]
- **Livre de paie** imprimable (brut/cotisations/net/charges patronales + totaux) + **export Excel**.

## [2.134.0] — migration 092
- **Absences RH** (absence/retard/maladie/autorisation), informatif (pas de retenue automatique).

## [2.133.0] — migration 091
- **Congés** : demande → approbation/refus → solde annuel (quota réglable).

## [2.132.0] — migration 090
- **Dossier employé 360°** + **identité civile** + **historique des contrats** (période d'essai, motif de fin).

## [2.131.0] · [2.130.0] — migration 089
- **Avances & prêts** : échéancier, solde réversible (dérivé), **déduction automatique** à la génération. Proratisation embauche/départ en cours de mois.

## [2.129.0] — migration 088
- **Contrôle interne (Phase 1)** : piste d'audit des montants (inviolable), garde de suppression hors brouillon, **séparation des tâches** optionnelle.

## [2.128.0] — migrations 086, 087
- **Réparation** workflow/audit (journal_audit non persisté) + **diagnostic santé** (RH → Paie → Régime → « Vérifier l'installation »).

## [2.127.0] — migration 085
- Audit 🟡 : import du barème **atomique** (RPC), **dette personnel** visible au comptable, Part TRIMF clarifiée.

## [2.126.0]
- **Arrondi au franc** cohérent (net = somme des lignes arrondies).

## [2.125.0]
- **Vérification des entêtes** avant génération (champs manquants par employé, taux horaire critique).

## [2.124.0]
- **Bulletin de paie au format officiel** (colonnes part employé / patronale, cotisations, net, charges patronales).

## [2.123.0] — migration 084
- Audit 🟠 #1 : **recalcul automatique** des cotisations/IR après édition. Retrait du code mort `maj_salaire`.

## [2.122.0]
- **Préparer la paie** : heures/absences validées par employé avant génération.

## [2.121.0]
- **Tableau de bord comptable** (Phase G) : caisse/banque, recettes/dépenses/salaires, **créances & dettes**, résultat.

## [2.120.0] — migration 083
- Gains **non soumis** (transport…) : dans le net mais hors assiette cotisations/IR.

## [2.119.0] — migration 082
- **Brut = heures mensuelles × taux horaire** (base + sursalaire) ; heures ajustables par bulletin.

## [2.118.0] · [2.117.0] — migration 081
- **Moteur de paie** : cotisations (part sal./patr., plafonds) + **IR/TRIMF via barème** ; **import du barème** par école.

## [2.116.0] — migration 080
- **Régime de paie configurable** par école (cotisations, mode simplifié/complet, champs fiscaux employé).

## [2.115.0] — migration 079
- **Workflow de paie** brouillon → validé → payé (verrouillage) + **journal d'audit**.

## [2.114.0] — migration 078
- **Bulletin dynamique** : composition en lignes (gains/retenues), net recalculé par trigger.

## [2.113.0] — migration 077
- **Catalogue d'éléments de paie** configurable (gains/retenues, récurrent/ponctuel).

## [2.112.0] — migration 076
- **Catégories financières** configurables par école.

## [2.111.0]
- Édition du personnel, import des enseignants comme personnel, personnel sans contrat visible en paie.

## [2.110.0] — migration 075
- **Trésorerie/scolarité** : les encaissements alimentent la caisse (cohérence trésorerie ↔ résultat).

## [2.109.0] — migration 074
- Paie **nette** (« salaire de base »), personnel automatique, édition post-paiement (resync dépense) ; correctifs d'audit RH & compta.

---

### Correctifs base (sans changement de version applicative)
- **093** — autorise la suppression d'un bulletin **brouillon** (le verrou ignorait le parent supprimé en cascade).
