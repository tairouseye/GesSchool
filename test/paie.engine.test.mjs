// Tests du moteur de paie (fonctions pures de src/lib/paie.js + bareme.js).
// Couvre : barème (recherche par tranche), cotisations (taux/plafond/forfait),
// lignes statutaires, et surtout le calcul NET → BRUT (net-to-gross) et sa
// réciprocité exacte au franc — le cœur du correctif « salaire de base = net ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerPaie } from "./bundle.helper.mjs";

const M = await chargerPaie();

// --- Jeu de configuration réaliste (Sénégal simplifié, valeurs de test) ---
const COTISATIONS = [
  { libelle: "IPRES", taux_salarial: 0.056, taux_patronal: 0.084, plafond: 432000, actif: true },
  { libelle: "CSS",   taux_salarial: 0,     taux_patronal: 0.07,  plafond: 63000,  actif: true },
  { libelle: "IPM",   taux_salarial: 0,     taux_patronal: 0, forfait_salarial: 5000, forfait_patronal: 5000, actif: true },
];
// Barème mensuel « en escalier » : ir constant par tranche (part 1).
const BAREME = [
  { periodicite: "mensuel", revenu: 0,      trimf: 0,   ir: { "1": 0,     "1.5": 0,     "2": 0 } },
  { periodicite: "mensuel", revenu: 100000, trimf: 400, ir: { "1": 5000,  "1.5": 4000,  "2": 3000 } },
  { periodicite: "mensuel", revenu: 200000, trimf: 500, ir: { "1": 20000, "1.5": 16000, "2": 12000 } },
  { periodicite: "mensuel", revenu: 300000, trimf: 500, ir: { "1": 45000, "1.5": 38000, "2": 30000 } },
];
const CTX = { partIr: 1, partTrimf: 1, cotisations: COTISATIONS, baremeMensuel: BAREME };

test("chercherBareme : recherche par tranche (floor)", () => {
  assert.equal(M.chercherBareme(BAREME, 50000, 1).ir, 0);       // < 100000
  assert.equal(M.chercherBareme(BAREME, 150000, 1).ir, 5000);   // tranche 100000
  assert.equal(M.chercherBareme(BAREME, 250000, 1).ir, 20000);  // tranche 200000
  assert.equal(M.chercherBareme(BAREME, 999999, 1).ir, 45000);  // dernière tranche
  assert.equal(M.chercherBareme(BAREME, 250000, 1).trimf, 500);
});

test("calculerCotisations : taux, plafond et forfait", () => {
  const cot = M.calculerCotisations(500000, COTISATIONS);
  const ipres = cot.find((c) => c.libelle === "IPRES");
  const css = cot.find((c) => c.libelle === "CSS");
  const ipm = cot.find((c) => c.libelle === "IPM");
  // IPRES plafonné à 432000 → 432000 × 5,6 %
  assert.equal(ipres.sal, Math.round(432000 * 0.056));
  assert.equal(ipres.patr, Math.round(432000 * 0.084));
  // CSS plafonné à 63000, part salariale nulle
  assert.equal(css.sal, 0);
  assert.equal(css.patr, Math.round(63000 * 0.07));
  // IPM en forfait
  assert.equal(ipm.sal, 5000);
  assert.equal(ipm.patr, 5000);
});

test("lignesBrut : heures × taux (base + sursalaire)", () => {
  const lignes = M.lignesBrut(173.33, { taux_horaire: 1000, taux_sursalaire: 200 });
  assert.equal(lignes[0].montant, Math.round(173.33 * 1000));
  assert.equal(lignes[1].montant, Math.round(173.33 * 200));
});

test("lignesStatutaires : cotisations salariales/patronales + IR/TRIMF", () => {
  const st = M.lignesStatutaires(250000, CTX);
  const patr = st.filter((l) => l.sens === "patronal");
  const ret = st.filter((l) => l.sens === "retenue");
  assert.ok(patr.length >= 1, "au moins une ligne patronale");
  assert.ok(ret.some((l) => l.libelle.includes("IR")), "ligne IR présente");
  // net = brut − retenues salariales, cohérent avec netDeBrut
  const sommeRet = ret.reduce((s, l) => s + l.montant, 0);
  assert.equal(250000 - sommeRet, M.netDeBrut(250000, CTX));
});

test("netDeBrut : net = brut − cotisations salariales − IR − TRIMF", () => {
  const brut = 250000;
  const cot = M.calculerCotisations(brut, COTISATIONS);
  const sal = cot.reduce((s, c) => s + c.sal, 0);
  const { ir } = M.chercherBareme(BAREME, brut, 1);
  const { trimf } = M.chercherBareme(BAREME, brut, 1);
  assert.equal(M.netDeBrut(brut, CTX), brut - sal - ir - trimf);
});

test("brutPourNet ∘ netDeBrut : réciprocité exacte au franc", () => {
  // Pour un balayage de bruts, le net obtenu doit être ré-atteignable exactement.
  for (let brut = 120000; brut <= 320000; brut += 2500) {
    const net = M.netDeBrut(brut, CTX);
    const brut2 = M.brutPourNet(net, CTX);
    assert.equal(M.netDeBrut(brut2, CTX), net, `net ${net} non ré-atteint (brut ${brut} → ${brut2})`);
  }
});

test("brutPourNet : le brut est ≥ au net et croît avec la cible", () => {
  const b1 = M.brutPourNet(150000, CTX);
  const b2 = M.brutPourNet(200000, CTX);
  assert.ok(b1 >= 150000, "brut ≥ net");
  assert.ok(b2 > b1, "monotone croissant");
  assert.equal(M.brutPourNet(0, CTX), 0);
});

const BAREME_ANNUEL = [
  { periodicite: "annuel", revenu: 0,       trimf: 0, ir: { "1": 0 } },
  { periodicite: "annuel", revenu: 1200000, trimf: 0, ir: { "1": 60000 } },
  { periodicite: "annuel", revenu: 2400000, trimf: 0, ir: { "1": 240000 } },
];

test("regularisationIR : IR annuel − cumul mensuel (complément / trop-perçu)", () => {
  // revenu annuel 2 500 000 → tranche 2 400 000 → IR annuel 240 000
  assert.equal(M.regularisationIR(2500000, 200000, BAREME_ANNUEL, 1), 40000);   // complément à retenir
  assert.equal(M.regularisationIR(2500000, 260000, BAREME_ANNUEL, 1), -20000);  // trop-perçu à restituer
  assert.equal(M.regularisationIR(2500000, 240000, BAREME_ANNUEL, 1), 0);       // pile
});
