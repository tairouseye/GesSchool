// GesSchool — modules commerciaux (activables par école : « vendre à la carte »).
// Une école avec modules_actifs = null a TOUS les modules (compat ascendante).

export const MODULES = [
  { id: "scolarite", label: "Scolarité", desc: "Élèves, inscriptions, structure", cles: ["eleves", "structure"] },
  { id: "evaluations", label: "Évaluations", desc: "Notes & bulletins", cles: ["notes", "bulletins"] },
  { id: "vie_scolaire", label: "Vie scolaire", desc: "Appel, absences, emploi du temps, fournitures", cles: ["appel", "vie_scolaire", "emploi", "fournitures"] },
  { id: "finances", label: "Finances", desc: "Paiements, recouvrement, comptabilité", cles: ["paiements", "recouvrement", "comptabilite"] },
  { id: "rh", label: "RH & paie", desc: "Personnel, contrats, paie, enseignants", cles: ["rh", "enseignants"] },
  { id: "communication", label: "Communication", desc: "Annonces & messagerie", cles: ["annonces", "messagerie"] },
  { id: "pilotage", label: "Pilotage", desc: "Vue consolidée multi-écoles", cles: ["_pilotage"] },
];

const CLE_MODULE = {};
for (const m of MODULES) for (const c of m.cles) CLE_MODULE[c] = m.id;

// Module d'une page (null = page « cœur », toujours active).
export function moduleDeCle(cle) {
  return CLE_MODULE[cle] || null;
}

// Une page est-elle active pour l'école ? (modulesActifs null = tout actif)
export function moduleActif(modulesActifs, cle) {
  const mod = moduleDeCle(cle);
  if (!mod) return true; // cœur (dashboard, accueils, paramètres…)
  if (!modulesActifs) return true; // null = tous les modules
  return modulesActifs.includes(mod);
}

export function tousLesModules() {
  return MODULES.map((m) => m.id);
}
