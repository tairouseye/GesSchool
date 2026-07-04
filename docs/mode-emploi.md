# GesSchool — Mode d'emploi

Guide d'utilisation pas à pas, de la création de l'école à l'usage quotidien.
Application web (PWA) : utilisable sur ordinateur, tablette et téléphone, depuis un navigateur — installable comme une application.

**📑 Accès rapide** — cliquez sur une rubrique pour y aller directement :

[SOMMAIRE]

---

## 0. Concepts de base (à lire une fois)

**GesSchool** organise le travail en **espaces** selon le métier de chaque utilisateur :

| Espace | Icône | Pour qui | Menus |
|---|---|---|---|
| **Pilotage** | 🎯 | Promoteur (accès total) | Vue consolidée de toutes ses écoles, **Membres** |
| **Pédagogie** | 🎓 | Responsable pédagogique, enseignants, surveillants | Accueil, **Appel**, **Cahier de textes**, **Progression**, Élèves (lecture), Structure, Notes, Bulletins, **Classement**, Emploi du temps, Vie scolaire, **Assiduité**, Fournitures, **Membres** |
| **Gestion** | 💼 | Comptable, secrétaire / caisse | Accueil, Élèves & inscriptions, **Documents**, **Demandes**, Paiements, Recouvrement, Comptabilité, Annonces, Messagerie, **Membres**, Paramètres |
| **RH & Paie** | 🧑‍💼 | Responsable RH | Personnel & paie, Enseignants, **Membres** |
| **Parent** | 👪 | Familles | Suivi de chaque enfant (voir §13) |

