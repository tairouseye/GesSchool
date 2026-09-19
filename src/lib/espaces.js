// GesSchool — espaces d'usage (Pédagogie / Gestion / RH & Paie / Pilotage).
// Un espace regroupe des pages (clés) et cible des rôles. Les rôles complets
// (admin/direction/super_admin) et les promoteurs accèdent à tous les espaces.

import { ROLES_COMPLETS, estRoleComplet, peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

// Chaque page (clé) appartient à un ou plusieurs espaces.
// `roles` = rôles « métier » membres de l'espace (en plus des rôles complets).
export const ESPACES = [
  {
    id: "pilotage",
    label: "Pilotage",
    icone: "🎯",
    accueil: "/pilotage",
    roles: [], // réservé promoteur + rôles complets
    promoteur: true,
    items: [
      { to: "/pilotage", label: "Vue d'ensemble", icone: "🎯", cle: "_pilotage" },
      { to: "/passage-annee", label: "Passage d'année", icone: "🗓️", cle: "_passage_annee" },
      { to: "/abonnement", label: "Mon abonnement", icone: "🎫", cle: "_abonnement" },
      { to: "/organigramme", label: "Organigramme", icone: "🗂️", cle: "_organigramme" },
      { to: "/documentation", label: "Documentation", icone: "📁", cle: "_documentation" },
      { to: "/membres", label: "Membres", icone: "👥", cle: "membres" },
      { to: "/a-signer", label: "À signer", icone: "✍️", cle: "signatures" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion",
    icone: "💼",
    accueil: "/gestion",
    roles: ["comptable", "secretaire"], // comptable = responsable ; secretaire = opérationnel
    items: [
      { to: "/gestion", label: "Accueil", icone: "▦", cle: "_gestion", exact: true },
      { to: "/eleves", label: "Élèves & inscriptions", labelSup: "Étudiants", icone: "👤", cle: "eleves" },
      { to: "/codes-parents", label: "Codes parents", icone: "🔑", cle: "codes_parents" },
      { to: "/certificats", label: "Documents", icone: "🧾", cle: "certificats" },
      { to: "/demandes", label: "Demandes", icone: "📥", cle: "demandes" },
      { to: "/paiements", label: "Paiements", icone: "₣", cle: "paiements" },
      { to: "/recouvrement", label: "Recouvrement", icone: "🔔", cle: "recouvrement" },
      { to: "/comptabilite", label: "Comptabilité", icone: "💰", cle: "comptabilite" },
      { to: "/cantine", label: "Cantine", icone: "🍽️", cle: "cantine" },
      { to: "/transport", label: "Transport", icone: "🚌", cle: "transport" },
      { to: "/annonces", label: "Annonces", icone: "📣", cle: "annonces" },
      { to: "/messagerie", label: "Messagerie", icone: "💬", cle: "messagerie" },
      { to: "/membres", label: "Membres", icone: "👥", cle: "membres" },
      { to: "/a-signer", label: "À signer", icone: "✍️", cle: "signatures" },
      { to: "/parametres", label: "Paramètres", icone: "⚙️", cle: "parametres" },
    ],
  },
  {
    id: "pedagogie",
    label: "Pédagogie",
    icone: "🎓",
    accueil: "/pedagogie",
    roles: ["direction", "enseignant", "surveillant"], // direction = responsable pédagogique
    // `types` = types d'établissement où l'item s'affiche ; absent = tous.
    // La branche académique bascule ainsi entre « école » et « supérieur » (LMD).
    items: [
      { to: "/pedagogie", label: "Accueil", icone: "▦", cle: "_pedagogie", exact: true },
      { to: "/appel", label: "Appel", icone: "✅", cle: "appel", types: ["ecole"] },
      { to: "/cahier-textes", label: "Cahier de textes", icone: "📓", cle: "cahier", types: ["ecole"] },
      { to: "/progression", label: "Progression", icone: "🗂️", cle: "progression", types: ["ecole"] },
      { to: "/eleves", label: "Élèves", labelSup: "Étudiants", icone: "👤", cle: "eleves" },
      { to: "/codes-parents", label: "Codes parents", icone: "🔑", cle: "codes_parents" },
      { to: "/structure", label: "Niveaux & classes", icone: "🏫", cle: "structure", types: ["ecole"] },
      { to: "/filieres", label: "Filières & maquettes", icone: "🏛️", cle: "filieres", types: ["superieur"] },
      { to: "/inscriptions-sup", label: "Inscriptions", icone: "📝", cle: "inscriptions_sup", types: ["superieur"] },
      { to: "/codes-etudiants", label: "Codes étudiants", icone: "🔑", cle: "codes_etudiants", types: ["superieur"] },
      { to: "/notes-lmd", label: "Notes", icone: "✎", cle: "notes_lmd", types: ["superieur"] },
      { to: "/deliberations", label: "Délibérations & relevés", icone: "⚖️", cle: "deliberations_sup", types: ["superieur"] },
      { to: "/bibliotheque", label: "Bibliothèque", icone: "📚", cle: "bibliotheque", types: ["superieur"] },
      { to: "/biblio-circulation", label: "Prêts & retours", icone: "🔄", cle: "biblio_circulation", types: ["superieur"] },
      { to: "/biblio-depots", label: "Mémoires & thèses", icone: "🎓", cle: "biblio_depots", types: ["superieur"] },
      { to: "/biblio-acquisitions", label: "Acquisitions", icone: "🧾", cle: "biblio_acquisitions", types: ["superieur"] },
      { to: "/biblio-inventaire", label: "Inventaire", icone: "📋", cle: "biblio_inventaire", types: ["superieur"] },
      { to: "/enseignants", label: "Enseignants & affectations", icone: "🧑‍🏫", cle: "enseignants" },
      { to: "/notes", label: "Notes", icone: "✎", cle: "notes", types: ["ecole"] },
      { to: "/bulletins", label: "Bulletins", icone: "🎓", cle: "bulletins", types: ["ecole"] },
      { to: "/classement", label: "Classement", icone: "🏆", cle: "classement", types: ["ecole"] },
      { to: "/emploi-du-temps", label: "Emploi du temps", icone: "🗓️", cle: "emploi" },
      { to: "/vie-scolaire", label: "Vie scolaire", icone: "📋", cle: "vie_scolaire", types: ["ecole"] },
      { to: "/assiduite", label: "Assiduité", icone: "📊", cle: "assiduite", types: ["ecole"] },
      { to: "/fournitures", label: "Fournitures", icone: "🎒", cle: "fournitures", types: ["ecole"] },
      { to: "/membres", label: "Membres", icone: "👥", cle: "membres" },
      { to: "/a-signer", label: "À signer", icone: "✍️", cle: "signatures" },
      { to: "/parametres", label: "Paramètres", icone: "⚙️", cle: "parametres" },
    ],
  },
  {
    id: "rh",
    label: "RH & Paie",
    icone: "🧑‍💼",
    accueil: "/rh",
    roles: ["rh"], // la Comptabilité a rejoint l'espace Gestion (côté comptable)
    items: [
      { to: "/rh", label: "Personnel & paie", icone: "🧑‍💼", cle: "rh", exact: true },
      { to: "/enseignants", label: "Enseignants", icone: "🧑‍🏫", cle: "enseignants" },
      { to: "/membres", label: "Membres", icone: "👥", cle: "membres" },
      { to: "/a-signer", label: "À signer", icone: "✍️", cle: "signatures" },
    ],
  },
];

// L'utilisateur a-t-il accès à un espace donné ?
function aAccesEspace(espace, roles, estPromoteur) {
  if (estRoleComplet(roles)) return true;
  if (espace.promoteur) return !!estPromoteur;
  return (roles || []).some((r) => espace.roles.includes(r));
}

// Espaces accessibles (dans l'ordre déclaré).
export function espacesAccessibles(roles, estPromoteur) {
  return ESPACES.filter((e) => aAccesEspace(e, roles, estPromoteur));
}

// Espace d'atterrissage par défaut (selon le rôle).
export function espaceParDefaut(roles, estPromoteur) {
  // Promoteur / gestion → Pilotage ; sinon premier espace accessible.
  if (estPromoteur || estRoleComplet(roles)) return ESPACES.find((e) => e.id === "pilotage");
  const accessibles = espacesAccessibles(roles, estPromoteur);
  return accessibles[0] || ESPACES.find((e) => e.id === "pedagogie");
}

export function espaceParId(id) {
  return ESPACES.find((e) => e.id === id) || null;
}

// À quels espaces appartient une route (via la clé de page).
export function espacesDeRoute(path) {
  return ESPACES.filter((e) => e.items.some((it) => it.to === path));
}

// (itemsEspace a été retiré : il laissait passer les accueils « _xxx » sans
//  vérifier le droit, donc le menu proposait des pages que la garde refusait.
//  Utiliser routeOuvrable / premiereRoute ci-dessous.)

// Une route est-elle RÉELLEMENT ouvrable ? On reproduit ici la garde exacte
// posée sur la route (cf. App.jsx) : rôle + module actif, et statut promoteur
// pour les pages de pilotage. Sans cela, on peut proposer une page que la
// garde refusera — c'est ce qui provoquait une boucle de redirection.
const ROUTES_PROMOTEUR = ["/pilotage", "/passage-annee", "/abonnement", "/organigramme", "/documentation"];

export function routeOuvrable(item, roles, estPromoteur, modulesActifs) {
  if (!moduleActif(modulesActifs, item.cle)) return false;
  if (ROUTES_PROMOTEUR.includes(item.to)) return !!estPromoteur;
  return peutVoir(roles, item.cle);
}

// L'item est-il pertinent pour ce TYPE d'établissement ? (bascule école ↔ supérieur)
// Un item sans `types` s'affiche partout ; sinon il faut que le type courant y figure.
export function itemPourType(item, typeEtab) {
  if (!item.types) return true;
  return item.types.includes(typeEtab || "ecole");
}

// Première page réellement accessible, tous espaces confondus.
// Renvoie `null` si l'utilisateur n'a accès à RIEN : l'appelant doit alors
// afficher un écran explicite plutôt que de rediriger indéfiniment.
export function premiereRoute(roles, estPromoteur, modulesActifs, typeEtab) {
  for (const e of espacesAccessibles(roles, estPromoteur)) {
    const it = e.items.find((x) => routeOuvrable(x, roles, estPromoteur, modulesActifs) && itemPourType(x, typeEtab));
    if (it) return it.to;
  }
  return null;
}

export { ROLES_COMPLETS };
