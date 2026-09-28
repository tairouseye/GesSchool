// =====================================================================
//  Pilotage — consolidation des montants (migration 154)
//
//  Née d'un signalement : « des montants qui ne font pas de sens » dans
//  Pilotage → vue d'ensemble. Sur les données réelles, TutTank_Demo avait
//  encaissé 10 102 500 et affichait une trésorerie de −370 000, parce que
//  `pilotage_synthese` ne comptait pas les paiements de scolarité. La
//  requête est corrigée en base ; ces tests gardent la partie calculée
//  côté écran, qui n'est vérifiable par aucune session.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const pilotage = () => chargerLib("pilotage", ['export * from "@/lib/pilotage.js";']);

test("resultatAnnee : entrées (recettes + scolarité) moins sorties", async () => {
  const { resultatAnnee } = await pilotage();
  // Chiffres réels de TutTank_Demo au 28/09/2026.
  assert.equal(resultatAnnee({ recettes_annee: 0, scolarite_annee: 10102500, depenses_annee: 370000 }), 9732500);
  // La scolarité encaissée compte : l'omettre était précisément le défaut.
  assert.equal(resultatAnnee({ recettes_annee: 0, scolarite_annee: 10102500, depenses_annee: 0 }), 10102500);
  // Un déficit reste un déficit — on ne le masque pas (cas UCAD).
  assert.equal(resultatAnnee({ recettes_annee: 0, scolarite_annee: 60000, depenses_annee: 535000 }), -475000);
  // Champs absents ou nuls : zéro, pas NaN. Un NaN s'afficherait « NaN XOF ».
  assert.equal(resultatAnnee({}), 0);
  assert.equal(resultatAnnee(null), 0);
  assert.equal(resultatAnnee({ scolarite_annee: "60000", depenses_annee: null }), 60000);
});

test("une seule devise : les écoles s'additionnent, une seule ligne", async () => {
  const { consoliderParDevise } = await pilotage();
  const m = consoliderParDevise([
    { devise: "XOF", tresorerie: 9732500, masse_salariale: 2622999, recettes_annee: 0, scolarite_annee: 10102500, depenses_annee: 370000 },
    { devise: "XOF", tresorerie: -375000, masse_salariale: 650000, recettes_annee: 0, scolarite_annee: 60000, depenses_annee: 535000 },
  ], "XOF");
  assert.equal(m.length, 1);
  const [dev, v] = m[0];
  assert.equal(dev, "XOF");
  assert.equal(v.tresorerie, 9357500);
  assert.equal(v.masse, 3272999);
  assert.equal(v.resultat, 9257500);
});

test("⚠️ deux devises ne s'additionnent PAS en un seul nombre", async () => {
  const { consoliderParDevise } = await pilotage();
  // Cas réel en attente : la démo RDC est en USD, les écoles sénégalaises en
  // XOF. L'écran appliquait la devise de l'école ACTIVE à toutes les cartes et
  // sommait le tout — 1 000 USD + 1 000 XOF = « 2 000 XOF », un nombre qui ne
  // veut rien dire et surestime d'un facteur 600.
  const m = consoliderParDevise([
    { devise: "XOF", tresorerie: 5000000, masse_salariale: 800000, scolarite_annee: 6000000, depenses_annee: 1000000 },
    { devise: "USD", tresorerie: 12000, masse_salariale: 3000, scolarite_annee: 15000, depenses_annee: 2000 },
    { devise: "USD", tresorerie: 8000, masse_salariale: 1000, scolarite_annee: 9000, depenses_annee: 500 },
  ], "XOF");
  assert.equal(m.length, 2, "une ligne par monnaie");
  const par = Object.fromEntries(m);
  assert.equal(par.XOF.tresorerie, 5000000);
  assert.equal(par.USD.tresorerie, 20000);
  assert.equal(par.USD.resultat, 15000 - 2000 + 9000 - 500);
  // Et surtout : aucune ligne ne porte la somme des deux.
  assert.ok(!m.some(([, v]) => v.tresorerie === 5020000));
});

test("une école sans devise retombe sur celle de l'école active, pas sur rien", async () => {
  const { consoliderParDevise } = await pilotage();
  // `ecoles.devise` peut être null sur une fiche ancienne : sans repli, la clé
  // serait `null` et la tuile afficherait un montant sans unité.
  const m = consoliderParDevise([{ tresorerie: 100 }, { devise: "XOF", tresorerie: 50 }], "XOF");
  assert.equal(m.length, 1);
  assert.deepEqual(m[0][0], "XOF");
  assert.equal(m[0][1].tresorerie, 150);
});

test("aucune école : aucune ligne, et surtout aucun zéro trompeur", async () => {
  const { consoliderParDevise } = await pilotage();
  assert.deepEqual(consoliderParDevise([], "XOF"), []);
  assert.deepEqual(consoliderParDevise(undefined, "XOF"), []);
});
