# GesSchool — Mode d'emploi

Guide d'utilisation pas à pas, de la création de l'école à l'usage quotidien.
Application web (PWA) : utilisable sur ordinateur, tablette et téléphone, depuis un navigateur — installable comme une application.

> **Version 2.254 · mise à jour du 6 octobre 2026.** Cette édition intègre ce qui a été construit après la visite d'établissement : circuit du bulletin et procès-verbal du conseil de classe, suivi des acquis au préscolaire, programmation officielle de l'IEF, photos d'élèves, indicateur de paiement, paliers d'établissement, présence par séance au supérieur. Les **51 écrans** du menu y sont décrits, et une épreuve automatique refuse qu'un écran neuf parte en production sans sa page de manuel.
>
> **Où le retrouver** : dans l'application, lien **📖 Aide & mode d'emploi** en bas de la barre latérale (ou dans le menu **Compte** sur téléphone), qui ouvre la page d'aide — ce manuel y est le dernier lien.

> **Vous cherchez juste à faire votre travail ?** Ce manuel décrit **tous** les écrans ; votre métier n'en utilise qu'une partie. Quatre guides courts, imprimables, en extraient l'essentiel :
> **[Enseignante](guide-enseignant.html)** · **[Direction](guide-direction.html)** · **[Gestion](guide-gestion.html)** · **[Parent](guide-parent.html)**.
> Ils sont rassemblés sur la **[page d'aide](aide.html)**, c'est-à-dire exactement ce qu'ouvre le lien **📖 Aide & mode d'emploi** de l'application.

> **Vous ouvrez GesSchool pour la première fois ?** Allez directement à l'annexe **§28 — Votre première semaine, pas à pas**. Elle donne l'ordre dans lequel procéder, et les étapes qu'il ne faut pas sauter.

**📑 Accès rapide** — cliquez sur une rubrique pour y aller directement :

[SOMMAIRE]

---

## 0. Concepts de base (à lire une fois)

**GesSchool** organise le travail en **espaces** selon le métier de chaque utilisateur :

| Espace | Icône | Pour qui | Menus |
|---|---|---|---|
| **Pilotage** | 🎯 | Promoteur (accès total) | Vue consolidée de toutes ses écoles, **Mise en route**, **Passage d'année**, **Membres** |
| **Pédagogie** | 🎓 | Responsable pédagogique, enseignants, surveillants | Accueil, **Feuille de présence**, **Cahier de textes**, **Progression**, **Programmation officielle**, **Suivi des acquis**, Élèves, **Photos des élèves**, Structure, Notes, Bulletins, **Classement**, **Emploi du temps**, Vie scolaire, **Assiduité**, Fournitures, **Membres** |
| **Gestion** | 💼 | Comptable, secrétaire / caisse | Accueil, Élèves & inscriptions, **Documents**, **Demandes**, Paiements, Recouvrement, **Cantine**, **Transport**, Annonces, Messagerie, **Membres**, Paramètres |
| **RH & Paie** | 🧑‍💼 | Responsable RH | Personnel & paie, Enseignants, Comptabilité, **Membres** |
| **Parent** | 👪 | Familles | Suivi de chaque enfant (voir §17) |

- Le **promoteur** (créateur de l'école) voit **tous les espaces** et configure l'établissement. Les **responsables** (pédagogique, RH, comptable) sont **cloisonnés à leur domaine** ; chacun **gère ses propres accès** (voir §4).
- Le **sélecteur d'espace** est en haut à gauche de la barre latérale (visible si vous avez accès à plusieurs). Les onglets et menus passent à la ligne pour rester visibles sur téléphone.
- Chaque **module** (Finances, Évaluations, RH, Cantine, Transport…) peut être activé/désactivé **par le promoteur** (Paramètres → Modules).
- Chaque accueil met en avant une zone **« À traiter »** (ce qui demande une action) — voir §15.
- Chacun **atterrit dans son espace** à la connexion (un enseignant arrive sur la **Feuille de présence**, un comptable sur son **tableau de bord Gestion**…).
- **Le menu s'adapte à ce que l'établissement couvre.** Un établissement qui ne fait que l'élémentaire ne voit pas les écrans du supérieur, et inversement. Un établissement qui couvre les deux voit les deux (voir §2.4).

**Rôles disponibles :** Promoteur, Responsable pédagogique, Comptable / Gestion, Responsable RH, Secrétaire / Caisse, Enseignant, Surveillant, Parent, Super-admin.

---

## 1. Créer son compte et son école

### 1.1 Créer le compte
1. Ouvrir l'application → page **Connexion**.
2. Onglet **Inscription** → e-mail + mot de passe (min. 6 caractères) → **Créer le compte**.
3. Selon la configuration, un e-mail de confirmation peut être demandé : le valider, puis se connecter.

### 1.2 Choisir son profil
Au premier accès, l'écran **Bienvenue** propose quatre entrées :
- **🏫 Je gère une école** → crée l'établissement (cas du **promoteur**).
- **🧑‍💼 Je suis un membre du personnel** → rejoint l'établissement avec un **code d'invitation** (voir §4).
- **🧑‍🏫 Je suis un enseignant** → relie son compte à sa fiche avec un **code** (voir §4).
- **👪 Je suis un parent** → rejoint un enfant avec un **code de liaison** (voir §17).

> Si vous avez reçu un **lien d'invitation** (`…/#/rejoindre?code=…`), il vous suffit de l'ouvrir : après création du compte, le code est pré-rempli automatiquement.

### 1.3 Assistant de création de l'école (3 étapes)
1. **Identité** : nom, sigle, type (Privé / Public / Confessionnel / Franco-arabe), logo et cachet (optionnels), couleurs.
2. **Cycles ouverts** : cocher les cycles présents (Préscolaire, Élémentaire, Collège, Lycée, Formation pro, Université).
3. **Responsable & année** : prénom/nom, libellé de l'année (ex. 2025-2026), dates, et découpage **Trimestres (3)** ou **Semestres (2)**.
4. **Créer l'établissement**.

➡️ L'école, ses cycles, votre compte admin, l'année et les périodes sont créés automatiquement. La **checklist de mise en route** (§15) vous guide ensuite pour le reste du paramétrage.

---

## 2. Configuration initiale

### 2.1 Structure académique (menu **Structure**)
Ordre logique : **Niveaux → Classes → Matières → (Séries) → Coefficients**.
- **Niveaux** : dans chaque cycle, taper un niveau (6e, CP, Seconde) → **+ Niveau**. ⚠️ L'**ordre** des niveaux doit être correct (6e avant 5e…) : il sert de base à la **promotion des élèves** au passage d'année (§16).
- **Classes** (génération en lot) : base du nom + nombre + suffixe (A,B,C / 1,2,3 / aucun) + série + effectif → **+ Générer** (doublons ignorés).
- **Matières** : libellé + code (ex. MATH).
- **Séries** (lycée) : créer L, S2… ou **+ Pré-remplir les séries standard**.
- **Grille de coefficients** : choisir une portée (série OU niveau), saisir le coefficient de chaque matière (vide = non comptée).

### 2.2 Paramètres (menu **Paramètres**)
- **Établissement** : nom, sigle, devise, **logo** et **cachet** (utilisés sur factures, bulletins, certificats), et **Apparence** — une **couleur d'accent** propre à l'école, avec aperçu en direct.
- **Signataires** : liste des responsables habilités à signer (nom, fonction, signature), rattachés à leur compte pour la **validation des documents** (§9).
- **Notation & bulletins** : **barème** (ex. /20), **moyenne de passage**, **mentions** personnalisées (seuils et libellés), et affichage du rang / des appréciations / de la décision. Ces réglages pilotent les bulletins (§7).
- **Champs personnalisés de l'élève** : ajoutez vos propres champs (texte, nombre, date, liste) qui apparaissent sur la fiche élève et à l'inscription (et sont **mappables à l'import**, §3).
- **Matricule** : préfixe, séparateur, nombre de chiffres, et **Année** — laissez vide pour l'année civile automatique, **ou fixez-la** (ex. 2026) pour que toute une rentrée porte le même « 26 », quelle que soit la date de saisie. Aperçu ex. `CLB-26-0001`.
- **Modules actifs** (réservé au **promoteur**) : activer/désactiver des modules (Cantine, Transport, RH…). Un module désactivé disparaît des menus.

### 2.3 Paiement mobile (menu **Paiements → onglet Paiement mobile**)
Saisir vos numéros **Wave / Orange Money / Free Money** (affichés aux parents pour régler les factures et déclarer un paiement).

### 2.4 Ce que l'établissement couvre, et sa pédagogie (**Paramètres → Établissement**)

C'est ici que vous déclarez **les paliers** de votre établissement, et c'est **ce choix qui détermine les écrans visibles**.

- Les **cas courants en un clic** : « Élémentaire », « Élémentaire et Collège », « Élémentaire, Collège et Lycée », « De l'Élémentaire à l'Université », « Collège et Lycée », « Université seule », « Formation professionnelle ».
- Des **cases à cocher** en dessous pour tout cas particulier. Les deux vont ensemble : cliquer un cas courant coche les cases.
- **Élémentaire inclut le préscolaire** — c'est un seul palier.
- Un établissement peut couvrir **l'élémentaire ET l'université** : il voit alors **les deux** jeux d'écrans.
- Si un palier manque au milieu de l'échelle (élémentaire et lycée, sans collège), l'écran le **signale** sans l'interdire : vous avez peut-être une raison.
- **Tant que rien n'est déclaré**, l'établissement fonctionne exactement comme avant : rien ne disparaît.

**Pédagogie de l'élémentaire** — le choix n'apparaît que si l'élémentaire est couvert :

| | |
|---|---|
| **Classique** | un niveau par classe |
| **Montessori** | classes multi-niveaux (TPS/PS, CI/CP…) |

En Montessori, précisez le **niveau réel** de chaque enfant avec les **sous-niveaux** (Structure → Niveaux & classes) : la classe s'appelle « TPS/PS A », et chaque enfant y est TPS **ou** PS. Le tarif, le programme et les fournitures restent posés sur le niveau de la classe ; le sous-niveau ne sert qu'à dire où en est l'enfant.

### 2.5 Découpage de l'année et responsables de cycle (menu **Structure**)

- **Découpage de l'année** : donnez à chaque trimestre (ou semestre) sa **date de début et de fin**. ⚠️ **Sans ces dates, les absences ne peuvent pas être comptées sur les bulletins** — l'application affiche alors « absences non comptabilisées » plutôt qu'un zéro trompeur. Deux périodes qui se chevauchent sont signalées, sans être interdites.
- **Responsables de cycle** : désignez **qui répond de chaque cycle** (préscolaire, élémentaire…). C'est **indispensable** pour la signature du procès-verbal du conseil de classe (§7.3) — sans désignation, personne ne peut signer, pas même la direction. **Seul le promoteur** peut désigner : si la direction pouvait se désigner elle-même, sa signature ne vaudrait plus rien.

---

## 3. Élèves & inscriptions (menu **Élèves**)

C'est l'écran le plus utilisé de l'application. Tout part de là : les notes, les factures, les bulletins, l'accès des parents.

### 3.1 Ce que vous voyez

Un tableau avec une ligne par élève : **photo** (ou ses initiales), **matricule**, **nom et prénom**, **sexe**, **classe**, **statut d'inscription**, et — si vous avez filtré sur une classe — une colonne **Paiement** (§19).

Au-dessus, trois outils :

| Outil | À quoi il sert |
|---|---|
| **Champ de recherche** | nom, prénom ou matricule. La recherche part après une courte pause de frappe, inutile de valider. |
| **Toutes les classes** | n'afficher qu'une classe. C'est aussi ce qui fait apparaître la colonne Paiement. |
| **Tous les statuts** | Inscrit · Réinscrit · Abandon · Non inscrit |

> **« Non inscrit »** n'est pas une erreur : c'est un élève créé dans l'établissement mais pas encore rattaché à une classe pour l'année en cours. Cela arrive à l'import quand la colonne Classe ne correspond à aucune classe existante.

### 3.2 Ajouter un élève un par un

**+ Nouvel élève**, puis :

| Champ | Obligatoire | Remarque |
|---|---|---|
| **Prénom**, **Nom** | oui | — |
| **Sexe** | non | Masculin / Féminin — sert aux accords dans les documents (« né » / « née ») |
| **Date** et **lieu de naissance** | non | nécessaires pour les certificats ; vous pouvez compléter plus tard |
| **Matricule** | non | **laissez vide** : il est attribué automatiquement selon votre format (§2.2) |
| **Classe** | non | inscrit l'élève pour l'année en cours |
| **Responsable** | non | nom + téléphone. Crée le parent et le rattache à l'enfant |
| Vos **champs personnalisés** | selon votre réglage | ceux que vous avez définis dans Paramètres |

**Ce qui se passe ensuite** : l'élève apparaît dans la liste avec son matricule. S'il a une classe, il est **inscrit** ; sinon il reste **non inscrit** jusqu'à ce que vous l'inscriviez depuis sa fiche.

### 3.3 Importer une liste (Excel ou CSV)

C'est la bonne méthode pour une rentrée. Comptez une vingtaine de minutes pour 100 élèves, préparation du fichier comprise.

**Avant d'importer** — et c'est l'étape qui fait échouer les imports :

1. **Créez d'abord vos classes** (Structure, §2.1). Sans classes, les élèves seront créés mais **non inscrits**.
2. Dans votre fichier, la colonne **Classe** doit contenir **exactement** le libellé de la classe, caractère pour caractère : `CI/CP A` et `CI-CP A` ne sont pas la même chose.

**L'import, étape par étape :**

1. **↑ Importer (Excel)** → choisissez votre fichier `.xlsx` ou `.csv`.
2. L'application lit les en-têtes et **devine** à quoi correspond chaque colonne. Un écran vous montre son interprétation.
3. **Vérifiez et corrigez** les associations. Seuls **Prénom** et **Nom** sont obligatoires ; vous pouvez associer Sexe, Date de naissance, Lieu de naissance, Matricule, Classe, **Parent/Tuteur**, **Téléphone du parent**, et vos champs personnalisés. Une colonne que vous laissez non associée est simplement ignorée.
4. **Suivant →** puis **Terminer**.
5. Un **bilan** s'affiche : combien d'élèves créés, combien inscrits en classe, combien de parents créés et rattachés, combien de lignes ignorées.

**Lisez ce bilan.** C'est là que vous verrez, par exemple, « 96 créés, 88 inscrits » — les 8 manquants ont une classe qui ne correspond à rien.

> Un **modèle de fichier** est fourni : `modele-import-eleves.csv`. Les colonnes attendues sont `prenom, nom, sexe, date_naissance, lieu_naissance, matricule, classe, parent_nom, parent_tel`. Le sexe s'écrit `M` ou `F`, la date au format `AAAA-MM-JJ`.

### 3.4 La fiche d'un élève

Cliquez sur une ligne. Vous y trouvez quatre parties :

- **État civil** et **photo** — « Ajouter une photo » / « Changer la photo ». Pour photographier toute une classe, préférez l'écran dédié (§23).
- **Vos champs personnalisés**.
- **Responsables** : les parents rattachés. Le bouton **Code parent** génère le code qui permettra à la famille de créer son compte (§17.1).
- **Inscriptions** : l'historique année par année, avec la classe et — en Montessori — le **sous-niveau** réel de l'enfant (§2.4).

### 3.5 Supprimer

Deux façons : l'icône **🗑️** sur une ligne, ou les **cases à cocher** puis **« Supprimer la sélection »** pour plusieurs élèves.

> ⚠️ **La suppression emporte tout ce qui est rattaché à l'élève** : inscriptions, notes, bulletins, factures, paiements, absences, documents. Une confirmation le rappelle. S'il s'agit d'un élève qui a quitté l'école, préférez passer son inscription en **Abandon** : vous gardez son dossier et son historique.

### 3.6 Qui peut quoi

| | Voir | Créer, importer, supprimer |
|---|---|---|
| Promoteur, comptable, secrétariat | tout l'établissement | **oui** |
| Responsable pédagogique, surveillant | tout l'établissement | non |
| Enseignant | **ses classes seulement** | non |

### 3.7 Si ça ne marche pas

- **« L'import n'a inscrit personne en classe »** → la colonne Classe ne correspond pas aux libellés exacts. Corrigez le fichier et réimportez : les élèves déjà créés ne seront pas dupliqués si les matricules correspondent.
- **« Impossible d'inscrire un élève »** → aucune classe n'existe pour l'année en cours. Créez-les dans Structure.
- **« Un élève n'apparaît pas »** → vérifiez le filtre de statut : un « non inscrit » est masqué si vous filtrez sur « Inscrit ».
- **« Je ne vois que quelques élèves »** → vous êtes connecté avec un compte enseignant, qui ne voit que ses classes.

---

## 4. Membres de l'équipe & délégation des accès (menu **Membres**)

GesSchool fonctionne en **cascade de délégation** : le **promoteur** configure l'école puis crée les **responsables** ; chaque responsable, cloisonné à son domaine, crée et gère à son tour **ses** sous-utilisateurs.

```
Promoteur                → configure l'école, garde un raccourci total
 ├─ Responsable pédagogique → invite profs, surveillants, parents
 ├─ Responsable RH          → invite le personnel (secrétaire / caisse)
 └─ Comptable / Gestion     → invite une secrétaire / caisse
```

### 4.1 Qui peut inviter qui
| Vous êtes… | Vous pouvez inviter/gérer |
|---|---|
| **Promoteur** | Tous les rôles |
| **Responsable pédagogique** | Enseignant, Surveillant, Parent |
| **Responsable RH** | Secrétaire / Caisse |
| **Comptable / Gestion** | Secrétaire / Caisse |

### 4.2 Inviter un membre
1. Ouvrir le menu **Membres** (présent dans votre espace).
2. **+ Inviter un membre** → choisir le **rôle** + e-mail (optionnel) → **Générer le code d'invitation**.
3. Un **code à 8 caractères** et un **lien** s'affichent → les transmettre via **Copier**, **WhatsApp** ou **Email**.

> 🔒 **Verrouillage par e-mail (optionnel)** : si vous renseignez l'e-mail, l'invitation n'est utilisable **que** par un compte créé avec **cette** adresse. Laissez vide pour un code utilisable par tout destinataire. Transmettez le code **en privé**.

### 4.3 Donner un accès à quelqu'un qui est **déjà** dans l'application

C'est le cas le plus fréquent au bout de quelques mois : la personne travaille déjà avec vous, et vous voulez simplement **élargir** ce qu'elle peut faire. Il ne faut **pas** lui renvoyer un code d'invitation.

**Membres** → sur sa ligne → **« + Donner un accès… »** → choisir l'accès → confirmer.

> **Ses accès actuels sont conservés.** Donner « Comptable / Gestion » à une responsable pédagogique ne lui retire rien : elle garde ses notes, ses bulletins et ses classes, et gagne Paiements, Recouvrement, Comptabilité, Documents, Cantine et Transport. C'est exactement le cas d'une école où les responsables de cycle tiennent aussi la gestion.

**Seul le promoteur** peut le faire — et la base le refuse aux autres, pas seulement l'écran. Pour retirer un accès, la croix **✕** à côté de son nom.

### 4.4 Limiter quelqu'un à **un seul cycle**

Le cas typique : votre école a un préscolaire et un élémentaire, chacun avec sa responsable, et chacune n'a pas à voir les élèves de l'autre.

**Membres** → sur sa ligne → le sélecteur **« Toute l'école / … seulement »** → choisir le cycle → confirmer.

À partir de là, cette personne ne voit plus que son cycle : **les élèves, les inscriptions, les classes, les bulletins, les notes, les absences, les factures, les abonnements cantine et transport** — et **les totaux suivent**. Son tableau de bord affiche le montant facturé de son cycle, pas celui de l'école.

> **Elle garde tous ses accès.** Le périmètre ne touche pas à ce qu'elle peut FAIRE, seulement à QUI elle le fait. Une responsable qui encaisse continue d'encaisser — pour les familles de son cycle.

**Deux personnes ne sont jamais limitées** : **vous** (le promoteur) et la **responsable RH**. Même si vous vous désignez sur un cycle, vous continuez de tout voir — sinon vous perdriez la main sur votre propre établissement sans pouvoir revenir en arrière.

Le sélecteur n'apparaît **que si votre école a au moins deux cycles**, et **seul le promoteur** peut le régler. Pour revenir en arrière : **« Toute l'école »**.

### 4.5 Rejoindre (côté invité)
L'invité crée un compte, choisit **« 🧑‍💼 Je suis un membre du personnel »** et saisit le code — ou ouvre le **lien d'invitation** (code pré-rempli). ✅ Son compte est créé avec le bon rôle.

### 4.6 Enseignants reliés à leur fiche
Pour qu'un enseignant retrouve **ses** classes (Appel, Notes…), son compte doit correspondre à sa **fiche** :
1. **Enseignants** → ouvrir la fiche (e-mail conseillé) → **« Code d'accès »** → l'enseignant choisit **« 🧑‍🏫 Je suis un enseignant »** et le saisit. *Astuce : si l'e-mail du compte = l'e-mail de la fiche, la liaison est automatique.*
2. **Affectations** : relier enseignant × classe × matière (alimente coefficients **et** la génération d'emploi du temps).

### 4.7 Invitations en attente & 4.8 Révoquer/suspendre
La section **« Invitations en attente »** liste les codes non utilisés (Copier le lien / Annuler). Sur chaque personne gérée : **✕** retire un rôle ; **Suspendre** bloque l'accès (« Compte suspendu »), **Réactiver** le rétablit.

---

## 5. Le quotidien de l'enseignant (espace Pédagogie)

Quatre gestes, dans l'ordre d'une journée.

### 5.1 Le matin : la feuille de présence

*(Anciennement « Appel ».)*

1. Choisissez votre **classe** dans le sélecteur en haut — s'il n'y en a qu'une, elle est déjà là.
2. Pour chaque élève : **Présent** · **Absent** · **Retard**. **Tout le monde est présent par défaut**, vous ne marquez que les exceptions.
3. **Valider**.

**Ce qui se passe ensuite** : les absences partent à l'administration **et** aux **parents des absents** (🔔). Le parent peut alors justifier depuis son espace, et vous retrouverez sa réponse dans **Vie scolaire** (§13.1).

**Deux points qui comptent :**

- **Refaire l'appel du jour ne détruit rien.** Si vous vous êtes trompé, corrigez et revalidez : les **justifications** déjà saisies par les familles sont conservées. Seul le pointage change.
- La feuille est **imprimable** et porte le nom de la personne qui l'a remplie — utile pour l'archivage papier ou une inspection.

**Qui voit quoi** : la direction et le responsable pédagogique voient **toutes les classes** ; un enseignant, seulement les siennes. C'est ce qui permet, dans les écoles où les responsables pédagogiques font le travail des enseignantes, de faire l'appel de n'importe quelle classe.

> Au **supérieur**, la présence ne se pointe pas par journée mais **par séance** (§22).

### 5.2 Après la séance : le cahier de textes

Une entrée par séance : **date**, **matière**, **contenu** de la séance, et si besoin les **devoirs** avec leur « pour le… ».

- Le bouton **📋 Reprendre la programmation** ouvre les contenus officiels du mois pour le niveau de la classe, filtrables par domaine et par semaine. Un clic remplit le champ — **et le texte reste modifiable** (§21.2). C'est la différence entre choisir et ressaisir.
- Les entrées sont **visibles des parents** : un enfant absent retrouve ce qui a été fait.

### 5.3 Au fil des semaines : la progression

Planifiez vos leçons à l'avance : un **titre** (chapitre, leçon), une **description**, une **période**, une **date prévue**, et un état — **À faire** · **En cours** · **Fait**.

C'est ce qui permet, en conseil ou devant un inspecteur, de montrer où l'on en est du programme sans reconstituer l'historique de mémoire.

### 5.4 Au préscolaire : observer plutôt que noter

Les classes du préscolaire n'ont pas de notes. À la place, le **suivi des acquis** (§20) : pour chaque item observable, **acquis** · **en cours d'acquisition** · **pas encore**.

### 5.5 Les deux écrans de suivi

| Écran | Ce qu'il montre |
|---|---|
| **Assiduité** | absences et retards **par élève** sur une période ; les élèves à 5 incidents ou plus sont surlignés |
| **Photos des élèves** | la prise de vue classe par classe, au téléphone (§23) — réservée à la direction et au secrétariat |

### 5.6 Si ça ne marche pas

- **« Je ne vois aucune classe »** → aucune classe ne vous est attribuée pour l'année en cours. Il faut être **professeur principal** ou avoir une **affectation** sur une matière de cette classe (Structure). Si vous êtes direction, vous devriez voir toutes les classes : vérifiez que l'année courante est bien ouverte.
- **« Mon compte n'est pas relié à une fiche enseignant »** → l'administration doit renseigner votre **e-mail** sur votre fiche dans RH → Enseignants. Ce message ne concerne pas la direction, qui n'a pas besoin de fiche enseignant.
- **« Le bouton Reprendre la programmation n'apparaît pas »** → la direction n'a pas encore déposé la planification du niveau (§21.1). Saisissez la séance à la main en attendant.

---

## 6. Notes (menu **Notes**)

### 6.1 Le principe

Une **note** appartient toujours à une **évaluation** : on ne saisit pas une note « en l'air ». Une évaluation, c'est un devoir, une composition, une interrogation — avec son barème, son coefficient et sa date. C'est ce qui permet au bulletin de calculer une moyenne qui veut dire quelque chose.

### 6.2 Créer une évaluation

1. Choisissez **Classe**, **Période**, **Matière** — les trois sont nécessaires.
2. **+ Ajouter** :

| Champ | Remarque |
|---|---|
| **Type** | devoir, composition, interrogation… |
| **Libellé** | ce que l'élève reconnaîtra : « Devoir n°2 — fractions » |
| **Barème** | sur combien l'évaluation est notée. Vous pouvez noter sur 10 ou sur 40 : le bulletin ramènera tout au barème de l'école (§2.2) |
| **Coefficient** | le poids dans la moyenne de la matière |
| **Date** | sert au classement chronologique et au suivi |

### 6.3 Saisir les notes

Cliquez l'évaluation : la liste des élèves de la classe apparaît.

- Saisissez les notes **sur le barème de l'évaluation** (si elle est sur 40, saisissez sur 40).
- Cochez **Absent** pour un élève qui n'a pas fait l'épreuve : il ne pèsera pas sur sa moyenne. **Une absence n'est pas un zéro** — un zéro fait chuter la moyenne, une absence est neutre. La distinction compte pour la famille.
- **✓ Enregistré** s'affiche quand c'est écrit. Vous pouvez quitter et revenir : rien n'est perdu.

### 6.4 Ce que cela change ailleurs

- Les notes alimentent le **calcul des bulletins** (§7) et le **classement** (§8).
- Chaque nouvelle note **notifie le parent** (🔔), s'il a activé les notifications.
- Au **préscolaire**, on ne note pas : voyez le **suivi des acquis** (§20).

### 6.5 Si ça ne marche pas

- **« Aucune évaluation »** → vous n'en avez pas encore créé pour cette classe, cette période et cette matière. Les trois filtres comptent.
- **« Inscrivez des élèves dans cette classe »** → la classe est vide pour l'année en cours.
- **« Un enseignant ne voit pas la matière »** → il n'y est pas **affecté** (Structure → affectations). Un enseignant ne saisit les notes que des classes **et** matières qui lui sont attribuées.

---

## 7. Bulletins : un circuit en trois temps (menu **Bulletins**)

> ⚠️ **Ce chapitre a changé.** Auparavant, enregistrer un bulletin le rendait **aussitôt visible** du parent : aucune relecture n'était possible. Le bulletin suit désormais un circuit, et la diffusion est un **acte distinct**.

### 7.1 Établir les bulletins
1. Choisir **Classe** + **Période** → **Calculer les bulletins** (rang, moyenne, mention selon vos réglages de **Notation**, §2.2).
2. Cliquer **Bulletin →** : saisir les **appréciations par matière**, l'**appréciation générale**, la **décision du conseil** → **💾 Enregistrer**.
3. Ou **💾 Enregistrer les bulletins** (en-tête) pour toute la classe d'un coup.

Les bulletins naissent en **brouillon** : **le parent ne les voit pas encore**.

### 7.2 Le panneau « Circuit »
Il apparaît dès qu'une classe a des bulletins et répond à la seule question qui compte : *est-ce que les familles le voient ?*

| État | Ce que cela veut dire |
|---|---|
| **Brouillon** | En relecture — le parent ne le voit pas. |
| **Validé** | Arrêté par la direction — le parent ne le voit pas encore. |
| **Publié** | Visible dans l'espace parent. |

- **✓ Valider** puis **📤 Publier aux parents** font avancer **toute la classe**.
- **↩️ Retirer de l'espace parent** ramène en brouillon — l'écran prévient que les familles qui l'ont déjà consulté ne le verront plus.
- Le panneau indique **combien de familles ont consulté** le bulletin (« 7 consultés sur 12 publiés »).
- Une classe dont les bulletins sont **dispersés entre deux états** est signalée comme telle : on ne vous dira pas « publié » si trois élèves sont restés en brouillon.
- **Seule la direction** arrête et diffuse. Un enseignant voit l'état de sa classe mais n'a aucun bouton — et cela vaut aussi par l'API, pas seulement à l'écran.

#### Si un bulletin ne correspond plus aux notes

Un bulletin enregistré est une **photographie** : moyenne, rang, mention sont figés au moment du calcul. Les **notes**, elles, continuent de vivre. Si une note est corrigée après la diffusion, la famille voit la correction dans « Notes » et l'ancienne moyenne dans « Bulletins ».

Le panneau « Circuit » **le détecte seul** et affiche un encadré rouge :

> ⚠️ 3 bulletin(s) ne correspondent plus aux notes actuelles — avec le **nom** de chaque élève, l'ancienne et la nouvelle valeur (`12.25 → 14.5`), et le nombre de **familles qui ont déjà consulté** le chiffre dépassé.

**Pour corriger** : **Calculer les bulletins**, puis **💾 Enregistrer les bulletins**. Ceux qui sont déjà publiés **le restent** — la correction parvient aussitôt aux familles, sans avoir à republier.

Deux précisions :
- Un **brouillon** périmé n'est jamais signalé : rien n'a été arrêté ni diffusé, et le recalculer est le geste normal.
- Le **rang** compte autant que la moyenne : il suffit qu'un camarade soit corrigé pour que le rang imprimé sur le bulletin d'un autre devienne faux.

### 7.3 Le procès-verbal du conseil de classe
Dans le même panneau, le **PV** attend **deux signatures** :

1. le **responsable pédagogique du cycle** de la classe ;
2. le **responsable de la gestion** (promoteur, comptable ou secrétariat).

- Une **même personne ne peut pas poser les deux** : c'est tout le sens de l'exigence.
- Le responsable pédagogique d'un **autre cycle** ne peut pas signer : désignez-les dans **Structure → Responsables de cycle** (voir §2.5).
- Publier sans PV signé **demande confirmation** mais n'est pas interdit : un conseil reporté ne doit pas bloquer l'école.
- Chacun peut **retirer sa propre** signature, jamais celle d'un autre.

Le **barème**, la **moyenne de passage** et les **mentions** sont ceux définis dans Paramètres → Notation (barème /20 par défaut : Passable ≥10, Assez Bien ≥12, Bien ≥14, Très Bien ≥16).

Au **collège et au-delà**, le bulletin affiche aussi le **nombre d'absences** de la période — à condition que la période soit **datée** (§2.5). Au préscolaire et à l'élémentaire, il ne l'affiche pas.

---

## 8. Classement & tableau d'honneur (menu **Classement**)

### 8.1 Obtenir le classement

Choisissez **Classe** + **Période** → **Calculer**. Vous obtenez la liste complète, du premier au dernier : **rang**, **moyenne**, et les **distinctions** attribuées automatiquement.

### 8.2 Les distinctions

| Distinction | À partir de |
|---|---|
| **Encouragements** | 12 |
| **Tableau d'honneur** | 14 |
| **Félicitations** | 16 |

Ces seuils suivent le barème de l'école (§2.2) : si vous notez sur 10, ils sont ramenés en proportion.

### 8.3 Imprimer

**🖨️ Imprimer** produit le palmarès, en-tête et logo de l'école compris — affichable au tableau ou remis au conseil.

> Le classement se calcule à partir des **notes saisies**, indépendamment de l'état des bulletins : vous pouvez classer avant de publier.

---

## 9. Documents administratifs (espace Gestion)

### 9.1 Produire un certificat ou une attestation (menu **Documents**)

**Le principe** : un document officiel engage l'établissement. Il n'est donc pas imprimable directement — il passe par une **validation** par un signataire habilité.

1. Choisissez l'**élève**, le **type** de document et le **signataire**.

   Types disponibles : certificat de scolarité, attestation d'inscription, attestation de fréquentation, certificat de radiation ou de transfert, attestation de résultats, convocation, carte scolaire, registre ou liste d'élèves.

2. Le document part **pour validation**. Le signataire le retrouve dans **« À signer »**, avec un badge d'alerte.
3. Le signataire **valide** — sa signature enregistrée est apposée — ou **rejette**.
4. Une fois validé, le document est **imprimable / PDF** : informations de l'élève remplies automatiquement, accords « né / née » selon le sexe, cachet de l'école.

> **Préparez vos signataires d'abord** (Paramètres → Signataires, §2.2) : nom, fonction et signature, rattachés à un compte. Sans signataire déclaré, aucun document ne peut être validé.

Chaque document validé porte un **QR code** d'authentification : le scanner permet de vérifier qu'il a bien été émis par l'établissement, et qu'il n'a pas été modifié.

### 9.2 Répondre aux demandes des familles (menu **Demandes**)

Les parents demandent leurs documents depuis leur espace (§17.2). Leurs demandes arrivent ici.

Pour chacune : **En cours** · **Marquer prêt** · **Rejeter**, avec la possibilité d'écrire une **réponse**. Le parent est **notifié automatiquement** à chaque changement — inutile de l'appeler.

---

## 10. Paiements & recouvrement (espace Gestion)

L'écran **Paiements** a quatre onglets : **Factures**, **Paiements en ligne**, **Grille tarifaire**, **Paiement mobile**. L'ordre dans lequel on s'en sert est l'inverse : on règle d'abord la grille, puis on facture, puis on encaisse.

### 10.1 La grille tarifaire (onglet **Grille tarifaire**)

C'est le catalogue de ce que l'école facture. À faire **une fois** en début d'année.

Pour chaque frais :

| Champ | Ce qu'il faut savoir |
|---|---|
| **Libellé** | « Scolarité », « Inscription », « Tenue »… tel qu'il apparaîtra sur la facture |
| **Montant** | dans la devise de l'école |
| **Portée** | **toute l'école** · **par cycle** (une scolarité identique pour tout l'élémentaire) · **par niveau** (un tarif propre, par exemple une classe d'examen) |
| **Mensuel** | le frais se répète chaque mois |
| **Obligatoire** | il sera pré-coché à la facturation en lot |

> ⚠️ **Attention à la portée en Montessori.** Si votre classe s'appelle « TPS/PS » et que vous posez le tarif sur « TPS », il ne s'appliquera **à personne** : c'est le niveau de la classe qui compte, pas le sous-niveau de l'enfant (§2.4).

Chaque frais reste **modifiable** ou supprimable.

### 10.2 Facturer

**Un élève à la fois** — **+ Nouvelle facture** : l'élève, une **date d'échéance**, puis les lignes (**+ Ajouter une ligne**, ou choisissez dans **Frais à facturer**).

> **On CHERCHE l'élève, on ne le déroule plus.** Tapez deux lettres du nom, du prénom ou du matricule : l'application interroge le serveur et propose huit résultats. C'était une liste déroulante jusqu'à la version 2.242 — praticable à cent élèves, impossible à dix mille, et surtout **plafonnée à 1 000 noms sans le dire** : au-delà, un élève en fin d'alphabet était absent de la liste, donc impossible à facturer. Le même champ de recherche sert maintenant partout où l'on désigne un élève : facture, incident de vie scolaire, document, cantine, transport, messagerie.

**Toute une promotion** — **⚡ Générer en lot** : choisissez le niveau ; les frais obligatoires sont pré-cochés, **y compris ceux définis au niveau du cycle**. L'application **ne crée pas de doublon** : un élève déjà facturé pour le même frais est ignoré.

> **Mettez une date d'échéance.** Sans elle, une facture impayée n'est jamais comptée « en retard » (§19) et n'entre pas dans les relances. L'application ne devine pas une échéance que vous n'avez pas donnée.

### 10.3 Encaisser

Cliquez une facture : vous voyez son détail, ses encaissements, et un **reçu imprimable** avec le logo de l'école.

**Encaisser un paiement** : montant, **mode** (espèces, Wave, Orange Money, Free Money, virement, chèque, carte), référence, date, et le **compte** d'encaissement si vous tenez la comptabilité.

- Le **statut de la facture se recalcule tout seul** : émise → partiellement payée → payée. Vous n'avez pas à le changer à la main.
- Les **paiements partiels** sont normaux : encaissez autant de fois que nécessaire.
- **Annuler la facture** est possible : elle n'engage alors plus la famille et sort des comptes d'impayés.

### 10.4 Les paiements déclarés par les familles (onglet **Paiement mobile**)

Renseignez d'abord vos numéros **Wave / Orange Money / Free Money** : ils seront affichés aux parents.

Un parent qui paie par mobile money **déclare** son paiement depuis son espace, en joignant une **preuve** (capture d'écran, photo du bordereau). Sa déclaration arrive ici.

1. **« Voir »** la preuve — vérifiez le montant, la date et la référence.
2. **Valider** : la facture est soldée automatiquement. Ou **rejeter**, en expliquant pourquoi.

> C'est le point où l'on se fait avoir : **comparez toujours la référence de la transaction** avec celle de la preuve. Une capture d'écran se retouche.

### 10.5 Recouvrement (menu **Recouvrement**)

La liste des impayés : montant total, retard, contact de la famille.

- **Relancer** envoie une notification (et un push si la famille l'a activé).
- **WhatsApp** ouvre un message pré-rempli vers le numéro du parent — c'est le canal qui fonctionne le mieux au Sénégal.
- L'**historique** des relances est conservé, ce qui évite de relancer deux fois la même famille le même jour.

Des **relances récurrentes** se configurent dans Paramètres : des paliers (par exemple 7, 15 et 30 jours de retard) déclenchent automatiquement une notification chaque matin.

### 10.6 Si ça ne marche pas

- **« Aucun frais applicable à ce niveau »** → le frais est posé sur un autre cycle ou un autre niveau. Vérifiez sa portée.
- **« Toutes les familles apparaissent en retard »** → regardez la pastille : ⚪ **Non facturé** n'est pas 🔴 **Retard** (§19).
- **« Une facture reste "émise" après encaissement »** → le montant encaissé est inférieur au total : elle est partiellement payée, c'est normal.

---

## 11. Emploi du temps automatique (menu **Emploi du temps**)

GesSchool **génère automatiquement** les emplois du temps sous contraintes (aucun prof/classe/salle en double), avec aperçu avant application. Onglets :

1. **Grille horaire** : définissez, **jour par jour**, les créneaux type (08h–09h…) ; cochez **« pause »** pour une récréation (non planifiable). Bouton **« Copier sur tous les jours »**.
2. **Volumes** : par **niveau**, le nombre de séances/semaine de chaque matière (boutons +/− ; enregistrement auto).
3. **Salles** : la liste des salles (pour éviter qu'une salle soit occupée par deux classes en même temps).
4. **Par enseignant** : l'emploi du temps individuel d'un prof (imprimable) et sa **grille de disponibilité** — cliquez un créneau pour le marquer **indisponible** ; la génération n'y placera aucun cours.
5. **⚡ Générer** : une **checklist de préparation** (Grille ✓ · Volumes ✓ · Salles · Affectations) rappelle ce qui manque. Cochez les classes → **Générer l'aperçu** → un **rapport** indique les séances placées et, le cas échéant, les **heures non placées avec leur raison** (grille pleine, prof déjà pris, prof indisponible, salle indisponible, pas d'affectation). **Appliquer** écrase l'emploi du temps des classes choisies (retouche manuelle possible ensuite).

**Onglet Emplois du temps** : consultation par classe + retouche manuelle (ajouter/supprimer un créneau, avec confirmation) et **🖨️ Imprimer / PDF** (grille hebdomadaire avec en-tête de l'école — préférez l'orientation **Paysage**).

---

## 12. Cantine & Transport (modules, espace Gestion)

Deux modules **activables par le promoteur** (Paramètres → Modules). Désactivés, ils disparaissent des menus — et des espaces parents.

### 12.1 Cantine

Trois onglets, qui correspondent à trois moments différents.

**Abonnés** — qui mange, et selon quelle formule.

| Formule | Comment ça marche |
|---|---|
| **Mensuel** | un tarif fixe par mois, facturé d'avance |
| **Prépayé au repas** | la famille crédite un **solde**, et chaque repas pointé le décrémente |

Pour chaque abonné : la formule, le tarif, le **régime ou les allergies** (à renseigner — c'est ce que la cuisine consultera), et le solde s'il est en prépayé.

**Pointage du jour** — marquez les repas effectivement pris. En prépayé, le solde diminue à chaque pointage ; une **recharge** se saisit au même endroit.

**Menu** — le menu de la semaine, visible des familles dans leur espace.

**« Facturer le mois »** génère les factures des abonnements mensuels. Comme partout, il n'y a pas de doublon : un abonné déjà facturé pour le mois est ignoré.

> **Surveillez les soldes prépayés.** Un solde à zéro ne bloque pas le pointage — l'enfant mange — mais il passe en négatif et devra être régularisé. C'est voulu : on ne refuse pas un repas à un enfant pour un problème de caisse.

### 12.2 Transport

**Circuits** — chaque circuit a un **chauffeur** et une liste d'**arrêts**, triés par heure de passage. C'est à construire une fois, puis à ajuster.

**Abonnés** — pour chaque élève : le circuit, son **arrêt**, le trajet (aller, retour, ou les deux), le tarif.

**Embarquement** — pointez les élèves effectivement pris en charge. **Le parent est notifié**, ce qui répond à la question qu'il se pose chaque matin : « est-il bien monté ? »

**« Facturer le mois »** fonctionne comme pour la cantine.

### 12.3 Côté famille

Si l'enfant a un abonnement, des onglets **🍽️ Cantine** et **🚌 Transport** apparaissent dans son espace : formule, solde, menu de la semaine, circuit et arrêt. Rien n'apparaît s'il n'est pas abonné — inutile de masquer quoi que ce soit.

---

## 13. Vie scolaire, fournitures & communication


### 13.1 Absences, retards et justifications

L'écran **Vie scolaire** rassemble ce que la **feuille de présence** (§5) a produit, et ce que les familles ont répondu.

**Le circuit d'une absence :**

1. L'enseignante ou le responsable pointe l'élève absent → **le parent est notifié**.
2. Le parent **justifie** depuis son espace, en expliquant et, s'il le souhaite, en joignant un document.
3. Sa justification apparaît ici avec un statut **à valider** : vous tranchez **Justifié** ou **Non justifié**.

> ⚠️ **Le statut et la justification n'appartiennent pas à l'appel.** Refaire l'appel du jour ne les écrase pas : corriger une erreur de pointage ne détruit pas le travail de justification. C'est une protection délibérée.

À partir du **collège**, le nombre d'absences de la période apparaît sur le **bulletin** — à condition que la période soit **datée** (§2.5).

### 13.2 Incidents

Au-delà des absences, l'écran enregistre les **incidents** : un **type** (observation, sanction, félicitation), une **gravité**, une description, une date.

> **Ce n'est pas qu'un registre de sanctions.** Une **félicitation** s'y enregistre aussi, et c'est une bonne pratique : un dossier qui ne contient que des reproches donne une image fausse de l'enfant, et le conseil de classe s'appuie dessus.

### 13.3 Assiduité (menu **Assiduité**)

La vue par élève sur une période : absences, retards, justifiés ou non. Les élèves à **5 incidents ou plus** sont surlignés — c'est le seuil où une famille mérite d'être appelée.

---

### 13.4 Fournitures : constituer et remettre la liste
Deux usages, dans le même écran.

**Constituer la liste** — pour chaque article : le **libellé**, la **quantité**, s'il est **obligatoire** ou conseillé, une **note** libre, et le **niveau** concerné. Un article sans niveau concerne toute l'école.

**Le cas qui compte** : le bouton **« école »** marque un article comme **fourni ou disponible à l'école**. Il apparaît alors **en rouge** chez le parent, avec sa note. C'est ce qui évite qu'une famille achète une blouse qu'elle pouvait prendre au secrétariat.

**Remettre la liste aux familles** — choisissez une **classe** dans le sélecteur, puis **🖨️ Imprimer pour les parents**. La liste reprend le niveau de la classe **et** les articles « tous niveaux » : les omettre donnerait une liste incomplète, et c'est le genre d'oubli qui se paie à la rentrée.

Les familles la retrouvent aussi dans leur espace, onglet **Fournitures**.

---

### 13.5 Annonces

Une annonce est publiée vers une **audience** que vous choisissez :

| Audience | Qui la voit |
|---|---|
| Toute l'école | le personnel et toutes les familles |
| Les parents | toutes les familles |
| Un **cycle** | les familles de ce cycle (le préscolaire sans l'élémentaire, par exemple) |
| Un **niveau** | les familles de ce niveau |
| Une **classe** | les familles de cette classe |

Vous pouvez joindre une **pièce** (règlement intérieur, calendrier, circulaire). Un document joint peut être **versé au rayon réglementaire** : il devient alors un texte de référence consultable en permanence, au lieu de disparaître avec l'annonce.

> ⚠️ **L'audience d'une pièce suit celle de son annonce.** Un règlement publié pour l'élémentaire n'est pas visible des familles du préscolaire. C'est délibéré : les deux cycles n'ont pas le même règlement.

Côté parent, les annonces apparaissent **par enfant** — un parent de deux écoles ne voit pas les annonces mélangées — et les nouveautés des sept derniers jours sont signalées.

### 13.6 Messagerie

Un fil de discussion entre l'école et chaque famille. Accessible à la **direction**, au **comptable** et au **secrétariat**.

Pour écrire : **recherchez l'élève** — le fil du parent qui a un compte s'ouvre. Ou depuis la fiche de l'élève, bouton **✉️ Message**.

> Un parent qui a des enfants dans **plusieurs** de vos écoles a **un fil par école** : les établissements restent cloisonnés, même pour une même famille.

---

## 14. RH & Paie · Comptabilité


L'écran a quatre onglets : **Personnel**, **Paie**, **Congés & absences**, **Documents**.

### 14.1 Personnel

La fiche de chaque employé : état civil, **fonction**, **catégorie** (gestion, supervision, terrain), responsable hiérarchique, contrat, et ses **documents**.

> Le **personnel** et les **enseignants** sont deux annuaires distincts. Un enseignant a une fiche pédagogique (affectations, classes) ; un employé a une fiche RH (contrat, salaire). La même personne peut avoir les deux, reliées par son compte.

### 14.2 Paie

**Deux régimes**, à choisir selon votre déclaration :

| Régime | Pour qui |
|---|---|
| **Simplifié** | un net convenu, sans décomposition |
| **Complet (cotisations + IR)** | le régime réel sénégalais : cotisations sociales, impôt sur le revenu au barème, TRIMF |

En régime complet, le **barème** est chargé par école et paramétrable : il évolue, et il n'est pas le même partout.

**Générer la paie du mois :**

1. **⚡ Générer la paie** → un bulletin par employé, en **brouillon**.
2. **Vérifiez** les montants, les primes et les retenues.
3. **Valider** le bulletin — il n'est plus modifiable, et devient imprimable.
4. **Payer** — l'opération crée automatiquement une **dépense en comptabilité**.

> ⚠️ **Un bulletin validé ne se supprime plus.** C'est une garde volontaire : une paie versée est un fait comptable. Corrigez-la par une régularisation sur le mois suivant, comme vous le feriez sur papier.

Le régime complet gère aussi la **régularisation annuelle** : l'impôt est retenu mensuellement, puis l'écart est régularisé en fin d'exercice.

### 14.3 Congés & absences

Les congés et absences du personnel, distincts de ceux des élèves. Ils alimentent le calcul de la paie.

### 14.4 Le tableau de bord RH

Il met en avant ce qui demande une action : **salaires à payer**, **fiches à générer**, et **contrats arrivant à échéance** — ce dernier point évitant de découvrir un contrat expiré après coup.

---

### 14.5 Comptabilité SYSCOHADA
Une comptabilité **SYSCOHADA**, en six onglets.

| Onglet | Ce qu'on y fait |
|---|---|
| **Synthèse** | le résultat de l'exercice, recettes moins dépenses |
| **Trésorerie** | ce qu'il y a réellement en caisse et en banque |
| **Recettes** | les encaissements, dont ceux venus des factures |
| **Dépenses** | les sorties, avec **justificatif** à joindre |
| **Plan comptable** | les comptes, selon le plan SYSCOHADA |
| **Journal** | toutes les écritures, dans l'ordre |

**Ce qui arrive tout seul** : un encaissement de facture (§10.3) et une paie payée (§14.2) créent leur écriture. Vous n'avez pas à les ressaisir.

**Ce qui demande une saisie** : les dépenses propres à l'établissement — loyer, électricité, fournitures, carburant. Joignez le justificatif : c'est lui qui rend la dépense défendable.

> **Distinguez « facturé » et « encaissé ».** Une facture émise n'est pas de l'argent reçu. La **Synthèse** raisonne sur le facturé, la **Trésorerie** sur l'encaissé — et l'écart, c'est exactement vos impayés.

---

## 15. Tableaux de bord & mise en route

Chaque accueil de secteur affiche, en haut, une zone **« À traiter »** (tuiles cliquables, code couleur) puis des indicateurs :
- **Gestion** : déclarations à valider, élèves en impayé, échéances 7 j · taux de recouvrement, encaissé jour/semaine/mois, répartition par mode, top impayés.
- **Pédagogie** : absences non justifiées, absences de la semaine · effectif & **moyenne par niveau** (colorée), filles/garçons, redoublants.
- **RH** : salaires à payer, fiches à générer, contrats à échéance · masse salariale, répartition par fonction.

**Checklist de mise en route** (accueil **Pilotage**, promoteur) : passe en revue Structure, Matières, Enseignants, Affectations, Grille tarifaire, Élèves — chaque étape en **✓** ou **⚠️** avec un lien **« Configurer »**. Idéale à la création de l'école **et** à chaque rentrée après le passage d'année.

---

## 16. Passage d'année scolaire (Pilotage → **Passage d'année**, promoteur)

En fin d'année, ouvrez la suivante sans tout ressaisir :

1. **Nouvelle année** : libellé (ex. 2026-2027) + dates. Choisissez ce qui est **recopié** depuis l'année en cours — **Structure (classes)**, **Affectations profs**, **Grille tarifaire**, **Emplois du temps** — les **compteurs** indiquent le volume. Un **récapitulatif** confirme avant d'ouvrir. L'ancienne année reste **archivée** ; la nouvelle devient **courante**.
2. **Promotion des élèves** : **Calculer les propositions** → chaque élève est proposé au **niveau supérieur** (même section si elle existe). Ajustez au cas par cas : **Passe** / **Redouble** / **Sort de l'école**, et la classe cible. **Réinscrire** applique le tout (relançable sans doublon).

   **En Montessori, la proposition suit le niveau RÉEL de l'enfant, pas celui de la classe.** Dans « TPS/PS A », un TPS devient **PS et reste dans la même classe** ; un PS, lui, passe au niveau combiné suivant et y entre par son **premier cran** (en CI dans « CI/CP »). L'écran l'écrit ainsi : le niveau réel de départ apparaît à côté du nom, et la proposition dit « Passe en PS (même classe) ».

   > ⚠️ **Ce n'était pas le cas avant la version 2.241.** Le TPS et le PS recevaient la même proposition — l'enfant de TPS sautait une année — et la réinscription **effaçait** le niveau réel saisi l'année précédente. Si vous avez déjà fait un passage d'année avec des sous-niveaux, vérifiez-les sur les fiches élèves.

   Un **redoublant** garde son niveau réel. Un élève dont le sous-niveau n'a jamais été renseigné se comporte comme avant : l'application ne devine pas un niveau qu'on ne lui a pas donné.
3. **Filet de sécurité** : une année **vide** (0 inscription) ouverte par erreur peut être **supprimée** (l'ancienne redevient courante). L'**enchaînement des niveaux** est affiché, avec une alerte si l'ordre est incohérent.

Ce qui **persiste** d'une année à l'autre (à ne pas refaire) : niveaux, cycles, matières, séries, coefficients, personnels/enseignants, salles, volumes horaires, membres/rôles.

---

## 17. Espace parent

### 17.1 Donner l'accès
Fiche élève → Responsables → **Code parent** → communiquer le code au parent.

### 17.2 Côté parent
Inscription → **Je suis un parent** → saisir le **code**. Pour chaque enfant, onglets :
- **Notes**, **Bulletins** (avec appréciations & décision), **Cahier de textes**, **Emploi du temps**, **Fournitures**, et si abonné **🍽️ Cantine** / **🚌 Transport**.
- **Suivi des acquis** (préscolaire) : apparaît dès que l’école a observé quelque chose (§20).
- La **photo de l’enfant** s’affiche sur sa carte et dans l’en-tête de sa fiche, dès que l’école l’a prise (§23).
> ⚠️ **Un bulletin n’apparaît que lorsque l’école l’a publié** (§7.2). S’il manque, il est encore en relecture — ce n’est pas une panne.
- **Paiements** : régler une facture par **mobile money** (numéro de l'école + référence affichés) → **Déclarer le paiement** en **joignant une preuve** (capture/photo) → l'école valide (§10.4).
- **Absences** : **Justifier** une absence → l'école valide.
- **Documents** : **Demander** un document → suivre le statut.
- En-tête : 💬 **Messagerie** et 🔔 **Alertes** (+ **Activer** les notifications push).

### 17.3 Plusieurs enfants — y compris dans des écoles différentes
Un parent gère **tous ses enfants depuis un seul compte**, même dans des établissements différents :
1. Se connecter avec **son compte** (ne pas en recréer un).
2. Accueil parent → **« + Ajouter un enfant »** → saisir le **code** de l'autre établissement.
3. Le nouvel enfant apparaît, **étiqueté avec son école**.

> ⚠️ **Un seul compte, plusieurs codes.** Si vous avez déjà un compte, **connectez‑vous** puis ajoutez le nouveau code — ne créez pas un second compte. Les établissements restent cloisonnés.

---

## 18. Notifications push
Parents et personnel peuvent **activer les notifications** (alerte même app fermée) : note, absence, facture, document prêt, embarquement transport, message. Sur mobile, installer la PWA (« Ajouter à l'écran d'accueil ») — sur iPhone, l'installation est requise pour le push.

---

## 19. L'indicateur de paiement (menu **Élèves**)

Choisissez une **classe** dans le filtre : une colonne **Paiement** apparaît, et un bandeau résume la situation.

| | |
|---|---|
| 🟢 **À jour** | aucune facture échue impayée |
| 🔴 **Retard** | au moins une facture échue reste impayée |
| ⚪ **Non facturé** | aucune facture émise : **rien n'est dû** |

> ⚠️ **« Non facturé » n'est pas « en retard ».** Si vous n'avez pas encore facturé une famille, elle n'est pas en défaut — c'est le travail de facturation qui reste à faire. Le bandeau le dit dans ce sens : « 88 sans facture ».

Une facture **sans date d'échéance** ne rend pas la famille « en retard » : on ne traite pas l'inconnu comme une faute.

**Qui le voit** : promoteur, comptable, secrétariat et responsable pédagogique. **Pas les enseignants ni les surveillants** — ils n'ont aucune action à mener sur un impayé, et savoir quelles familles sont en retard risquerait de peser sur le regard porté sur l'enfant. L'indicateur ne montre **jamais de montant** : seulement l'état.

---

## 20. Suivi des acquis, au préscolaire (menu **Suivi des acquis**)

> **Au préscolaire, on n'évalue pas sur 20 : on observe.** Un enfant de TPS n'a pas une moyenne de 12,5 en langage — il « sait nommer les objets usuels », ou il y arrive bientôt. Cet écran remplace les notes pour les plus petits ; il n'apparaît que pour les classes du cycle **Préscolaire**.

### 20.1 Mettre en place le référentiel (direction)

Le suivi repose sur une liste d'**items observables**, regroupés par **domaine** : Langage et communication, Activités numériques, Découverte du monde, Vivre ensemble, Activités physiques, Activités artistiques.

Cette liste **appartient à l'école**. À la première ouverture, un bouton propose de **charger un référentiel de départ** (19 items), que vous adaptez ensuite à vos intitulés. Si un référentiel existe déjà, le bouton refuse de l'écraser.

### 20.2 Observer (enseignante ou responsable pédagogique)

Choisissez **classe** et **période**, puis **un enfant à la fois** — pas une grille de 25 enfants sur 60 items, qui serait illisible et fausse dans l'esprit : on observe un enfant, pas un tableau.

Trois valeurs :

| | | |
|---|---|---|
| 🟢 | **Acquis** | l'enfant y parvient seul, régulièrement |
| 🟡 | **En cours d'acquisition** | il y parvient avec de l'aide, ou par moments |
| 🔴 | **Pas encore acquis** | il ne s'en saisit pas encore — **ce n'est pas un échec, c'est une étape** |

- Re-cliquer la valeur active la **retire** : ne rien avoir observé est une information légitime.
- Le compteur « 7 / 19 observés » vous dit **ce qui reste à faire**.
- **Il est normal de ne pas tout observer.** Un suivi en cours n'est pas un bilan.

### 20.3 Ce que la famille voit

La tuile **Suivi des acquis** apparaît dans l'espace parent **dès qu'une observation existe** — et uniquement ce qui a été observé, jamais une liste de lignes vides. Un texte rappelle à la famille qu'au préscolaire l'équipe observe plutôt que de noter.

---

## 21. La programmation officielle (menu **Programmation officielle**)

L'inspection diffuse une **planification mensuelle** par cours. Plutôt que de la ressaisir, on la **charge une fois** et les enseignantes y puisent.

### 21.1 Déposer le document (direction)

1. **Programmation officielle** → **Choisir un document .docx** — celui de l'IEF, tel qu'il vous a été remis.
2. L'écran **montre ce qu'il a compris** : domaines, sous-domaines, rubriques, activités, paliers, et le détail semaine par semaine.
3. **Confirmez le niveau et le mois**, puis **Enregistrer**.

> ⚠️ **Vérifiez toujours le niveau et le mois.** Le document qui nous a été remis s'appelait « CE1 juin » et contenait du **CM1 d'avril**. C'est **l'en-tête du document** qui fait foi, jamais le nom du fichier — et c'est pour cela que l'écran vous demande de confirmer, même quand il a su lire.

- La planification est enregistrée **par niveau** : celle de CM1 vaut pour CM1 A comme pour CM1 B.
- Certains contenus sont rangés en **« tout le mois »** : le document fusionne parfois des cellules sur les quatre semaines, et nous préférons le dire plutôt que d'inventer une semaine.
- Redéposer le même mois **remplace** la version précédente, domaine par domaine.

### 21.2 S'en servir (enseignante)

Dans **Cahier de textes**, le bouton **📋 Reprendre la programmation** liste les contenus du mois pour le niveau de la classe, filtrables par domaine et par semaine. Un clic remplit la séance — **et le texte reste modifiable** : la planification décrit un objectif, pas le déroulé d'une séance.

---

## 22. Présence par séance, au supérieur (menu **Présence par séance**)

À l'école, on pointe un élève pour une **journée**. À l'université, pour **une séance** : un étudiant peut manquer le TD de 8 h et assister au CM de 14 h.

1. Choisir **filière**, **semestre** et **date** — l'écran propose les séances **de ce jour-là**.
2. Choisir **sa séance** (horaire, UE, type CM/TD/TP).
3. Pointer **Présent / Absent / Retard** → **Enregistrer l'appel**.

- Si la séance est rattachée à une **UE**, seuls les étudiants **inscrits à cette UE** sont convoqués — une UE optionnelle ne concerne pas toute la filière.
- Si la séance n'a **pas** d'UE, toute la filière est convoquée **et l'écran le signale**.
- **Tout le monde est présent par défaut** : on ne marque que les exceptions.
- Les deux feuilles ne se mélangent jamais : l'appel d'une classe ne touche pas les absences de séance, et inversement.

---

## 23. Photos des élèves (menu **Photos des élèves**)

Conçu pour le **téléphone**, debout, en classe : choisissez une classe, **touchez un élève**, l'appareil photo s'ouvre. Le compteur « 12 / 96 » vous dit qui reste.

- **Les photos sont privées.** Seuls l'école et **le parent de l'enfant** y ont accès — un parent ne peut pas voir la photo d'un autre enfant, même de la même classe.
- Réservé à la **direction et au secrétariat** : une photo d'enfant se confie au moins de mains possible.
- **5 Mo maximum** par photo.
- Retirer une photo supprime **le fichier et la référence**.
- Côté famille, la photo apparaît sur la carte de l'enfant et dans l'en-tête de sa fiche. Sans photo, les initiales colorées restent.

---

## 24. L'enseignement supérieur (LMD)

Si votre établissement couvre le palier **Université** (§2.4), l'espace Pédagogie bascule sur le modèle **LMD**.

### 24.1 La structure, et ce qu'elle remplace

| Écran | À quoi il sert |
|---|---|
| **Filières & maquettes** | Facultés, départements, filières, **semestres**, **UE / ECUE**, crédits — remplace « Niveaux & classes » |
| **Admissions** | Dossiers de candidature, de la réception à la décision |
| **Inscriptions LMD** | Inscrire un étudiant dans une filière et un semestre, puis **à ses UE** |
| **Codes étudiants** | Le code d'activation de chaque étudiant, à lui transmettre |
| **Emploi du temps** | Planification par **filière et semestre**, et non par classe |
| **Présence par séance** | Le pointage par cours (§22) |

> **Inscrivez les étudiants à leurs UE**, pas seulement à leur filière. C'est l'inscription à l'UE qui détermine qui est convoqué à une séance (§22) et qui apparaît dans les notes de cette UE.

### 24.2 Notes, délibérations et relevés

- **Notes LMD** : les notes par UE et par ECUE, avec leurs crédits.
- **Délibérations & relevés** : la validation des semestres — crédits acquis, compensations, décision de jury — puis l'édition des **relevés de notes**, qui portent un **QR code** d'authentification comme les autres documents officiels (§9.1).

### 24.3 La bibliothèque universitaire

Quatre écrans, qui correspondent à quatre métiers.

| Écran | Ce qu'on y fait |
|---|---|
| **Catalogue** | les notices, les auteurs, les exemplaires, les cotes, et la recherche |
| **Prêts & retours** | le poste de circulation : emprunter, rendre, renouveler, voir les retards |
| **Acquisitions** | les commandes, les fournisseurs, les suggestions d'achat |
| **Inventaire** | les campagnes de récolement, et les écarts constatés |
| **Mémoires & thèses** | le dépôt institutionnel : soumission, vérification, validation, publication |

Un étudiant accède depuis son espace au catalogue, à ses emprunts, à ses réservations et au fonds numérique. Un document numérique **restreint** n'est lisible que par les étudiants qu'il cible — la règle est appliquée côté serveur, pas seulement masquée à l'écran.

### 24.4 L'espace de l'étudiant

Il fonctionne comme l'espace parent : des **tuiles** à l'accueil, et un lien **« ← Accueil »** pour y revenir.

| Tuile | Ce qu'il y trouve |
|---|---|
| **Mes résultats** | ses notes par UE, et ses relevés |
| **Emploi du temps** | ses séances |
| **Ma scolarité** | ses frais, ce qu'il reste à payer |
| **Mes documents** | ses attestations, et ses demandes |
| **Messagerie** · **Actualités** | l'échange avec la scolarité, les annonces |
| **Bibliothèque** · **Mon dépôt** | le catalogue, ses emprunts, le dépôt de son mémoire |
| **Ma carte** · **Textes de référence** | sa carte d'étudiant, les règlements |

En haut, en permanence : **💬 Messagerie** et **🔔 Alertes**, chacune avec son compteur de non-lus.

> ⚠️ **Les tuiles suivent les modules achetés.** « Bibliothèque » et « Mon dépôt » n'apparaissent que si l'établissement a souscrit les modules correspondants — avant la version 2.241, elles s'affichaient toujours et s'ouvraient sur un écran vide.

**🔔 Les alertes** — écran **Mes alertes** : nouvelle note, relevé disponible, échéance de scolarité, document prêt, message de la scolarité. Un bouton y propose d'activer les **notifications sur le téléphone**, et sur iPhone l'écran explique qu'il faut d'abord installer l'application sur l'écran d'accueil. *Cet écran n'existait pas avant la version 2.241 : un étudiant n'était prévenu de rien.*

### 24.5 Le vocabulaire et les comptes

- On dit **« étudiant »** dans un établissement **exclusivement** universitaire. Dans un établissement qui va de l'élémentaire à l'université, on garde « élève » comme mot courant — dire « étudiant » au préscolaire serait absurde — et les écrans du supérieur portent leurs propres intitulés.
- ⚠️ **L'accès d'un étudiant à ses notes passe par un consentement** : il le demande depuis son espace, l'établissement l'accorde. Tant qu'il n'est pas accordé, les notes et les relevés ne lui sont pas servis.

---

## 25. Pilotage & console super-admin

### 25.1 Vue d'ensemble (menu **Vue d'ensemble**, promoteur)

La synthèse de **toutes vos écoles** : effectifs, recouvrement, trésorerie, masse salariale.

Deux précisions qui évitent les mauvaises lectures :

- Les écoles marquées **démonstration** sont **exclues des totaux**. Sans cela, des chiffres fictifs viendraient gonfler votre consolidé.
- Quand vous entrez dans une école par **« Gérer cette école »**, la vue se **cloisonne à cette école** : vous ne voyez plus le consolidé, mais l'établissement où vous travaillez.

### 25.2 Organigramme (menu **Organigramme**, promoteur)

Généré **automatiquement** depuis **Membres** et **RH** : promoteur en tête, puis les responsables de chaque pôle et leurs équipes. Les personnes sans compte (personnel RH seulement) y figurent, discrètement marquées.

> Il n'y a rien à saisir ici. **Changez un rôle dans Membres, l'organigramme suit.** C'est pour cela qu'il n'est pas modifiable : une organisation saisie deux fois finit par se contredire.

### 25.3 Documentation (menu **Documentation**, promoteur)

Le recensement des documents que l'établissement peut produire, par famille — scolarité, pédagogie, finances, RH — avec, pour chacun, l'écran où il s'obtient et s'il est déjà disponible. Sert à répondre à « est-ce que l'application sait faire tel papier ? » sans chercher dans tous les menus.

### 25.4 Journal des actes (menu **Journal des actes**, promoteur)

La trace des **actes sensibles** : qui a modifié une note, une facture, un paiement, un bulletin — et quand. C'est ce qui permet de répondre à une contestation, et de restaurer une valeur effacée par erreur.

### 25.5 Mise en route et passage d'année

- **Mise en route** : la liste de ce qui reste à configurer, dans l'ordre (§15). Pour une école neuve, suivez plutôt l'annexe §28.
- **Passage d'année** : ouvrir l'année suivante et promouvoir les élèves (§16).

### 25.6 Mon abonnement (menu **Mon abonnement**, promoteur)

Votre formule, son **palier d'effectif**, sa date d'échéance, et la liste des **modules** : ✓ ceux que vous avez, 🔒 ceux qu'une formule supérieure débloquerait. Sert à savoir ce que vous payez et ce que vous pourriez activer, sans avoir à nous appeler.

### 25.7 Console super-admin (réservée à l'éditeur)

Toutes les écoles clientes, leur **plan d'abonnement**, leur **statut**, leurs **modules actifs** et le **nombre de comptes** (personnel et parents). Sert au support et à la facturation du logiciel, pas à la gestion d'une école.

---

## 26. Récapitulatif des rôles

| Rôle | Accès principal | Peut inviter |
|---|---|---|
| **Promoteur** | Tous les espaces + configuration + passage d'année | Tout le monde |
| **Responsable pédagogique** | Pédagogie (toutes les classes) + Structure + codes parents + **circuit du bulletin** + **indicateur de paiement** (sans les montants) | Enseignant, Surveillant, Parent |
| **Comptable / Gestion** | Gestion : paiements, recouvrement, comptabilité, cantine/transport, communication | Secrétaire / Caisse |
| **Secrétaire / Caisse** | Gestion opérationnel : élèves & inscriptions, documents, demandes, encaissement, messagerie | — |
| **Responsable RH** | RH & Paie : personnel, paie, enseignants, comptabilité | Secrétaire / Caisse |
| **Enseignant** | Pédagogie : appel, cahier, progression, notes, bulletins, classement, assiduité (**ses classes**) | — |
| **Responsable de cycle** | Désigné par le promoteur (Structure) : signe le **PV du conseil** des classes de SON cycle | — |
| **Surveillant** | Pédagogie : appel, vie scolaire, assiduité | — |
| **Parent** | Espace parent : suivi de ses enfants | — |
| **Super-admin** | Console de pilotage du SaaS | — |

---

## 27. Dépannage rapide
- **« Je ne vois pas un menu »** → module désactivé (Paramètres → Modules, promoteur) ou rôle sans accès.
- **« Une page ne s'ouvre pas / reste blanche »** → cache de l'app dépassé après une mise à jour : l'appli se recharge normalement toute seule ; sinon **rechargez** (Ctrl+Maj+R), ou ouvrez en **navigation privée**, ou réinstallez la PWA.
- **« Comment ajouter un responsable / une secrétaire ? »** → **Membres → + Inviter un membre** (§4). Si la personne a **déjà** un compte, ne lui renvoyez pas de code : **Membres → sa ligne → + Donner un accès…** (§4.3).
- **« Le parent ne voit pas le bulletin »** → il est probablement en **brouillon** ou **validé** : ouvrez **Bulletins**, choisissez la classe, et utilisez **📤 Publier aux parents** dans le panneau « Circuit » (§7.2).
- **« Personne ne peut signer le procès-verbal »** → aucun **responsable de cycle** n’est désigné. Le promoteur le fait dans **Structure → Responsables de cycle** (§2.5). La direction elle-même est refusée tant qu’elle n’est pas désignée.
- **« Les absences ne sont pas comptées sur le bulletin »** → la période n’a pas de **dates** : **Structure → Découpage de l’année** (§2.5). L’application préfère ne rien afficher plutôt qu’un zéro faux.
- **« Toutes les familles apparaissent en retard de paiement »** → regardez la pastille : ⚪ **Non facturé** n’est pas 🔴 **Retard**. Il reste des factures à émettre (§19).
- **« L'enseignant ne voit pas sa classe »** → vérifier son **code d'accès** et qu'il est **prof principal** ou **affecté** à une classe.
- **« Impossible d'inscrire un élève »** → créer d'abord une classe via **Structure**.
- **« L'import n'inscrit pas en classe »** → la colonne Classe ne correspond pas au libellé exact.
- **« La génération d'emploi du temps laisse des heures non placées »** → voir la **raison** dans le rapport (grille trop petite, prof indisponible, pas d'affectation…) et corriger.
- **« Je ne peux pas ouvrir la nouvelle année »** → réservé au **promoteur** (Pilotage → Passage d'année).
- **Mot de passe oublié** → sur la page de connexion, saisir l'e-mail → un **code à 6–8 chiffres** est envoyé → le saisir + choisir un nouveau mot de passe (pensez aux spams).

## 28. Annexe — Votre première semaine, pas à pas

Si vous ouvrez GesSchool pour la première fois, suivez cet ordre. Il n'est pas arbitraire : chaque étape a besoin de la précédente, et sauter la première fait échouer la quatrième.

### Jour 1 — L'établissement (≈ 1 h, promoteur)

1. **Créez votre compte** et votre école (§1).
2. **Paramètres → Établissement** : nom, sigle, devise, **logo** et **cachet**. Ils apparaîtront sur toutes les factures, bulletins et certificats — autant les mettre maintenant.
3. **Déclarez vos paliers** (§2.4) : élémentaire seul, élémentaire et collège, jusqu'à l'université… C'est ce choix qui détermine les écrans que vous verrez. Et la **pédagogie** si vous couvrez l'élémentaire.
4. **Paramètres → Matricule** : votre format (`CLB-26-0001`). Fixez l'**année** si toute une rentrée doit porter le même millésime.
5. **Paramètres → Signataires** : qui signe les documents officiels, avec sa fonction et sa signature. **Sans cela, aucun certificat ne pourra être validé.**

### Jour 2 — La structure académique (≈ 1 h 30, promoteur ou direction)

1. **Structure → cycles, niveaux, classes** (§2.1). Créez les classes **avant** d'importer les élèves : c'est l'oubli numéro un.
   - En **Montessori**, créez le niveau combiné (`TPS/PS`) puis ses **sous-niveaux** (TPS, PS) — §2.4.
2. **Structure → Découpage de l'année** (§2.5) : les **dates** de chaque trimestre. Sans elles, les absences ne pourront pas être comptées sur les bulletins.
3. **Structure → Responsables de cycle** (§2.5) : qui répond de chaque cycle. **Sans cela, personne ne pourra signer le procès-verbal du conseil de classe** — pas même la direction.
4. **Matières**, puis **coefficients** si vous les personnalisez.

### Jour 3 — Les élèves (≈ 2 h pour 100 élèves, secrétariat)

1. Préparez votre fichier depuis `modele-import-eleves.csv`. Vérifiez **deux fois** la colonne Classe : elle doit correspondre au libellé exact.
2. **Élèves → ↑ Importer** (§3.3). **Lisez le bilan** : « 96 créés, 96 inscrits » est ce que vous voulez voir. Si le second chiffre est plus petit, la colonne Classe ne correspond pas.
3. Complétez ce qui manque : dates de naissance, téléphones des parents.
4. **Photos** (§23) : au téléphone, classe par classe. Comptez 10 minutes par classe.

### Jour 4 — L'argent (≈ 1 h, comptable)

1. **Paiements → Grille tarifaire** (§10.1) : vos frais, avec leur **portée**. Attention à la portée en Montessori.
2. **Paiements → Paiement mobile** : vos numéros Wave / Orange Money / Free Money.
3. **⚡ Générer en lot** par niveau (§10.2) — **avec une date d'échéance**, sans quoi aucun retard ne sera jamais signalé.
4. Vérifiez sur l'écran **Élèves**, en filtrant une classe : la colonne **Paiement** doit afficher ⚪ ou 🔴, pas du vide.

### Jour 5 — L'équipe et les familles (≈ 1 h)

1. **Membres → + Inviter un membre** (§4) : direction, comptable, secrétariat. Chacun gérera ensuite ses propres accès.
2. **RH → Enseignants** : l'annuaire, puis les **affectations** (qui enseigne quoi, dans quelle classe).
   > Si, comme dans beaucoup d'écoles, ce sont les **responsables pédagogiques** qui font le travail des enseignantes, vous n'avez pas besoin de créer de comptes enseignants : la direction voit toutes les classes.
3. **Codes parents** : générez-les et envoyez-les (§17.1). Le code est ce qui permet à une famille de créer son compte.

### Et ensuite, chaque jour

| Qui | Quoi |
|---|---|
| Enseignante ou responsable | **Feuille de présence** le matin (§5) · **Cahier de textes** après la séance |
| Secrétariat | **Encaissements** (§10.3) · **Déclarations** de paiement mobile · **Demandes** de documents |
| Direction | ce que l'accueil met dans **« À traiter »** (§15) |

### Chaque fin de trimestre

1. **Notes** : vérifiez que toutes les évaluations sont saisies (§6).
2. **Bulletins → Calculer** puis **💾 Enregistrer** (§7.1).
3. Tenez le **conseil de classe**, ouvrez le **PV** et faites-le **signer** par les deux responsables (§7.3).
4. **✓ Valider** puis **📤 Publier aux parents** (§7.2).
5. **Classement** et palmarès à afficher (§8).

> **Le repère le plus simple** : si une famille vous dit qu'elle ne voit pas le bulletin, c'est presque toujours qu'il n'a pas été **publié** — pas que l'application est en panne. Le panneau « Circuit » vous le dira en un regard.

---

*GesSchool — gestion scolaire multi-écoles, « zéro papier » : appel, cahier de textes, progression, notes, bulletins & appréciations, classement, assiduité, certificats & validation, demandes de documents, paiements & paiement mobile avec preuve, recouvrement, emplois du temps automatiques, cantine, transport, RH & paie, comptabilité, communication, tableaux de bord, passage d'année, espace parent, multi-écoles et modules à la carte.*
