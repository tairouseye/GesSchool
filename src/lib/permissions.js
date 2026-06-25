// GesSchool — permissions par rôle (RBAC).
// Les « rôles complets » voient tout (promoteur / direction / admin).
// Les autres rôles n'ont accès qu'aux pages de leur métier.

export const ROLES_COMPLETS = ["super_admin", "admin_ecole", "direction"];

// Libellés lisibles des rôles (pour l'UI).
export const LIBELLES_ROLES = {
  super_admin: "Super admin",
  admin_ecole: "Administrateur",
  direction: "Direction",
  enseignant: "Enseignant",
  comptable: "Comptable",
  rh: "RH",
  surveillant: "Surveillant",
  parent: "Parent",
};

// Pour chaque page : rôles autorisés EN PLUS des rôles complets.
//  "*"  = tout le personnel ;  []  = réservé aux rôles complets.
const ACCES = {
  dashboard: "*",
  eleves: ["surveillant"],
  notes: ["enseignant"],
  bulletins: ["enseignant"],
  structure: [],
  enseignants: ["rh"],
  vie_scolaire: ["surveillant", "enseignant"],
  emploi: ["enseignant"],
  annonces: [],
  paiements: ["comptable"],
  recouvrement: ["comptable"],
  comptabilite: ["comptable"],
  rh: ["rh"],
};

// Ordre des pages → sert aussi à déterminer la page d'atterrissage.
export const PAGES = [
  { cle: "dashboard", path: "/" },
  { cle: "eleves", path: "/eleves" },
  { cle: "notes", path: "/notes" },
  { cle: "bulletins", path: "/bulletins" },
  { cle: "paiements", path: "/paiements" },
  { cle: "recouvrement", path: "/recouvrement" },
  { cle: "structure", path: "/structure" },
  { cle: "enseignants", path: "/enseignants" },
  { cle: "vie_scolaire", path: "/vie-scolaire" },
  { cle: "emploi", path: "/emploi-du-temps" },
  { cle: "annonces", path: "/annonces" },
  { cle: "comptabilite", path: "/comptabilite" },
  { cle: "rh", path: "/rh" },
];

export function estRoleComplet(roles) {
  return (roles || []).some((r) => ROLES_COMPLETS.includes(r));
}

export function peutVoir(roles, cle) {
  if (!roles || roles.length === 0) return false;
  if (estRoleComplet(roles)) return true;
  const a = ACCES[cle];
  if (a === "*") return true;
  if (!a || a.length === 0) return false;
  return roles.some((r) => a.includes(r));
}

// Première page accessible (atterrissage / repli si accès refusé).
export function premierePage(roles) {
  const p = PAGES.find((x) => peutVoir(roles, x.cle));
  return p ? p.path : "/";
}
