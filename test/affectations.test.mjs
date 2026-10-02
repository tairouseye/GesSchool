// =====================================================================
//  Affectations — l'enseignant « toutes matières » (migration 161)
//
//  Au préscolaire, une classe de TPS/PS compte jusqu'à trois maîtresses et
//  chacune enseigne l'ensemble des domaines. Une affectation dont la matière
//  est NULL signifie donc « toutes les matières de cette classe ».
//
//  🔴 LE PIÈGE QUE CES TESTS GARDENT : `getMesMatieresParClasse` construit la
//  carte des matières autorisées. Si une affectation sans matière y poussait
//  `null`, `matieresAutorisees` filtrerait sur une liste `[null]` — et la
//  maîtresse se retrouverait avec AUCUNE matière, soit l'exact contraire de
//  l'intention. La carte doit donc ne RIEN contenir pour cette classe : une
//  classe absente n'est pas restreinte.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const appel = () => chargerLib("appel", ['export { matieresAutorisees } from "@/lib/appel.js";']);
const MATIERES = [
  { id: "m1", libelle: "Langage" },
  { id: "m2", libelle: "Mathématiques" },
  { id: "m3", libelle: "Psychomotricité" },
];

// Reproduit le regroupement de `getMesMatieresParClasse` (la fonction elle-même
// interroge le réseau ; c'est sa règle qu'on éprouve, pas sa requête).
function carte(affectations) {
  const map = {};
  const toutesMatieres = new Set();
  for (const a of affectations) {
    if (!a.matiere_id) { toutesMatieres.add(a.classe_id); continue; }
    (map[a.classe_id] ||= []).push(a.matiere_id);
  }
  for (const cid of toutesMatieres) delete map[cid];
  return map;
}

test("🔴 une maîtresse sans matière garde TOUTES les matières", async () => {
  const { matieresAutorisees } = await appel();
  const m = carte([{ classe_id: "c1", matiere_id: null }]);
  assert.deepEqual(m, {}, "la classe ne doit pas figurer dans la carte");
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c1", false), MATIERES);
});

test("une affectation « toutes matières » l'emporte sur les matières précises", async () => {
  const { matieresAutorisees } = await appel();
  // Cas réel : une maîtresse prend la classe entière ET porte un coefficient
  // sur une matière. Le plus large doit gagner, sinon l'ajout d'un détail
  // RÉTRÉCIRAIT son périmètre — un effet de bord incompréhensible.
  const m = carte([
    { classe_id: "c1", matiere_id: "m1" },
    { classe_id: "c1", matiere_id: null },
  ]);
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c1", false), MATIERES);
});

test("sans affectation « toutes matières », le cloisonnement par matière tient", async () => {
  const { matieresAutorisees } = await appel();
  const m = carte([
    { classe_id: "c1", matiere_id: "m1" },
    { classe_id: "c1", matiere_id: "m3" },
  ]);
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c1", false).map((x) => x.id), ["m1", "m3"]);
});

test("une classe n'en déteint pas sur une autre", async () => {
  const { matieresAutorisees } = await appel();
  const m = carte([
    { classe_id: "c1", matiere_id: null },        // toute la classe c1
    { classe_id: "c2", matiere_id: "m2" },        // seulement Maths en c2
  ]);
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c1", false), MATIERES);
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c2", false).map((x) => x.id), ["m2"]);
});

test("trois maîtresses sur la même classe, aucune restreinte", async () => {
  const { matieresAutorisees } = await appel();
  // Le cas Montessori de Tut'Tank : la carte d'une maîtresse ne dépend que
  // de SES affectations, mais aucune des trois ne doit être limitée.
  for (const ens of ["A", "B", "C"]) {
    const m = carte([{ classe_id: "tps_ps_a", matiere_id: null, enseignant_id: ens }]);
    assert.deepEqual(matieresAutorisees(MATIERES, m, "tps_ps_a", false), MATIERES, `maîtresse ${ens}`);
  }
});

test("un rôle qui voit tout n'est jamais restreint", async () => {
  const { matieresAutorisees } = await appel();
  const m = carte([{ classe_id: "c1", matiere_id: "m1" }]);
  assert.deepEqual(matieresAutorisees(MATIERES, m, "c1", true), MATIERES);
});
