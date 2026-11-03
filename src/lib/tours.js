// GesSchool — parcours de visite guidée (références par data-tour).

export const TOUR_STAFF = [
  { titre: "Bienvenue sur GesSchool 👋", texte: "Faisons un tour rapide de votre espace de travail — moins d'une minute." },
  { selector: '[data-tour="espaces"]', titre: "Vos espaces", texte: "Basculez entre Pédagogie, Gestion, RH et Pilotage selon votre besoin. Vous ne voyez que les espaces autorisés pour votre rôle." },
  { selector: '[data-tour="menu"]', titre: "Vos outils", texte: "Chaque espace affiche les menus de son métier. Cliquez pour naviguer." },
  { selector: '[data-tour="profil"]', titre: "Votre compte", texte: "Cliquez sur votre nom : notifications, connexion par empreinte, aide et déconnexion." },
  { titre: "Une aide sur chaque écran", texte: "Le « ? » à côté du titre d'une page ouvre l'explication de cet écran dans le mode d'emploi." },
  { selector: '[data-tour="aide"]', titre: "Rejouer ce guide", texte: "Cliquez sur ce « ? » à tout moment pour revoir cette visite. Bonne utilisation ! 🎓" },
];

export const TOUR_PARENT = [
  { titre: "Bienvenue dans l'espace parent 👋", texte: "Suivez la scolarité de votre enfant en quelques clics." },
  { selector: '[data-tour="enfants"]', titre: "Vos enfants", texte: "Touchez un prénom : l'essentiel de cet enfant s'affiche dessous (à régler, notes, absences, devoirs). « + » ajoute un enfant." },
  { selector: '[data-tour="messagerie"]', titre: "Messagerie", texte: "Échangez directement avec l'établissement." },
  { selector: '[data-tour="alertes"]', titre: "Alertes", texte: "Nouvelles notes, absences, factures… Activez les notifications pour être prévenu sur votre téléphone." },
  { selector: '[data-tour="aide-parent"]', titre: "Rejouer ce guide", texte: "Relancez-le quand vous voulez : bouton « ? » sur ordinateur, menu « Plus » sur téléphone. Bonne navigation !" },
];
