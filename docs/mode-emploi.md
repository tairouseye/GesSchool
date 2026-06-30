# GesSchool — Mode d'emploi

Guide d'utilisation pas à pas, de la création de l'école à l'usage quotidien.
Application web (PWA) : utilisable sur ordinateur, tablette et téléphone, depuis un navigateur.

---

## 0. Concepts de base (à lire une fois)

**GesSchool** organise le travail en **espaces** selon le métier de chaque utilisateur :

| Espace | Icône | Pour qui | Contient |
|---|---|---|---|
| **Pédagogie** | 🎓 | Enseignants, surveillants | Élèves, Structure, Notes, Bulletins, Emploi du temps, Vie scolaire, Fournitures |
| **Gestion** | 💼 | Comptables, administration | Élèves, Paiements, Recouvrement, Comptabilité, Annonces, Messagerie, Paramètres |
| **RH & Paie** | 🧑‍💼 | RH | Personnel & paie, Enseignants |
| **Pilotage** | 🎯 | Promoteur / direction | Vue consolidée de toutes ses écoles |

- L'**administrateur** et la **direction** voient **tous les espaces**. Les autres rôles ne voient que le leur.
- Le sélecteur d'espace est en haut à gauche (visible si vous avez accès à plusieurs).
- Chaque **module** (Finances, Évaluations, etc.) peut être activé/désactivé par école (voir Paramètres).

**Rôles disponibles :** Administrateur, Direction, Enseignant, Comptable, RH, Surveillant, Parent, Super-admin.

---

## 1. Créer son compte et son école

### 1.1 Créer le compte
1. Ouvrir l'application → page **Connexion**.
2. Onglet **Inscription** → saisir e-mail + mot de passe (min. 6 caractères) → **Créer le compte**.
3. Selon la configuration, un e-mail de confirmation peut être demandé : le valider, puis se connecter.

### 1.2 Choisir son profil
Au premier accès, l'écran **Bienvenue** propose :
- **🏫 Je gère une école** → crée l'établissement (c'est votre cas en tant qu'admin).
- **👪 Je suis un parent** → rejoint un enfant avec un code de liaison (voir §9).

### 1.3 Assistant de création (3 étapes)
En cliquant sur « Je gère une école » :
1. **Identité** : nom, sigle, type (Privé / Public / Confessionnel / Franco-arabe), logo et cachet (optionnels), couleurs.
2. **Cycles ouverts** : cocher les cycles présents (Préscolaire, Élémentaire, Collège, Lycée, Formation pro, Université).
3. **Responsable & année** : votre prénom/nom, libellé de l'année (ex. 2025-2026), dates, et découpage **Trimestres (3)** ou **Semestres (2)**.
4. **Créer l'établissement**.

➡️ À la fin, l'école, ses cycles, votre compte admin, l'année scolaire et les périodes sont créés automatiquement. Vous arrivez sur le tableau de bord.

---

## 2. Configuration initiale (à faire en premier)

### 2.1 Structure académique (menu **Structure**)
C'est le squelette de l'école. Ordre logique : **Niveaux → Classes → Matières → (Séries) → Coefficients**.

- **Niveaux** : dans chaque cycle, taper un niveau (ex. « 6e », « CP », « Seconde ») → **+ Niveau**.
- **Classes** (génération en lot) : sur une ligne de niveau, choisir la *base du nom* (ex. 6e), le *nombre* de classes, le *suffixe* (A,B,C / 1,2,3 / aucun), éventuellement une *série* et un *effectif max* → **+ Générer**. L'aperçu montre les classes à créer (les doublons sont ignorés).
- **Matières** : libellé + code (ex. MATH) + cycle optionnel → **+ Ajouter**.
- **Séries** (lycée uniquement) : créer L, S2… ou cliquer **+ Pré-remplir les séries standard**.
- **Grille de coefficients** : choisir une *portée* (une série OU un niveau), puis saisir le coefficient de chaque matière (laisser vide = matière non comptée). Saisi une fois, il s'applique à toutes les classes concernées.

### 2.2 Paramètres (menu **Paramètres**)
- **Établissement** : nom, sigle, devise (XOF par défaut), couleurs.
- **Matricule des élèves** : préfixe, séparateur, nombre de chiffres. Aperçu en direct (ex. `GS-25-0001`). Généré automatiquement à chaque inscription.
- **Relances automatiques** (si module Finances actif) : voir §6.4.
- **Modules actifs** : activer/désactiver des modules. Un module désactivé disparaît des menus.

