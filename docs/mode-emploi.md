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
| **Pilotage** | 🎯 | Promoteur (accès total) | Vue consolidée de toutes ses écoles, **Mise en route**, **Passage d'année**, **Membres** |
| **Pédagogie** | 🎓 | Responsable pédagogique, enseignants, surveillants | Accueil, **Appel**, **Cahier de textes**, **Progression**, Élèves (lecture), Structure, Notes, Bulletins, **Classement**, **Emploi du temps**, Vie scolaire, **Assiduité**, Fournitures, **Membres** |
| **Gestion** | 💼 | Comptable, secrétaire / caisse | Accueil, Élèves & inscriptions, **Documents**, **Demandes**, Paiements, Recouvrement, **Cantine**, **Transport**, Annonces, Messagerie, **Membres**, Paramètres |
| **RH & Paie** | 🧑‍💼 | Responsable RH | Personnel & paie, Enseignants, Comptabilité, **Membres** |
| **Parent** | 👪 | Familles | Suivi de chaque enfant (voir §17) |

- Le **promoteur** (créateur de l'école) voit **tous les espaces** et configure l'établissement. Les **responsables** (pédagogique, RH, comptable) sont **cloisonnés à leur domaine** ; chacun **gère ses propres accès** (voir §4).
- Le **sélecteur d'espace** est en haut à gauche de la barre latérale (visible si vous avez accès à plusieurs). Les onglets et menus passent à la ligne pour rester visibles sur téléphone.
- Chaque **module** (Finances, Évaluations, RH, Cantine, Transport…) peut être activé/désactivé **par le promoteur** (Paramètres → Modules).
- Chaque accueil met en avant une zone **« À traiter »** (ce qui demande une action) — voir §15.
- Chacun **atterrit dans son espace** à la connexion (un enseignant arrive sur l'**Appel**, un comptable sur son **tableau de bord Gestion**…).

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

---

## 3. Élèves & inscriptions (menu **Élèves**)

- **+ Nouvel élève** : prénom, nom, sexe, naissance, classe, responsable optionnel, + vos **champs personnalisés**. **Matricule auto**.
- **↑ Importer (Excel)** : fichier .xlsx/.csv → **associer chaque colonne** (Prénom & Nom obligatoires ; Sexe, Naissance, Matricule, Classe, **Parent/Tuteur + téléphone**, et vos **champs personnalisés**). L'app **devine** les colonnes par leur intitulé. La colonne **Classe** doit correspondre **exactement** au libellé d'une classe existante pour inscrire l'élève ; un **parent** renseigné est créé et rattaché automatiquement. Bilan : créés / inscrits / parents liés / ignorés.
- **Recherche/filtres** : nom/matricule, classe, statut.
- **Supprimer** : icône 🗑️ par ligne, ou **cases à cocher** + **« Supprimer la sélection »** pour plusieurs élèves. Une **confirmation** rappelle que toutes les données liées (inscriptions, notes, factures, absences…) seront perdues.
- **Fiche élève** (clic) : état civil + **photo**, champs personnalisés, **Responsables** (+ bouton **Code parent**, §17), **Inscriptions**.

> Édition (créer/importer/supprimer) réservée au promoteur, au comptable et à la secrétaire. Un **enseignant** ne voit que les élèves de **ses classes** ; direction, surveillant et gestion voient tout l'établissement.

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

### 4.3 Rejoindre (côté invité)
L'invité crée un compte, choisit **« 🧑‍💼 Je suis un membre du personnel »** et saisit le code — ou ouvre le **lien d'invitation** (code pré-rempli). ✅ Son compte est créé avec le bon rôle.

### 4.4 Enseignants reliés à leur fiche
Pour qu'un enseignant retrouve **ses** classes (Appel, Notes…), son compte doit correspondre à sa **fiche** :
1. **Enseignants** → ouvrir la fiche (e-mail conseillé) → **« Code d'accès »** → l'enseignant choisit **« 🧑‍🏫 Je suis un enseignant »** et le saisit. *Astuce : si l'e-mail du compte = l'e-mail de la fiche, la liaison est automatique.*
2. **Affectations** : relier enseignant × classe × matière (alimente coefficients **et** la génération d'emploi du temps).

### 4.5 Invitations en attente & 4.6 Révoquer/suspendre
La section **« Invitations en attente »** liste les codes non utilisés (Copier le lien / Annuler). Sur chaque personne gérée : **✕** retire un rôle ; **Suspendre** bloque l'accès (« Compte suspendu »), **Réactiver** le rétablit.

---

## 5. Le quotidien de l'enseignant (espace Pédagogie)

- **Appel** : l'enseignant voit **sa classe**, pointe **Présent / Absent / Retard** → **Valide l'appel**. Les absences partent à l'administration **et** aux **parents des absents** (🔔).
- **Cahier de textes** : séance (date, matière, contenu, **devoirs** + « pour le… »). Visible des parents.
- **Progression** : planifier ses leçons (chapitre, période, date) et suivre **À faire / En cours / Fait**.
- **Assiduité** : absences/retards **par élève** sur une période (≥ 5 incidents surlignés).

---

## 6. Notes (menu **Notes**)
1. Choisir **Classe**, **Période**, **Matière**.
2. **+ Ajouter** une évaluation : type, libellé, **barème**, **coefficient**, date.
3. Cliquer l'évaluation → saisir les notes (cocher **Absent** si besoin) → **Enregistrer**.

> Les notes sont ramenées sur le barème de l'école lors du calcul des bulletins.

---

## 7. Bulletins (menu **Bulletins**)
1. Choisir **Classe** + **Période** → **Calculer les bulletins** (rang, moyenne, mention selon vos réglages de **Notation**, §2.2).
2. Cliquer **Bulletin →** : saisir les **appréciations par matière**, l'**appréciation générale**, la **décision du conseil** → **📤 Enregistrer & publier** (visible du parent) ; **Imprimer / PDF** (avec cachet).
3. **📤 Publier aux parents** (en-tête) publie les **moyennes** de toute la classe d'un coup.

Le **barème**, la **moyenne de passage** et les **mentions** sont ceux définis dans Paramètres → Notation (barème /20 par défaut : Passable ≥10, Assez Bien ≥12, Bien ≥14, Très Bien ≥16).

---

## 8. Classement & tableau d'honneur (menu **Classement**)
Choisir **Classe + Période** → **Calculer** : classement complet (rang, moyenne), **distinctions automatiques** (Encouragements ≥12, Tableau d'honneur ≥14, Félicitations ≥16), **🖨️ Imprimer**.

---

## 9. Documents administratifs (espace Gestion)

### 9.1 Certificats, attestations & validation (menu **Documents**)
Choisir un **élève** + un **type** (certificat de scolarité, attestation d'inscription, de fréquentation) + **signataire** → le document part **pour validation** au signataire choisi. Le signataire retrouve sa file dans **« À signer »** (badge d'alerte) et **valide** (avec sa signature enregistrée) ou **rejette**. Une fois **validé**, le document est **imprimable / PDF** (infos remplies automatiquement, accords né/née, cachet).

### 9.2 Demandes de documents (menu **Demandes**)
File des demandes envoyées par les parents (§17) : **En cours / Marquer prêt / Rejeter** + une **réponse**. Le parent est **notifié** automatiquement.

---

## 10. Paiements & recouvrement (espace Gestion)

### 10.1 Grille tarifaire (**Paiements → Grille tarifaire**)
Frais : libellé, montant, **portée** (toute l'école / **par cycle** — scolarité identique — / **par niveau** — classe d'examen), **Mensuel**, **Obligatoire**. Chaque frais est **modifiable** (bouton **modifier**) ou supprimable.

### 10.2 Facturer
- **+ Nouvelle facture** (un élève, échéance, lignes).
- **⚡ Générer en lot** (par niveau ; frais obligatoires — y compris ceux **du cycle** — pré-cochés ; pas de doublon).

### 10.3 Encaisser
Cliquer une facture → **reçu imprimable** (avec le **logo** de l'école) + encaissements. Saisir montant, **mode** (Espèces, Wave, Orange Money, Virement, Chèque…), référence, date → **Encaisser** (statut recalculé automatiquement). Encaissements possibles en plusieurs fois.

### 10.4 Déclarations de paiement mobile (onglet **Déclarations**)
Les paiements déclarés par les parents apparaissent ici avec, le cas échéant, une **📎 preuve** jointe (capture Wave/OM, photo du bordereau) : cliquez **« Voir »** pour la vérifier, puis **valider** (solde la facture automatiquement) ou **rejeter**.

### 10.5 Recouvrement (menu **Recouvrement**)
Impayés (total, retards, contact), **Relancer** (notification/push), **WhatsApp**, historique. Relances récurrentes configurables (Paramètres).

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

Modules activables par le promoteur (§2.2). Une fois actifs :

- **Cantine** : **Abonnés** (formule *mensuel* ou *prépayé au repas*, tarif, régime/allergies, **solde**), **Pointage du jour** (marquer les repas ; le solde prépayé est décrémenté, recharge possible), **Menu** de la semaine. Bouton **« Facturer le mois »** → génère les factures des abonnements.
- **Transport** : **Circuits** (chauffeur, arrêts triés par heure), **Abonnés** (circuit, arrêt, trajet aller/retour, tarif), **Embarquement** (pointer les élèves pris en charge → notifie les parents). **« Facturer le mois »** disponible.

Côté **parent**, si l'enfant a un abonnement, des onglets **🍽️ Cantine** et **🚌 Transport** apparaissent (formule, solde, menu, circuit/arrêt).

---

## 13. Vie scolaire, fournitures, communication
- **Vie scolaire** (Pédagogie) : absences/retards + incidents. La **justification du parent** apparaît avec un statut à **valider** (Justifié / Non justifié).
- **Fournitures** (Pédagogie) : liste par niveau, visible des parents.
- **Annonces** (Gestion) : publier vers toute l'école / parents / une classe.
- **Messagerie** (Gestion) : fil école ↔ parents. Accessible à la **direction, au comptable et à la secrétaire**. Pour écrire, **recherchez l'élève** (le parent avec un compte s'ouvre) — ou depuis la fiche élève, **✉️ Message**.

---

## 14. RH & Paie · Comptabilité
- **RH & Paie** : fiches **personnel**, contrats, **fiches de paie** (« ⚡ Générer la paie » du mois ; un salaire « payé » crée une dépense en comptabilité et son **bulletin** est imprimable). Le tableau de bord RH met en avant salaires à payer, fiches à générer et **contrats à échéance** (§15).
- **Enseignants** : annuaire + affectations + **codes d'accès** (§4).
- **Comptabilité** (sous RH & Paie / Gestion) : recettes, **dépenses** (avec justificatif), trésorerie, synthèse/résultat.

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
3. **Filet de sécurité** : une année **vide** (0 inscription) ouverte par erreur peut être **supprimée** (l'ancienne redevient courante). L'**enchaînement des niveaux** est affiché, avec une alerte si l'ordre est incohérent.

Ce qui **persiste** d'une année à l'autre (à ne pas refaire) : niveaux, cycles, matières, séries, coefficients, personnels/enseignants, salles, volumes horaires, membres/rôles.

---

## 17. Espace parent

### 17.1 Donner l'accès
Fiche élève → Responsables → **Code parent** → communiquer le code au parent.

### 17.2 Côté parent
Inscription → **Je suis un parent** → saisir le **code**. Pour chaque enfant, onglets :
- **Notes**, **Bulletins** (avec appréciations & décision), **Cahier de textes**, **Emploi du temps**, **Fournitures**, et si abonné **🍽️ Cantine** / **🚌 Transport**.
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

## 19. Console super-admin & Pilotage
- **🛠️ Console super-admin** (réservée au propriétaire du SaaS) : toutes les écoles clientes, leur **plan/abonnement**, **statut**, **modules**, et le **nombre de comptes** (personnel + parents) par école.
- **Pilotage** (promoteur multi-écoles) : **synthèse consolidée** (effectifs, recouvrement, trésorerie, masse salariale), **checklist de mise en route**, **passage d'année**, et **« Gérer cette école »**.

---

## 20. Récapitulatif des rôles

| Rôle | Accès principal | Peut inviter |
|---|---|---|
| **Promoteur** | Tous les espaces + configuration + passage d'année | Tout le monde |
| **Responsable pédagogique** | Pédagogie (toutes les classes) + Structure + codes parents | Enseignant, Surveillant, Parent |
| **Comptable / Gestion** | Gestion : paiements, recouvrement, comptabilité, cantine/transport, communication | Secrétaire / Caisse |
| **Secrétaire / Caisse** | Gestion opérationnel : élèves & inscriptions, documents, demandes, encaissement, messagerie | — |
| **Responsable RH** | RH & Paie : personnel, paie, enseignants, comptabilité | Secrétaire / Caisse |
| **Enseignant** | Pédagogie : appel, cahier, progression, notes, bulletins, classement, assiduité (**ses classes**) | — |
| **Surveillant** | Pédagogie : appel, vie scolaire, assiduité | — |
| **Parent** | Espace parent : suivi de ses enfants | — |
| **Super-admin** | Console de pilotage du SaaS | — |

---

## 21. Dépannage rapide
- **« Je ne vois pas un menu »** → module désactivé (Paramètres → Modules, promoteur) ou rôle sans accès.
- **« Une page ne s'ouvre pas / reste blanche »** → cache de l'app dépassé après une mise à jour : l'appli se recharge normalement toute seule ; sinon **rechargez** (Ctrl+Maj+R), ou ouvrez en **navigation privée**, ou réinstallez la PWA.
- **« Comment ajouter un responsable / une secrétaire ? »** → **Membres → + Inviter un membre** (§4).
- **« L'enseignant ne voit pas sa classe »** → vérifier son **code d'accès** et qu'il est **prof principal** ou **affecté** à une classe.
- **« Impossible d'inscrire un élève »** → créer d'abord une classe via **Structure**.
- **« L'import n'inscrit pas en classe »** → la colonne Classe ne correspond pas au libellé exact.
- **« La génération d'emploi du temps laisse des heures non placées »** → voir la **raison** dans le rapport (grille trop petite, prof indisponible, pas d'affectation…) et corriger.
- **« Je ne peux pas ouvrir la nouvelle année »** → réservé au **promoteur** (Pilotage → Passage d'année).
- **Mot de passe oublié** → sur la page de connexion, saisir l'e-mail → un **code à 6–8 chiffres** est envoyé → le saisir + choisir un nouveau mot de passe (pensez aux spams).

---

*GesSchool — gestion scolaire multi-écoles, « zéro papier » : appel, cahier de textes, progression, notes, bulletins & appréciations, classement, assiduité, certificats & validation, demandes de documents, paiements & paiement mobile avec preuve, recouvrement, emplois du temps automatiques, cantine, transport, RH & paie, comptabilité, communication, tableaux de bord, passage d'année, espace parent, multi-écoles et modules à la carte.*
