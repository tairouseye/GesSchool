// =====================================================================
//  Confronter le fichier « Suivi des mensualités » de l'école avec l'appli
//  (mig. 222, Mme Kane 02/11/2026).
//
//  🔴 Ce qui compte : un mois payé dans le fichier et absent de l'appli est
//  proposé À ENCAISSER pour la DIFFÉRENCE seulement — jamais deux fois ce
//  qui est déjà enregistré.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const S = () => chargerLib("suiviFichier", ['export * from "@/lib/suiviFichier.js";']);
const ANNEE = ["2026-10", "2026-11", "2026-12", "2027-01"];

// La mise en page du fichier de Tut'Tank : titre, ligne vide, en-têtes.
const FICHIER = [
  ["ÉCOLE TUT'TANK — SUIVI DES MENSUALITÉS 2026-2027"],
  [],
  ["N°", "Matricule", "Nom", "Prénom", "Niveau", "Classe", "Montant mensualité", "Inscription", "Octobre", "Novembre", "Décembre", "Janvier"],
  [1, "TT2026011", "DIOP", "Serigne", "TPS", "TPS/PS A", 55000, "Oui", null, null, null, null],
  [2, "TT2026004", "FALL", "Ndeye", "TPS", "TPS/PS A", 55000, 55000, 55000, "55 000", null, null],
  [3, "TT2024011", "SAGNE", "Babacar", "CM1", "CM1", 55000, "Non", 30000, null, null, null],
  ["", "", "Total", "", "", "", "", "", 85000],
];

test("le fichier est lu par ses en-têtes, montants « 55 000 » compris", async () => {
  const { lireSuivi } = await S();
  const { eleves, colonnesMois } = lireSuivi(FICHIER, ANNEE);
  assert.equal(eleves.length, 3, "la ligne de total, sans matricule, est ignorée");
  assert.deepEqual(colonnesMois.map((c) => c.k), ANNEE);
  assert.deepEqual(eleves[1].mois, { "2026-10": 55000, "2026-11": 55000 });
  assert.equal(eleves[0].inscription, "oui");
  assert.equal(eleves[1].inscription, 55000);
  assert.equal(eleves[2].inscription, "non");
});

test("sans colonne Matricule : un message clair", async () => {
  const { lireSuivi } = await S();
  assert.throws(() => lireSuivi([["Nom", "Octobre"]], ANNEE), /Matricule/);
});

const grille = () => [
  { eleve_id: "e1", matricule: "TT2026011", nom: "DIOP", prenom: "Serigne", mensualite: 55000,
    inscription_montant: 45000, inscription_paye: 0, mois: { "2026-10": { paye: 0 }, "2026-11": { paye: 0 } } },
  { eleve_id: "e2", matricule: "TT2026004", nom: "FALL", prenom: "Ndeye", mensualite: 55000,
    inscription_montant: 55000, inscription_paye: 55000, mois: { "2026-10": { paye: 55000 }, "2026-11": { paye: 0 } } },
  { eleve_id: "e3", matricule: "TT2024011", nom: "SAGNE", prenom: "Babacar", mensualite: 50000,
    inscription_montant: 45000, inscription_paye: 0, mois: { "2026-10": { paye: 10000 }, "2026-11": { paye: 55000 } } },
  { eleve_id: "e4", matricule: "TT2020001", nom: "KANE", prenom: "Nafissatou", mensualite: 60000, mois: {} },
];

test("🔴 à encaisser = la différence avec ce que l'appli a déjà", async () => {
  const { lireSuivi, confronter } = await S();
  const e = confronter(lireSuivi(FICHIER, ANNEE).eleves, grille());
  const a = e.filter((x) => x.type === "a_encaisser").map((x) => [x.matricule, x.mois, x.montant]);
  assert.deepEqual(a, [
    ["TT2026011", null, 45000],          // « Oui » = le montant de l'inscription
    ["TT2026004", "2026-11", 55000],     // novembre absent de l'appli
    ["TT2024011", "2026-10", 20000],     // 30 000 dans le fichier, 10 000 dans l'appli
  ]);
});

test("les autres écarts sont signalés, pas encaissés", async () => {
  const { lireSuivi, confronter } = await S();
  const e = confronter(lireSuivi(FICHIER, ANNEE).eleves, grille());
  const t = (type) => e.filter((x) => x.type === type).map((x) => x.matricule);
  assert.deepEqual(t("appli_plus"), ["TT2024011"]);     // novembre payé dans l'appli seulement
  assert.deepEqual(t("mensualite"), ["TT2024011"]);
  assert.deepEqual(t("absent_fichier"), ["TT2020001"]);
});

test("un matricule inconnu de l'appli est signalé, sans rien encaisser", async () => {
  const { confronter } = await S();
  const e = confronter([{ matricule: "TT9999999", nom: "X", prenom: "Y", classe: "CM1", inscription: "oui", mois: { "2026-10": 55000 } }], []);
  assert.deepEqual(e.map((x) => x.type), ["absent_appli"]);
});
