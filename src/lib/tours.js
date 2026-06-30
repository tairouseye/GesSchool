// GesSchool — parcours de visite guidée (références par data-tour).

export const TOUR_STAFF = [
  { titre: "Bienvenue sur GesSchool 👋", texte: "Faisons un tour rapide de votre espace de travail — moins d'une minute." },
  { selector: '[data-tour="espaces"]', titre: "Vos espaces", texte: "Basculez entre Pédagogie, Gestion, RH et Pilotage selon votre besoin. Vous ne voyez que les espaces autorisés pour votre rôle." },
  { selector: '[data-tour="menu"]', titre: "Vos outils", texte: "Chaque espace affiche les menus de son métier. Cliquez pour naviguer." },
  { selector: '[data-tour="profil"]', titre: "Votre profil", texte: "Votre rôle, l'accès à la console super-admin (si vous êtes promoteur), et la déconnexion." },
  { selector: '[data-tour="aide"]', titre: "Rejouer ce guide", texte: "Cliquez sur « ? » à tout moment pour revoir cette visite. Bonne utilisation ! 🎓" },
];

export const TOUR_PARENT = [
  { titre: "Bienvenue dans l'espace parent 👋", texte: "Suivez la scolarité de votre enfant en quelques clics." },
  { selector: '[data-tour="enfants"]', titre: "Vos enfants", texte: "Cliquez sur un enfant pour voir ses notes, bulletins, emploi du temps, paiements…" },
  { selector: '[data-tour="messagerie"]', titre: "Messagerie", texte: "Échangez directement avec l'établissement." },
  { selector: '[data-tour="alertes"]', titre: "Alertes", texte: "Nouvelles notes, absences, factures… Activez les notifications pour être prévenu sur votre téléphone." },
  { selector: '[data-tour="aide-parent"]', titre: "Rejouer ce guide", texte: "Cliquez sur « ? » quand vous voulez. Bonne navigation !" },
];
