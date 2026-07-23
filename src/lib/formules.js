// GesSchool — FORMULES commerciales (axe « modules »), distinct de l'axe
// « taille » (paliers d'effectif). Le prix se lit au croisement des deux :
//   prix = prix_plancher(palier) × multiplicateur(formule)
//
// Les formules s'EMPILENT : Confort contient Essentiel, Tout inclus contient
// Confort. On ne déclare donc que les modules AJOUTÉS par chaque niveau.

import { MODULES } from "@/lib/modules.js";

// Ordre = ordre de montée en gamme. `ajoute` = modules nouveaux à ce niveau.
// `multiplicateur` = premium de valeur (les modules ne coûtent quasi rien à la
// marge → c'est un levier de valeur, ajustable dans le simulateur).
// Prix FIXES par formule (annuel, XOF) pour les écoles ≤ 800 élèves.
// Au-delà de 800 : offre « Campus », sur devis.
export const FORMULES = [
  {
    id: "essentiel",
    libelle: "Basic",
    accroche: "Gérer élèves, notes, bulletins et encaisser",
    ajoute: ["scolarite", "evaluations", "encaissement"],
    multiplicateur: 1.0,
    prixAnnuel: 250000,
  },
  {
    id: "confort",
    libelle: "Classic",
    accroche: "Le quotidien + lien parents + comptabilité",
    ajoute: ["vie_scolaire", "communication", "comptabilite"],
    multiplicateur: 1.4,
    prixAnnuel: 300000,
  },
  {
    id: "tout",
    libelle: "Premium",
    accroche: "L'établissement complet",
    ajoute: ["rh", "cantine", "transport", "pilotage"],
    multiplicateur: 1.8,
    prixAnnuel: 400000,
  },
];

// Palier d'effectif unique pour les prix fixes ; au-delà = Campus (devis).
export const SEUIL_CAMPUS = 800;

// Modules d'une formule = ses ajouts + ceux de toutes les formules précédentes.
export function modulesDeFormule(formuleId) {
  const out = [];
  for (const f of FORMULES) {
    out.push(...f.ajoute);
    if (f.id === formuleId) break;
  }
  return out;
}

export function formuleParId(id) {
  return FORMULES.find((f) => f.id === id) || null;
}

// Quelle formule fournit un module donné ? (pour l'upsell : « débloqué en … »)
export function formuleDuModule(moduleId) {
  return FORMULES.find((f) => f.ajoute.includes(moduleId)) || null;
}

// À quelle formule correspond une liste de modules actifs ? On prend la plus
// haute dont TOUS les modules sont présents. `null` (tous modules) => Tout inclus.
export function formuleDeModules(modulesActifs) {
  if (!modulesActifs) return FORMULES[FORMULES.length - 1];
  const set = new Set(modulesActifs);
  let trouvee = null;
  for (const f of FORMULES) {
    if (modulesDeFormule(f.id).every((m) => set.has(m))) trouvee = f;
  }
  return trouvee;
}

// Détail lisible d'un module (libellé + description) depuis son id.
export function infoModule(moduleId) {
  return MODULES.find((m) => m.id === moduleId) || { id: moduleId, label: moduleId, desc: "" };
}
