# GesSchool — Mode d'emploi

Guide d'utilisation pas à pas, de la création de l'école à l'usage quotidien.
Application web (PWA) : utilisable sur ordinateur, tablette et téléphone, depuis un navigateur — installable comme une application.

> **Version 2.235 · mise à jour du 3 octobre 2026.** Cette édition intègre ce qui a été construit après la visite d'établissement : circuit du bulletin et procès-verbal du conseil de classe, suivi des acquis au préscolaire, programmation officielle de l'IEF, photos d'élèves, indicateur de paiement, paliers d'établissement, présence par séance au supérieur.

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

- **Feuille de présence** (anciennement « Appel ») : pointer **Présent / Absent / Retard** → **Valider**. Les absences partent à l'administration **et** aux **parents des absents** (🔔). La feuille est **imprimable** et porte le nom de qui l'a remplie. Au préscolaire et à l'élémentaire, la présence est **journalière** ; au supérieur, elle se pointe **par séance** (§22).
  > La direction et le responsable pédagogique voient **toutes les classes** ; un enseignant, seulement les siennes. C'est utile là où les responsables pédagogiques font le travail des enseignants.
- **Cahier de textes** : séance (date, matière, contenu, **devoirs** + « pour le… »). Visible des parents. Le bouton **📋 Reprendre la programmation** permet de **choisir un contenu officiel au lieu de le ressaisir** (§21).
- **Progression** : planifier ses leçons (chapitre, période, date) et suivre **À faire / En cours / Fait**.
- **Suivi des acquis** (préscolaire) : on y **observe** au lieu de noter (§20).
- **Assiduité** : absences/retards **par élève** sur une période (≥ 5 incidents surlignés).
- **Photos des élèves** : prise de vue classe par classe, au téléphone (§23).

---

## 6. Notes (menu **Notes**)
1. Choisir **Classe**, **Période**, **Matière**.
2. **+ Ajouter** une évaluation : type, libellé, **barème**, **coefficient**, date.
3. Cliquer l'évaluation → saisir les notes (cocher **Absent** si besoin) → **Enregistrer**.

> Les notes sont ramenées sur le barème de l'école lors du calcul des bulletins.

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

| Écran | À quoi il sert |
|---|---|
| **Filières & maquettes** | Facultés, départements, filières, **semestres**, **UE / ECUE**, crédits — remplace « Niveaux & classes » |
| **Admissions** | Dossiers de candidature |
| **Inscriptions LMD** | Inscrire un étudiant dans une filière et un semestre, puis à ses **UE** |
| **Notes LMD** | Notes par UE/ECUE, avec les crédits |
| **Délibérations** | Validation des semestres, relevés de notes |
| **Codes étudiants** | Donner à chaque étudiant son code d'activation |
| **Emploi du temps** | Planification par **filière et semestre** (et non par classe) |
| **Bibliothèque** | Catalogue, prêts et retours, fonds numérique, dépôt de mémoires et thèses |

- Le vocabulaire passe à **« étudiant »** dans un établissement **exclusivement** universitaire. Dans un établissement qui va de l'élémentaire à l'université, on garde « élève » comme mot courant — dire « étudiant » au préscolaire serait absurde — et les écrans du supérieur portent leurs propres intitulés.
- Les étudiants ont leur **propre espace** : relevés, emploi du temps, bibliothèque, carte d'étudiant.
- ⚠️ **L'accès d'un étudiant à ses notes passe par un consentement** : il le demande, l'établissement l'accorde.

---

## 25. Console super-admin & Pilotage
- **🛠️ Console super-admin** (réservée au propriétaire du SaaS) : toutes les écoles clientes, leur **plan/abonnement**, **statut**, **modules**, et le **nombre de comptes** (personnel + parents) par école.
- **Pilotage** (promoteur multi-écoles) : **synthèse consolidée** (effectifs, recouvrement, trésorerie, masse salariale), **checklist de mise en route**, **passage d'année**, et **« Gérer cette école »**.

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
- **« Comment ajouter un responsable / une secrétaire ? »** → **Membres → + Inviter un membre** (§4).
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

---

*GesSchool — gestion scolaire multi-écoles, « zéro papier » : appel, cahier de textes, progression, notes, bulletins & appréciations, classement, assiduité, certificats & validation, demandes de documents, paiements & paiement mobile avec preuve, recouvrement, emplois du temps automatiques, cantine, transport, RH & paie, comptabilité, communication, tableaux de bord, passage d'année, espace parent, multi-écoles et modules à la carte.*
