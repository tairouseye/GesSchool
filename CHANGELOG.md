# Journal des modifications — GesSchool

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version la plus récente en haut.
La version applicative est celle de `package.json` (affichée dans l'app). Migrations dans [`supabase/migrations/`](supabase/migrations).

> Historique antérieur à `2.109.0` : voir l'historique git. Ce journal démarre au chantier **Comptabilité / RH & Paie**.

## [2.237.0] — quatre guides par rôle, et le manuel ne s'ouvre plus en premier
- **Demandé** : des guides par rôle — « Je suis enseignante », « Je suis comptable », « Je suis parent » — plus courts et plus directs que le manuel complet.
- **🔴 Le problème que ça règle.** Le manuel fait **1 020 lignes**. Une enseignante qui cherche comment faire l'appel n'a pas à le traverser, et une mère de famille encore moins. Le lien de l'application ouvre désormais une **page d'aide** (`/aide.html`) qui demande d'abord « qui êtes-vous ? », puis mène au bon guide — le manuel y reste, en dernier, pour chercher un détail.
- **Quatre guides** écrits depuis le code, pas de mémoire : **Enseignante** (sa journée : présence, cahier de textes, notes, acquis) · **Direction** (ouvrir l'établissement, arrêter et diffuser les bulletins, le PV du conseil) · **Gestion** (facturer, encaisser, vérifier une preuve mobile money, relancer) · **Parent** (compte, suivi, paiement, absence, document). Chacun se termine par un « **Si ça ne marche pas** » tiré des vraies causes d'échec.
- **Chaque guide dit aussi ce qu'il ne fait PAS** — et pourquoi. Un enseignant ne voit pas qui a payé : il n'a aucune action sur un impayé, et l'information pourrait peser sur son regard sur l'enfant. Ce n'est pas un oubli de produit, c'est une décision.
- **Le guide parent ne renvoie pas au manuel du personnel**, mais au **secrétariat** : une personne, pas mille lignes. L'épreuve vérifie cette nuance plutôt que d'imposer la même règle à tous.
- **Cinq nouvelles épreuves dans `test/modeEmploi.test.mjs`** : chaque guide est écrit, **généré** et **servi** · la page d'aide mène à **tous** les guides et au manuel · un guide reste **sous 300 lignes** (sinon on se retrouve avec deux manuels à tenir) · chaque guide dit où aller ensuite · **la page d'aide ne mente pas sur le nombre de chapitres** du manuel — un chiffre écrit à la main vieillit comme le reste.
- **Deux affirmations fausses corrigées au passage** : l'annonce « 28 chapitres » alors qu'il y en a **29**, et les trois guides qui citaient un lien « 📖 Mode d'emploi » devenu « **📖 Aide & mode d'emploi** ». Le manuel renvoie maintenant aux guides dès son en-tête.
- `docs/md2html.mjs` traite les **six documents** en une passe ; `docs/guide-parent.html` (juin, périmé) est supprimé au profit de la version générée, et `docs/guide-parent.pdf` est régénéré pour que le document distribué aux familles dise la même chose que l'application.

## [2.236.0] — le mode d'emploi devient accessible, et une épreuve le tient à jour
- **Demandé** : rendre le mode d'emploi accessible depuis l'application, et le mettre à jour après chaque évolution.
- **🔴 Un manuel que personne ne peut atteindre n'existe pas.** Il vivait dans `docs/`, c'est-à-dire nulle part pour une directrice : aucun écran n'y renvoyait, et GitHub Pages ne publie que `dist/`. Le convertisseur écrit désormais dans **`public/`**, que Vite recopie dans `dist/` — le manuel est servi à **`/mode-emploi.html`**, et un lien **📖 Mode d'emploi** figure dans la barre latérale et dans le panneau Compte mobile, **pour tous les rôles** : une enseignante en a autant besoin qu'un promoteur.
- **Deux faiblesses du convertisseur corrigées au passage.** Il portait `C:/Users/…` **en dur** — il n'aurait jamais tourné ailleurs que sur un poste, ni dans la chaîne d'intégration. Et il **relisait sa propre sortie** pour en extraire le `<style>` : si le HTML était perdu, la mise en forme disparaissait silencieusement. Le style vit maintenant dans le script, et `docs/mode-emploi.html` est supprimé pour ne pas laisser deux copies diverger.
- **⚠️ Une intention ne tient pas, une épreuve si.** Le manuel avait pris **183 versions de retard**, et son chapitre sur les bulletins décrivait un bouton supprimé — il **trompait**. `test/modeEmploi.test.mjs` échoue désormais si : un écran de `espaces.js` n'est **pas mentionné** dans le manuel · la version annoncée ne correspond plus à celle du paquet · un renvoi `§x.y` pointe vers une section **inexistante** · un numéro de chapitre est **en double** · `public/mode-emploi.html` manque ou est plus ancien que sa source. Une sixième épreuve vérifie que **le garde-fou détecte bien ce qu'il traque**.
- **Elle m'a attrapé dans la minute** : après le bump en 2.236.0, l'épreuve de version a échoué parce que le manuel annonçait encore 2.235. C'est exactement ce qu'on lui demande de faire.
- **Et elle a trouvé 11 écrans non documentés dès sa pose** : la **Vue d'ensemble**, l'**Organigramme**, la **Documentation**, le **Journal des actes**, les quatre écrans de **bibliothèque**, les **Délibérations & relevés**, le **Catalogue** et **Mon abonnement**. **51 écrans sur 51** sont maintenant documentés — deux chapitres approfondis (§24 le supérieur et sa bibliothèque, §25 le Pilotage) et le manuel passe à **1 015 lignes**.
- *Critère volontairement bas* : la garde vérifie qu'un écran est **mentionné**, pas que le texte est bon. Elle interdit seulement qu'un écran neuf parte en production sans qu'une ligne le nomme. Si elle échoue, la réponse est d'écrire le paragraphe manquant — pas d'allonger une liste de tolérances.

## [2.235.2] — mode d'emploi approfondi : 511 → 958 lignes
- **Retour de l'école** : « pas assez détaillé ». C'était juste. J'avais gardé le style télégraphique de l'existant — des chemins de menu — là où il faut dire **ce qu'on voit, ce qu'on fait, ce qui se passe ensuite, et quoi faire si ça coince**.
- La mesure de densité a montré que le problème était **surtout dans les anciens chapitres** : 6 lignes pour toute la RH et la comptabilité, 8 pour les notes, 11 pour les élèves — l'écran le plus utilisé.
- Approfondis : **§3 Élèves** (11 → 86), **§5 Quotidien de l'enseignant** (11 → 41), **§6 Notes** (8 → 40), **§8 Classement** (4 → 23), **§9 Documents** (9 → 25), **§10 Paiements** (19 → 68), **§12 Cantine & Transport** (10 → 40), **§13 Vie scolaire, fournitures & communication** (7 → 69), **§14 RH & Paie · Comptabilité** (6 → 62).
- Ce sont les **pièges** qui ont été ajoutés, pas du remplissage : créer les classes **avant** l'import, l'**échéance** sans laquelle aucun retard n'est jamais signalé, la portée des frais en Montessori, une **absence n'est pas un zéro**, refaire l'appel **ne détruit pas** les justifications, un bulletin de paie validé ne se supprime plus, et l'écart entre « facturé » et « encaissé » qui **est** exactement vos impayés.
- Nouveau **§28 — annexe « Votre première semaine, pas à pas »** : l'ordre jour par jour, avec les trois étapes qu'il ne faut pas sauter (les classes avant l'import, les dates de période avant les bulletins, les responsables de cycle avant le PV).
- Les libellés décrits viennent des **écrans**, pas de ma mémoire. **Un manuel détaillé qui se trompe est pire qu'un manuel mince.**

## [2.235.1] — jeu de démonstration des fonctions 164 → 172
- Les deux écoles marquées `demonstration` étaient déjà bien garnies ; les manques étaient **précisément les fonctions récentes**. Script `supabase/seeds/demo_fonctions_recentes.sql`, **exécuté et vérifié** : pédagogie Montessori, périodes **datées**, 19 items d'acquis et 53 à 72 observations variées, la programmation de l'IEF (4 domaines, 50 contenus), responsables de cycle, un PV **complet** à deux signataires sur une démo et **incomplet** sur l'autre, des bulletins dans les **trois** états dont des publiés déjà consultés, 24 séances de cahier de textes toutes **reliées** à la programmation, progressions, fournitures et incidents.
- **🔴 Ne touche que `demonstration = true`**, et chaque bloc le revérifie. Mesuré après exécution : les **cinq écoles de production** sont restées à zéro sur toutes les nouvelles tables.
- **Deux défauts trouvés en l'écrivant.** En PL/pgSQL, `select … into v` **laisse la variable inchangée** quand la requête ne rend rien : dans mes boucles, le CM1 de la première école survivait pour la seconde, et j'aurais écrit une programmation sur le niveau d'une **autre école**. Et **mon propre déclencheur de la 166 a arrêté le script** — à juste titre : un bulletin ne peut pas *naître* publié. Je ne l'ai pas désactivé ; le script **endosse** le promoteur de l'école, le contrôle s'exerce pour de vrai, et les bulletins naissent en brouillon puis avancent par le circuit.

## [2.235.0] — migration **172** · le suivi des acquis, au préscolaire
- **Point 2 de la visite** : « suivi pédagogique préscolaire ».
- **🔴 Au préscolaire, on ne note pas sur 20 — on OBSERVE.** Un enfant de TPS n'a pas une moyenne de 12,5 en langage : il « sait nommer les objets usuels » — **acquis**, **en cours d'acquisition**, ou **pas encore**. Réutiliser `notes` et `evaluations` aurait produit des bulletins chiffrés absurdes, et surtout une **conversation fausse avec les familles** : un parent qui lit « 8/20 » à trois ans comprend un échec, là où l'enseignante voulait dire « il y arrive bientôt ».
- **La formulation est une décision, pas de la cosmétique.** « **Pas encore acquis** » décrit un moment d'un parcours ; « non acquis » sonne comme un verdict. C'est un enfant de trois ans qu'on décrit à ses parents, et l'écran le dit explicitement : « ce n'est pas un échec, c'est une étape ». Verrouillé par une épreuve.
- **Trois valeurs, et pas de quatrième « non évalué ».** L'absence d'observation **est** l'information : une ligne manquante le dit déjà. Ajouter une valeur explicite obligerait à créer une observation pour chaque item non traité — des milliers de lignes vides. Et une valeur absente ou inattendue n'est **jamais** comptée comme « pas encore acquis » : confondre « non observé » et « en échec » ferait dire à l'école quelque chose qu'elle n'a pas dit.
- **Un enfant à la fois, pas une grille.** 25 enfants × 60 items feraient **1 500 cases** : illisible au téléphone, et faux dans l'esprit — on observe un enfant, pas une matrice. On choisit l'enfant, puis on parcourt ses domaines. Re-cliquer la valeur active la **retire**.
- **Le référentiel appartient à l'école** : on ne lui impose aucune liste. Un modèle de départ (6 domaines, 19 items observables) s'insère **sur demande**, et la fonction **refuse** de s'exécuter si un référentiel existe déjà — on ne vient pas écraser le travail d'une équipe pédagogique avec une liste générique. Le modifier est un acte de **direction** ; **saisir les observations** est le travail quotidien de la classe, donc ouvert à l'enseignant.
- **⚠️ La grille de consentement de la migration 114 s'applique.** Un acquis est une appréciation pédagogique sur l'enfant, au même titre qu'une note : la RPC famille passe par `_parent_possede` **puis** `_acces_notes_autorise`. S'en dispenser aurait ouvert par la fenêtre ce que la 114 ferme à la porte.
- **Côté famille**, on ne montre **que ce qui a été observé** — un référentiel de 60 items dont 3 renseignés n'affiche pas 57 lignes vides. La tuile n'apparaît même pas tant que l'école n'a rien saisi : une tuile vide inquiéterait un parent sans rien lui apprendre. Et le suivi s'accompagne d'une phrase qui dit ce qu'il **est**, pour qu'il ne se lise pas comme un bulletin chiffré.
- L'écran ne s'affiche que pour les classes du cycle **Préscolaire** : le proposer pour un CM1 n'aurait pas de sens, on y note. 6 épreuves sur l'échelle. Suite : **241 vertes**.
- *Volontairement hors périmètre* : l'impression du suivi sur le bulletin. Le bulletin préscolaire mérite une mise en page propre, pas une colonne de plus dans un modèle chiffré.

## [2.234.0] — migration **171** · la présence par séance, au supérieur
- **Précisé par l'école** : « la présence est journalière pour le préscolaire et l'élémentaire, et **par séance — c'est-à-dire par matière** — pour le supérieur. »
- **⚠️ Ce n'est pas un second écran d'appel, c'est une CLÉ différente.** À l'école on pointe un élève pour une **journée** ; à l'université pour **une séance**. Un étudiant peut manquer le TD de 8 h et assister au CM de 14 h — confondre les deux fausserait tous les comptes d'assiduité. `absences.classe_id` ne pouvait pas servir : l'université n'a pas de classes, ses étudiants sont inscrits par filière et suivent des UE. D'où `seance_sup_id`.
- **Les deux circuits ne se croisent jamais** : les lignes du supérieur portent `classe_id` NULL, donc l'appel d'une classe ne les voit pas et ne peut pas les effacer — et réciproquement. Verrouillé par une épreuve.
- **Le diff est réutilisé, pas réécrit.** Celui de la feuille de présence est éprouvé par 12 épreuves, dont celle qui garde les justifications après l'incident de perte de données. Seul **ce qui rattache la ligne** change ; sans contexte, le circuit école se comporte exactement comme avant (épreuve dédiée).
- **⚠️ Aucun changement de droits, et je l'ai vérifié avant d'en écrire un.** La migration 018 autorise l'écriture d'`absences` à `est_gestion() or surveillant or enseignant`, **sans** restriction de classe — la 058 a cloisonné les notes et les bulletins, pas les absences. Un enseignant du supérieur peut donc déjà faire son appel. Toucher à cette policy aurait été un risque gratuit.
- **Qui est convoqué** : si la séance porte une **UE**, seuls les étudiants inscrits à **cette UE** — une UE optionnelle ne concerne pas toute la filière, et marquer absents ceux qui ne la suivent pas serait une faute de compte. Si la séance n'a pas d'UE (la migration 138 le permet), toute la filière est convoquée **et l'écran le dit**, puisque le compte d'assiduité en dépend. Une inscription suspendue ou annulée n'est pas convoquée.
- **Tout le monde présent par défaut**, on ne marque que les exceptions : l'inverse produirait une promotion entière d'absents dès qu'on ouvre l'écran sans rien valider.
- L'écran propose les séances **du jour choisi** — la question que se pose l'enseignant en entrant en salle, pas « toutes les séances du semestre ». **⚠️ En `SECURITY DEFINER`, le cloisonnement entre établissements est écrit explicitement** dans la RPC de liste (leçon de la 167). Suite : **235 vertes**.

## [2.233.0] — migration **170** · savoir si une famille est à jour, sans voir ses montants
- **Demandé à la visite**, et précisé par l'école : « à jour signifie paiement ». Une pastille par élève dans la liste d'une classe, et un bandeau de synthèse.
- **🔴 Trois états, pas deux — et c'est tout l'enjeu.** Relevé en production : **8 factures pour 96 élèves inscrits**. Un indicateur à deux états aurait affiché « en retard » pour **88 familles qui n'ont jamais été facturées** : une information fausse, et accusatrice. L'état « non facturé » dit la vérité — le travail reste à faire du côté de **l'école**. Le bandeau l'énonce ainsi : « 88 sans facture ».
- **⚠️ Ce que la migration 133 avait établi, et que je n'ai pas défait.** Elle avait purgé les policies de `factures`, `facture_lignes` et `paiements` pour les reposer sur `est_admin() or comptable or secretaire`, après avoir mesuré qu'un enseignant lisait les factures par simple appel REST. **Vérifié à nouveau avec de vraies sessions** : la direction et le responsable RH ne lisent rien de `factures`. Le cloisonnement tient.
- **D'où une RPC qui ne rend QUE l'état** : trois valeurs et un compte de factures échues — jamais un montant, jamais une échéance, jamais un numéro. Le responsable pédagogique apprend qu'une famille est en retard ; il n'apprend pas de combien.
- **⚠️ Et pas d'accès pour l'enseignant ni le surveillant.** Décision explicite : ils n'ont aucune action à mener sur un impayé, et savoir quelles familles sont en retard crée un risque de **traitement différencié de l'enfant**. La colonne disparaît simplement pour eux, sans message d'erreur.
- Deux précautions dans le calcul : une facture **sans date d'échéance** n'est pas « en retard », elle est indatée — compter l'inconnu comme un retard serait accuser à tort ; et le retard se mesure sur **le solde** (`montant_total > montant_paye`), tenu par un déclencheur, plutôt que sur `statut`, qui est saisi à la main et peut mentir. Une facture annulée n'entre dans aucun compte.
- **⚠️ En `SECURITY DEFINER`, la RLS ne protège plus** : le cloisonnement entre établissements est écrit explicitement dans la fonction (même leçon qu'à la migration 167).
- Un état inconnu se comporte comme « non facturé », jamais comme « en retard » : si la base rendait un jour une valeur inattendue, elle n'accuserait personne. 6 épreuves, dont le cas réel de Tut'Tank. Suite : **231 vertes**.

## [2.232.0] — migration **169** · les photos des élèves, et le parent qui voit la sienne
- **Constat avant d'écrire une ligne** : le téléversement existait depuis la migration 003 et fonctionnait depuis la fiche élève… et pourtant **aucune photo n'avait jamais été enregistrée — 0 sur 172 élèves**. Ouvrir 96 fiches une par une n'est pas une tâche qu'on fait. Ce n'est pas la plomberie qui manquait, c'est un écran où l'on enchaîne.
- **Nouvel écran « Photos des élèves »** (Pédagogie → Élèves & structure), conçu pour le **téléphone, debout, en classe** : une classe, une grille, on touche un élève et `capture="environment"` ouvre **directement l'appareil photo** au lieu d'un explorateur de fichiers. Un compteur dit où l'on en est (« 12 / 96 ») — sans lui, on ne sait pas qui reste. La ligne se met à jour sur place : recharger la classe après chaque photo rendrait la saisie de 96 élèves pénible.
- **Le parent voit la photo de SON enfant**, et d'aucun autre. Elle apparaît sur sa carte d'accueil et dans l'en-tête de la fiche de l'enfant ; sans photo, les initiales colorées restent — l'espace parent ne doit pas attendre que l'école ait photographié 96 enfants.
- **🔴 Ce qu'il ne fallait PAS faire pour y arriver.** Un parent ne voyait rien parce que `ecole_courante()` est NULL pour lui : la policy de la migration 015 l'excluait, à juste titre. La tentation était de l'élargir à `est_membre_ecole()` — **et ç'aurait été une faute** : ce helper est vrai pour **tous les parents** de l'école, donc chacun aurait pu lister et lire la photo de **chacun des 96 enfants**. C'est la famille de défauts « un parent voit les données d'un autre enfant » que l'audit de la bibliothèque avait relevée. On passe par **`_parent_possede()`**, qui ne répond vrai que pour ses propres enfants. Les policies du personnel (mig. 015) ne sont pas touchées : sous PostgreSQL, les policies permissives s'additionnent.
- **⚠️ Le chemin de stockage a changé de forme, et c'est le cœur de la migration.** L'ancien était `<ecole_id>/<eleve_id>-<horodatage>.<ext>` : **inanalysable** dans une policy, car un UUID contient quatre tirets — découper sur « - » ne permet pas de retrouver l'élève. Le nouveau est `<ecole_id>/<eleve_id>/<horodatage>.<ext>`, un segment par identifiant. **Cette correction était possible sans migration de données précisément parce qu'aucune photo n'existait encore** ; l'occasion ne se serait pas représentée une fois les 96 photos prises.
- Le format du chemin est désormais traité comme un **contrat** : la fonction qui le construit est pure, et **5 épreuves le vérifient des deux côtés** — dont une qui applique au chemin produit la *même* expression régulière que la fonction SQL, et une qui prouve que l'ancienne forme ne la passait pas. Un nom de fichier hostile ne peut pas ajouter de segment et déplacer l'élève. Sans ce verrou, une dérive du format ferait disparaître la photo **sans erreur, en silence**.
- **Droits** : prendre les photos est réservé à la **direction et au secrétariat**. Un enseignant tient sa classe, il ne constitue pas les dossiers — et une photo d'enfant se confie au moins de mains possible. Plafond de **5 Mo** par photo : un cliché de 8 Mo coûte de la bande passante aux familles comme à l'école, pour un portrait affiché en 40 pixels. Retirer une photo supprime **le fichier ET la référence** — laisser l'un sans l'autre produirait un objet orphelin ou une image cassée.
- Vérifié avant d'écrire : le bucket est bien **privé**, un **anonyme est refusé**, et la grille de consentement de la migration 114 n'est pas touchée (elle garde les **notes**, pas l'identité de l'enfant).
- Suite complète : **225 vertes**.

## [2.231.0] — migration **168** · ce que l'établissement couvre, et la pédagogie de l'élémentaire
- **Demandé** : pouvoir déclarer « Élémentaire (incluant le préscolaire) », « Collège », « Lycée », « Université » **et leurs combinaisons**, du plus simple (Élémentaire seul) au plus étendu (Élémentaire-Collège-Lycée-Université). Plus, pour l'élémentaire, le choix entre **classique** et **Montessori**.
- **⚠️ Pourquoi une colonne neuve, et non `type_etablissement`.** Ce champ porte déjà **deux significations successives** : la migration 001 y stockait le statut juridique (« Privé », « Public »), la 108 en a fait la bascule école/supérieur — et son `add column if not exists` n'ayant rien appliqué, **six écoles sur sept avaient perdu** Appel, Notes, Bulletins et Emploi du temps de leur menu. Y poser une troisième signification, avec une quinzaine de combinaisons, aurait rejoué ce défaut en pire. Le champ n'est plus proposé à la saisie : il est **déduit** des paliers, pour que les anciens consommateurs restent cohérents.
- **⚠️ Et pourquoi pas `cycles_actifs`, qui semblait faite pour ça.** Parce que sa donnée n'est pas fiable pour cette question, et je l'ai vérifié avant de m'y appuyer : **l'Université Cheikh Anta Diop porte `type_etablissement = 'superieur'` mais `cycles_actifs = {prescolaire, premier_cycle, second_cycle, lycee, formation_pro}` — sans `universite`.** Ce sont des cycles d'école, hérités des valeurs par défaut de l'inscription. En faire la source de vérité du menu aurait privé UCAD de **toutes** ses pages LMD.
- **Une combinaison n'est pas une valeur, c'est un ensemble.** Énumérer « elementaire_college », « elementaire_college_lycee »… demanderait quinze valeurs pour quatre paliers, et vingt-six pour cinq. Un tableau dit la même chose sans explosion.
- **Le besoin que la demande a révélé** : la bascule binaire **interdisait** à un établissement de couvrir l'élémentaire **et** l'université. Désormais il voit les **deux** jeux de pages — mesuré : 12 items scolaires + 13 items supérieur.
- **Comment le choix est rendu aisé** : les cas courants **en un clic**, formulés comme l'école les dit (« Élémentaire et Collège », « De l'Élémentaire à l'Université », « Université seule »…), et des **cases à cocher** juste en dessous pour tout cas particulier. Les deux sont le même état. Une phrase résume ce qui vient d'être déclaré, et un **trou dans l'échelle** (élémentaire + lycée sans collège) est **signalé sans être interdit** — une école peut fermer son collège le temps d'un chantier.
- **⚠️ Le repli est volontairement sûr** : NULL ou vide signifie « non déclaré », **jamais « aucun palier »**. Une école qui n'a rien déclaré continue de se comporter comme aujourd'hui. Un défaut à `'{}'` aurait vidé son menu — un écran blanc est une panne, pas une précaution. Et « déclaré » n'est pas « affiché » : on n'écrit pas à l'écran que l'école couvre le collège et le lycée alors qu'elle n'a rien dit.
- **`formation_pro` figure dans la liste bien qu'il n'ait pas été demandé** : le « Centre de formation professionnel de Diamniadio » existe en production et ne couvre **que** ce palier. L'omettre lui aurait laissé un ensemble vide, donc aucun menu.
- **Le vocabulaire et les pages sont deux questions distinctes.** Un établissement qui va de l'élémentaire à l'université a surtout des **élèves** : dire « étudiant » au préscolaire serait absurde, et les pages du supérieur portent déjà leurs propres intitulés. Seul un établissement **exclusivement** universitaire parle d'étudiants partout.
- **Pédagogie Montessori** (le cas de notre école pionnière au Sénégal) : le choix n'apparaît **que** si l'élémentaire est couvert — le demander à une université n'aurait aucun sens — et renvoie vers les **sous-niveaux** (mig. 164), qui servent exactement à dire le niveau réel d'un élève dans une classe TPS/PS. Choisir Montessori puis retirer l'élémentaire **vide** le champ, plutôt que d'y laisser une valeur qui ne veut plus rien dire.
- **Non-régression mesurée école par école** avec les données réelles : les sept établissements conservent **exactement** le même menu (48 items, 49 pour UCAD). 17 épreuves sur les paliers, dont celles qui verrouillent le repli et le cas UCAD. Suite complète : **219 vertes**.
- *Reste à faire* : l'inscription d'une nouvelle école ne demande pas encore ses paliers (elle naît « non déclarée », donc au repli sûr) ; le promoteur les renseigne ensuite dans Paramètres.

## [2.230.1] — migration **167** · 🔴 personne ne pouvait signer le procès-verbal
- **Défaut de la migration 166, trouvé en l'éprouvant avec de vraies sessions** — et il est de moi. `signer_conseil` était déclarée `SECURITY INVOKER`, et j'avais **délibérément omis toute policy d'INSERT** sur `conseil_signatures`, pour que la RPC reste le seul chemin d'écriture : un `with check` ne sait pas vérifier que le signataire pédagogique est responsable **du cycle** de la classe concernée.
- **Les deux décisions étaient justes séparément, et incompatibles ensemble.** En `SECURITY INVOKER`, l'INSERT de la fonction passe lui aussi par la RLS ; sans policy d'insertion, il est refusé — **y compris au signataire légitime**. Mesuré : `new row violates row-level security policy for table conseil_signatures` (42501) pour le responsable du bon cycle. Les contrôles de la fonction ne servaient à rien, puisque l'insertion n'arrivait jamais.
- **Pourquoi pas simplement ajouter une policy d'INSERT** : elle rouvrirait le trou qu'on fermait. Un `with check (profil_id = auth.uid())` laisserait n'importe quel membre insérer sa signature **directement par l'API**, en sautant le contrôle de cycle. La table reste donc fermée à l'écriture directe.
- La fonction passe en **`SECURITY DEFINER`** — cohérent avec la leçon de `_doc_peut_lire` (mig. 150), qui disait INVOKER « quand le métier de la fonction est d'**appliquer** la RLS ». Ici son métier est d'appliquer une règle que la RLS **ne sait pas exprimer**. ⚠️ Mais le DEFINER retire le filet du cloisonnement multi-tenant : il est **reposé à la main** (`v_ecole = ecole_courante()`), sans quoi un membre de l'école B signerait le PV de l'école A. `ecole_courante()` valant NULL pour un parent, il reste exclu.
- Le cas « j'ai déjà signé dans l'autre qualité » est désormais annoncé **en français** avant d'atteindre la contrainte d'unicité, qui aurait affiché une erreur Postgres brute (23505).
- **Le reste de la 166 est vérifié et conforme** : les 20 bulletins existants sont tous en « publié » (aucun parent n'a perdu l'accès) · un bulletin neuf naît en brouillon et **n'apparaît pas** chez le parent · publié, il apparaît et la **première** consultation est datée, la seconde ne la modifie pas · retiré, il disparaît · le cloisonnement par cycle refuse le responsable du préscolaire sur un PV d'élémentaire · le déclencheur refuse un changement d'état même par la clé de service · un parent n'accède ni au PV, ni aux signatures, ni aux responsables, et ne fait rien avancer.

## [2.230.0] — migration **166** · le bulletin suit un circuit, et le PV du conseil porte deux signatures
- **Points 6 et 7 de la visite.** Le bulletin devait suivre un circuit (brouillon → validé → publié, et savoir si le parent l'a consulté), et le PV du conseil de classe devait être signé par le **responsable pédagogique** *et* par le **responsable de la gestion** — « donc il faut 2 signatures ».
- **🔴 Ce que « publier » voulait dire jusqu'ici.** La fonction s'appelle `publierBulletins` et son commentaire disait « persiste les bulletins calculés → **visibles par les parents** ». Autrement dit : écrire un bulletin le rendait **aussitôt** visible, sans relecture possible. Le bouton « 📤 Publier aux parents » devient donc « 💾 Enregistrer les bulletins », et la diffusion est un acte distinct, réservé à la direction.
- **⚠️ L'ordre des opérations de la migration est critique.** Écrire `add column statut text not null default 'brouillon'` aurait mis **tous les bulletins existants en brouillon** — et fait disparaître d'un coup tous les bulletins que les parents consultent aujourd'hui. La colonne est donc ajoutée **nullable**, l'existant est repris en « publié » (c'est son état réel : il est visible), et le défaut n'est posé qu'ensuite, pour les lignes à venir. Même leçon que le défaut de `type_etablissement` : `add column` n'applique son défaut qu'aux nouvelles lignes.
- **⚠️ Et l'upsert de l'application n'envoie pas `statut`** — volontairement : `on conflict do update` ne touche que les colonnes transmises. **Régénérer un bulletin déjà publié conserve sa publication**, au lieu de le retirer des familles. Corriger une appréciation ne fait donc rien disparaître.
- **🔴 Faille trouvée en vérifiant la policy existante.** La migration 058 autorise l'**enseignant de la classe** à écrire dans `bulletins` — c'est normal, c'est lui qui renseigne les appréciations. Mais `statut` est une colonne comme les autres : sans garde, un enseignant pouvait écrire `statut = 'publie'` par un simple PATCH sur l'API et **diffuser lui-même les bulletins de sa classe**, sans passer par la direction. Le circuit n'aurait existé que dans l'écran. Un déclencheur garde cette seule colonne, sans toucher à la policy de la 058 : l'enseignant continue d'écrire notes et appréciations.
- **Pourquoi une table dédiée pour les responsables de cycle, et non une portée sur `profil_roles`.** Chez Tut'Tank il y a **deux** responsables pédagogiques — un pour le préscolaire, un pour l'élémentaire — et tout compte `direction` couvre l'école entière : le système ne savait pas lequel répondait de quel cycle. Or `profil_roles` est lu par `a_role()`, `est_gestion()`, `est_membre_ecole()` et la quasi-totalité des policies : y ajouter une portée aurait changé le sens de **chaque appel existant**, un risque large pour un besoin local. La désignation vit donc dans sa propre table, et se fait dans **Structure → Responsables de cycle**.
- **⚠️ `est_gestion()` n'est pas le bon prédicat pour la seconde signature.** Ce helper (mig. 011) vaut vrai pour `direction` : s'en servir aurait permis à un responsable pédagogique de fournir **les deux** signatures, et le « PV à deux signatures » n'en aurait exigé qu'une. Les rôles de l'espace Gestion sont donc nommés explicitement. Deux contraintes d'unicité portent le reste : une signature par qualité, et **une même personne ne peut pas poser les deux** — sans quoi un compte cumulant direction et gestion signerait seul.
- **Les signatures ne s'écrivent pas directement** : aucune policy d'insertion sur `conseil_signatures`, on passe par la RPC `signer_conseil`, qui vérifie que le signataire pédagogique est responsable **du cycle de la classe concernée** — ce qu'un simple `with check` ne saurait pas faire. Retirer **sa propre** signature reste permis : une signature posée par erreur doit pouvoir être reprise.
- **On avertit sans enfermer** : publier sans PV signé demande confirmation plutôt que d'être interdit. Un conseil reporté, un rattrapage, et l'école se retrouverait dans une impasse. Retirer un bulletin déjà publié prévient de ce que cela fait aux familles qui l'ont lu.
- **Une classe aux états mélangés n'est ni l'un ni l'autre**, et l'écran le dit. Afficher « publié » parce que la majorité l'est ferait croire que tous les parents voient le bulletin de leur enfant — faux pour certains, et l'on ne le découvrirait qu'au reproche d'un parent.
- « Consulté » n'est pas un quatrième état mais un fait daté : la **première** ouverture par le parent est horodatée, les suivantes ne changent rien — écrire à chaque lecture aurait fait un UPDATE par affichage de page.
- **La grille de consentement de la migration 114 est conservée telle quelle** (`_parent_possede` puis `_acces_notes_autorise`) : c'est elle qui protège contre « un parent voit les notes d'un autre enfant ».
- 12 épreuves sur la logique du circuit et des signatures. Suite complète : **202 vertes**.

## [2.229.0] — 🔴 la feuille de présence était inutilisable pour les responsables pédagogiques
- **Remonté par l'école** : « au préscolaire et à l'élémentaire, ce sont les **responsables pédagogiques qui se substituent aux enseignants** — tout le travail de ces derniers sera fait par eux. »
- **🔴 Défaut trouvé en vérifiant cette information.** Sur les sept pages de classe, **« Feuille de présence » était la seule** à ne prévoir aucune branche pour la direction : elle ne chargeait les classes **que si une fiche enseignant existait**. Un responsable pédagogique n'y voyait donc **aucune classe** et ne pouvait pas faire l'appel — la tâche la plus quotidienne de l'établissement. Les six autres pages (Notes, Bulletins, Cahier de textes, Progression, Assiduité, Vie scolaire) traitaient déjà le cas.
- Et le message affiché était une **impasse** : « demande à l'administration de renseigner ton e-mail dans RH → Enseignants » — adressé à la personne qui *est* l'administration. Il ne s'affiche plus qu'à un enseignant.
- L'**enregistrement** fonctionnait déjà sans fiche enseignant (il horodate l'utilisateur connecté, pas l'enseignant) : seul le chargement des classes bloquait. La correction est donc **minimale et sans migration**.
- La **feuille imprimée** nommait « L'enseignant(e) » au-dessus du trait de signature quand aucune fiche n'existait. Elle porte désormais le nom de la personne qui a réellement fait l'appel.
- **Vérifié en base, rien d'autre ne bloque** : `peut_noter_evaluation`, `peut_editer_bulletin` et les policies de la migration 058 commencent toutes par `est_gestion()`, qui inclut `direction`. Un responsable pédagogique peut donc créer les évaluations, saisir les notes et établir les bulletins sans fiche enseignant.
- **⚠️ Conséquence à connaître** : lorsqu'un responsable pédagogique fait tout le travail, il saisit les notes, établit les bulletins, signe le PV au titre pédagogique **et** peut les publier. La **signature de la gestion** sur le procès-verbal devient alors le seul regard extérieur de la chaîne — c'est exactement ce que l'exigence « 2 signatures » préserve.
- Suite complète : **202 vertes**.

## [2.228.0] — migration **165** · la programmation officielle de l'IEF, chargée depuis son document Word
- **Demandé après la visite (point 15)** : « l'enseignant devrait pouvoir **réutiliser** les éléments de programmation plutôt que les ressaisir ». L'école a fourni le document source — la planification mensuelle de l'IEF de Sangalkam — et confirmé qu'il s'agit du modèle **officiel**, de forme stable, rattaché à un **cours** (un niveau) et non à une classe.
- La direction dépose le `.docx` ; l'écran le lit, **montre ce qu'il a compris**, et n'enregistre qu'après confirmation. L'enseignante retrouve ensuite ces contenus dans **Cahier de textes → « Reprendre la programmation »**, et le texte reste **modifiable** : la planification de l'IEF décrit un objectif, pas le déroulé d'une séance.
- **🔴 Le document contredit son propre nom de fichier.** Celui qui nous a été remis s'appelle « CE1 juin » et contient du **CM1 d'avril** — zéro occurrence de « CE1 » ou de « juin ». Se fier au nom aurait rangé le programme dans la mauvaise classe **et** le mauvais mois, pour toute l'année. C'est **l'en-tête qui fait foi**, et le niveau comme le mois sont **toujours confirmés à la main**, même quand l'en-tête les annonce.
- **⚠️ Ce que la lecture du vrai document a corrigé dans ma première version** — sept défauts, tous trouvés en éprouvant l'analyseur sur le fichier de l'école plutôt que sur un exemple inventé :
  - **un seul tableau porte tout le mois**, 81 lignes et **quatre domaines** (Langue et communication, Mathématiques, ESVS, EPSA). Je supposais un domaine par tableau : les mathématiques se rangeaient sous le français ;
  - le changement de domaine s'écrit de **deux** façons, et le marqueur de sous-domaine de **quatre** (« Sous-domaine 1 », « Sous -domaine 2 », « SOUS-DOMMAINE 1 » avec deux M, « SOUS DOMAINE 2 » sans tiret) ;
  - les titres en capitales internes (« LECTURE », « PRODUCTION DE TEXTES ») sont des **rubriques**, pas des sous-domaines : les promouvoir faisait **disparaître** « COMMUNICATION ECRITE » ;
  - des cellules sont **fusionnées** : une ligne de 2 cellules dans un tableau de 5 colonnes ne dit pas quelle semaine elle couvre. D'où `semaine` **nullable** = « tout le mois ». Inventer une semaine 1 faisait passer un **palier de 183 caractères** — l'intention pédagogique du mois — pour une séance ;
  - une cellule remplie **seule** est un titre dans la colonne de gauche mais un **contenu** dans une colonne de semaine : la confondre faisait **taire complètement** les mathématiques et l'ESVS, sans la moindre erreur ;
  - le même contenu est recopié dans **neuf** cellules fusionnées : sans dédoublonnage, l'aperçu devient illisible et l'enseignante ne peut plus juger de la lecture ;
  - le document laisse quatre fois « Palier » **nu**, sans énoncé : un palier sans énoncé n'apprend rien, on l'écarte au lieu d'en faire une activité nommée « Palier ».
- **Lecture du `.docx` sans DOM**, à dessein : `DOMParser` n'existe pas sous Node, l'extraction n'aurait été éprouvable que dans un navigateur — donc en pratique jamais. Écrite en pur texte, elle se **teste sur le vrai document**, et c'est précisément ce qui a révélé les cellules fusionnées. `jszip` est chargé **à la demande** (97 ko isolés dans leur propre fragment, jamais servis à qui n'importe rien).
- **Sécurité.** Lecture = tout le personnel de l'établissement (les enseignantes en ont besoin, c'est le but) ; **écriture = promoteur et responsable pédagogique seulement**, côté **base** comme côté écran. La planification d'un niveau est **partagée** par ses classes : si chaque enseignante pouvait la réécrire, celle de CM1 A écraserait celle de CM1 B. Deux contrôles que la RLS seule ne voit pas ont été ajoutés dans la fonction d'import : l'**année scolaire doit appartenir à l'école du niveau** (sinon on accrocherait sa programmation à l'année d'un autre établissement), et un **domaine répété** dans la même charge utile est refusé explicitement — le `delete` de remplacement aurait effacé le bloc précédent et seul le dernier aurait survécu, en silence.
- **Import atomique** : tous les domaines du mois en une seule transaction. Un appel par domaine laisserait, en cas d'échec au troisième, un mois à moitié importé que personne ne remarquerait. Réimporter **remplace** domaine par domaine, n'empile pas ; un domaine absent du nouvel import garde son ancienne version.
- **Rien n'est imposé** : tant que la direction n'a rien importé, le cahier de textes est identique à avant — le bouton n'apparaît même pas. Le lien d'une séance vers sa ligne officielle est **facultatif** (séance improvisée, rattrapage, sortie), et supprimer une programmation **conserve** les séances qui la citaient.
- **29 épreuves** sur le document réel (`test/programmationIEF.test.mjs`, `test/docxTableaux.test.mjs`), dont une qui échoue si **un seul domaine devient muet** — le défaut le plus dangereux, parce qu'il ne produit aucune erreur. Suite complète : 190 vertes.

## [2.227.0] — migration **164** · le niveau réel d'un élève dans une classe multi-niveaux
- **Remonté en visite** : chez Tut'Tank, « TPS/PS A » est **une** classe qui contient des élèves de TPS **et** de PS — c'est le système Montessori, et « CI/CP » fonctionne pareil. Le système ne savait pas le dire : le niveau d'un élève était celui de sa classe, et l'école contournait en créant des niveaux **combinés**.
- **⚠️ Pourquoi je n'ai pas simplement ajouté TPS et PS dans `niveaux`.** Parce que `niveaux` n'est pas qu'une nomenclature pédagogique : **six** objets s'y accrochent — la grille tarifaire (`frais`), les coefficients de matière, les volumes horaires, les fournitures, le ciblage des annonces (mig. 152) et celui des textes de référence (mig. 159). Y insérer TPS et PS les ferait apparaître dans six écrans de sélection, et **un tarif posé sur « TPS » au lieu de « TPS/PS » ne s'appliquerait plus à personne**. Le défaut aurait été silencieux et coûteux.
- On sépare donc deux notions que l'école confond par commodité : le **niveau de la classe** — unité de tarif, de programme, de fournitures — et le **sous-niveau de l'élève**, sa place réelle dans cette classe.
- **Fonctionnalité opt-in** : un niveau sans sous-niveaux se comporte exactement comme avant. Rien ne change pour les six autres écoles, ni pour les niveaux simples de Tut'Tank. Le champ n'apparaît même pas à l'inscription. Et aucune inscription existante n'est modifiée.
- **⚠️ L'intégrité qu'une clé étrangère ne sait pas dire.** Une FK garantit que le sous-niveau existe, pas qu'il appartient au niveau de la classe de l'élève : sans contrôle, on pourrait inscrire un élève de CI/CP au sous-niveau « TPS » — cohérent pour Postgres, absurde pour l'école. Un déclencheur le refuse, et il écoute aussi `classe_id` : déplacer un élève vers une classe d'un autre niveau sans vider son sous-niveau est rejeté. Même leçon que les clés composites de l'audit bibliothèque (mig. 127).
- Retirer un sous-niveau ne perd rien : les inscriptions concernées reprennent le niveau de leur classe (`on delete set null`), et la confirmation le dit.
- Écriture réservée aux mêmes rôles que « Niveaux & classes » et que les dates de période ; lecture ouverte à tout membre, y compris les parents via les RPC.
- Le niveau réel s'**affiche** dans l'historique d'inscriptions et l'en-tête de la fiche élève — saisi sans être lu, il n'aurait servi à rien. 6 tests, dont celui qui vérifie qu'un niveau simple ne propose **aucun** choix.
- Hors périmètre, assumé : la création d'élèves **en masse** (import, écran Élèves) n'affecte pas de sous-niveau. Il se renseigne depuis la fiche de l'élève, où le contexte est clair.

## [2.226.0] — migration **163** · les absences sur le bulletin, à partir du collège
- Demande de l'école, à la lettre : afficher le nombre d'absences **dès le collège**, et **pas** au préscolaire ni à l'élémentaire — « la logique doit être basée sur le niveau scolaire et non codée en dur dans plusieurs composants ».
- **⚠️ Et elle l'aurait été.** Le bulletin s'imprime depuis **deux composants distincts** : `BulletinImprimable` côté personnel, et un composant inline dans l'espace parent. Y écrire deux fois « si le cycle n'est pas préscolaire… », c'est garantir qu'un jour les deux divergeront. La règle vit en base (`bulletin_affiche_absences`), et les deux côtés la **consomment** sans la redériver.
- **Exclusion plutôt qu'inclusion** : on n'énumère pas les cycles qui affichent, mais les deux qui n'affichent pas. Un cycle ajouté demain — technique, professionnel — héritera du comportement attendu sans qu'on y pense.
- **⚠️ Une période sans dates ne donne pas zéro, elle ne donne rien.** Compter « 0 absence » sur une période qu'on ne sait pas borner serait un mensonge, et le pire : celui qui rassure. Les compteurs valent `NULL`, et les deux écrans affichent alors « absences non comptabilisées », en renvoyant au Découpage de l'année.
- Côté personnel, **un seul appel pour toute la classe** : une requête par élève aurait été le patron N+1 que l'audit de performance a déjà corrigé ailleurs. On passe d'un bulletin à l'autre sans relancer de requête.
- Le comptage distingue les absences **justifiées**, et le bulletin du personnel ajoute les retards — l'information existe, autant la rendre.

## [2.225.0] — migration **162** · dater les périodes, et restreindre qui le peut
- **Prérequis du point 9**, découvert en le préparant : compter les absences *d'un trimestre* suppose de savoir quand il commence et finit. Or **17 des 20 périodes en base n'ont aucune date**, et `periodes` n'était **jamais écrite** par l'application — aucun écran ne permettait de les saisir, elles naissent nulles à l'ouverture de l'année.
- Un panneau **« Découpage de l'année »** rejoint Structure académique, à côté des niveaux et des matières. Les dates restent facultatives : une école peut ne renseigner que le trimestre en cours.
- **🔴 Et en vérifiant les droits, un second défaut.** `periodes` ne portait que la policy générique de la migration 001 (`ecole_id = ecole_courante()`) : la 018 lui avait oublié ses policies par rôle. Mesuré avec de vraies sessions — le **responsable RH pouvait modifier le calendrier scolaire**, tout comme le comptable, le secrétaire, le surveillant et l'enseignant. Les parents étaient bien exclus (`ecole_courante()` est NULL pour eux) : pas de fuite vers les familles, mais une violation du moindre privilège — et je n'allais pas poser un écran de saisie par-dessus.
- Le découpage de l'année devient un acte de **structure académique** : mêmes rôles que « Niveaux & classes ». La **lecture reste ouverte** à tout le personnel, dont notes, bulletins et progressions dépendent.
- Garde-fous : une contrainte refuse une période dont la fin précède le début, et l'écran **signale les chevauchements sans bloquer** — deux trimestres qui se recouvrent compteraient deux fois la même absence, mais une école peut avoir une raison que nous ignorons. 6 tests, dont le cas des périodes incomplètes qu'il ne faut **pas** signaler à tort.

## [2.224.0] — migration **161** · plusieurs enseignants par classe, et l'enseignant « toutes matières »
- **Remonté en visite** : au préscolaire, une classe de TPS/PS compte jusqu'à **trois maîtresses**, et chacune enseigne l'ensemble des domaines. Au collège, l'affectation reste enseignant → matière → classe. Le modèle doit porter les deux.
- **Correction de mon propre audit** : j'avais écrit que plusieurs enseignants par classe étaient impossibles. C'est faux — **12 classes sont déjà dans ce cas**, en se répartissant des matières différentes. Le modèle collège fonctionne. Ce qui était impossible, c'est le cas Montessori : des maîtresses qui ne se répartissent rien et font tout, ensemble.
- **Deux verrous, dont un seul était visible.** `matiere_id NOT NULL` interdisait d'affecter une maîtresse « pour tout » (0 ligne de ce type en base, et pour cause). Et `unique (classe_id, matiere_id, annee_id)` n'autorisait **qu'un seul enseignant par matière** : deux maîtresses se partageant le Langage étaient refusées. Cette contrainte faisait de l'affectation une propriété de la **matière**, alors qu'elle décrit un lien entre une **personne** et une classe.
- `matiere_id` à NULL signifie désormais « toutes les matières de cette classe ». Deux index partiels remplacent la contrainte et n'interdisent plus que le **doublon pur** : le même enseignant, deux fois, sur la même classe et la même matière. Les **134 affectations existantes sont intactes** — on ne fait que lever des interdits.
- **🔴 Le point le plus délicat était invisible depuis l'interface.** `enseigne_classe_matiere()` exigeait `a.matiere_id = p_matiere` : une maîtresse affectée sans matière aurait obtenu la classe mais se serait vu **refuser notes, bulletins et cahier de textes**. La fonctionnalité aurait semblé livrée sans marcher. Une affectation sans matière couvre maintenant toutes les matières, comme le professeur principal.
- **Quatre lectures du front adaptées**, chacune pour une raison distincte : la carte des matières d'un enseignant (où pousser `null` aurait privé la maîtresse de **toutes** ses matières — l'exact contraire de l'intention), le repli de coefficient des bulletins, la génération d'emploi du temps, et l'écran d'affectation.
- **`creerAffectation` passe d'un `upsert` à un `insert`**, parce que le sens de l'acte a changé : l'upsert sur (classe, matière, année) **remplaçait silencieusement** le collègue déjà affecté. Maintenant qu'une matière peut être partagée, affecter doit **ajouter** — remplacer quelqu'un sans le dire serait une perte de donnée déguisée en commodité.
- 6 tests sur la règle « toutes matières », dont celui des trois maîtresses d'une même classe.

## [2.223.0] — aucune migration · feuille de présence imprimable
- La feuille du jour s'imprime désormais **telle qu'elle a été saisie**, avec logo, effectifs et emplacements de signature pour l'enseignant et la direction.
- Elle **complète** le registre vierge déjà imprimable depuis la liste d'élèves : ici les états sont renseignés, là-bas les colonnes sont à cocher au stylo. Les deux usages existent, l'école choisit.

### 🔴 Blocage découvert : les absences au bulletin ne peuvent pas être calculées
- Le point « afficher les absences sur le bulletin à partir du collège » supposait de compter les absences **sur la période**. Or **17 des 20 périodes en base n'ont aucune date** (`date_debut` et `date_fin` à NULL), et `periodes` n'est **jamais écrite** par l'application : aucun écran ne permet de saisir ces dates, elles naissent nulles à l'ouverture de l'année scolaire.
- Livrer la fonctionnalité maintenant produirait un bulletin qui n'affiche rien pour 17 périodes sur 20, **sans que l'école puisse y remédier**. Afficher « 0 absence » serait pire : un mensonge, là où l'information n'existe pas.
- Le prérequis est donc la **saisie des dates de période** — un écran absent, que mon audit avait manqué en classant ce point en « migration légère ». Il est reclassé.

## [2.222.0] — migration **160** · lot 2 (partiel) : évaluations, WhatsApp, fournitures

### 🔴 Supprimer une évaluation aurait effacé ses notes, sans retour
- La capacité n'existait pas dans l'interface, mais **un fusil chargé l'attendait dans la couche métier** : `supprimerEvaluation()` faisait un `delete` brut, sans aucun appelant. Or `notes.evaluation_id` est en **`on delete cascade`** (migration 001) : y brancher un bouton aurait suffi à perdre un trimestre. Mesuré : **28 évaluations sur 31 portent des notes**, 171 notes au total.
- Règle retenue : **une évaluation notée ne se supprime pas, elle s'archive.** Seule une évaluation vierge — créée par erreur — part réellement. Le refus indique **combien** de notes bloquent : un refus qui n'explique pas pousse à chercher un contournement.
- **Archiver a un effet réel sur les moyennes**, sinon le mot serait creux : `getEvaluations()` est le seul chemin vers les évaluations, pour la saisie comme pour `calculerBulletins()`. Y filtrer `actif` suffit. Les notes restent en base, et réactiver rend exactement la moyenne d'avant.
- **Les deux RPC sont en `SECURITY INVOKER`, volontairement** : leur rôle est d'ajouter une règle métier, pas de contourner la RLS. Le droit d'écrire sur `evaluations` est déjà défini (migration 018) et l'enseignant est cloisonné à ses classes (migration 058) ; en `SECURITY DEFINER` ces deux garde-fous sauteraient — le défaut attrapé sur `_doc_peut_lire` en migration 150. On contrôle `found` : si la RLS masque la ligne, l'opération le **dit** au lieu de réussir en silence.

### Annonce → WhatsApp : prévenir, pas transporter
- Le message relaie **le titre et un lien vers l'espace parent**, jamais le contenu ni les pièces jointes. Une annonce peut être ciblée par classe, niveau ou cycle, et ses pièces jointes ont un accès contrôlé en base (migrations 152, 159) : la recopier dans WhatsApp la sortirait de ce contrôle, la rendrait transférable à n'importe qui, et l'école perdrait ce qui fait foi.
- Sans numéro de destinataire : WhatsApp ouvre le sélecteur de contacts, parce qu'une école relaie dans un groupe de classe qu'aucun numéro ne désigne.

### Fournitures : consultation par classe et liste pour les familles
- Filtre **par classe** — le parent raisonne en classe, l'école range par niveau ; la classe se résout vers son niveau, sans colonne supplémentaire.
- **« Tous niveaux » accompagne toujours** un filtre de classe : ces articles concernent tout le monde, et les omettre donnerait une liste incomplète — l'oubli se paierait à la rentrée.
- **Impression destinée aux familles**, avec logo, quantités, articles optionnels et mention « fourni par l'école » — celle qui évite d'acheter deux fois.

### Attrapé par le garde-fou
- `Annonces.jsx` utilisait `ecole?.nom` sans que `ecole` soit destructuré de `useAuth()`. `vite build` passait ; `test/identifiants.test.mjs` a nommé la ligne exacte. Exactement le défaut qui avait fait exploser la page Annonces en 2.211.2 — cette fois il n'a pas atteint la production.

## [2.221.0] — aucune migration · lot 1 de la visite d'établissement
Suite à une visite sur site, 17 besoins ont été audités avant toute modification. Ce lot livre les corrections sans risque ; les évolutions de schéma suivront par lots séparés.

### 🔴 Perte de données en production : refaire la feuille de présence effaçait les justifications
- `enregistrerAppel` faisait un **DELETE** de toutes les absences de la classe pour la journée, puis un **INSERT** avec `statut: 'non_justifie'`. Un second passage, une correction, ou deux personnes qui saisissent la feuille **remettaient à zéro le travail du secrétariat** : le statut repassait à « non justifié » et la justification déposée par le parent (migration 024) disparaissait. Silencieux, irréversible.
- L'enregistrement procède désormais par **différence**, ce qui le rend **idempotent** : rejouer la même feuille ne produit aucune écriture, et une erreur réseau en cours de route se répare en recommençant — c'est cette propriété qui remplace l'atomicité, sans migration.
- Trois garanties nouvelles, chacune testée : `statut` et `justification` ne sont **jamais** touchés par l'appel (ils appartiennent au circuit de justification) ; passer d'absence à retard **modifie** la ligne au lieu de la recréer ; un élève **hors de la feuille** — désinscrit, ou absent via une autre classe ce jour-là — n'est plus emporté par un DELETE global. 8 tests.

### 🔴 Un jour perdu sur les échéances d'emprunt à l'ouest de Greenwich
- Trouvé parce que la suite est passée au rouge : `versISO()` repassait par `versDate()`, qui lit les composantes **locales** d'un `Date` déjà positionné à minuit **UTC**. Toute échéance calculée était donc décalée d'un jour en fuseau négatif.
- Le Sénégal (UTC+0) et la RDC (UTC+1) n'étaient pas touchés — d'où un défaut resté dormant depuis la migration 118, révélé par le fuseau de la machine de build. La suite est maintenant vérifiée en UTC−3, UTC+0 et UTC+13.

### Évolutions du lot
- **« Appel » devient « Feuille de présence »** dans le menu, la page et l'onglet de Vie scolaire. Le responsable pédagogique y avait **déjà** accès (`ACCES.appel`) : rien à ouvrir.
- **Pas de 15 minutes** sur les saisies horaires de l'emploi du temps (classes et supérieur) et sur l'éditeur de la grille de créneaux. **Pourquoi 15 et non un réglage 15/30** : un pas de 15 permet d'écrire 08:00–08:30 *comme* 08:00–08:15, donc les deux granularités demandées, alors qu'un pas de 30 interdirait les créneaux courts et invaliderait 140 créneaux déjà saisis. Vérifié : 100 % des créneaux existants tombent déjà sur un multiple de 15.
- **Le nombre d'absences devient cliquable** dans Assiduité, et ouvre le détail : date, type, horaire, motif, état de justification. Aucune requête supplémentaire — les lignes brutes étaient déjà chargées. Le filtre par période existait déjà.
- **Récapitulatif imprimable** des absences de la période (« Absences du 1er trimestre » se fabrique en choisissant les dates), avec en-tête à logo et emplacements de visa, sur le patron d'impression de la liste d'élèves.
- **Logo de l'établissement** ajouté aux impressions des codes d'accès parents et étudiants — des feuilles qui circulent entre les mains des familles et ne portaient aucun repère.

## [2.220.0] — migration **159** · le rayon réglementaire porte une audience
Deux corrections de l'utilisateur ont conduit ici, et **la seconde a renversé la première conclusion**. Le récit compte, parce qu'il explique la forme du correctif.

- **« Tut'Tank a bien publié son règlement intérieur »** — exact. Il est en pièce jointe d'une annonce du 28/09, ciblée sur le cycle **Élémentaire**. Mon audit voyait la tuile « Règlement » vide et en concluait qu'aucune école n'avait rien publié : constat juste, **cause fausse**.
- **« Mais le préscolaire ne doit pas voir ce règlement, qui n'appartient qu'à l'élémentaire »** — et là tout change. Le ciblage n'était pas un défaut, c'était une **décision** : un établissement peut avoir un règlement par cycle. J'avais d'abord écrit une 159 qui versait le document « à toutes les familles » ; elle aurait violé l'intention de l'école. Elle n'était pas encore appliquée, elle est donc corrigée à la source plutôt que rattrapée par une 160.
- **Ce qui était fautif, c'était le rayon.** « Textes de référence » ne savait publier qu'en tout-ou-rien — `portee = 'familles'` ⇒ visible de tous les membres. Le vrai manque n'était pas une porte entre les deux endroits, c'est que le rayon **ignorait la notion d'audience** que les annonces possèdent depuis la migration 152.
- **Un texte de référence reçoit donc le même vocabulaire de ciblage qu'une annonce** : tout l'établissement, un cycle, un niveau, une classe. Le règlement de l'Élémentaire se range sur l'étagère, consultable en permanence — par les familles de l'Élémentaire, et par elles seules.
- **Et la règle n'est pas recopiée une cinquième fois.** L'en-tête de la 152 prévient qu'elle vit à quatre endroits ; elle est désormais **sortie dans `_public_vise()`**, que `_annonce_visible_par()` et le rayon appellent tous deux. Une règle, deux appelants, au lieu de deux copies qui divergeront. La recette de la 152 est rejouée après application pour prouver que le comportement des annonces est inchangé.
- **L'audience est un paramètre obligatoire** de `verser_au_rayon()`, pour qu'on ne puisse pas publier à tout le monde par omission ; et la modale la **préremplit depuis l'annonce** — le règlement d'un cycle se range sur ce cycle sans qu'on ait à s'en souvenir. La RPC refuse une catégorie hors rayon, une audience ciblée sans entité, et une entité appartenant à une autre école : un ciblage silencieusement faux rendrait le texte invisible partout, ce qui est pire qu'un refus.
- **Rétrocompatibilité** : `cible` reste `NULL` sur les textes déjà publiés, et `_public_vise` traite `NULL` comme « toute l'école » — leur audience ne change pas.
- « Retirer du rayon » remet la portée à « interne », rend à une pièce jointe sa catégorie d'origine et remet le ciblage à zéro. Sans ça elle sortirait du rayon en restant classée « règlement » : invisible partout.
- **Prévention** : joindre un fichier à une annonce **ciblée** avertit désormais que la pièce ne parviendra qu'aux familles visées, et renvoie au rayon.
- Détail d'implémentation qui évite une page cassée : les libellés d'audience sont résolus **côté écran** et non par un embed `classes(libelle)` sur `fichiers_ecole`. Ces clés étrangères n'existent qu'après la migration, et un embed sur une relation absente fait échouer *toute* la requête (PGRST200) — la Documentation serait tombée entre le déploiement et l'application.
- **Parti d'une correction de l'utilisateur** : Tut'Tank *avait* publié son règlement intérieur, contrairement à ce que mon audit concluait. Vérifié : il est bien là, en pièce jointe d'une annonce du 28/09 — **ciblée sur le cycle Élémentaire**. Mon constat (« la tuile Règlement est vide ») était exact ; ma cause était fausse.
- **Ce que la vérification a révélé**, et qui valait mieux que mon constat d'origine :

| Cycle | Élèves inscrits | Reçoit le règlement |
|---|---|---|
| Élémentaire | 51 | ✅ |
| Préscolaire | **45** | ❌ |

- Les quatre parents qui ont un compte ont tous un enfant en Élémentaire, donc l'ont reçu — **par chance**. Et le document n'apparaissait dans aucune étagère consultable : une annonce se lit une fois, un règlement se consulte pendant des années.
- **Ce n'était pas un défaut, c'était ma conception, et elle était trop raide.** Les migrations 150/151 ont posé deux endroits distincts, et ma **153** a exigé `annonce_id is null` pour la portée « familles ». Je fermais un vrai trou — une pièce jointe d'annonce ciblée qui, marquée « familles », fuyait au-delà de son audience. Mais je confondais **une portée posée par accident** (le trou) et **une portée posée volontairement par l'école** (une décision de publication légitime). Dans le second cas l'annonce reste ciblée ; seul le document devient public. C'est exactement ce qu'on attend d'un règlement : annoncé à une classe, opposable à tous.
- **Comment distinguer l'accident de l'intention, puisque la base ne voit qu'une valeur de colonne ?** Par un **double verrou** que seule une démarche explicite franchit : la portée « familles » *et* une catégorie du rayon réglementaire — or `televerserFichier` force `'interne'` et `'annonce'` sur toute pièce jointe. Deux champs, deux gestes, aucun par défaut. La RPC `verser_au_rayon()` les pose ensemble sous contrôle de rôle : c'est la seule porte.
- **Dans la Documentation** : une action « ⚖️ verser au rayon » sur chaque fichier, qui demande la nature du texte, sa référence et sa date ; et « retirer du rayon » sur les textes publiés — dépublier par erreur doit se défaire sans passer par l'éditeur SQL. Un retrait rend à une pièce jointe sa catégorie d'origine, sinon elle resterait classée « règlement » tout en sortant du rayon : invisible partout.
- **Prévention, pour que le prochain règlement ne reparte pas sur un seul cycle** : en joignant un fichier à une annonce **ciblée**, la composition avertit désormais que la pièce ne parviendra qu'aux familles visées, et renvoie au rayon. L'école avait fait le geste évident ; rien ne l'en avertissait.

## [2.219.0] — migration **158** · audit de l'espace parent : trois corrections
Audit demandé sur l'espace parent, en particulier la logique des menus à la première connexion. Tout ce qui suit a été constaté dans le code ou avec de vraies sessions parent.

### 🔴 Messagerie : un fil par personne, non par fiche
- **Mesuré sur de vraies sessions** : **Idrissa KANE**, 4 fiches tuteur pour 4 enfants de la même école, voyait **4 boutons tous intitulés « Tut'Tank »**, indiscernables. **Tahirou SEYE**, 3 fiches pour 1 enfant, voyait 3 onglets dont deux pour des écoles où il n'a aucun enfant. Et le miroir existait côté école : `ecole_conversations()` listant les fiches, Idrissa y apparaissait **quatre fois sous le même nom**.
- **Ce n'est pas un défaut d'affichage mais un défaut de clé.** Le fil était identifié par la fiche tuteur, or une fiche est créée par élève **et** par responsable — c'est le principe même des codes d'accès. Les échanges se répartissaient donc entre les fiches : l'école répondait dans un fil, le parent regardait dans un autre.
- La clé devient la **personne dans une école**. Un parent parle à un établissement, pas à une fiche.
- **Aucune donnée n'est déplacée** : les messages restent attachés à leur fiche, on change la façon de les regrouper. L'écriture se fait sur une fiche canonique — la plus ancienne — et **les deux côtés écrivent au même endroit**, sinon le fil se rescinderait par le bas.
- Le versant école nomme désormais **les enfants concernés** : le secrétariat parlait quatre fois au même « Idrissa KANE » sans savoir duquel il s'agissait.
- ⚠️ Les noms de paramètres changent (`p_tuteur` → `p_ecole`, et un `p_parent` côté école). PostgREST résout les RPC **par nom** : l'ancien appel répond 404, pas 403. Front et base sont modifiés dans le même lot, et les anciennes signatures supprimées pour ne pas laisser deux surcharges ambiguës. Le lien profond de la fiche élève passe de `?tuteur=` à `?parent=`. Le volet **étudiant** n'est pas touché : sa clé est l'élève, un étudiant majeur n'a qu'un fil.

### 🔴 La visite guidée ratait son étape principale
- Elle s'ouvrait après un délai **devinné de 700 ms**, indépendamment du chargement. L'étape « Vos enfants » cible une ancre qui n'existe pas encore pendant le chargement, et `Tour` saute alors l'étape **en silence** — l'étape la plus importante, à la seule occasion où elle compte. La migration 157 avait aggravé le risque en ralentissant `mes_enfants()`.
- Elle attend maintenant que l'ancre existe, avec un plafond de 8 secondes pour qu'un parent sans enfant rattaché ait quand même le guide. Et elle ne s'ouvre plus que sur l'accueil : trois de ses cinq étapes visent le contenu de cette page.

### Les tuiles dupliquaient l'en-tête sans en porter les signaux
- **« Mon compte » est retirée** des tuiles, comme signalé : c'est un réglage qu'on ouvre une fois, la roue dentée de l'en-tête suffit, et une tuile de la taille de « Messages » lui donnait une importance qu'elle n'a pas.
- **Les pastilles de non-lus passent sur les tuiles.** Elles n'étaient que sur les icônes de l'en-tête, minuscules sur téléphone — là où se trouve l'essentiel du public parent. Le chemin visible ne signalait rien, le chemin qui signale était presque invisible. Les compteurs sont transmis par la coque, déjà chargés : aucune requête de plus.

### Constaté, non corrigé
- La tuile **« Règlement » mène à une page vide pour tous les parents** : `textes_reference()` renvoie 0 texte, `fichiers_ecole` étant vide dans toute la base. C'est un manque de contenu, pas de code — aucune école n'a encore publié son règlement intérieur.
- L'état « aucun enfant » n'est **pas atteignable en pratique** : on entre dans l'espace parent par un code enfant, donc toujours avec au moins un enfant. L'écran vide est un filet, pas la première connexion — utile à savoir avant d'y investir du travail.

## [2.218.0] — migration **157** · les annonces appartiennent à l'enfant, pas à l'accueil
- **Demandé** : sur le profil parent, que les annonces soient liées à l'enfant et ne s'affichent pas dès l'ouverture de l'application. L'accueil présentait la liste complète, toutes écoles confondues, avant même d'avoir choisi un enfant.
- **La liste a quitté l'accueil** ; elle reste dans la page de chaque enfant, où elle était déjà cadrée sur son établissement, sa classe, son niveau et son cycle.
- **⚠️ Mais les retirer sans rien mettre à la place les rendait invisibles.** Vérifié : il n'existe **aucun déclencheur sur `annonces`** — publier une annonce ne crée pas de notification, et la migration 146 le disait déjà (« les annonces ne se dupliquent pas »). L'accueil **était** le mécanisme de distribution. Sans repère, l'école aurait publié une circulaire que personne n'ouvrirait, faute de savoir qu'elle existe.
- **Un compteur sur la carte de chaque enfant** — « 📣 2 annonces » — indique où il y a du nouveau. Il porte sur les **7 derniers jours**, parce qu'il n'existe pas d'état « lu » sur les annonces, contrairement aux notifications : un total resterait affiché pour toujours dès la première publication, ce qui serait du bruit, pas un signal. Une fenêtre s'efface d'elle-même et répond à la seule question utile. Un vrai état de lecture serait plus juste, mais c'est un autre chantier.
- **La règle de visibilité n'a pas été recopiée une cinquième fois.** La migration 152 prévient qu'elle vit déjà à quatre endroits ; `mes_enfants()` **appelle** `annonces_enfant(e.id)`, qui reste la seule source — le compteur ne peut donc pas montrer une annonce que la page ne montrerait pas, ni l'inverse. Elle revérifie au passage l'appartenance de l'enfant, redondant ici mais c'est ce qu'on attend d'un contrôle d'accès.
- Ménage : `annoncesParent()` et `annoncesParEcole()` n'avaient plus aucun appelant, ils sont retirés. La RPC `annonces_parent()` **reste en base**, dormante : elle porte l'une des quatre écritures de la règle, son retrait mérite sa propre migration et non un effet de bord.
- Les quatre tests d'`annoncesParEcole` sont remplacés par cinq sur le **ciblage** de la migration 152, qui n'en avait aucun : chaque cible exige la bonne entité, n'en renseigne qu'une, et sait la nommer — y compris quand la jointure revient vide, où « Une classe » vaut mieux qu'une pastille muette.

## [2.217.0] — aucune migration · 🔴 Journal des actes : la page ne s'ouvrait pas
- **Signalé** : « Could not find a relationship between `journal_audit` and `utilisateur` in the schema cache ». La page était **inutilisable depuis sa création** — pas dégradée, inaccessible.
- **Cause** : `journal_audit.utilisateur` est un uuid **sans clé étrangère** vers `profils` (migration 079), et un embed PostgREST exige une relation déclarée. Vérifié en base avant de conclure : la relation n'existe bien nulle part.
- **La clé étrangère était la correction évidente ; je ne l'ai pas ajoutée.** En `on delete set null`, supprimer un compte effacerait l'auteur de **tous** ses actes passés — la seule chose qu'un journal d'audit ne doit jamais perdre. En `restrict`, plus aucun compte ne serait supprimable. L'uuid nu survit à la disparition du profil : c'est la bonne propriété, il ne faut pas la sacrifier pour la commodité d'un embed.
- Les noms sont donc résolus par une **seconde requête bornée aux auteurs de la page affichée** (25 lignes), et rebranchés sous la même forme que l'embed — la page n'a rien à savoir de ce détour. Vérifié avec une vraie session de promoteur : 25 lignes, 90 au total, auteur résolu.
- Deux précautions : un acte fait **hors session utilisateur** (éditeur SQL, clé de service) porte `utilisateur = null` et reste « auteur non identifié » — c'est exact, on n'impute rien à personne ; et si la résolution des noms échoue, le journal s'affiche quand même sans auteurs, plutôt que de rendre une page d'erreur.
- **Trouvé au passage, et ce n'était pas cosmétique** : sur les 137 actes en base, **101 portaient `salaire_ligne / suppr_ligne`** — ni l'entité ni l'opération n'étaient déclarées. La majorité du journal s'affichait donc en clés brutes, et ces lignes étaient **hors du filtre**, donc introuvables. La paie journalise depuis la migration 079 ; seul le volet pédagogique (134-135) avait été déclaré. Les entités `salaire`, `salaire_ligne`, `contrat` et les opérations `suppr_ligne`, `validation`, `devalidation`, `modif_salaire_base` sont ajoutées.
- 5 tests, dont un qui vérifie que **tout ce que les déclencheurs écrivent porte un libellé** et un ton connu du composant `Badge` — c'est ce test qui empêchera la prochaine entité de paie de passer inaperçue.

## [2.216.0] — aucune migration · « Établissement » : les entrées transverses ont un toit
- **Demandé** : un nom pour regrouper Accueil, Membres et Paramètres dans les menus Gestion et Pédagogie.
- **Le nom retenu — « Établissement »** — désigne ce que ces entrées ont en commun : l'établissement lui-même, et non l'une de ses matières. Sa vue d'ensemble, qui y travaille, ce qu'il y a à signer, comment il est réglé. C'est un nom simple, comme les autres en-têtes (Scolarité, Finances, Évaluation) — « Administration » aurait fait doublon avec l'espace Gestion.
- **« À signer » rejoint le groupe** : elle flottait avec les trois autres et relève de la même famille.
- **Contrainte structurelle assumée** : `grouperItems` ne fusionne que des entrées adjacentes, or Accueil était en tête et les autres en pied. Le groupe est donc placé **en tête**, Accueil en première position : le lien d'accueil doit rester le premier, ce n'est pas au regroupement de dicter l'ordre de lecture. Bénéfice immédiat sur téléphone — ces quatre tuiles se replient maintenant comme les autres, ce qu'elles ne pouvaient pas faire sans en-tête.
- **🔴 Régression attrapée par les tests, et elle valait mieux qu'un correctif local.** Remonter le groupe en tête a fait atterrir le **bibliothécaire sur « À signer » au lieu de son catalogue** : `premiereRoute` — qui décide où l'on atterrit après connexion, pas seulement du repli d'une garde — suivait l'ordre de déclaration du menu. Le vrai défaut n'était pas la position du groupe mais ce **couplage** : l'ordre d'un menu ne doit pas déplacer les gens.
- `premiereRoute` procède désormais en deux passes, les entrées marquées `transverse` n'étant retenues qu'en dernier recours : **une page d'atterrissage est du travail, pas un utilitaire**. Le marquage suit la nature de l'entrée, donc il vaut aussi dans Pilotage et RH & Paie, qui ne sont pas regroupés pour autant (huit entrées et quatre se lisent d'un bloc).
- Deux tests de plus : aucun rôle n'atterrit sur un utilitaire tant qu'une page métier lui est ouverte — mais un utilitaire reste un repli valable, mieux qu'un cul-de-sac. Le test « toutes les pages métier sont rangées en section » devient « **aucune** entrée ne flotte hors section », plus strict et conforme à la nouvelle intention.

## [2.215.0] — aucune migration · Pilotage cloisonné à l'école ouverte
- **Demandé** : « quand je rentre dans une école, la vue d'ensemble doit être cloisonnée à cette école, mais pas toutes ».
- **Vérifié d'abord qu'il ne s'agissait pas d'une fuite** : `pilotage_synthese` filtre sur `proprietaires`, donc on ne voit que ses propres écoles — jamais celles d'un autre promoteur. C'était bien la vue consolidée voulue à l'origine, pas un défaut de cloisonnement.
- **Les tuiles portent désormais sur l'école ouverte**, par défaut. Entrer dans Tut'Tank puis lire un total de quatre établissements en croyant lire le sien, c'est exactement la confusion des versions précédentes.
- **Un sélecteur plutôt qu'une suppression.** Pris au pied de la lettre, cloisonner effacerait la vue consolidée — la raison d'être de Pilotage pour un promoteur multi-écoles. Or les cartes en dessous listent déjà chaque école : seul le total disparaîtrait. « Toutes mes écoles » reste donc à un clic, et le sélecteur n'apparaît pas quand il n'y a qu'une école, où le choix n'aurait aucun sens.
- **Le sous-titre et les légendes suivent le périmètre** : « Tut'Tank · 4 établissements au total » quand c'est cloisonné, « 4 établissements · dont 1 de démonstration, hors totaux » quand c'est consolidé. Annoncer « vue consolidée » au-dessus d'une seule école aurait été la même confusion, à l'envers.
- **Deux replis, parce qu'une page vide se lit comme une page cassée** : si aucune école n'est ouverte (ou si l'école active sort du périmètre), on retombe sur le cumul ; et si l'école ouverte **est** une démo — le cas de la démarcheuse — on affiche ses chiffres, puisque c'est ce qu'elle a demandé en y entrant, mais la légende annonce « démonstration ».
- 4 tests de plus sur le périmètre, dont les deux replis. Les cartes restent volontairement complètes : ce sont elles qui permettent de basculer d'une école à l'autre.

## [2.214.0] — migration **156** · écoles de démonstration, écartées des totaux
- **Décidé après les 154-155** : sur les 9 357 500 de trésorerie cumulée du promoteur de Tut'Tank, **9 732 500 venaient de TutTank_Demo**. Un total dont l'essentiel est fictif n'est pas un total approximatif — il est inexploitable.
- **Un marqueur sur la fiche école**, `ecoles.demonstration`, et non une convention de nommage : se fier au suffixe « _Demo » aurait marché jusqu'au jour où quelqu'un renomme l'école, et se serait cassé en silence. Réglable depuis la console super-admin (« Nature de l'établissement »).
- **La carte de l'école reste.** Le promoteur doit pouvoir continuer à gérer sa démo depuis Pilotage — c'est son outil de démarchage. Seuls les totaux l'écartent ; la carte porte une pastille « Démonstration · hors totaux » et son bouton « Gérer cette école » fonctionne comme avant.
- **⚠️ Et certains comptes n'ont QUE des démos.** Vérifié en base : la démarcheuse ne possède que TutTank_Demo, et le compte de présentation RDC que « Complexe Scolaire La Grâce ». Les écarter sans filet aurait donné 0 partout — une page qui paraît cassée. D'où un repli : s'il ne reste aucune école réelle, on consolide les démos **et on l'annonce** (« établissement de démonstration »), au lieu de faire passer des chiffres de démonstration pour des vrais.
- Le sous-titre suit — « 4 établissements · dont 1 de démonstration, hors totaux » — sinon il aurait contredit les tuiles qui n'en cumulent que 3. Les démos passent en fin de liste : la page s'ouvre sur les vraies écoles.
- Deux écoles marquées : **TutTank_Demo** et **Complexe Scolaire La Grâce** (démo RDC). Attendu pour ton compte : trésorerie consolidée **−375 000** au lieu de 9 357 500.
- 4 tests de plus, dont celui du repli et un qui vérifie qu'**en l'absence du marqueur, aucune école n'est exclue par surprise**.

## [2.213.0] — migration **155** · 🔴 Pilotage : la masse salariale comptait des brouillons
- **Signalé** : « je ne reconnais pas 805k, 3 572 999 et 9 257 500 pour Tut'Tank, ça ne colle pas avec Gestion ». Deux réponses, dont une est un vrai défaut.
- **Ces trois nombres ne sont pas ceux de Tut'Tank** : ce sont les totaux des **4 écoles** du compte. Tut'Tank seule affiche trésorerie 0, masse 300 000, résultat 0. Et surtout, **9 732 500 des 9 357 500 de trésorerie consolidée viennent de TutTank_Demo**, l'école de démonstration : les montants fictifs écrasent les vrais. Le sous-titre annonçait « 4 établissements · vue consolidée », mais les tuiles, elles, ne disaient rien — on les lisait donc comme le chiffre de l'école ouverte dans Gestion. Chaque tuile porte désormais la mention « N établissements cumulés ».
- **🔴 Le vrai défaut : la masse salariale comptait des bulletins en brouillon.** Un bulletin suit un cycle `brouillon → validé → payé → archivé` (migration 079). Un brouillon est un calcul en cours : il peut être recalculé, corrigé, jeté. Or la tuile sommait tous les bulletins du mois sans regarder leur statut — et **la totalité des bulletins de la base sont en brouillon, aucun n'est payé**. Elle annonçait donc 300 000 pour Tut'Tank, 2 622 999 pour la démo, 650 000 pour l'UCAD : 3 572 999 dont pas un franc n'est engagé.
- **Ce n'est pas un détail d'affichage** : un promoteur lit cette tuile à côté de sa trésorerie pour décider s'il peut payer. Annoncer une charge qui n'existe pas encore est aussi trompeur que d'en oublier une.
- La masse salariale ne compte plus que les bulletins **engagés** (validés, payés, archivés). Et parce qu'un promoteur ne doit pas pour autant ignorer ce qui se prépare, le montant en brouillon est rendu **à part** : « + 300 000 XOF en brouillon (2 bulletins à valider) ». Sur les données actuelles, l'engagé tombe donc à 0 — et c'est la vérité.
- Le libellé dit « **+** brouillons » et non « dont » : un brouillon s'ajoute à l'engagé, il n'en fait pas partie. Deux tests supplémentaires verrouillent cela, dont un qui vérifie que **valider un bulletin déplace le montant d'une colonne à l'autre sans en créer**.

## [2.212.0] — migration **154** · 🔴 Pilotage : la trésorerie oubliait la scolarité encaissée
- **Signalé** : « des montants qui ne font pas de sens » dans Pilotage → vue d'ensemble. Constaté sur les données réelles : **TutTank_Demo affichait une trésorerie de −370 000 après avoir encaissé 10 102 500** ; l'UCAD, −435 000 pour 60 000 encaissés.
- **La trésorerie ne comptait que les sorties.** Elle valait `solde initial + recettes − dépenses`, or la scolarité ne passe pas par les recettes du livre de caisse mais par la table des paiements — et celle des recettes est vide dans toute la base. Le solde n'était pas sous-estimé : il était **inversé**.
- **La page se contredisait elle-même**, et c'est ce qui la rendait illisible : le même argent figurait dans « Résultat (année) » — 9 732 500 pour la démo — mais pas dans « Trésorerie », juste à côté.
- **Le diagnostic avait déjà été posé.** La migration 075 s'appelle « Trésorerie : la scolarité encaissée alimente la caisse » et décrit exactement ce symptôme. Mais elle n'avait corrigé que `soldes_comptes` ; `pilotage_synthese`, écrite en 010, n'a jamais été reprise. Une même règle métier vivait à deux endroits, un seul a été réparé.
- **Pourquoi compter les encaissements par école et non par compte de caisse** : `soldes_comptes` joint sur le compte, ce qui est juste pour un solde de caisse. Mais au niveau de l'établissement, un encaissement non imputé reste de l'argent entré — et il n'existe aujourd'hui que **2 comptes de caisse dans toute la base**, avec la **totalité** des paiements à `compte_id` nul. Raisonner par compte aurait effacé tout ce qui est encaissé.
- **Deux corrections trouvées au passage.** Les factures **annulées** gonflaient le dénominateur du taux de recouvrement : la migration 143 avait posé la règle pour le tableau de bord des finances, Pilotage ne la suivait pas. Et l'écran appliquait la **devise de l'école active à toutes les cartes**, en sommant le tout : un promoteur ayant une école en USD ou en CDF (démo RDC) lisait des francs CFA qui n'existent pas, et `1 000 USD + 1 000 XOF` donnait « 2 000 XOF ». Chaque carte porte désormais la devise de son école, et les tuiles consolidées gardent **une ligne par monnaie** plutôt qu'un total impossible.
- Libellé précisé en « Résultat (**année civile**) » : le calcul court depuis le 1er janvier, alors que tout le reste de l'application raisonne en année scolaire. Le chiffre ne change pas — seule l'ambiguïté disparaît.
- Le calcul propre à l'écran est sorti dans `lib/pilotage.js` (`resultatAnnee`, `consoliderParDevise`) et couvert par 5 tests, dont un qui vérifie qu'**aucune ligne ne porte la somme de deux devises**.

## [2.211.2] — aucune migration · 🔴 « Can't find variable: getNiveaux » sur la page Annonces
- **Signalé** : la page Annonces refusait de s'ouvrir sur `Can't find variable: getNiveaux`.
- **De mon fait, en livrant la 2.211.0** : `Annonces.jsx` appelait `getNiveaux` et `getCycles` sans les importer. Un caractère manquant dans une ligne d'import, et la page entière tombe.
- **Le vrai sujet, c'est que rien ne l'a vu.** `vite build` a réussi, les 111 tests sont passés. Un empaqueteur ne résout que les **imports** : un identifiant libre est pour lui une variable globale parfaitement licite, et l'erreur n'apparaît qu'à l'ouverture de la page, chez l'utilisateur. Aucun de nos tests n'ouvre les pages — c'était un angle mort complet de la chaîne.
- **Garde-fou ajouté** (`test/identifiants.test.mjs`) : chaque fichier de `src/` est transformé puis analysé, et tout identifiant utilisé sans être déclaré ni importé fait échouer la suite, avec son fichier et sa ligne. Confronté au défaut réel, il nomme bien `Annonces.jsx:45 — getNiveaux` et `:46 — getCycles`.
- Deux précautions dans le garde-fou lui-même : les constantes injectées au build (`__APP_VERSION__`…) sont lues dans `vite.config.js` au lieu d'être codées en dur — une liste figée mentirait dès qu'on en ajouterait une ; et un second test rejoue le défaut d'origine en miniature, parce qu'un garde-fou qui ne détecte rien est pire que pas de garde-fou : il rassure.
- Vérifié au passage que `getNiveaux`/`getCycles` rendent bien un tableau plat avec `id` et `libelle`, ce que lisent les sélecteurs — un import correct rendant une forme inattendue aurait donné un menu vide **sans lever d'erreur**, comme la régression `getFactures` de la 2.206.

## [2.211.1] — migration **153** · 🔴 une pièce jointe suit son annonce, et elle seule
- **Trouvé en éprouvant la 152 avec de vraies sessions parent** — pas en relisant le code.
- La migration 151 avait ouvert une seconde voie de lecture dans `fichiers_ecole` : un texte de portée « familles » est lisible par tout membre de l'établissement. C'était le but — un règlement intérieur que les familles ne peuvent pas lire ne sert à rien.
- **Mais cette voie ne distinguait pas les pièces jointes.** Un fichier rattaché à une annonce ciblée « Préscolaire » et portant `portee = 'familles'` devenait lisible par **tous** les parents de l'école, ligne comme octet. Le ciblage, correct au niveau de l'annonce, était contourné par son propre fichier.
- **Pourquoi le corriger alors que l'interface ne produit pas ce cas** : `televerserFichier` force bien `portee = 'interne'` dès qu'il y a une annonce. Mais une règle de sécurité qui tient parce que le client choisit bien la valeur d'une colonne n'est pas une règle de sécurité — c'est une convention, et une convention se perd. Même leçon que l'audit bibliothèque : ne jamais faire garder au client ce que la RLS doit garantir.
- **Deux audiences, deux voies, aucun recouvrement** : une pièce jointe (`annonce_id` renseigné) suit l'audience de son annonce ; un document libre (`annonce_id` nul) suit sa portée. `textes_reference()` écarte également les pièces jointes — le filtre de catégorie le faisait déjà en pratique, mais c'était encore l'application qui le décidait.
- Rien à changer côté Storage : `_doc_peut_lire` étant en `SECURITY INVOKER`, le droit de lire l'octet suit la policy corrigée sans qu'on ait à le redire.

## [2.211.0] — migration **152** · cibler une annonce par niveau ou par cycle
- **Le ciblage s'arrêtait à la classe.** Or une école annonce rarement à une seule classe : une sortie concerne « le préscolaire », une réunion « les CM », un rappel de fournitures « l'élémentaire ». Faute de maille intermédiaire, ces messages partaient à **toutes** les familles — et ce qui s'adresse à tout le monde n'est lu par personne.
- **Deux cibles ajoutées** — **cycle** et **niveau** — sur le même patron que « classe » : un discriminant `cible` et la colonne d'identifiant correspondante. Chez Tut'Tank, cela donne « Préscolaire », « Élémentaire », puis TPS/PS, MS/GS, CI/CP, CE1/CE2, CM1.
- **La règle de visibilité est écrite à quatre endroits**, et les quatre ont été modifiés ensemble : `_annonce_visible_par()` (qui gouverne aussi les pièces jointes, table **et** Storage), `annonces_parent()`, `annonces_enfant()` et `mes_annonces()`. En oublier un, c'était soit masquer une annonce légitime, soit laisser fuir sa pièce jointe.
- **Nuance conservée, et elle compte** : une annonce « tous » ou « parents » atteint un parent **dès qu'il a un enfant dans l'école**, même sans inscription active. Un ciblage par classe, niveau ou cycle exige au contraire l'inscription de l'année courante — c'est elle qui rattache l'enfant à une classe. Avec 35 élèves de Tut'Tank sans responsable rattaché, la distinction n'est pas théorique.
- **L'étudiant du supérieur n'a ni classe, ni niveau, ni cycle** : `mes_annonces` écartait déjà les annonces de classe, elle écarte désormais les trois.
- Côté familles, la pastille affiche l'audience réelle — « CM1 », « Élémentaire » — au lieu du seul mot « classe ». Côté personnel, la liste des annonces fait de même.
- Détail : changer de cible remet à zéro les autres identifiants, sinon une annonce basculée de « classe » à « cycle » aurait gardé un ciblage fantôme.

## [2.210.0] — migration **151** · « Textes de référence », le rayon réglementaire
- **Nouveau rayon dans Pilotage → Documentation** : règlement intérieur, codes et décrets relatifs à l'enseignement, arrêtés, conventions et agréments, chartes et procédures internes.
- **Pourquoi un rayon distinct** plutôt qu'une catégorie de plus : ces textes ne se consultent pas comme une circulaire ponctuelle. On y revient, on les cite, ils font autorité et ils survivent aux années scolaires. Les mélanger au tout-venant reviendrait à les perdre.
- **Le nom retenu — « Textes de référence »** — couvre aussi bien le règlement intérieur, texte propre à l'école, que les codes et décrets, textes externes. Il n'entre pas en collision avec le module Bibliothèque.
- **Un besoin moins évident, traité au passage : un règlement intérieur que les familles ne peuvent pas lire ne sert à rien.** La migration 150 réservait les dépôts libres au personnel. Chaque texte porte désormais une **portée** explicite — « personnel uniquement » ou « visible des parents et étudiants ». C'est une décision de publication, pas un réglage technique, d'où un champ et non une convention de nommage.
- Un texte publié apparaît dans l'espace parent (raccourci **Règlement**) et dans l'espace étudiant (tuile **Textes de référence**), via un composant partagé : même contenu, deux endroits de consultation.
- Chaque texte peut porter sa **référence** (« Décret n° 2024-1234 ») et sa **date** — un décret se cite, un règlement intérieur a une version.
- **Rien à changer côté Storage.** `_doc_peut_lire` étant en `SECURITY INVOKER` (mig. 150), elle s'appuie sur la policy de la table : le droit de lire l'octet suit automatiquement le droit de lire la ligne, portée « familles » comprise. C'est le bénéfice d'avoir écrit la règle à un seul endroit.

## [2.209.0] — migration **150** · pièces jointes aux annonces, archivées dans la Documentation
- **Une annonce peut désormais porter des fichiers** — PDF, image, document bureautique, 20 Mo par pièce. Ils s'affichent sous l'annonce dans l'espace parent (accueil et page de l'enfant) et dans l'espace étudiant, et s'ouvrent par un lien signé valable une heure.
- **Ces fichiers sont conservés dans Pilotage → Documentation**, dans une nouvelle section « Bibliothèque de fichiers » où l'on peut aussi déposer directement un règlement ou une circulaire. La page promettait cet archivage « prochainement » : la mention est retirée.
- **Une seule table, pas deux.** Les stocker séparément — une copie pour l'annonce, une pour la GED — garantirait qu'elles divergent. `fichiers_ecole` **est** la documentation de l'établissement ; une pièce jointe n'est qu'une de ses lignes, rattachée à une annonce. Supprimer le fichier depuis la Documentation le retire aussi de l'annonce, et l'interface le dit avant de confirmer.
- **Le point délicat : qui peut lire le fichier.** Une annonce ciblée « classe » ne s'adresse qu'aux parents de cette classe ; sa pièce jointe doit suivre la même audience, sinon le ciblage est contourné par le fichier. La règle est écrite **une seule fois**, dans `_annonce_visible_par()`, et appliquée à la policy de la table, à la policy Storage et aux trois RPC des espaces parent et étudiant.
- 🔴 **Défaut attrapé pendant l'écriture** : j'avais déclaré `_doc_peut_lire` en `SECURITY DEFINER`. Elle aurait alors **contourné la RLS** de `fichiers_ecole` et répondu « oui » pour n'importe quel fichier existant — annulant le contrôle d'audience au moment même où on croit l'appliquer. Passée en `SECURITY INVOKER` : la ligne n'est visible que si l'appelant a le droit de la voir, et la policy de la table fait donc foi pour l'octet aussi.
- Détails : le fichier est retiré du stockage si l'enregistrement de la ligne échoue (un octet sans ligne serait invisible et pèserait pour rien) ; les fichiers trop lourds sont écartés **avant** l'envoi, pas après plusieurs minutes de téléversement ; le champ de dépôt est réinitialisé après coup, sans quoi redéposer le même fichier ne déclencherait rien.

## [2.208.1] — aucune migration · 🔴 renvoyé sur « Bienvenue » alors qu'on a déjà un compte
- **Signalé** : impossible d'entrer dans l'application, renvoi systématique sur l'écran de bienvenue.
- **Vérifié d'abord côté base** : les comptes concernés sont sains (profil présent, `actif`, rôles en place) et rejouer les quatre requêtes du contexte d'authentification **avec le jeton du compte bloqué** les fait toutes aboutir. Le serveur n'était pas en cause.
- **La cause est côté client** : `chargerProfil` ne lisait **jamais** le champ `error` de ses requêtes. Une lecture qui échoue — réseau coupé, jeton en cours de renouvellement, réponse perdue — renvoyait `data = null`, et l'application en concluait « cet utilisateur n'a pas de profil » : direction l'écran de bienvenue, en `replace`, donc sans retour possible.
- Aggravant : `onAuthStateChange` rejoue ce chargement **à chaque renouvellement de jeton**. Un utilisateur déjà connecté pouvait donc se faire éjecter en cours de session.
- **Correctif** : une erreur de lecture n'est plus une absence de profil. Nouvel état `erreurProfil` ; `sansProfil` n'est vrai que si la lecture a **abouti** et n'a rien trouvé — seul cas où proposer la création d'une école. En cas d'erreur, un écran **« Connexion au serveur interrompue »** affiche le message exact et un bouton **Réessayer**, au lieu d'annoncer à un client établi qu'il n'a pas de compte.
- **Deux courses corrigées au passage** : un numéro de demande empêche une réponse en retard d'écraser une plus récente (deux chargements se croisent à chaque événement d'authentification), et `setChargement(false)` passe en `finally` — un échec ne fige plus l'écran d'attente.

## [2.208.0] — aucune migration · les tuiles se replient sur téléphone
- **Les sections de la grille de tuiles (mobile) se replient et se déplient.** Pédagogie compte une vingtaine d'entrées : dépliée d'un bloc, elle imposait plusieurs écrans de défilement pour atteindre la dernière.
- **L'état est partagé avec la barre latérale** : même clé de stockage (`menu_sec_<section>`). Replier « Bibliothèque » sur le téléphone la retrouve repliée sur l'ordinateur — un seul réglage, deux affichages. Et il est relu à chaque ouverture du panneau : ouvrir un module puis revenir ne perd pas le choix.
- **Un bouton « Tout replier / Tout déplier »** dans l'en-tête de chaque espace : replier six sections une à une, c'est six gestes.
- **Replier n'escamote jamais une alerte** : une section fermée affiche la somme des pastilles qu'elle contient, comme le fait déjà la barre latérale.
- Détail d'implémentation corrigé en cours de route : les sections du panneau mobile sont **contrôlées** par le parent, contrairement à celles de la barre latérale. Si chacune gardait son état, le libellé « Tout replier » se serait figé dès le premier repli.
- **Non concernés** : les tuiles des espaces parent et étudiant ne sont pas groupées — il n'y a rien à y replier. Les regrouper serait un autre sujet.

## [2.207.2] — migration **149** · balayage complet : la comptabilité était ouverte elle aussi
- **Plutôt que de découvrir ces trous un par un**, balayage de tout le schéma. Méthode : les 169 fonctions `SECURITY DEFINER` du dépôt → retrait de celles qui portent une garde interne ou une révocation explicite (**31 restent**) → croisement avec les **148 RPC réellement exposées** par PostgREST, une fonction `returns trigger` ne l'étant pas (**19**) → mise à l'écart des **4 publiques par conception** (portail d'admission, QR de vérification) → vérification qu'aucune n'est appelée depuis `src/`.
- **Neuf fonctions internes restaient appelables par tout compte connecté**, et ce sont les plus sensibles : `_compta_poster`, `_compta_tresorerie`, `_annuler_piece_source`, `_compte_ligne_salaire`, `poster_facture`, `poster_paiement`, `poster_depense` (écritures comptables), `recalc_salaire` (moteur de paie) et `prochain_numero_facture` (séquence de numérotation). Toutes sont invoquées par des déclencheurs, qui s'exécutent avec les droits du propriétaire : la révocation ne les gêne pas.
- **`prochain_matricule` reste exposée volontairement** : l'interface l'appelle à la création d'un élève, et elle se limite d'elle-même à `ecole_courante()` — nulle pour un parent, qui échoue donc déjà.
- **La révocation est dynamique, par lecture de `pg_proc`.** Écrire les signatures à la main exige l'exactitude, et une seule erreur fait échouer la migration : en extrayant les neuf signatures des fichiers d'origine, **six différaient de ce que j'avais d'abord écrit**. Le dépôt peut de surcroît avoir dérivé de la base — précédent avéré avec `enfant_factures`. On lit donc la vérité dans le catalogue, ce qui couvre aussi les surcharges éventuelles.

## [2.207.1] — migration **148** · 🔴 les fabriques de notifications étaient ouvertes à tous
- **Trouvé en éprouvant la migration 147 avec une vraie session de parent** — pas en relisant le code. Sondage depuis un compte parent sans aucun rôle de gestion :

  | Fonction | Résultat |
  |---|---|
  | `_notifier_parents` | 🔴 204 — autorisé |
  | `_notifier_etudiant` | 🔴 204 — autorisé |
  | `executer_relances` | 🔴 200 — autorisé |
  | `_notifier_parents_ecole` | 🔴 200 — autorisé |
  | `relancer_eleve` | ✓ « Réservé au comptable. » |

- Concrètement : **un parent pouvait forger une notification adressée à n'importe quel parent de n'importe quel établissement**, ou déclencher la campagne de relances d'une autre école.
- **Deux causes, et l'une est la mienne.** (1) `create function` accorde EXECUTE à PUBLIC par défaut ; les helpers `_notifier_parents` (mig. 013/112) et `_notifier_etudiant` (mig. 130) n'avaient jamais été révoqués — défaut ancien. (2) `executer_relances` avait été **délibérément** révoquée en migration 019, avec un wrapper `relancer_tout()` gardé pour l'interface : **ma migration 147 l'a rouverte** avec un `grant … to authenticated` ajouté « par sécurité ». Reposer des droits sans vérifier ce qu'ils étaient, c'est les inventer.
- **Correctif** : les quatre fonctions sont révoquées de `public`, `anon` **et** `authenticated`. Un helper préfixé `_` n'est jamais appelé par le client — il est invoqué depuis des déclencheurs et des fonctions `SECURITY DEFINER`, qui s'exécutent avec les droits du propriétaire et ne sont donc pas gênés. Aucun appel applicatif à ces quatre fonctions n'existe, vérifié dans `src/`.
- **Défense en profondeur** : `_notifier_parents_ecole` porte désormais sa garde de rôle **à l'intérieur**, pour qu'un `grant` distrait — comme le mien — ne suffise plus à rouvrir la brèche.
- **Troisième occurrence du même motif** après `ecole_conversations` (mig. 139) : une fonction `SECURITY DEFINER` sans contrôle interne, atteignable parce que personne n'avait révoqué PUBLIC.

## [2.207.0] — migration **147** · notification d'enfant vs notification d'école
- **Question posée** : il y a des notifications par enfant et d'autres qui concernent l'école — cette particularité est-elle bien gérée ? **Recensement de toutes les sources avant de répondre**, et la réponse tient en deux temps.
- **Aucune notification d'école n'existe aujourd'hui.** Les six sources (`_notifier_parents`, `traiter_demande`, `executer_relances`, `relancer_eleve`, `transport_notifier`, messagerie étudiante) sont **toutes** rattachées à un enfant. Un même parent ne reçoit donc jamais deux exemplaires d'un même évènement. La particularité ne pose pas de problème… parce qu'elle n'existe pas encore.
- **Mais rien ne la préparait.** Le jour où l'on notifie un évènement d'école — annonce publiée, fermeture exceptionnelle —, l'écriture naturelle (parcourir `eleve_tuteurs`) enverrait **trois fois le même message** à un parent de trois enfants. C'est exactement le défaut redouté. La primitive correcte est donc posée **avant** d'en avoir besoin : `_notifier_parents_ecole()` fait **un `select distinct` sur le profil** — une notification par parent, quel que soit son nombre d'enfants — et laisse `eleve_id` à NULL à dessein.
- **Trois sources par enfant omettaient encore `eleve_id`** : les rappels de paiement (mig. 019, deux fonctions) et la prise en charge du bus (mig. 042). Leurs alertes ne pouvaient donc pas porter le nom de l'enfant ni alimenter les pastilles par section. Corrigé, avec la catégorie.
- Méthode : les corps de ces trois fonctions ont été **extraits programmatiquement des migrations d'origine et patchés uniquement sur leurs lignes d'insertion**, plutôt que retapés — retyper quarante lignes de PL/pgSQL pour en changer deux est le meilleur moyen d'y glisser une erreur.
- Côté parent, une alerte sans enfant s'affiche **« Toute l'école »** dès qu'il y a plusieurs enfants : l'absence de nom devient une information, et non un oubli apparent.

## [2.206.0] — migration **146** · une notification dit de quel enfant elle parle
- **Signalé** : un parent de plusieurs enfants dans la même école reçoit « 3 mêmes notifications ». Mesuré avant de corriger — et la réponse n'est pas celle qu'on attendait.
- **Les annonces, elles, ne se dupliquent pas** : `annonces_parent()` porte un `select distinct`, et **aucun déclencheur ne transforme une annonce en notification**. Rien à corriger de ce côté.
- **Les notifications sont émises par enfant, et c'est correct** : trois enfants, trois notes saisies, trois évènements réels. Le défaut est qu'elles sont **indiscernables**. Relevé sur un vrai parent : deux « Demande de document — Votre document est prêt à être retiré. » rigoureusement identiques, à deux dates, pour deux enfants différents.
- **Le nom de l'enfant s'affiche désormais** en pastille sur chaque alerte — à partir de **deux enfants** seulement, car avec un seul il n'ajoute rien. Aucune migration nécessaire pour l'affichage : la table `eleves` est fermée au parent, mais il retrouve le nom par `mes_enfants`, qu'il a déjà le droit de lire.
- **Encore fallait-il que la colonne soit remplie.** `notifications.eleve_id` existe depuis la migration 112 et `_notifier_parents` la renseigne — mais `traiter_demande` (mig. 028) est antérieure et insérait sa notification à la main, **sans** `eleve_id` ni `categorie`. Seule source à l'omettre ; corrigée, et le **type de document** rejoint le message : deux demandes distinctes cessent de se ressembler.
- **Rattrapage prudent des notifications déjà envoyées** : l'enfant n'est rétabli que lorsque le rattachement est **sans ambiguïté** — un seul enfant de ce parent dans cette école. Essai à blanc : 10 notifications sans enfant, **2 rattrapables, 8 laissées à null**. Deviner pour les autres serait pire que se taire : une alerte attribuée au mauvais enfant induit en erreur, une alerte sans nom se lit encore.
- Dans la page d'un enfant, une annonce générale porte la mention **« Toute l'école »** — sans quoi, relue d'un enfant à l'autre, elle passerait pour un doublon alors qu'elle n'a été publiée qu'une fois.

## [2.205.0] — migration **145** · les annonces se rattachent à un enfant
- **Signalé par l'utilisateur** : dans l'espace parent, les annonces ne semblaient pas cloisonnées par école ni par enfant.
- **Vérifié d'abord : le cloisonnement de sécurité est CORRECT.** `annonces_parent()` (mig. 006) filtre déjà sur les écoles où le profil a un enfant, et les annonces ciblées « classe » sur les classes de ses propres enfants. Une annonce destinée aux enseignants ou aux étudiants ne lui parvient pas. **Aucune fuite inter-établissement** — c'est la lisibilité qui manquait.
- **Le vrai défaut** : les annonces s'affichaient en une liste unique sur l'accueil, et la page d'un enfant n'en montrait **aucune** — alors que c'est là qu'on les cherche. Un parent ayant des enfants dans plusieurs établissements (cas réel en base : un profil rattaché à trois écoles) les voyait mélangées.
- **Cause technique** : la RPC ne renvoyait que le *nom* de l'école et de la classe, jamais leurs identifiants — le client ne pouvait rattacher une annonce à rien.
- **Nouvelle section « Annonces » dans la page de chaque enfant** (`annonces_enfant`, gardée par `_parent_possede` comme les autres `enfant_*`), cadrée sur **son** établissement et **sa** classe — et non sur celles de toute la fratrie, contrairement à la vue globale.
- **L'accueil groupe désormais par établissement** quand le parent en a plusieurs ; sinon la liste reste simple, un titre unique n'apprendrait rien. Le regroupement se fait sur l'identifiant, pas sur le nom : deux écoles homonymes restent distinctes.
- `annonces_parent` a été **supprimée avant d'être recréée** (42P13 sur un `returns table`, quatrième occurrence après les migrations 114, 131 et 144).
- Piège évité en écrivant : `fmtDate` n'existait pas dans `ParentEnfant.jsx` et `annoncesEnfant` n'était pas importée — le build serait passé et la page aurait planté à l'ouverture de la section.

## [2.204.0] — migration **144** · la catégorie devient un vrai champ
- **Même évolution que `fourni_ecole`** (migration 105) : ce que les écoles exprimaient par convention devient un champ. Elles écrivaient la catégorie dans le libellé — `Livres — BLED CM1/CM2` — faute d'endroit où la mettre. La deviner marchait ; la **saisir** est mieux : un article mal rangé cesse de l'être définitivement.
- **Nouvelle colonne `fournitures.categorie`**, saisie à la création (liste ouverte, suggestions tirées du vocabulaire déjà employé par l'école) et **modifiable sur chaque ligne** — sans quoi le rattrapage ne serait pas rectifiable.
- **Rattrapage essayé à blanc avant d'être écrit** sur les 100 libellés réels : **79 lignes rangées, 27 laissées intactes, aucun tiret orphelin**. Catégories obtenues : Petit matériel (49), Cahiers (12), Divers (7), Livres (6), Maison (5). « Taille-crayon avec réservoir » reste entier — le séparateur reconnu est le tiret **cadratin**, jamais le trait d'union.
- **La transition se fait sans rupture** : l'espace parent lit la colonne quand elle existe, retombe sur le préfixe pour les listes non rattrapées, puis sur la devinette. Une école rattrapée et une autre pas produisent le même groupe. Verrouillé par deux tests.
- `enfant_fournitures` renvoie désormais la catégorie. La fonction a été **supprimée avant d'être recréée** : `create or replace` ne peut pas changer le type de retour d'un `returns table(...)` — piège déjà rencontré en migrations 114 et 131.

## [2.203.0] — aucune migration · fournitures regroupées par nature
- **Les fournitures s'affichent et s'envoient par groupes** — Cahiers, Livres & manuels, Stylos & crayons, Divers — au lieu d'une liste continue. En magasin, on parcourt un rayon à la fois.
- **Découverte en regardant les vraies listes : les écoles écrivent déjà la catégorie dans le libellé** — `Livres — BLED CM1/CM2`, `Cahiers — Cahiers de 100 pages`, `Petit matériel — Gomme`, `Maison — Trousse`. Tut'Tank range sa liste à la main, faute de champ pour le faire. **Ce classement fait donc foi** : on l'affiche tel quel, et on ne devine que pour les listes sans préfixe (« Cahier 96 pages », « Bic bleu »…). Le préfixe est retiré des lignes, sinon chaque article répéterait « Petit matériel — » sous son propre titre.
- Le séparateur reconnu est le tiret **cadratin** entouré d'espaces, jamais le trait d'union : sinon « Taille-crayon avec réservoir » serait coupé en deux. Verrouillé par un test.
- « Autres » et « Divers » sont ramenés au même groupe, toujours placé **en dernier**. Les catégories propres à l'école (« Petit matériel », « Maison ») gardent leur nom et leur place.
- Dans le message WhatsApp, les titres de groupe sont en **gras WhatsApp**. Un seul groupe → pas de titre, il n'apprendrait rien.
- Une clé stable par article remplace l'index : les libellés se répètent d'une catégorie à l'autre (« Gomme » chez *Maison* **et** *Petit matériel*), et cocher l'un aurait coché l'autre.
- 12 tests sur le module, vérifiés ensuite sur les listes réelles de Tut'Tank.
- **Amélioration possible plus tard** : une vraie colonne `categorie` sur `fournitures`, éditable par l'école. C'est exactement l'évolution qu'a connue `fourni_ecole` — détection par mot-clé, puis vraie case à cocher (migration 105).

## [2.202.0] — aucune migration · le parent envoie sa liste de fournitures par WhatsApp
- **L'espace parent sépare désormais deux listes** : **À acheter** et **Fourni par l'école**. Avant, tout était mélangé dans une seule liste où le « fourni par l'école » se signalait par une couleur — il fallait lire ligne à ligne pour savoir quoi mettre dans son panier.
- **Bouton « Envoyer par WhatsApp »** : la liste des articles à acheter part en message texte, prêt à être relu dans un rayon de magasin. **Aucun numéro n'est imposé** — WhatsApp laisse le parent choisir le destinataire : sa boutique, son conjoint, lui-même. C'est l'inverse des relances de l'école, qui visent une famille précise.
- **Cases à cocher** : une liste de rentrée s'achète en plusieurs fois. Le parent décoche ce qu'il a déjà, et seul le reste part dans le message. Un bouton **Copier la liste** sert de repli quand WhatsApp n'est pas installé (ordinateur).
- **Ce qui ne doit jamais arriver, verrouillé par un test** : un article fourni par l'école ne figure **jamais** dans le message — le parent le paierait deux fois. Le repli sur la note (« disponible à l'école ») est conservé pour les listes saisies avant la migration 105, qui a introduit la case.
- Détails du message : la quantité n'apparaît que si elle dépasse 1, la note de l'école est reprise (format, couleur — c'est ce qui sert en magasin), et l'en-tête nomme l'enfant et sa classe. 6 tests sur le module, qui est pur.

## [2.201.0] — migration **143** · supprimer ou annuler une facture
- **Question de l'utilisateur : une facture générée ne peut pas être supprimée ?** Exact, et c'était un manque : `supprimerFacture()` existait dans la couche données depuis le début, **aucune page ne l'appelait**. Même défaut que `journaliser()` et `creerAuteur()` en bibliothèque — une fonction livrée sans porte d'entrée.
- **Mais « ajouter un bouton Supprimer » aurait été la mauvaise réponse.** `paiements.facture_id` est en `on delete cascade` : effacer une facture réglée aurait effacé **ses encaissements avec elle**, de l'argent disparaissant des livres. Et `factures.numero` est une numérotation séquentielle : on n'efface pas une pièce numérotée, on l'annule.
- **Deux actes distincts, désormais tous deux accessibles** au bas de la fiche facture :
  - **Supprimer** — proposé uniquement si la facture n'a **aucun encaissement**. La base refuse le reste, avec un message nommant le nombre et le montant en jeu. Le Journal (mig. 134) en garde la ligne complète : l'acte reste restaurable.
  - **Annuler** — la voie normale pour une facture déjà réglée, ou dont le numéro doit rester dans la série. La facture reste visible et vérifiable, mais sort du recouvrement, des relances et du tableau de bord. **Rétablir** défait l'annulation.
- Le statut `annulee` existait dans l'enum depuis la migration 001 et était **déjà honoré** par les relances (019), le recouvrement et la comptabilité (096, 098). Personne ne le posait jamais.
- **Corrigé au passage** : `tableau_bord_finances` (mig. 137, la mienne) sommait toutes les factures sans regarder leur statut — une facture annulée y serait restée comptée et aurait creusé un impayé fantôme dans le taux de recouvrement.
- Choix technique : la garde est dans une **RPC**, pas dans un déclencheur sur la table. Un déclencheur se serait aussi déclenché sur la cascade venant de `eleves` et aurait bloqué la suppression d'un élève — un effet de bord que personne n'a demandé.

## [2.200.1] — aucune migration · 🔴 la colonne « Élève » de Paiements était vide
- **Signalé par l'utilisateur** : la liste des factures n'affichait que des numéros, sans nom d'élève. **Ce n'était pas normal — régression introduite par moi** avec la pagination des factures (migration 136, v2.193).
- **Cause.** La RPC `factures_paginees` renvoie l'élève **à plat** (`prenom`, `nom`, `matricule`), parce qu'elle applique `to_jsonb()` à une jointure. Tout le reste de l'application le lit sous `eleves: { … }` — c'est ce que font `getFacture`, `getDeclarations` et `getTransactions`. Le composant lisait donc `f.eleves?.prenom` sur un objet qui n'existait plus. **Rien ne plantait : la colonne était simplement blanche.** Exactement le même défaut que le changement de forme de `getEleves` en v2.192 — un contrat de données modifié sans recenser ses lecteurs.
- **Correctif à la frontière** : `getFactures` replie l'élève sous `eleves`, plutôt que d'aller retoucher chaque affichage. Tout futur appelant retrouve la forme attendue. Une facture sans élève rattaché donne `eleves = null` et non un objet de champs vides — sinon l'écran afficherait « null null ».
- **Le matricule s'affiche** désormais à côté du nom : les homonymes sont fréquents dans une école, et ouvrir la mauvaise facture se paie cher.
- **3 tests** verrouillent ce contrat sans toucher au réseau. Vérifié aussi en session d'administration réelle : la RPC renvoie bien les champs à plat, c'était donc bien côté client.

## [2.200.0] — migration **142** · le parent imprime sa facture et ses reçus
- **Le parent peut éditer lui-même sa facture** depuis l'espace parent (onglet Paiements, bouton « 🧾 Facture »), au même format carnet que le secrétariat, et **un reçu par encaissement**. Jusqu'ici il devait le réclamer à l'école.
- **Pourquoi une migration.** `enfant_factures` (mig. 004) ne renvoie que l'en-tête : numéro, dates, totaux, statut. De quoi dresser une liste, pas de quoi produire un document — il manquait **les lignes de la facture**, les encaissements, et l'identité de l'établissement. Et le parent n'a accès à aucune de ces tables : `factures` et `paiements` lui sont fermées depuis la migration 133, et son `profils.ecole_id` est NULL de toute façon.
- `enfant_facture_detail(p_facture)` renvoie **tout en un seul appel** — le document s'affiche d'un bloc, il ne se compose pas progressivement sous les yeux du parent. Gardé par `_parent_possede()`, le même verrou que les autres `enfant_*` : le contrôle porte sur l'**élève**, c'est le lien de filiation qui autorise.
- Piège évité au passage : l'état de la modale ne s'appelle pas `document` — ce nom aurait masqué l'objet global du DOM dans tout le composant.
- **Mentions légales de Tut'Tank renseignées** (RCCM, NINEA, CORIS BANK, ordre des chèques), plus l'adresse et le téléphone qui manquaient à leur fiche. Le pied de page imprimé reproduit désormais celui de leur carnet.

## [2.199.1] — migration **141** · 🔴 onze entrées de menu manquaient à six écoles sur sept
- **Trouvé en travaillant sur les factures, mesuré sur les 7 écoles de la base.** Tut'Tank — **client réel** — et cinq autres établissements ne voyaient plus dans leur menu : Appel, Cahier de textes, Progression, Emploi du temps, Niveaux & classes, Notes, Bulletins, Classement, Vie scolaire, Assiduité, Fournitures. Seule l'UCAD était épargnée.
- **Cause.** `ecoles.type_etablissement` porte deux significations successives. La migration 001 l'a créée pour le **statut juridique** (« Privé », « Public », « Confessionnel ») — et c'est encore ce qu'écrivait la page d'onboarding. La migration 108 a voulu en faire la bascule école / supérieur avec `add column if not exists … not null default 'ecole' check (…)`. **La colonne existait déjà : l'instruction entière n'a rien fait.** Ni défaut, ni contrainte, sans la moindre erreur. Les écoles sont restées à « Privé », et le filtre de menu `["ecole"].includes("Privé")` a commencé à les exclure dès que le gating par type est arrivé (v2.171.0, élargi en v2.185.0).
- **Correctif applicatif** (`normaliserType`) : le type est binaire partout ailleurs dans le code — tout ce qui n'est pas « superieur » est une école. Les menus reviennent sans attendre la migration.
- **Correctif de données** (migration 141) : le statut juridique est d'abord recopié dans une nouvelle colonne `statut_juridique` — il n'est lu nulle part, mais l'écraser serait une perte sèche —, puis `type_etablissement` est normalisé et reçoit enfin le défaut, le NOT NULL et la contrainte que la 108 croyait avoir posés.
- **La page d'onboarding** ne propose plus le statut juridique dans ce champ : elle propose École / Supérieur, comme Paramètres. Toute école créée depuis l'onboarding naissait infirme.
- **Test de non-régression** : les entrées « école » restent visibles pour `Privé`, `Public`, `Confessionnel`, `Franco-arabe`, `Collège` et `null`, et les entrées « supérieur » restent invisibles.
- **Leçon, à retenir** : `add column if not exists` ne dit pas « mets la colonne dans cet état », il dit « crée-la si elle manque ». Changer le défaut, la nullité ou une contrainte d'une colonne qui peut déjà exister demande des `alter column` explicites.

## [2.199.0] — aucune migration · facture et reçu « carnet d'établissement » (écoles)
- **Facture et reçu redessinés** sur le modèle des carnets qu'utilisent réellement les écoles sénégalaises : cadre de couleur, bandeau de tableau, lignes alternées, montant en toutes lettres, bloc « Modes de paiement », pied de page légal. **La palette n'est pas figée** : elle vient de `couleur_primaire` / `couleur_secondaire`, pour que chaque école reconnaisse son propre imprimé. Facture et reçu échangent cadre et bandeau — on les distingue de loin, comme sur les carnets.
- **Ce sont désormais deux pièces distinctes**, et non plus un seul bloc « Reçu / Facture ». La facture dit ce qui est dû et porte les moyens de paiement ; le reçu atteste un encaissement précis, avec « Paiement effectué par », le mode, la référence et la signature. Un bouton par encaissement dans la fiche facture.
- **Nouveau : le montant en toutes lettres** (`montantEnLettres`), mention d'usage constant en zone OHADA qui rend un chiffre infalsifiable. Elle n'existait nulle part dans l'application. Module pur, **14 tests** sur les pièges du français — et l'un d'eux a trouvé une vraie faute dans ma première version : « cent » et « vingt » gardent leur *s* devant **million** (un nom) mais le perdent devant **mille**. On écrit *deux cents millions* et *deux cent mille*.
- **L'impression conserve les aplats.** Sans `print-color-adjust: exact`, les navigateurs suppriment les fonds « pour économiser l'encre » : il ne serait resté qu'un tableau nu. Ajout aussi d'un `@page` A4.
- **Mentions légales configurables** (RCCM, NINEA, forme juridique, ordre des chèques, banque et compte) dans Paiements → onglet **Paiement mobile**, à côté des numéros mobile money : les deux alimentent les mêmes imprimés. Stockées dans `parametres`, aucune migration nécessaire. Laissées vides, elles n'apparaissent simplement pas.
- ⚠️ **Réservé aux écoles.** Le carnet de caisse coloré est un usage du primaire et du secondaire ; une université continue d'émettre le document sobre.
- **Pas encore** : l'espace parent affiche toujours l'ancienne présentation de facture — il lit les données par une RPC de forme différente, à reprendre séparément.

## [2.198.0] — migration **140** · admissions & candidatures en ligne
- **Une université ne pouvait recruter qu'en saisissant elle-même chaque dossier** : `inscriptions_sup` suppose un `eleve` qui existe déjà. Tout ce qui précède l'inscription — dépôt, examen, décision — se passait hors de l'application, et la donnée était retapée à l'arrivée.
- **Le candidat postule SANS COMPTE**, sur une page publique `/candidature?ecole=…` : exiger une inscription avant même de pouvoir candidater est le premier point d'abandon d'un portail d'admission. Le dépôt passe par des RPC accordées à `anon` (précédent : `verifier_document`) ; les tables, elles, restent fermées — `anon` n'a aucun accès direct.
- Il reçoit un **code de suivi** et consulte l'avancement de son dossier sur la même page, onglet « Suivre mon dossier » — même idiome que les codes parents et étudiants. Un refus ou une demande de complément lui affiche le texte saisi par la scolarité.
- **Côté établissement** (Pédagogie → Admissions, direction et secrétariat) : campagnes datées avec interrupteur d'ouverture, lien public copiable, compteurs par statut cliquables, liste paginée et recherche, fiche de dossier complète, décisions **soumise → en examen → complément → admise / liste d'attente / refusée**.
- **La conversion est le cœur de l'affaire** : un dossier admis devient un étudiant inscrit **sans ressaisie** — création de la fiche `eleves` (matricule compris) et de l'inscription LMD dans une seule transaction. Non rejouable : un dossier déjà transformé est refusé.
- Décisions horodatées **par un déclencheur en base** et non par l'interface : une date posée par le client serait celle de l'horloge du client.
- ⚠️ **Dit franchement : un point d'entrée anonyme est une surface de spam.** Trois garde-fous — campagne explicitement ouverte et datée, un seul dossier par e-mail et par campagne, longueurs plafonnées — mais aucun n'arrête un attaquant qui ferait varier l'adresse. Une limitation de débit demande une brique d'infrastructure (Edge Function + compteur) : à prévoir **avant** d'ouvrir une campagne à grande échelle.
- **Pas encore** : le dépôt de pièces jointes (relevé de notes, acte de naissance). Un téléversement anonyme vers le Storage est une surface distincte, qui mérite son propre travail.

## [2.197.0] — migration **139** · messagerie étudiante (+ un correctif de sécurité)
- 🔴 **Faille trouvée en chemin, corrigée ici.** `ecole_conversations()` (mig. 014) est `SECURITY DEFINER` et n'était gardée que par `ecole_courante()`. La migration 133 avait fermé la **table** `messages` aux enseignants — mais pas cette fonction, qui leur renvoyait le dernier message de **chaque** conversation parent. Le durcissement de la 133 était donc contournable par un simple appel RPC. Même garde-fou posé sur les deux fonctions (admin / direction / comptable / secrétaire).
- **L'étudiant peut écrire à sa scolarité** (`/etudiant/messagerie`, tuile sur son accueil avec pastille de messages non lus). Au supérieur il est majeur, paie lui-même et fait ses démarches seul : le faire passer par ses parents pour poser une question était la même incohérence que celle corrigée en v2.19x pour ses factures.
- **La table est étendue, pas dupliquée** : `eleve_id` rejoint `tuteur_id` dans `messages`, avec la contrainte « exactement un des deux » — même patron que l'emprunteur de `biblio_emprunts`. Un fil reste un fil ; une seconde table aurait dupliqué les RPC, la RLS et l'écran.
- **Côté établissement**, la page Messagerie prend deux onglets **Étudiants / Parents** au supérieur. À l'école, elle ne change pas. La recherche d'étudiant se fait **côté serveur** (8 résultats), et la liste des conversations ne contient que les fils réellement ouverts — dérouler 10 000 inscrits n'aurait été ni utilisable ni supportable.
- Un message de l'établissement **crée une notification** pour l'étudiant : une réponse qu'on ne voit pas est une réponse perdue. Le déclencheur sort immédiatement sur un fil parent — notifier aussi les parents changerait le comportement d'utilisateurs réels (le push est branché, mig. 066), c'est une décision à part.
- Détail qui compte : écrire à un étudiant **sans compte activé** est signalé dans l'en-tête du fil — le message part, mais personne ne le lira.

## [2.196.0] — migration **138** · phase 3 : emploi du temps du supérieur
- **L'université avait perdu son emploi du temps.** La page existante planifie par **classe** (`emplois_du_temps.classe_id` est `NOT NULL`) ; le supérieur n'a pas de classes, l'entrée de menu y avait donc été masquée en v2.185.0. Le besoin restait entier.
- **Nouveau modèle `emplois_sup`** (migration 138) : la séance se rattache à une **filière**, un **semestre** et une **UE** (ou un ECUE), avec son type — **CM / TD / TP** —, son jour, ses horaires, sa salle et son enseignant. C'est la maille réelle d'une université.
- **Page `Emploi du temps` (Pédagogie, supérieur)** : saisie par filière et semestre, séances regroupées par jour. Les créneaux qui **se chevauchent** sont encadrés en rouge et comptés en tête de page — une salle occupée deux fois, ou un étudiant convoqué à deux endroits, ne se voit pas à la lecture d'une liste.
- **L'étudiant voit sa semaine** (`/etudiant/emploi`, tuile sur son accueil), le jour courant mis en avant. Les séances passent par le RPC `mon_emploi_sup` : les tables de la maquette lui sont fermées, c'est la fonction qui résout son inscription (filière + niveau + année).
- Détails qui comptent : une séance dont l'heure de fin précède le début est **refusée en base** (contrainte), pas affichée à l'envers ; le RPC teste l'inscription par `exists` et non par une jointure, sinon un étudiant réinscrit dans la même filière verrait chaque cours en double.
- Six tests unitaires sur le regroupement par jour et la détection des chevauchements (dont le cas « bord à bord », qui n'est **pas** un conflit).
- **Corrigé sur données réelles** : l'étudiant de L1 recevait S1 **et** S2 dans la même semaine, puisque les deux semestres portent le niveau L1. Deux cours du lundi matin, un par semestre, se lisaient comme un conflit d'horaire inexistant. La page propose désormais un **sélecteur de semestre** ; les chevauchements se calculent à l'intérieur du semestre affiché.
- Emploi du temps de démonstration posé sur l'UCAD (L1 Maths, 11 séances au S1 et 6 au S2).

## [2.195.0] — aucune migration
- **Le sélecteur d'élève est étendu** à Cantine, Transport et Inscriptions (supérieur), en plus de Documents. Ces pages construisaient un menu déroulant d'un `<option>` par élève.
- **Le composant lit désormais l'établissement dans le contexte** au lieu de l'exiger en propriété. Sans ce changement, les trois conversions auraient **planté à l'ouverture** : ces sélecteurs vivent dans des modales, composants séparés où `ecoleId` n'est pas en portée. Le build ne détecte pas ce genre d'erreur — c'est la deuxième fois aujourd'hui qu'un identifiant manquant passe la compilation.
- `exclure` est lu **par référence** et non mis en dépendance d'effet : Cantine et Transport lui passent un `Set` reconstruit à chaque rendu, ce qui aurait relancé la recherche en boucle.
- **Non traité, volontairement** : ces pages continuent de charger la liste complète des élèves (plafonnée à 1000) pour d'autres usages. Le menu déroulant n'en dépend plus, mais retirer ces chargements suppose de vérifier chaque consommateur — un travail distinct.
- Vie scolaire n'est pas concernée : sa boucle sur les élèves est une grille d'appel bornée par la classe, pas un sélecteur.

## [2.194.0] — aucune migration · **fin de la phase 2**
- **Correction du diagnostic de l'audit.** Les 137 requêtes « non bornées » était une mesure **statique** qui surestimait le problème : `getSalaires` est filtré par période, le cumul d'IR par année et par employé, les notes de bulletin par les évaluations d'une classe. Ces requêtes ont une **borne métier naturelle** et n'avaient pas besoin d'être paginées. RH et Bulletins sortent donc du chantier.
- **Le vrai goulot restant était ailleurs** : six pages rendaient **un `<option>` par élève** dans un menu déroulant (Cantine, Transport, Messagerie, Documents, Vie scolaire, Inscriptions). Indolore à 96 élèves, impraticable à 10 000 — autant de nœuds dans le DOM, et une liste qu'on ne peut pas parcourir.
- **Nouveau composant `SelecteurEleve`** : on tape, le serveur renvoie au plus huit résultats (recherche bornée `chercherEleves`, anti-rebond 250 ms). Il sait exclure des élèves déjà traités sans que l'appelant charge toute la liste. Branché sur **Documents** pour valider le patron ; les cinq autres pages suivront.
  - Piège corrigé au passage : le composant pose son propre `<label>`, un `<label>` englobant aurait produit une imbrication invalide et détourné le clic sur les résultats.

## [2.193.0] — migration 137 · **phase 2 : tableau de bord**
- **Les agrégats financiers du tableau de bord passent en base.** La page faisait déjà bien deux choses sur quatre — l'effectif par un `count` sans transfert de lignes, la moyenne des notes par RPC. Mais elle rapatriait **toutes les factures de l'année et tous les paiements de six mois**… pour n'en faire que des sommes. À 10 000 élèves, plusieurs dizaines de milliers de lignes traversaient le réseau à chaque ouverture d'une page qui n'affiche que trois chiffres et un histogramme.
- L'histogramme mensuel est construit par `generate_series` : les **mois sans paiement** restent présents à zéro. Un graphique qui saute les mois vides donne une lecture fausse de la saisonnalité.
- Index `(ecole_id, date_paiement)` sur `paiements` : sans lui, le découpage mensuel parcourait toute la table à chaque ouverture.

## [2.192.1] — migration 136 · **phase 2 : page Paiements, et correctif d'une régression**
- **🔴 Correctif — `getEleves` avait changé de forme en 2.192.0** et renvoyait `{lignes, total}` au lieu d'un tableau. **Sept pages** l'utilisent pour alimenter leurs sélecteurs d'élèves — Cantine, Certificats, Inscriptions, Messagerie, Paiements, Transport, Vie scolaire — et se seraient toutes cassées en silence : JavaScript ne vérifie pas les formes d'objet, et le build passait. Le contrat d'origine est restauré ; la liste paginée porte désormais un nom distinct, `getElevesPage`.
- **La page Paiements est paginée** (25 factures), recherche comprise.
  - Elle passe par une **RPC** (`factures_paginees`, migration 136) et non par `.range()` : la recherche doit porter à la fois sur le numéro de facture et sur l'élève embarqué, ce que **PostgREST refuse de combiner dans un même `or()`** — vérifié sur la base, erreur `PGRST100`. Le OU est donc écrit en SQL.
  - La garde de la RPC **reproduit exactement** la RLS posée en migration 133 : une fonction `SECURITY DEFINER` contourne la RLS, et sans cette précaution elle aurait rouvert la fuite que la phase 0 venait de fermer.
  - `getSoldesEleves` ne s'appuie plus sur la liste : un solde calculé sur une page serait faux. Requête dédiée, trois colonnes au lieu des lignes complètes.
  - Index `(ecole_id, annee_id, date_emission desc)` ajouté pour le tri de la liste.

## [2.192.0] — aucune migration · **phase 2 : pagination, page Élèves**
- **La page Élèves charge désormais 25 élèves à la fois**, au lieu de la table entière. Recherche, filtre de classe et filtre de statut s'exécutent **en base** — les appliquer après coup n'aurait filtré que la page affichée.
- Le second chargement complet de `inscriptions` disparaît : l'inscription de l'année est embarquée dans la même requête. La carte `inscriptions[eleve.id]` est reconstruite depuis la page, ce qui laisse tout le rendu existant inchangé.
- **La restriction « enseignant »** part au serveur elle aussi : un enseignant ne voit que ses classes, filtrées en base et non après coup.
- **⚠️ Piège évité — la feuille de présence imprimable.** Elle liste tous les élèves du filtre ; paginer naïvement n'en aurait imprimé que 25, en silence, sur un usage réel de Tut'Tank. Elle charge maintenant un **lot complet borné** à son ouverture, et **avertit** si le plafond de 1000 l'a tronquée.
- Recherche **anti-rebond** (300 ms) : sans cela chaque frappe déclenchait une requête. Tout changement de filtre ramène en page 1.
- `bornesPagination` / `nbPages` quittent `biblio.regles.js` pour un module partagé `pagination.js` — elles n'avaient rien de bibliothécaire et deviennent le socle des pages suivantes. `biblio.regles.js` les réexporte, aucun import existant n'est cassé.
- Formes de requête **vérifiées sur la base réelle** avant d'écrire le code (jointure interne, filtre de classe, recherche, et le cas retors des non-inscrits par jointure gauche bornée à l'année).

## [2.191.0] — aucune migration
- **Pilotage → « Journal des actes »**, l'écran qui manquait à la phase 1. `restaurer_depuis_journal` exige `auth.uid()`, **NULL dans l'éditeur SQL de Supabase** : la fonction livrée en 2.190.0 n'avait donc **aucune porte d'entrée** — exactement le défaut que cet audit relève ailleurs. Le promoteur consulte désormais les modifications et suppressions, déplie le détail champ par champ (valeur avant en rouge, après en vert) et **restaure une suppression en un clic**.
  - La confirmation rappelle explicitement que **seule la ligne revient**, pas les enregistrements partis en cascade.
  - Pagination **serveur** dès la première version : ce journal grossit à chaque note modifiée, le charger entièrement aurait reproduit le défaut que la phase 2 doit corriger ailleurs.

## [2.190.0] — migration 135 · **phase 1b : réversibilité des suppressions**
- **Le soft delete généralisé a été écarté, après examen.** Les neuf suppressions de données sensibles ne sont pas de même nature : **`notes_lmd` et `bulletin_lignes` ne détruisent rien, elles reconstruisent** (on efface les notes d'une UE avant de réécrire la saisie ; on vide un bulletin avant de le régénérer). Les passer en soft delete aurait cassé la saisie de notes et la génération des bulletins, et accumulé des lignes fantômes en conflit avec les index uniques. Par ailleurs, masquer une ligne par RLS ne la masque **pas** aux fonctions `SECURITY DEFINER` ni aux agrégats, qui s'exécutent comme propriétaire : une facture « supprimée » aurait continué de compter dans les totaux.
- **La réversibilité est obtenue autrement** : la migration 134 conserve déjà la **ligne entière** à la suppression. Il ne manquait qu'un moyen de la rejouer — c'est `restaurer_depuis_journal(id)`, réservée au promoteur, avec liste blanche de tables (une fonction `SECURITY DEFINER` acceptant un nom de table libre serait une porte d'escalade), refus d'écraser une ligne recréée depuis, et traçage de la restauration elle-même.
- **⚠️ Limite documentée** : la fonction restaure **une ligne, pas une cascade**. Supprimer un élève efface aussi inscriptions, notes et factures ; celles qui portent un trigger sont récupérables une à une, les autres (liens tuteurs, pièces jointes, absences) sont perdues. **La suppression d'un élève reste l'acte le plus destructeur de l'application** — c'est le seul endroit où un vrai soft delete resterait justifié.

## [2.189.0] — migrations 133 → 134 · **suites de l'audit global, phases 0 et 1a**
Aucun fichier applicatif modifié : ces deux migrations ne touchent que la base.

- **🔴 PHASE 0 — confidentialité à l'intérieur d'un établissement** (migration 133). Mesuré avec un vrai compte `enseignant`, sans aucun droit d'interface sur les finances : il lisait par simple appel REST les **factures**, les **paiements**, les **déclarations de paiement** et les **messages privés entre les familles et l'école**. L'interface masquait, la base autorisait — le type même de faille qui résiste à une revue d'écrans.
  - Cause : la migration 001 pose sur 37 tables une policy `<table>_tenant` qui ne contrôle **que l'établissement, pas le rôle**. La comptabilité et la paie avaient été durcies depuis ; la facturation et la messagerie étaient restées en arrière.
  - Les policies sont supprimées **dynamiquement** via `pg_policies`, pas par leur nom : celles de `factures`/`paiements` naissent d'une boucle `execute format` et celle de `declarations_paiement` d'une migration jamais versionnée. Un `drop if exists` sur un nom inexistant n'aurait rien retiré — et **deux policies permissives s'additionnent**, le correctif aurait été sans effet.
  - Vérifié après application : les cinq tables renvoient 0 pour un enseignant, qui conserve élèves, notes, classes, matières et catalogue.
  - `tuteurs` reste volontairement lisible : l'enseignant y accède depuis la fiche de l'élève et peut devoir joindre une famille.
- **PHASE 1a — traçabilité des actes contestables** (migration 134). Aucune trace n'existait sur la modification d'une note, la suppression d'un élève, l'annulation d'un paiement ou le changement de rôle. Un trigger commun alimente désormais `journal_audit` pour `notes`, `notes_lmd`, `releves`, `bulletins`, `factures`, `paiements`, `eleves`, `inscriptions_sup` et `profil_roles`.
  - **UPDATE et DELETE seulement** : une création est rarement contestée et serait très bruyante en saisie de masse. Le détail ne conserve que les champs réellement modifiés, avec leur valeur avant et après ; à la suppression, la ligne entière — sans elle on saurait qu'on a supprimé, pas quoi.
  - `SECURITY DEFINER`, sans quoi la RLS empêcherait un enseignant d'écrire au journal et sa modification passerait sans trace.
  - Trois journaux coexistaient ; on étend le seul vivant. **`audit_log` n'a aucun écrivain depuis la migration 001** : elle est marquée obsolète par un commentaire, pas supprimée — une suppression est irréversible et cette migration doit rester sans risque.

## [2.188.0] — aucune migration
- **Gestion se replie à son tour en sections** : **Scolarité** (Élèves, Codes parents, Documents, Demandes), **Finances** (Paiements, Recouvrement, Comptabilité), **Services aux familles** (Cantine, Transport), plus Communication et Bibliothèque déjà groupées. Dix entrées traînaient en vrac au-dessus. Les deux grands espaces se lisent désormais de la même façon.
- Le test « toute page métier porte un groupe » couvre maintenant **Pédagogie et Gestion** : ajouter une page en oubliant sa section fait échouer la suite.

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