### 2.3 Coordonnées de paiement mobile (menu **Paiements → onglet Paiement mobile**)
Saisir vos numéros **Wave / Orange Money / Free Money**. Ils seront affichés aux parents pour régler les factures.

---

## 3. Élèves & inscriptions (menu **Élèves**)

### 3.1 Ajouter un élève (un par un)
**+ Nouvel élève** → prénom, nom, sexe, naissance, classe (inscription immédiate), et un responsable optionnel (prénom, nom, téléphone, lien). Le **matricule est généré automatiquement**.

### 3.2 Importer en masse (Excel/CSV)
**↑ Importer (Excel)** :
1. Choisir le fichier (1ʳᵉ ligne = en-têtes).
2. Vérifier l'**association des colonnes** (Prénom et Nom obligatoires ; Sexe, Date de naissance, Lieu, Matricule, Classe optionnels). Les colonnes sont devinées automatiquement.
3. ⚠️ La colonne **Classe** doit correspondre **exactement** au libellé d'une classe existante pour inscrire l'élève.
4. **Importer** → un récapitulatif indique les élèves créés / inscrits / ignorés.

### 3.3 Rechercher / filtrer
Barre de recherche (nom ou matricule) + filtres par **classe** et par **statut**.

### 3.4 Fiche élève (clic sur une ligne)
- **État civil** : modifier, ajouter une **photo**, supprimer l'élève.
- **Responsables** : ajouter un tuteur ; bouton **Code parent** = génère un code à 8 caractères à communiquer au parent (voir §9) ; marquer responsable légal / paiement.
- **Inscriptions** : inscrire / changer de classe (option redoublant).

> Édition réservée à l'administration et au comptable. Enseignants/surveillants sont en lecture seule.

---

## 4. Notes (menu **Notes**)

1. Choisir **Classe**, **Période**, **Matière**.
2. **+ Ajouter** une évaluation : type (devoir, composition, examen, interro, tp, oral, projet), libellé, **barème** (ex. 20), **coefficient**, date.
3. Cliquer sur l'évaluation → saisir les notes élève par élève (cocher **Absent** si besoin) → **Enregistrer**.

> Les notes sont automatiquement ramenées sur 20 selon le barème lors du calcul des bulletins.

---

## 5. Bulletins (menu **Bulletins**)

