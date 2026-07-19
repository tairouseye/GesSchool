// GesSchool — permissions par rôle (RBAC hiérarchique).
// Modèle de délégation : le promoteur (admin_ecole) configure l'école et crée
// les responsables ; chaque responsable est CLOISONNÉ à son domaine et gère ses
// propres sous-utilisateurs.
//   - admin_ecole / super_admin : accès complet (tous les espaces + config).
//   - direction  = Responsable pédagogique (espace Pédagogie).
//   - comptable  = Responsable Gestion / finances.
//   - rh         = Responsable RH & Paie.
//   - secretaire = Secrétaire / Caisse (opérationnel Gestion).

// Les « rôles complets » voient tout. NB : `direction` N'EST PLUS complet — il
// est désormais responsable pédagogique cloisonné.
export const ROLES_COMPLETS = ["super_admin", "admin_ecole"];

// Libellés lisibles des rôles (pour l'UI).
export const LIBELLES_ROLES = {
  super_admin: "Super admin",
  admin_ecole: "Promoteur",
  direction: "Responsable pédagogique",
  comptable: "Comptable / Gestion",
  rh: "Responsable RH",
  secretaire: "Secrétaire / Caisse",
  enseignant: "Enseignant",
  surveillant: "Surveillant",
  parent: "Parent",
};

// Pour chaque page : rôles autorisés EN PLUS des rôles complets.
//  "*"  = tout le personnel ;  []  = réservé aux rôles complets (promoteur).
const ACCES = {
  dashboard: "*",

  // --- Espace Pédagogie — responsable : direction (voit tout l'espace) ---
  _pedagogie: ["direction", "enseignant", "surveillant"], // accueil Pédagogie
  appel: ["direction", "enseignant", "surveillant"],
  cahier: ["direction", "enseignant", "surveillant"],
  progression: ["direction", "enseignant"],
  notes: ["direction", "enseignant"],
  bulletins: ["direction", "enseignant"],
  classement: ["direction", "enseignant"],
  assiduite: ["direction", "enseignant", "surveillant"],
  vie_scolaire: ["direction", "surveillant", "enseignant"],
  emploi: ["direction", "enseignant"],
  fournitures: ["direction", "enseignant"],
  structure: ["direction"],

  // Élèves — présent en Pédagogie ET Gestion.
  eleves: ["direction", "surveillant", "enseignant", "comptable", "secretaire"],

  // --- Espace Gestion — responsable : comptable ; opérationnel : secretaire ---
  _gestion: ["comptable", "secretaire"], // accueil Gestion
  certificats: ["comptable", "secretaire"],
  demandes: ["comptable", "secretaire"],
  paiements: ["comptable", "secretaire"],
  recouvrement: ["comptable"],
  comptabilite: ["comptable"],
  cantine: ["comptable", "secretaire"],
  transport: ["comptable", "secretaire"],

  // --- Communication (partagée pédagogie + gestion) ---
  annonces: ["direction", "comptable", "secretaire"],
  messagerie: ["direction", "comptable", "secretaire"],

  // --- Espace RH — responsable : rh ---
  rh: ["rh"],
  // Les affectations prof ↔ classe ↔ matière sont un acte PÉDAGOGIQUE (elles
  // alimentent l'emploi du temps) autant qu'un acte RH : le responsable
  // pédagogique doit pouvoir les saisir.
  enseignants: ["rh", "direction"],

  // --- Configuration — le promoteur voit tout ; chaque responsable n'accède
  // qu'aux sections de son domaine (cf. SECTIONS_PARAMETRES). ---
  parametres: ["direction", "comptable", "secretaire"],

  // --- Gestion des membres — managers pouvant déléguer ---
  membres: ["direction", "rh", "comptable"],

  // --- Documents à signer — tout signataire (le menu ne s'affiche que s'il
  // reste des documents en attente, cf. Layout) ---
  signatures: "*",
};

// Ordre des pages → sert aussi à déterminer la page d'atterrissage de repli.
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

// Sections de la page Paramètres. Chacune appartient au domaine d'un
// responsable, qui doit pouvoir la régler sans passer par le promoteur.
// `[]` = promoteur uniquement (identité de l'école, commercial, matricule).
const SECTIONS_PARAMETRES = {
  etablissement: [],                          // nom, logo, couleurs, devise
  modules: [],                                // offre commerciale
  matricule: [],                              // format des matricules
  signataires: ["direction"],                 // signent bulletins & documents
  notation: ["direction"],                    // barème, mentions, bulletins
  champs_eleve: ["comptable", "secretaire"],  // fiche élève = Gestion
  relances: ["comptable"],                    // recouvrement
};

export function peutVoirSection(roles, section) {
  if (estRoleComplet(roles)) return true;
  const a = SECTIONS_PARAMETRES[section];
  if (!a || a.length === 0) return false;
  return (roles || []).some((r) => a.includes(r));
}

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

// NB : le repli « première page accessible » vit désormais dans espaces.js
// (premiereRoute), car il doit AUSSI tenir compte des modules actifs et du
// statut promoteur — sinon on propose une page que la garde refuse, d'où une
// boucle de redirection. Ne pas réintroduire de version partielle ici.

// « Voit toutes les classes » (pas seulement les siennes) : promoteur + le
// responsable pédagogique (direction). Utilisé par les pages pédago pour
// afficher tout l'établissement au lieu des seules classes de l'enseignant.
export function voitToutesClasses(roles) {
  return estRoleComplet(roles) || (roles || []).includes("direction");
}

// Gestion des accès parents (génération de codes tuteur sur la fiche élève) :
// promoteur + responsable pédagogique.
export function peutGererParents(roles) {
  return estRoleComplet(roles) || (roles || []).includes("direction");
}

// L'édition des élèves (CRUD / inscriptions) est réservée au côté Gestion.
export function peutEditerEleves(roles) {
  return estRoleComplet(roles) || (roles || []).some((r) => ["comptable", "secretaire"].includes(r));
}

// « Voit tous les élèves de l'établissement » : promoteur, direction, surveillant
// et la Gestion (comptable/secrétaire). L'enseignant « simple » est restreint
// aux élèves de ses propres classes (confidentialité).
export function voitTousEleves(roles) {
  if (estRoleComplet(roles)) return true;
  return (roles || []).some((r) => ["direction", "surveillant", "comptable", "secretaire"].includes(r));
}

// --- Matrice de délégation : quels rôles chaque rôle peut inviter/gérer ---
export const ROLES_INVITABLES = {
  super_admin: ["direction", "rh", "comptable", "secretaire", "enseignant", "surveillant", "parent"],
  admin_ecole: ["direction", "rh", "comptable", "secretaire", "enseignant", "surveillant", "parent"],
  direction: ["enseignant", "surveillant", "parent"],
  rh: ["secretaire"],
  comptable: ["secretaire"],
};

// Union des rôles qu'un utilisateur (avec ces rôles) peut inviter/gérer.
export function rolesInvitables(roles) {
  const set = new Set();
  (roles || []).forEach((r) => (ROLES_INVITABLES[r] || []).forEach((x) => set.add(x)));
  return [...set];
}

// Peut-il accéder à la gestion des membres (déléguer au moins un rôle) ?
export function peutGererMembres(roles) {
  return estRoleComplet(roles) || rolesInvitables(roles).length > 0;
}
