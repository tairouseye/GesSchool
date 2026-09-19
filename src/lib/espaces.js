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

      // Au quotidien
      { to: "/appel", label: "Appel", icone: "✅", cle: "appel", types: ["ecole"], groupe: "Au quotidien" },
      { to: "/cahier-textes", label: "Cahier de textes", icone: "📓", cle: "cahier", types: ["ecole"], groupe: "Au quotidien" },
      { to: "/progression", label: "Progression", icone: "🗂️", cle: "progression", types: ["ecole"], groupe: "Au quotidien" },
      // Gaté « école » : il n'existe pas encore d'emploi du temps LMD
      // (`emplois_du_temps.classe_id` est NOT NULL, or le supérieur n'a pas de
      // classes). Proposer la page au supérieur mènerait à un écran inutilisable.
      { to: "/emploi-du-temps", label: "Emploi du temps", icone: "🗓️", cle: "emploi", types: ["ecole"], groupe: "Au quotidien" },

      // Élèves & structure
      { to: "/eleves", label: "Élèves", labelSup: "Étudiants", icone: "👤", cle: "eleves", groupe: "Élèves & structure" },
      { to: "/codes-parents", label: "Codes parents", icone: "🔑", cle: "codes_parents", groupe: "Élèves & structure" },
      { to: "/codes-etudiants", label: "Codes étudiants", icone: "🔑", cle: "codes_etudiants", types: ["superieur"], groupe: "Élèves & structure" },
      { to: "/structure", label: "Niveaux & classes", icone: "🏫", cle: "structure", types: ["ecole"], groupe: "Élèves & structure" },
      { to: "/filieres", label: "Filières & maquettes", icone: "🏛️", cle: "filieres", types: ["superieur"], groupe: "Élèves & structure" },
      { to: "/inscriptions-sup", label: "Inscriptions", icone: "📝", cle: "inscriptions_sup", types: ["superieur"], groupe: "Élèves & structure" },
      { to: "/enseignants", label: "Enseignants & affectations", icone: "🧑‍🏫", cle: "enseignants", groupe: "Élèves & structure" },

      // Évaluation
      { to: "/notes", label: "Notes", icone: "✎", cle: "notes", types: ["ecole"], groupe: "Évaluation" },
      { to: "/bulletins", label: "Bulletins", icone: "🎓", cle: "bulletins", types: ["ecole"], groupe: "Évaluation" },
      { to: "/classement", label: "Classement", icone: "🏆", cle: "classement", types: ["ecole"], groupe: "Évaluation" },
      { to: "/notes-lmd", label: "Notes", icone: "✎", cle: "notes_lmd", types: ["superieur"], groupe: "Évaluation" },
      { to: "/deliberations", label: "Délibérations & relevés", icone: "⚖️", cle: "deliberations_sup", types: ["superieur"], groupe: "Évaluation" },

      // Vie scolaire
      { to: "/vie-scolaire", label: "Vie scolaire", icone: "📋", cle: "vie_scolaire", types: ["ecole"], groupe: "Vie scolaire" },
      { to: "/assiduite", label: "Assiduité", icone: "📊", cle: "assiduite", types: ["ecole"], groupe: "Vie scolaire" },
      { to: "/fournitures", label: "Fournitures", icone: "🎒", cle: "fournitures", types: ["ecole"], groupe: "Vie scolaire" },

      // Communication — la direction y a droit (ACCES) mais ces pages ne
      // vivaient que dans Gestion, espace auquel elle n'accède pas.
      { to: "/annonces", label: "Annonces", icone: "📣", cle: "annonces", groupe: "Communication" },
      { to: "/messagerie", label: "Messagerie", icone: "💬", cle: "messagerie", groupe: "Communication" },

      // Transverses : volontairement hors section, en pied de menu.
      { to: "/membres", label: "Membres", icone: "👥", cle: "membres" },
      { to: "/a-signer", label: "À signer", icone: "✍️", cle: "signatures" },
      { to: "/parametres", label: "Paramètres", icone: "⚙️", cle: "parametres" },
    ],
  },
  {
    // Espace à part entière plutôt que cinq entrées noyées dans Pédagogie :
    // le SIGB est un métier distinct, avec son propre responsable.
    //
    // ⚠️ `direction` doit figurer ici : ce n'est PAS un rôle complet
    // (ROLES_COMPLETS = super_admin, admin_ecole), il perdrait donc l'accès.
    // Les rôles listés reprennent l'union de ceux autorisés sur les pages
    // biblio dans ACCES ; chaque page reste filtrée individuellement, si bien
    // qu'un secrétaire ne voit que le catalogue.
    //
    // Toutes les entrées étant `types:["superieur"]`, l'espace disparaît de
    // lui-même pour une école : Layout écarte les espaces sans item visible.
    id: "bibliotheque",
    label: "Bibliothèque",
    icone: "📚",
    accueil: "/bibliotheque",
    roles: ["bibliothecaire", "direction", "enseignant", "secretaire"],
    items: [
      { to: "/bibliotheque", label: "Catalogue", icone: "📚", cle: "bibliotheque", types: ["superieur"], exact: true },
      { to: "/biblio-circulation", label: "Prêts & retours", icone: "🔄", cle: "biblio_circulation", types: ["superieur"] },
      { to: "/biblio-depots", label: "Mémoires & thèses", icone: "🎓", cle: "biblio_depots", types: ["superieur"] },
      { to: "/biblio-acquisitions", label: "Acquisitions", icone: "🧾", cle: "biblio_acquisitions", types: ["superieur"] },
      { to: "/biblio-inventaire", label: "Inventaire", icone: "📋", cle: "biblio_inventaire", types: ["superieur"] },
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

// Regroupe des entrées par `groupe`, en préservant l'ordre de déclaration.
// Les entrées sans groupe restent isolées, en tête (accueil) ou en pied
// (Membres, À signer, Paramètres) — elles ne se replient pas.
// Renvoie [{ groupe: string|null, items: [] }].
export function grouperItems(items = []) {
  const out = [];
  for (const it of items) {
    const g = it.groupe || null;
    const dernier = out[out.length - 1];
    if (g && dernier && dernier.groupe === g) dernier.items.push(it);
    else out.push({ groupe: g, items: [it] });
  }
  // Un groupe réduit à une seule entrée n'a pas d'intérêt : on le déplie.
  return out.map((s) => (s.groupe && s.items.length === 1 ? { groupe: null, items: s.items } : s));
}
