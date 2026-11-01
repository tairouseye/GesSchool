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

//  P2-12 : l'assistant d'inscription.
const I = () => import("../src/lib/inscription.js");

test("assistant : un homonyme est signalé, sauf date de naissance différente", async () => {
  const { doublonsPossibles } = await I();
  const existants = [
    { id: 1, prenom: "Awa", nom: "Diop", date_naissance: "2018-03-02" },
    { id: 2, prenom: "AWA", nom: "DIOP", date_naissance: null },
    { id: 3, prenom: "Awa", nom: "Diop", date_naissance: "2019-01-01" },
    { id: 4, prenom: "Awa", nom: "Ndiaye" },
  ];
  assert.deepEqual(doublonsPossibles(existants, { prenom: " awa ", nom: "Diop", date_naissance: "2018-03-02" }).map((e) => e.id), [1, 2]);
  assert.deepEqual(doublonsPossibles(existants, { prenom: "Awa", nom: "Diop" }).map((e) => e.id), [1, 2, 3]);
  assert.deepEqual(doublonsPossibles(existants, { prenom: "Aïssa", nom: "Diop" }), []);
  assert.deepEqual(doublonsPossibles([{ prenom: "Mame-Diarra", nom: "Sène" }], { prenom: "mame diarra", nom: "SENE" }).length, 1);
});

test("assistant : les frais du niveau, obligatoires cochés, jamais la réinscription", async () => {
  const { fraisApplicables, fraisParDefaut } = await I();
  const frais = [
    { id: "a", niveau_id: null, cycle_id: null, obligatoire: true, public: "nouveaux" },   // inscription
    { id: "b", niveau_id: "CP", obligatoire: true, recurrent: true },                      // mensualité CP
    { id: "c", niveau_id: "CM2", obligatoire: true },                                      // autre niveau
    { id: "d", cycle_id: "elem", obligatoire: false },                                     // facultatif du cycle
    { id: "e", niveau_id: null, cycle_id: null, obligatoire: true, public: "anciens" },    // réinscription
  ];
  const appl = fraisApplicables(frais, "CP", "elem");
  assert.deepEqual(appl.map((f) => f.id), ["a", "b", "d", "e"]);
  assert.deepEqual(fraisParDefaut(appl), { a: true, b: true });
});

test("assistant : rien n'est créé avant la fin de l'étape Famille ; parent connu rattaché, pas recréé", () => {
  const s = readFileSync("src/composants/AssistantInscription.jsx", "utf8");
  const avantCreer = s.slice(0, s.indexOf("async function creer()"));
  assert.doesNotMatch(avantCreer, /api\.(creerEleve|inscrire|ajouterTuteur|lierTuteur)\(/);
  assert.match(s, /if \(!etat\.eleve\) \{/, "un nouvel essai ne recrée pas l'élève");
  assert.match(s, /if \(famille\.tuteurExistant\) \{\s*await api\.lierTuteur\(/);
  //  Un code déjà remis n'est pas régénéré.
  assert.match(s, /if \(!tuteur \|\| tuteur\.profil_id \|\| tuteur\.code_acces \|\| !voitCodes\) return;/);
});
