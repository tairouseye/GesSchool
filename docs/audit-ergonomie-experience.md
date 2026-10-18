# Audit ergonomie et expérience utilisateur — GesSchool

**Date :** 18 octobre 2026  
**Périmètre :** parcours des parents, des étudiants et du personnel ; navigation, états de chargement et d'erreur, interactions courantes, adaptation mobile et accessibilité des composants partagés.

## Synthèse

GesSchool dispose d'une base UX déjà solide : espaces et modules filtrés selon les rôles, menus adaptés au mobile, raccourcis par tuiles, visites guidées, états vides contextualisés, chargements différés et messages d'erreur traduits. Les guides métier sont également accessibles depuis l'application.

Les améliorations les plus rentables concernent maintenant la **navigation entre sections**, la **lisibilité accessible** et le **retour d'état des interfaces**. En test réel sur mobile, l'en-tête parent dépasse la largeur disponible et coupe le bouton de déconnexion. Le parcours enfant impose de revenir à sa grille pour changer de rubrique ; certains contrastes sont trop faibles pour du petit texte ; la modale commune n'enferme pas le focus.

## Méthode et limites

Audit heuristique du code des routes, des coques de navigation, des écrans d'accueil et de plusieurs parcours représentatifs : connexion, liaison de compte, consultation des résultats, messagerie, appel et tableau de bord. Les guides parent et enseignant ont aussi été consultés. L'exploration réelle a porté sur la version de production **v2.262.0** ; les modifications locales apparues dans le worktree après le début de l'audit n'ont pas été intégrées aux conclusions.

L'audit de code et l'exploration navigateur ne remplacent pas des tests avec plusieurs parents, étudiants et membres du personnel, ni une vérification sur différents appareils réels. Les priorités ci-dessous expriment un ordre de traitement recommandé, pas une mesure de fréquence observée.

## Vérifications dans le navigateur

Une exploration en lecture seule a été menée le 18 octobre 2026 sur l'application en production v2.262.0, d'abord avec un profil promoteur/gestion, puis avec un profil parent lié à un enfant. Les essais ont couvert les tableaux de bord et les écrans Élèves, Appel, Notes, Bulletins, Paiements, Recouvrement, Documents, Demandes, Messagerie, Annonces, Structure, Enseignants, Emploi du temps, RH & Paie, Admissions, Paramètres, ainsi que l'accueil parent, les rubriques d'un enfant, les alertes, le règlement et le compte. Le formulaire « Nouvel élève » a été ouvert, parcouru au clavier puis fermé sans envoi ; d'autres formulaires ont été ouverts puis fermés sans soumission. Aucune donnée métier n'a été modifiée.

Les affichages ont été vérifiés à 390 px et 1 440 px de large, avec des contrôles complémentaires à 318 et 320 px. Le document masque les débordements horizontaux, mais une mesure des éléments internes a révélé que l'en-tête parent fait 421 px de large : à 390 px, le bouton « Déconnexion » déborde de 31 px et est partiellement coupé ; à 320 px, il déborde de 101 px. Les pages Élèves et Notes restent dans la largeur écran ; la table élèves conserve une densité importante qui mérite un essai sur téléphone réel.

**Limites :** l'espace Étudiant n'a pas été testé dans le navigateur, car aucune session disponible n'a ce rôle. Les autres modules et leurs opérations de création, validation, paiement, suppression ou envoi n'ont pas été exhaustivement testés. Un test en lecture seule ne permet pas de confirmer la fiabilité de ces opérations.

## Constats priorisés

### P1 — Changer de rubrique oblige à revenir à l'accueil dans les espaces parent et étudiant

Dans l'espace étudiant, les tuiles du menu disparaissent dès qu'une rubrique est ouverte ; le seul retour proposé est « Accueil ». Sur le parcours parent testé, les rubriques Notes, Bulletins, Cahier de textes, Emploi du temps, Paiements, Absences, Fournitures, Documents et Annonces sont des vues de l'enfant courant ; après ouverture, il faut revenir à la grille de cet enfant pour en choisir une autre. Consulter successivement les résultats, les paiements et les absences ajoute donc des retours, particulièrement pénalisants sur téléphone.

