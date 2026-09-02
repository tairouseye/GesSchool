// GesPro — identité du CONCEPTEUR (marque ombrelle).
// Trois niveaux de marque bien distincts :
//   • l'école  = le CLIENT (sa marque domine DANS l'app) ;
//   • GesSchool = le PRODUIT (ce que l'utilisateur ouvre) ;
//   • GesPro    = le CONCEPTEUR (signature élégante, identifiable).
// Tout est configurable ici, jamais en dur dans les écrans. AUCUN secret.

export const GESPRO = {
  nom: "GesPro",
  slogan: "Des logiciels intelligents pour transformer votre gestion.",
  annee: new Date().getFullYear(),
  // Affichage du branding développeur — passer à false pour une version « blanche ».
  afficherBranding: true,

  contacts: {
    site: "https://gesprosn.org",
    email: "gespro.sn@gmail.com",
    whatsapp: "221773435928", // sans « + », pour les liens wa.me
    telephone: "+221 77 343 59 28",
  },

  // Autres solutions GesPro (marketing DISCRET, jamais intrusif ni bloquant).
  solutions: [
    { nom: "GesSchool", secteur: "Écoles", desc: "Gestion scolaire complète : scolarité, notes, paiements et espace parent.", url: "https://gesschool.gesprosn.org" },
    { nom: "GesStock", secteur: "Commerce", desc: "Gestion de stock et d'inventaire pour points de vente.", url: "https://stock.gesprosn.org" },
    { nom: "GesClean", secteur: "Nettoyage", desc: "Prestations, plannings et équipes de nettoyage.", url: "https://gesprosn.org" },
    { nom: "Teranga Parts", secteur: "Automobile", desc: "Marketplace de pièces détachées automobiles.", url: "https://gesprosn.org" },
  ],
};

// Lien WhatsApp pré-rempli vers GesPro (assistance / renseignements).
export function lienWhatsAppGesPro(message = "Bonjour GesPro, je souhaite des informations.") {
  return `https://wa.me/${GESPRO.contacts.whatsapp}?text=${encodeURIComponent(message)}`;
}

// Ligne de copyright (pieds de page + documents).
export function copyrightGesPro() {
  return `© ${GESPRO.annee} ${GESPRO.nom} — ${GESPRO.slogan}`;
}