1. Choisir **Classe** + **Période** → **Calculer les bulletins**.
2. Le tableau affiche **rang, moyenne, mention** pour chaque élève.
3. Cliquer **Bulletin →** pour voir le bulletin individuel (avec cachet de l'école) → **Imprimer / PDF**.

Moyennes pondérées par les coefficients de matière ; mentions automatiques (Passable ≥10, Assez Bien ≥12, Bien ≥14, Très Bien ≥16).

---

## 6. Paiements & recouvrement (espace Gestion)

### 6.1 Grille tarifaire (menu **Paiements → onglet Grille tarifaire**)
Créer les frais : libellé (Scolarité, Inscription, Cantine…), montant, **niveau** ciblé ou tous, **Mensuel** (récurrent), **Obligatoire** (facturé automatiquement en lot).

### 6.2 Facturer
- **+ Nouvelle facture** : un élève, une échéance, des lignes (choisir un frais pré-rempli ou saisir librement) → **Créer la facture**.
- **⚡ Générer en lot** : choisir un **niveau**, cocher les frais (les obligatoires sont pré-cochés), une échéance → **Générer**. Une facture par élève ; les élèves déjà facturés sont ignorés (pas de doublon).

### 6.3 Encaisser
Cliquer une facture → **reçu imprimable** + historique des encaissements. Dans « Encaisser un paiement » : montant, **mode** (espèces, Wave, OM…), référence, date → **Encaisser**. Le statut de la facture (payée / partielle / en retard) se met à jour tout seul. **Imprimer le reçu** disponible.

### 6.4 Déclarations de paiement mobile (onglet **Déclarations**)
Quand un parent déclare un paiement mobile (voir §9), il apparaît ici : **valider** (enregistre l'encaissement et solde la facture) ou **rejeter**.

### 6.5 Recouvrement & relances (menu **Recouvrement**)
- Vue **Impayés** : total dû, dont en retard, liste par élève avec jours de retard et contact payeur.
  - **Relancer (push)** : envoie une notification + push au parent.
  - **WhatsApp** : ouvre un message pré-rempli (ou le copie si aucun numéro).
- Onglet **Historique** : journal de toutes les relances envoyées.
- **Relances automatiques** (Paramètres) : créer des **paliers** (ex. J+1, J+7, J+15 après l'échéance) avec un message type. Le système envoie les rappels chaque jour automatiquement. Bouton **Relancer tous les retards** pour un envoi immédiat.

---

## 7. Vie scolaire, emploi du temps, fournitures, communication

- **Vie scolaire** (Pédagogie) : saisie des **absences/retards** et incidents. Une absence saisie notifie automatiquement les parents.
- **Emploi du temps** (Pédagogie) : créneaux par classe (jour, horaires, matière, enseignant, salle).
- **Fournitures** (Pédagogie) : liste des fournitures par classe, visible par les parents.
- **Annonces** (Gestion) : publier une annonce (toute l'école, parents, une classe…).
- **Messagerie** (Gestion) : échanges école ↔ parents.

---

## 8. RH & Paie · Comptabilité

- **RH & Paie** (espace RH) : fiches **personnel**, contrats, **fiches de paie**. Marquer un salaire payé crée automatiquement une dépense en comptabilité.
- **Enseignants** (espace RH) : annuaire des enseignants et affectations classe/matière.
- **Comptabilité** (Gestion) : recettes, **dépenses** (avec justificatif), trésorerie.

---

## 9. Espace parent

### 9.1 Donner l'accès à un parent
1. Côté école : Fiche élève → Responsables → **Code parent** → un code à 8 caractères s'affiche.
2. Communiquer ce code au parent (WhatsApp, papier…).

### 9.2 Côté parent
1. Le parent crée un compte (Inscription) → écran Bienvenue → **Je suis un parent** → saisir le **code de liaison**.
2. Il accède à l'espace parent : pour chaque enfant, onglets **Notes, Emploi du temps, Fournitures, Paiements, Absences**.
3. **Payer une facture** : choisir Wave/OM/Free Money → payer depuis son appli mobile sur le numéro de l'école (référence = n° de facture) → **Déclarer le paiement**. L'école valide ensuite (§6.4).

Un même code peut couvrir plusieurs enfants si le tuteur est rattaché à plusieurs élèves.

---

## 10. Notifications push

Les parents (et le personnel) peuvent activer les **notifications push** sur leur appareil. Ils reçoivent alors une alerte pour : nouvelle note, absence, nouvelle facture, **rappel de paiement**. Sur mobile, installer l'app (PWA) via « Ajouter à l'écran d'accueil » améliore l'expérience.

---

## 11. Console super-admin (éditeur du SaaS)

Réservée au propriétaire de GesSchool (vous). Accès via le lien **🛠️ Console super-admin** en bas du menu.
- Liste de **toutes les écoles clientes** : effectif, plan, statut d'abonnement, échéance.
- Bouton **gérer** : appliquer un **plan/abonnement**, changer le **statut**, ajuster finement les **modules** activés d'une école.

### Promoteur multi-écoles (espace Pilotage)
Un promoteur propriétaire de plusieurs écoles voit une **synthèse consolidée** (effectifs, facturé/payé, trésorerie, masse salariale) et peut **« entrer »** dans une école pour la gérer.

---

## 12. Récapitulatif des rôles

| Rôle | Accès principal |
|---|---|
| **Administrateur / Direction** | Tout (tous les espaces) |
| **Comptable** | Gestion : élèves, paiements, recouvrement, comptabilité |
| **Enseignant** | Pédagogie : notes, bulletins, emploi du temps, vie scolaire (élèves en lecture) |
| **Surveillant** | Pédagogie : vie scolaire (absences) |
| **RH** | RH & Paie : personnel, paie, enseignants |
| **Parent** | Espace parent : suivi de ses enfants |
| **Super-admin** | Console de pilotage du SaaS |

---

## 13. Dépannage rapide

- **« Je ne vois pas un menu »** → le module est peut-être désactivé (Paramètres → Modules) ou votre rôle n'y a pas accès.
- **« Impossible d'inscrire un élève »** → aucune classe créée : passez par **Structure** d'abord.
- **« L'import n'inscrit pas en classe »** → la colonne Classe ne correspond pas au libellé exact d'une classe existante.
- **« Le parent ne reçoit pas le push »** → vérifier qu'il a activé les notifications et installé l'app ; le rappel reste visible dans son espace même sans push.
- **Mot de passe oublié** → lien « Mot de passe oublié ? » sur la page de connexion.

---

*GesSchool — gestion scolaire multi-écoles. Document à jour des fonctionnalités courantes (élèves, notes, bulletins, paiements, recouvrement & relances, espace parent, RH, comptabilité).*
