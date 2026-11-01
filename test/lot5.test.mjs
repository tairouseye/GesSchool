// =====================================================================
//  Lot 5 de l'audit du 31/10/2026 — finitions et qualité.
//
//  Ce que l'épreuve verrouille :
//   • chaque rubrique de l'espace étudiant liée à un module est gardée par
//     ce même module dans le routeur (une adresse tapée n'ouvre plus un
//     écran vide) — même clé que la tuile ;
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RUBRIQUES_ETUDIANT } from "../src/lib/etudiantRubriques.js";
import { MODULES, moduleDeCle } from "../src/lib/modules.js";

test("routes /etudiant/* gardées par le module de leur tuile", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  for (const r of RUBRIQUES_ETUDIANT) {
    const chemin = r.to.replace("/etudiant/", "");
    const ligne = app.split(/\r?\n/).find((l) => l.includes(`<Route path="${chemin}"`));
    assert.ok(ligne, `route ${chemin} absente`);
    //  Une clé qui ne relève d'aucun module (page « cœur ») n'a pas besoin de garde.
    const gere = MODULES.some((m) => m.id === moduleDeCle(r.cle));
    if (gere) assert.match(ligne, new RegExp(`<GardeModule cle="${r.cle}">`), `route ${chemin} non gardée`);
  }
});

//  P2-9 : les onze pages de travail relevées par l'audit montrent un témoin
//  pendant le premier chargement, au lieu d'un « Aucun… » trompeur.
test("les pages de travail ont un témoin de chargement", () => {
  for (const p of ["Annonces", "Assiduite", "CahierTextes", "Cantine", "Certificats", "Demandes",
                   "Enseignants", "Fournitures", "Transport", "Progression", "Parametres"]) {
    const s = readFileSync(`src/pages/${p}.jsx`, "utf8");
    assert.match(s, /<SkeletonListe/, `${p} sans témoin`);
    assert.match(s, /set(Chargement\(false\)|Charge\(true\))/, `${p} : le témoin ne s'éteint jamais`);
  }
});

test("Paramètres : une liste n'est jamais réécrite avant d'avoir été lue", () => {
  const s = readFileSync("src/pages/Parametres.jsx", "utf8");
  assert.match(s, /if \(!charge \|\| !f\.libelle\.trim\(\)\) return;/);
  assert.match(s, /if \(!charge \|\| !f\.fonction\.trim\(\)\) return;/);
});
