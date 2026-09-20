import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Un parent peut avoir des enfants dans PLUSIEURS établissements — le cas
// existe en base. Ses annonces arrivent alors mélangées ; il faut au moins
// pouvoir les ranger par école (migration 145, qui ajoute `ecole_id`).
const charger = () => chargerLib("annonces", ['export * from "@/lib/annonces.js";']);

test("annoncesParEcole : un groupe par établissement, ordre d'apparition conservé", async () => {
  const { annoncesParEcole } = await charger();
  const g = annoncesParEcole([
    { id: "1", titre: "Rentrée", ecole_id: "A", ecole: "Tut'Tank" },
    { id: "2", titre: "Soutenances", ecole_id: "B", ecole: "UCAD" },
    { id: "3", titre: "Réunion", ecole_id: "A", ecole: "Tut'Tank" },
  ]);
  assert.deepEqual(g.map((x) => x.ecole), ["Tut'Tank", "UCAD"]);
  assert.deepEqual(g[0].items.map((a) => a.id), ["1", "3"], "les annonces d'une école restent ensemble");
  assert.equal(g[1].items.length, 1);
});

test("annoncesParEcole : un seul établissement → un seul groupe", async () => {
  const { annoncesParEcole } = await charger();
  const g = annoncesParEcole([
    { id: "1", ecole_id: "A", ecole: "Tut'Tank" },
    { id: "2", ecole_id: "A", ecole: "Tut'Tank" },
  ]);
  assert.equal(g.length, 1, "l'écran n'affichera pas de titre : il n'apprendrait rien");
  assert.equal(g[0].items.length, 2);
});

test("annoncesParEcole : deux écoles homonymes restent distinctes", async () => {
  const { annoncesParEcole } = await charger();
  // Le regroupement se fait sur l'identifiant, pas sur le nom — c'est
  // précisément ce que la migration 145 rend possible.
  const g = annoncesParEcole([
    { id: "1", ecole_id: "A", ecole: "École Les Palmiers" },
    { id: "2", ecole_id: "B", ecole: "École Les Palmiers" },
  ]);
  assert.equal(g.length, 2);
});

test("annoncesParEcole : entrées vides ou sans identifiant ne cassent rien", async () => {
  const { annoncesParEcole } = await charger();
  assert.deepEqual(annoncesParEcole([]), []);
  assert.deepEqual(annoncesParEcole(), []);
  // Réponse d'une base où la migration 145 n'est pas encore appliquée :
  // pas d'`ecole_id`, on retombe sur le nom.
  const g = annoncesParEcole([{ id: "1", ecole: "Tut'Tank" }, { id: "2", ecole: "Tut'Tank" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].ecole, "Tut'Tank");
});
