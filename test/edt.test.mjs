// Tests du générateur d'emploi du temps (fonction pure genererEDT).
// Vérifie les contraintes DURES : pas de double réservation classe / prof / salle
// sur un même créneau, respect des indisponibilités, et report des heures non placées.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerEDT } from "./bundle.helper.mjs";

const { genererEDT } = await chargerEDT();

// Grille : 2 jours × 3 créneaux (dont une pause).
const grille = [
  { jour: 1, ordre: 1, heure_debut: "08:00", heure_fin: "09:00", pause: false },
  { jour: 1, ordre: 2, heure_debut: "09:00", heure_fin: "10:00", pause: false },
  { jour: 1, ordre: 3, heure_debut: "10:00", heure_fin: "10:15", pause: true },
  { jour: 2, ordre: 1, heure_debut: "08:00", heure_fin: "09:00", pause: false },
  { jour: 2, ordre: 2, heure_debut: "09:00", heure_fin: "10:00", pause: false },
];
const classes = [
  { id: "cA", niveau_id: "n1", libelle: "CE1 A" },
  { id: "cB", niveau_id: "n1", libelle: "CE1 B" },
];
const volumesParNiveau = { n1: [{ matiere_id: "m1", heures: 2 }, { matiere_id: "m2", heures: 1 }] };
const matiereLibelle = { m1: "Maths", m2: "Français" };

function collisions(creneaux) {
  const classe = new Set(), prof = new Set(), salle = new Set();
  let dupClasse = 0, dupProf = 0, dupSalle = 0;
  for (const c of creneaux) {
    const k = `${c.jour}|${c.heure_debut}`;
    if (classe.has(`${c.classe_id}|${k}`)) dupClasse++; else classe.add(`${c.classe_id}|${k}`);
    if (c.enseignant_id) { if (prof.has(`${c.enseignant_id}|${k}`)) dupProf++; else prof.add(`${c.enseignant_id}|${k}`); }
    if (c.salle) { if (salle.has(`${c.salle}|${k}`)) dupSalle++; else salle.add(`${c.salle}|${k}`); }
  }
  return { dupClasse, dupProf, dupSalle };
}

test("aucune double réservation classe / prof / salle sur un même créneau", () => {
  const affectationMap = { "cA:m1": "p1", "cA:m2": "p2", "cB:m1": "p1", "cB:m2": "p2" }; // p1 partagé A/B
  const salles = [{ id: "s1", nom: "Salle 1" }, { id: "s2", nom: "Salle 2" }];
  const { creneaux } = genererEDT({ classes, grille, volumesParNiveau, matiereLibelle, affectationMap, salles });
  const c = collisions(creneaux);
  assert.equal(c.dupClasse, 0, "une classe ne peut avoir 2 cours au même créneau");
  assert.equal(c.dupProf, 0, "un prof ne peut être dans 2 classes au même créneau");
  assert.equal(c.dupSalle, 0, "une salle ne peut accueillir 2 classes au même créneau");
});

test("respecte les indisponibilités d'un enseignant", () => {
  const affectationMap = { "cA:m1": "p1", "cA:m2": "p2" };
  const indispo = [{ enseignant_id: "p1", jour: 1, heure_debut: "08:00" }];
  const { creneaux } = genererEDT({ classes: [classes[0]], grille, volumesParNiveau, matiereLibelle, affectationMap, indisponibilites: indispo });
  const viol = creneaux.some((c) => c.enseignant_id === "p1" && c.jour === 1 && c.heure_debut === "08:00");
  assert.equal(viol, false, "aucun cours de p1 sur son créneau d'indisponibilité");
});

test("reporte en 'nonPlaces' les heures qui ne rentrent pas", () => {
  // 6h pour une classe mais seulement 4 créneaux planifiables (hors pause) → 2 non placées.
  const vol = { n1: [{ matiere_id: "m1", heures: 6 }] };
  const { creneaux, nonPlaces } = genererEDT({ classes: [classes[0]], grille, volumesParNiveau: vol, matiereLibelle, affectationMap: { "cA:m1": "p1" } });
  assert.equal(creneaux.length, 4, "4 créneaux disponibles seulement");
  assert.equal(nonPlaces.length, 2, "les 2 heures en trop sont reportées");
});

test("étalement : sur 2 jours, une matière n'est pas toute le même jour si évitable", () => {
  const vol = { n1: [{ matiere_id: "m1", heures: 2 }] };
  const { creneaux } = genererEDT({ classes: [classes[0]], grille, volumesParNiveau: vol, matiereLibelle, affectationMap: { "cA:m1": "p1" } });
  const jours = new Set(creneaux.map((c) => c.jour));
  assert.equal(jours.size, 2, "les 2 séances doivent tomber sur des jours différents");
});
