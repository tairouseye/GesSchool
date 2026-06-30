// GesSchool — espaces d'usage (Pédagogie / Gestion / RH & Paie / Pilotage).
// Un espace regroupe des pages (clés) et cible des rôles. Les rôles complets
// (admin/direction/super_admin) et les promoteurs accèdent à tous les espaces.

import { ROLES_COMPLETS, estRoleComplet, peutVoir } from "@/lib/permissions.js";

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
    items: [{ to: "/pilotage", label: "Vue d'ensemble", icone: "🎯", cle: "_pilotage" }],
  },
  {
    id: "pedagogie",
    label: "Pédagogie",
    icone: "🎓",
    accueil: "/pedagogie",
    roles: ["enseignant", "surveillant"],
    items: [
      { to: "/pedagogie", label: "Accueil", icone: "▦", cle: "_pedagogie", exact: true },
      { to: "/appel", label: "Appel", icone: "✅", cle: "appel" },
      { to: "/eleves", label: "Élèves", icone: "👤", cle: "eleves" },
      { to: "/structure", label: "Structure", icone: "🏫", cle: "structure" },
      { to: "/notes", label: "Notes", icone: "✎", cle: "notes" },
      { to: "/bulletins", label: "Bulletins", icone: "🎓", cle: "bulletins" },
      { to: "/emploi-du-temps", label: "Emploi du temps", icone: "🗓️", cle: "emploi" },
      { to: "/vie-scolaire", label: "Vie scolaire", icone: "📋", cle: "vie_scolaire" },
      { to: "/fournitures", label: "Fournitures", icone: "🎒", cle: "fournitures" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion",
    icone: "💼",
    accueil: "/gestion",
    roles: ["comptable"],
    items: [
      { to: "/gestion", label: "Accueil", icone: "▦", cle: "_gestion", exact: true },
      { to: "/eleves", label: "Élèves & inscriptions", icone: "👤", cle: "eleves" },
      { to: "/paiements", label: "Paiements", icone: "₣", cle: "paiements" },
      { to: "/recouvrement", label: "Recouvrement", icone: "🔔", cle: "recouvrement" },
      { to: "/comptabilite", label: "Comptabilité", icone: "💰", cle: "comptabilite" },
      { to: "/annonces", label: "Annonces", icone: "📣", cle: "annonces" },
      { to: "/messagerie", label: "Messagerie", icone: "💬", cle: "messagerie" },
      { to: "/parametres", label: "Paramètres", icone: "⚙️", cle: "parametres" },
    ],
  },
  {
    id: "rh",
    label: "RH & Paie",
    icone: "🧑‍💼",
    accueil: "/rh",
    roles: ["rh"],
    items: [
      { to: "/rh", label: "Personnel & paie", icone: "🧑‍💼", cle: "rh", exact: true },
      { to: "/enseignants", label: "Enseignants", icone: "🧑‍🏫", cle: "enseignants" },
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

// Items de menu d'un espace, filtrés par les permissions de l'utilisateur.
export function itemsEspace(espace, roles) {
  if (!espace) return [];
  return espace.items.filter((it) => it.cle.startsWith("_") || peutVoir(roles, it.cle));
}

export { ROLES_COMPLETS };