**Recommandation :** conserver une navigation secondaire accessible depuis chaque rubrique (barre compacte, menu repliable ou sélecteur de rubriques), avec un accès clair à l'enfant courant pour les parents. Éviter une barre permanente trop encombrante sur mobile ; valider la variante avec des utilisateurs.

Références : [EtudiantLayout.jsx](../src/pages/EtudiantLayout.jsx#L59), [ParentEnfant.jsx](../src/pages/ParentEnfant.jsx#L161).

### P1 — L'en-tête parent mobile coupe l'accès à la déconnexion

À une largeur de 390 px, l'en-tête parent dépasse de 31 px ; à 320 px, il dépasse de 101 px. Le conteneur masque le débordement plutôt que de l'exposer comme un défilement : « Déconnexion » est alors coupé et difficile à atteindre, tandis que les icônes prennent toute la place. Le bouton compte peut aussi être hors écran.

**Recommandation :** regrouper les actions secondaires (compte, aide et déconnexion) dans un menu compact sur petit écran, ou réduire le libellé de marque et ajuster les espacements. Vérifier que chaque action reste visible et atteignable au clavier entre 320 et 390 px.

Référence : [ParentLayout.jsx](../src/pages/ParentLayout.jsx#L56).

### P1 — Le contraste de plusieurs textes et accents est insuffisant

La palette applique fréquemment une opacité de 40 % ou 50 % au texte secondaire. Sur fond blanc, `text-navy-900/40` donne environ **2,49:1** et `/50` environ **3,28:1**. L'accent `#C9A227` sur blanc donne environ **2,42:1**. Ces valeurs sont sous le seuil WCAG AA de **4,5:1** pour le texte courant (et l'accent doré ne convient pas non plus à du texte courant sur blanc).

Cela affecte notamment les aides, dates, états vides, libellés secondaires et métadonnées : leur lecture devient difficile pour les personnes malvoyantes ou en faible luminosité.

**Recommandation :** définir des couleurs dédiées aux textes secondaires et aux liens, puis vérifier les combinaisons réellement utilisées avec un contraste automatisé. Garder le doré pour les surfaces décoratives, bordures ou grands éléments lorsqu'il ne satisfait pas le contraste du texte.

Références : [index.css](../src/index.css#L7), [ui.jsx](../src/composants/ui.jsx#L8).

### P1 — La modale commune ne gère pas complètement le focus clavier

La modale porte `role="dialog"` et `aria-modal="true"`, reçoit le focus à l'ouverture et se ferme avec Échap. Lors du test du formulaire « Nouvel élève », après tabulation à travers ses contrôles, le focus a quitté la boîte et atteint les commandes de navigation situées derrière. Le focus n'est pas non plus explicitement rendu à l'élément déclencheur à la fermeture.

**Recommandation :** confiner le focus dans la modale, mémoriser/restaurer le déclencheur, et vérifier l'ordre de tabulation ainsi que la fermeture par Échap et clic extérieur.

Référence : [ui.jsx](../src/composants/ui.jsx#L260).

### P2 — La messagerie parent peut annoncer « Aucune conversation » avant la fin du chargement

Au premier rendu, `ecoleId` vaut `null`. Tant que `mesConversations()` n'a pas répondu, l'interface affiche déjà « Aucune conversation. » : ce message ressemble à un résultat final, même si le chargement est toujours en cours. Après chargement, le parent testé ayant plusieurs établissements, aucune conversation n'est affichée tant qu'il n'en a pas choisi un ; « Aucune conversation » est alors également trompeur puisque la sélection est le prérequis. Le personnel dispose d'un état de chargement distinct dans sa messagerie.

**Recommandation :** distinguer explicitement chargement, erreur, absence réelle de conversation, choix d'établissement requis et conversation prête ; ne présenter l'état vide qu'après une réponse réussie et un établissement sélectionné.

Référence : [ParentMessagerie.jsx](../src/pages/ParentMessagerie.jsx#L9).

### P2 — Les erreurs en bandeau ne sont pas annoncées explicitement aux lecteurs d'écran

Les toasts ont `role="status"`, mais le composant commun `Alerte` n'a ni rôle d'alerte ni région live. Une erreur qui apparaît après une action peut donc rester invisible pour une personne qui utilise un lecteur d'écran sans déplacer le focus.

**Recommandation :** annoncer les erreurs de façon assertive (`role="alert"` ou `aria-live="assertive"`) et les informations/succès de façon non assertive ; éviter de rendre simultanément le même message deux fois.

Références : [ui.jsx](../src/composants/ui.jsx#L356), [Feedback.jsx](../src/composants/Feedback.jsx#L53).

### P2 — Les raccourcis Messagerie et Alertes ont un nom accessible à fiabiliser

Dans l'en-tête parent vérifié, les liens de Messagerie et Alertes n'ont ni `aria-label` ni libellé visible : seul un emoji et l'attribut `title` les identifient. Le `title` n'est pas un remplacement fiable d'un nom accessible explicite et l'emoji peut être restitué de manière variable selon le lecteur d'écran. Le même motif existe dans l'en-tête étudiant, qui reste à tester en session.

**Recommandation :** ajouter un `aria-label` explicite aux deux liens, incluant le nombre de messages/alertes non lus lorsque pertinent ; tester leur annonce au clavier et au lecteur d'écran.

Références : [ParentLayout.jsx](../src/pages/ParentLayout.jsx#L63), [EtudiantLayout.jsx](../src/pages/EtudiantLayout.jsx#L44).

### P2 — Les Paramètres concentrent de nombreuses catégories sur un seul écran

L'écran Paramètres présente plusieurs dizaines de contrôles dans une longue page : identité et apparence de l'école, cycles, signataires, notation, champs personnalisés, matricules, relances, paiement en ligne et modules. Cette richesse fonctionnelle est utile, mais rend les réglages difficiles à retrouver et augmente le risque de ne pas comprendre quelle section ou quel bouton Enregistrer correspond au changement effectué.

**Recommandation :** organiser les catégories en sous-pages ou en onglets avec une navigation persistante, garder les actions d'enregistrement au niveau de chaque section et afficher clairement les changements non enregistrés. Ne pas fusionner les réglages sensibles (paiement, accès et modules) avec les informations de profil.

Référence : [Parametres.jsx](../src/pages/Parametres.jsx).

### P2 — Le guide de prise en main interrompt l'arrivée sur le tableau de bord

Dans la session testée, la visite guidée s'est affichée automatiquement au premier accès et a recouvert une partie importante du tableau de bord. Le bouton « Passer » permet de la fermer, mais l'utilisateur doit d'abord traiter cette superposition avant d'accéder à son espace de travail.

**Recommandation :** préserver la visite guidée, mais proposer un choix clair de démarrage ou la différer jusqu'à ce que l'utilisateur soit prêt. Vérifier que le contenu reste compréhensible lorsque le guide est affiché sur mobile.

Référence : [Layout.jsx](../src/composants/Layout.jsx#L157).

### P3 — Un accès direct à un module indisponible ne dit pas pourquoi il n'est pas ouvert

Avec le profil de gestion test, l'ouverture directe de la route Bibliothèque a abouti à l'espace Pilotage. Le module n'était pas proposé dans le menu de ce profil ; le renvoi protège donc l'accès, mais n'explique pas si la fonction est désactivée, non incluse ou interdite par le rôle.

**Recommandation :** lors d'une route directe non accessible, afficher une explication et un retour vers l'espace courant plutôt que de rediriger silencieusement vers un autre écran.

Référence : [RouteProtegee.jsx](../src/composants/RouteProtegee.jsx).

## Lecture par public

### Parents

- **Points forts :** rattachement de plusieurs enfants, y compris dans plusieurs écoles ; carte par enfant ; alertes visibles sur les tuiles ; sections chargées à la demande pour limiter les requêtes sur mobile ; aide de premier accès et guide métier.
- **À améliorer en premier :** en-tête mobile débordant ; navigation entre rubriques de l'enfant sans retour obligatoire à la grille ; choix d'école explicite dans la messagerie multi-école ; contrastes des informations secondaires.
- **Parcours à tester :** premier rattachement par code, parent avec plusieurs enfants/écoles, déclaration d'un paiement avec justificatif, justification d'absence, demande de document.

### Étudiants

- **Points forts :** accès direct aux principales rubriques, masquage des modules non actifs, distinction entre notes indicatives et relevés officiels, consentement explicite pour l'accès parental aux résultats.
- **À améliorer en premier :** navigation persistante ou retour rapide entre les rubriques ; noms accessibles des icônes de messagerie et d'alertes ; annoncer les erreurs de chargement et les changements d'état.
- **Parcours à tester :** consultation puis impression d'un relevé, décision sur une demande parentale, envoi et réception d'un message, consultation sur petit écran.

### Personnel scolaire

- **Points forts :** navigation par espaces et groupes, menus filtrés par rôle et modules actifs, présentation spécifique au mobile, raccourcis sur les demandes à traiter, aide accessible depuis la coque et visite guidée. L'appel suit un parcours métier simple : classe, statut des élèves, validation.
- **À améliorer en premier :** vérifier la trouvabilité des modules pour les utilisateurs qui ont beaucoup d'accès ; évaluer si les tuiles, les groupes repliables et le sélecteur d'espaces restent compréhensibles avec plusieurs espaces. La densité fonctionnelle est élevée, même si les regroupements réduisent déjà la charge.
- **Parcours à tester :** enseignant réalisant l'appel sur téléphone, responsable traitant les demandes en attente, agent de gestion validant un paiement et utilisateur disposant de plusieurs rôles.

## Points positifs à préserver

- Les routes et menus distinguent les rôles, les modules actifs et les types d'établissement : les fonctionnalités indisponibles ne sont généralement pas proposées.
- Les états vides sont souvent contextualisés et les pages utilisent des squelettes de chargement.
- Les guides parent et enseignant expliquent les tâches concrètes plutôt que la seule terminologie du produit.
- La feuille de présence est conçue pour le geste quotidien : présents par défaut, signalement des exceptions, compteurs et confirmation après validation.
- La feuille de style prévoit un focus clavier visible, le respect de la réduction des animations et un défilement horizontal des tableaux sur mobile.

## Plan d'action recommandé

1. **Court terme :** adapter l'en-tête parent aux petits écrans ; clarifier le choix d'établissement dans la messagerie ; donner des noms accessibles aux liens d'icônes et annoncer les erreurs des composants communs.
2. **Court terme :** corriger la gestion du focus des modales et traiter les contrastes faibles dans le design system avant de retoucher les pages une par une.
3. **Ensuite :** alléger l'organisation de Paramètres et prototyper une navigation inter-rubriques parent/étudiant ; valider les deux variantes sur téléphone.
4. **Validation terrain :** organiser des sessions courtes avec au moins un parent, un étudiant, un enseignant et un membre de la gestion ; mesurer le taux de réussite, le temps jusqu'à la tâche et les demandes d'aide.

**Critères de validation proposés :** tous les textes courants atteignent 4,5:1 ; aucune modale ne permet de tabuler derrière elle ; une erreur asynchrone est annoncée sans déplacement du focus ; l'en-tête reste entièrement accessible à 320 px ; un parent/étudiant peut changer de rubrique sans repasser systématiquement par l'accueil ; le chargement et le choix d'établissement ne sont jamais présentés comme une absence de conversation.