- Le **promoteur** (créateur de l'école) voit **tous les espaces** et configure l'établissement. Les **responsables** (pédagogique, RH, comptable) sont **cloisonnés à leur domaine** ; chacun **gère ses propres accès** (voir §4).
- Le **sélecteur d'espace** est en haut à gauche de la barre latérale (visible si vous avez accès à plusieurs).
- Chaque **module** (Finances, Évaluations, RH…) peut être activé/désactivé par école (Paramètres → Modules).
- Chacun **atterrit dans son espace** à la connexion (un enseignant arrive directement sur l'**Appel**, un responsable pédagogique sur la Pédagogie…).

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
- **🧑‍💼 Je suis un membre du personnel** → rejoint l'établissement avec un **code d'invitation** (responsable, comptable, secrétaire, surveillant… voir §4).
- **🧑‍🏫 Je suis un enseignant** → relie son compte à sa fiche avec un **code** (voir §4).
- **👪 Je suis un parent** → rejoint un enfant avec un **code de liaison** (voir §13).

> Si vous avez reçu un **lien d'invitation** (`…/#/rejoindre?code=…`), il vous suffit de l'ouvrir : après création du compte, le code est pré-rempli automatiquement.

### 1.3 Assistant de création de l'école (3 étapes)
1. **Identité** : nom, sigle, type (Privé / Public / Confessionnel / Franco-arabe), logo et cachet (optionnels), couleurs.
2. **Cycles ouverts** : cocher les cycles présents (Préscolaire, Élémentaire, Collège, Lycée, Formation pro, Université).
3. **Responsable & année** : prénom/nom, libellé de l'année (ex. 2025-2026), dates, et découpage **Trimestres (3)** ou **Semestres (2)**.
4. **Créer l'établissement**.

➡️ L'école, ses cycles, votre compte admin, l'année et les périodes sont créés automatiquement.

---

## 2. Configuration initiale

### 2.1 Structure académique (menu **Structure**)
Ordre logique : **Niveaux → Classes → Matières → (Séries) → Coefficients**.
- **Niveaux** : dans chaque cycle, taper un niveau (6e, CP, Seconde) → **+ Niveau**.
- **Classes** (génération en lot) : base du nom + nombre + suffixe (A,B,C / 1,2,3 / aucun) + série + effectif → **+ Générer** (doublons ignorés).
- **Matières** : libellé + code (ex. MATH).
- **Séries** (lycée) : créer L, S2… ou **+ Pré-remplir les séries standard**.
- **Grille de coefficients** : choisir une portée (série OU niveau), saisir le coefficient de chaque matière (vide = non comptée).

### 2.2 Paramètres (menu **Paramètres**)
- **Établissement** : nom, sigle, devise, couleurs.
- **Matricule** : préfixe, séparateur, nombre de chiffres (aperçu ex. `GS-25-0001`).
- **Modules actifs** : activer/désactiver des modules (un module désactivé disparaît des menus et bloque l'accès).

### 2.3 Paiement mobile (menu **Paiements → onglet Paiement mobile**)
Saisir vos numéros **Wave / Orange Money / Free Money** (affichés aux parents pour régler les factures).

---

## 3. Élèves & inscriptions (menu **Élèves**)

- **+ Nouvel élève** : prénom, nom, sexe, naissance, classe, responsable optionnel. **Matricule auto**.
- **↑ Importer (Excel)** : fichier .xlsx/.csv → associer les colonnes (Prénom, Nom obligatoires) → la colonne **Classe** doit correspondre **exactement** au libellé d'une classe existante → **Importer**.
- **Recherche/filtres** : nom/matricule, classe, statut.
- **Fiche élève** (clic) : état civil + **photo**, **Responsables** (+ bouton **Code parent**, §13), **Inscriptions**.

> Édition réservée au promoteur, au comptable et à la secrétaire ; enseignants/surveillants en lecture seule. Le **code parent** peut aussi être généré par le **responsable pédagogique**.

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
| **Promoteur** | Tous les rôles (responsables + n'importe quel compte, en dépannage) |
| **Responsable pédagogique** | Enseignant, Surveillant, Parent |
| **Responsable RH** | Secrétaire / Caisse |
| **Comptable / Gestion** | Secrétaire / Caisse |

### 4.2 Inviter un membre
1. Ouvrir le menu **Membres** (présent dans votre espace).
2. **+ Inviter un membre** → choisir le **rôle** (limité à ce que vous avez le droit de déléguer) + e-mail (optionnel) → **Générer le code d'invitation**.
3. Un **code à 8 caractères** et un **lien** s'affichent → les transmettre via **Copier**, **WhatsApp** ou **Email**.

> 🔒 **Verrouillage par e-mail (optionnel)** : si vous renseignez l'e-mail, l'invitation n'est utilisable **que** par un compte créé avec **cette** adresse (plus sûr). Laissez vide pour un code utilisable par tout destinataire (utile pour le personnel sans e-mail). Dans tous les cas, transmettez le code **en privé**.

### 4.3 Rejoindre (côté invité)
1. L'invité crée un compte (Inscription) puis choisit **« 🧑‍💼 Je suis un membre du personnel »** et saisit le code — ou ouvre directement le **lien d'invitation** (code pré-rempli).
2. ✅ Son compte est créé avec le bon rôle et il atterrit dans **son espace**.

### 4.4 Enseignants reliés à leur fiche (cas particulier)
Pour qu'un enseignant retrouve **ses** classes (Appel, Notes…), son compte doit correspondre à sa **fiche** :
1. Espace RH/Pédagogie → **Enseignants** → ouvrir la fiche (prénom, nom, **e-mail** conseillé).
2. **« Code d'accès »** → communiquer le code → l'enseignant choisit **« 🧑‍🏫 Je suis un enseignant »** et le saisit.
3. Le compte est relié (badge **« ✓ compte lié »**). *Astuce : si l'e-mail du compte = l'e-mail de la fiche, la liaison est automatique.*
4. **Affectations** : onglet *Affectations* → relier enseignant × classe × matière (alimente aussi les coefficients).

### 4.5 Invitations en attente
Sous la liste des membres, la section **« Invitations en attente »** liste les codes générés **non encore utilisés** (rôle, code, 🔒 email ou « ouverte », date). Vous pouvez **Copier le lien** pour renvoyer l'invitation, ou l'**Annuler** (le code devient inutilisable).

### 4.6 Révoquer ou suspendre
Dans **Membres**, sur chaque personne que vous gérez :
- **✕** sur un rôle → retire ce rôle.
- **Suspendre** → bloque immédiatement l'accès (écran « Compte suspendu ») ; **Réactiver** le rétablit.

---

## 5. Le quotidien de l'enseignant (espace Pédagogie)

### 5.1 Appel (menu **Appel**)
À l'ouverture, l'enseignant voit **la liste des élèves de sa classe**. Il pointe **Présent / Absent / Retard** puis **Valide l'appel**.
➡️ Les absences partent **à l'administration** (Vie scolaire) **et** aux **parents des absents** (alerte 🔔).

### 5.2 Cahier de textes (menu **Cahier de textes**)
Pour une classe : ajouter une **séance** (date, matière, contenu fait, **devoirs** + « pour le… »). Visible par l'administration et les **parents**.

### 5.3 Progression (menu **Progression**)
Planifier ses leçons à l'avance (chapitre, matière, période, date prévue) et suivre le statut **À faire / En cours / Fait**.

### 5.4 Assiduité (menu **Assiduité**)
Absences/retards **par élève** sur une période et par classe (les élèves à ≥ 5 incidents sont surlignés).

---

## 6. Notes (menu **Notes**)
1. Choisir **Classe**, **Période**, **Matière**.
2. **+ Ajouter** une évaluation : type, libellé, **barème**, **coefficient**, date.
3. Cliquer l'évaluation → saisir les notes (cocher **Absent** si besoin) → **Enregistrer**.

> Les notes sont ramenées sur 20 selon le barème lors du calcul des bulletins.

---

## 7. Bulletins (menu **Bulletins**)

1. Choisir **Classe** + **Période** → **Calculer les bulletins** (rang, moyenne, mention).
2. Cliquer **Bulletin →** pour ouvrir le bulletin d'un élève :
   - Saisir les **appréciations par matière**, l'**appréciation générale** et la **décision du conseil de classe** (Admis(e), Redouble, Félicitations…).
   - **📤 Enregistrer & publier** → le bulletin (avec appréciations) devient visible par le **parent**.
   - **Imprimer / PDF** (avec cachet de l'école).
3. **📤 Publier aux parents** (en-tête) publie les **moyennes** de toute la classe d'un coup. *(Pour les appréciations, publier chaque bulletin individuellement.)*

Mentions automatiques : Passable ≥10, Assez Bien ≥12, Bien ≥14, Très Bien ≥16.

---

## 8. Classement & tableau d'honneur (menu **Classement**)
Choisir **Classe + Période** → **Calculer** :
- **Classement complet** (rang, moyenne, distinction).
- **Distinctions automatiques** : Encouragements (≥12), Tableau d'honneur (≥14), Félicitations (≥16).
- **🖨️ Imprimer le tableau d'honneur** (document avec cachet, à afficher/distribuer).

---

## 9. Documents administratifs (espace Gestion)

### 9.1 Certificats & attestations (menu **Documents**)
Choisir un **élève** + un **type** (certificat de scolarité, attestation d'inscription, de fréquentation) + signataire/ville/date → **Imprimer / PDF**. Les informations (matricule, classe, naissance, année) sont remplies automatiquement, avec accords (né/née) et cachet.

### 9.2 Demandes de documents (menu **Demandes**)
File des demandes envoyées par les parents (voir §13). Pour chacune : **En cours / Marquer prêt / Rejeter** + une **réponse** (« à retirer au secrétariat »). Le parent est **notifié** automatiquement.

---

## 10. Paiements & recouvrement (espace Gestion)

### 10.1 Grille tarifaire (**Paiements → Grille tarifaire**)
Frais : libellé, montant, **niveau** ciblé ou tous, **Mensuel**, **Obligatoire**.

### 10.2 Facturer
- **+ Nouvelle facture** (un élève, échéance, lignes).
- **⚡ Générer en lot** (par niveau ; frais obligatoires pré-cochés ; pas de doublon).

### 10.3 Encaisser
Cliquer une facture → reçu imprimable + encaissements. Saisir montant, **mode**, référence, date → **Encaisser** (statut mis à jour automatiquement).

### 10.4 Déclarations de paiement mobile (onglet **Déclarations**)
Les paiements mobiles déclarés par les parents apparaissent ici : **valider** (solde la facture) ou **rejeter**.

### 10.5 Recouvrement (menu **Recouvrement**)
Impayés (total, retards, contact), **Relancer** (notification/push), **WhatsApp**, historique.

---

## 11. Vie scolaire, emploi du temps, fournitures, communication
- **Vie scolaire** (Pédagogie) : absences/retards + incidents. Une absence notifie les parents ; la **justification du parent** apparaît avec un statut à **valider** (Justifié / Non justifié).
- **Emploi du temps** (Pédagogie) : créneaux par classe.
- **Fournitures** (Pédagogie) : liste par niveau, visible des parents.
- **Annonces** (Gestion) : publier vers toute l'école / parents / une classe.
- **Messagerie** (Gestion) : fil de discussion école ↔ parents. Pour écrire à un parent, **recherchez l'élève** (le parent avec un compte s'ouvre directement) — ou depuis la **fiche élève**, cliquez **✉️ Message** en face du responsable. Les conversations en cours (avec badge de non‑lus) restent listées.

---

## 12. RH & Paie · Comptabilité
- **RH & Paie** : fiches **personnel**, contrats, **fiches de paie** (un salaire « payé » crée une dépense en comptabilité).
- **Enseignants** : annuaire + affectations + **codes d'accès** (§4).
- **Comptabilité** (Gestion) : recettes, **dépenses** (avec justificatif), trésorerie, synthèse/résultat.

---

## 13. Espace parent

### 13.1 Donner l'accès
Fiche élève → Responsables → **Code parent** → communiquer le code au parent.

### 13.2 Côté parent
Inscription → **Je suis un parent** → saisir le **code**. Pour chaque enfant, onglets :
- **Notes**, **Bulletins** (consultables/imprimables, avec appréciations & décision), **Cahier de textes** (séances + devoirs), **Emploi du temps**, **Fournitures**.
- **Paiements** : régler une facture par **mobile money** (le numéro de l'école + la référence s'affichent) → **Déclarer le paiement** (l'école valide, §10.4).
- **Absences** : **Justifier** une absence (motif) → l'école valide.
- **Documents** : **Demander** un document (certificat…) → suivre le statut.
- En-tête : 💬 **Messagerie** et 🔔 **Alertes** (+ bouton **Activer** les notifications push).

Un même code couvre **tous les enfants** rattachés au tuteur.

### 13.3 Plusieurs enfants — y compris dans des écoles différentes
Un parent gère **tous ses enfants depuis un seul compte**, même s'ils sont scolarisés dans **des établissements différents** (utilisant tous GesSchool) :
1. Se connecter avec **son compte** (ne pas en recréer un).
2. Accueil parent → bouton **« + Ajouter un enfant »** → saisir le **code** remis par l'autre établissement.
3. Le nouvel enfant apparaît dans la liste, **étiqueté avec son école** ; chaque enfant garde ses propres notes, bulletins, paiements et absences.

> ⚠️ **Un seul compte, plusieurs codes.** Si vous avez déjà un compte (pour un premier enfant), **connectez‑vous** puis ajoutez le nouveau code — ne créez pas un second compte, sinon vos enfants seront répartis sur deux connexions distinctes. Les établissements restent totalement cloisonnés : chacun ne voit que ses propres élèves.

---

## 14. Notifications push
Parents et personnel peuvent **activer les notifications** sur leur appareil (alerte même app fermée) : nouvelle note, absence, facture, document prêt, message. Sur mobile, installer la PWA (« Ajouter à l'écran d'accueil ») — sur iPhone, l'installation est requise pour le push.

---

## 15. Console super-admin & Pilotage
- **🛠️ Console super-admin** (lien en bas du menu, réservé au propriétaire du SaaS) : toutes les écoles clientes, leur **plan/abonnement**, **statut**, et **modules** activés (vendre à la carte, suspendre un impayé).
- **Pilotage** (promoteur multi-écoles) : **synthèse consolidée** (effectifs, recouvrement, trésorerie, masse salariale) + **« Gérer cette école »**.

---

## 16. Récapitulatif des rôles

| Rôle | Accès principal | Peut inviter |
|---|---|---|
| **Promoteur** | Tous les espaces + configuration (Paramètres, Modules) | Tout le monde |
| **Responsable pédagogique** | Pédagogie (toutes les classes) + Structure + **codes parents** | Enseignant, Surveillant, Parent |
| **Comptable / Gestion** | Gestion : paiements, recouvrement, comptabilité, communication | Secrétaire / Caisse |
| **Secrétaire / Caisse** | Gestion opérationnel : élèves & inscriptions, documents, demandes, encaissement | — |
| **Responsable RH** | RH & Paie : personnel, paie, enseignants | Secrétaire / Caisse |
| **Enseignant** | Pédagogie : appel, cahier de textes, progression, notes, bulletins, classement, assiduité | — |
| **Surveillant** | Pédagogie : appel, vie scolaire, assiduité | — |
| **Parent** | Espace parent : suivi de ses enfants | — |
| **Super-admin** | Console de pilotage du SaaS | — |

---

## 17. Dépannage rapide
- **« Je ne vois pas un menu »** → module désactivé (Paramètres → Modules) ou rôle sans accès.
- **« Comment ajouter un responsable / une secrétaire ? »** → menu **Membres** → **+ Inviter un membre** (voir §4).
- **« Compte suspendu »** au démarrage → votre accès a été suspendu par un responsable ; demandez sa réactivation (menu Membres → Réactiver).
- **« Je n'ai pas le menu Membres »** → seuls le promoteur et les responsables (pédagogique, RH, comptable) peuvent déléguer des accès.
- **« L'enseignant ne voit pas sa classe »** → vérifier qu'il a saisi son **code d'accès** et qu'il est **prof principal** ou **affecté** à une classe.
- **« Impossible d'inscrire un élève »** → créer d'abord une classe via **Structure**.
- **« L'import n'inscrit pas en classe »** → la colonne Classe ne correspond pas au libellé exact.
- **« Le parent ne reçoit pas le push »** → vérifier l'activation des notifications / l'installation de l'app ; l'alerte reste visible dans son espace.
- **Mot de passe oublié** → lien sur la page de connexion.

---

*GesSchool — gestion scolaire multi-écoles, « zéro papier » : appel, cahier de textes, progression, notes, bulletins & appréciations, classement, assiduité, certificats, demandes de documents, paiements & paiement mobile, recouvrement, RH & paie, comptabilité, communication, espace parent, multi-écoles et modules à la carte.*
