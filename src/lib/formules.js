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
export const FORMULES = [
  {
    id: "essentiel",
    libelle: "Essentiel",
    accroche: "Gérer élèves, notes et bulletins",
    ajoute: ["scolarite", "evaluations"],
    multiplicateur: 1.0,
  },
  {
    id: "confort",
    libelle: "Confort",
    accroche: "Le quotidien + lien parents + caisse",
    ajoute: ["vie_scolaire", "communication", "finances"],
    multiplicateur: 1.4,
  },
  {
    id: "tout",
    libelle: "Tout inclus",
    accroche: "L'établissement complet",
    ajoute: ["rh", "cantine", "transport", "pilotage"],
    multiplicateur: 1.8,
  },
];

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
