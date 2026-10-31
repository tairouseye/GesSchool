// =====================================================================
//  Espace parent — l'aperçu d'un enfant (accueil et liste des rubriques)
//
//  Ce que l'épreuve verrouille :
//   • le cours du jour : celui en cours, sinon le prochain ; rien après la
//     dernière heure ;
//   • les devoirs « à venir » excluent ceux dont la date est passée ;
//   • « À régler » ignore les factures annulées et signale le retard ;
//   • une rubrique sans donnée n'affiche AUCUNE ligne plutôt qu'une fausse ;
//   • l'aperçu n'appelle jamais `enfant_bulletins`, qui marque les
//     bulletins comme consultés (mig. 166).
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const A = () => chargerLib("apercuEnfant", ['export * from "@/lib/apercuEnfant.js";']);

// Mardi 3 novembre 2026, 10 h 30.
const MARDI = new Date(2026, 10, 3, 10, 30);
const EMPLOI = [
  { jour: 2, heure_debut: "08:00:00", heure_fin: "10:00:00", matiere: "Lecture" },
  { jour: 2, heure_debut: "10:00:00", heure_fin: "11:00:00", matiere: "Mathématiques" },
  { jour: 2, heure_debut: "11:00:00", heure_fin: "12:00:00", matiere: "Éveil" },
  { jour: 2, heure_debut: "12:00:00", heure_fin: "13:00:00", matiere: "Sport" },
  { jour: 3, heure_debut: "08:00:00", heure_fin: "12:30:00", matiere: "Calcul" },
];

test("cours du jour : celui en cours, puis les deux suivants", async () => {
  const { coursDuJour } = await A();
  const c = coursDuJour(EMPLOI, MARDI);
  assert.equal(c.premier.matiere, "Mathématiques");
  assert.equal(c.premier.enCours, true);
  assert.deepEqual(c.suivants.map((s) => s.matiere), ["Éveil", "Sport"]);
  //  Après la dernière heure : rien à annoncer, mais on sait que la journée a eu lieu.
  const soir = coursDuJour(EMPLOI, new Date(2026, 10, 3, 18, 0));
  assert.equal(soir.premier, null);
  assert.equal(soir.termine, true);
  //  Avant le premier cours : le prochain, pas « en cours ».
  const tot = coursDuJour(EMPLOI, new Date(2026, 10, 4, 7, 0));
  assert.equal(tot.premier.matiere, "Calcul");
  assert.equal(tot.premier.enCours, false);
});

test("devoirs à venir : la date passée sort de la liste", async () => {
  const { devoirsAVenir, pourQuand } = await A();
  const cahier = [
    { devoirs: "Exercice 3", date_pour: "2026-11-02", matiere: "Calcul" },
    { devoirs: "Lire p. 12", date_pour: "2026-11-05", matiere: "Lecture" },
    { devoirs: "", date_pour: "2026-11-06", matiere: "Éveil" },
    { devoirs: "Réciter", date_pour: "2026-11-04", matiere: "Poésie" },
  ];
  assert.deepEqual(devoirsAVenir(cahier, MARDI).map((d) => d.matiere), ["Poésie", "Lecture"]);
  assert.equal(pourQuand("2026-11-04", MARDI), "pour demain");
  assert.equal(pourQuand("2026-11-06", MARDI), "pour vendredi");
});

test("à régler : les factures annulées ne comptent pas, le retard est signalé", async () => {
  const { aRegler } = await A();
  const f = [
    { montant_total: 35000, montant_paye: 0, date_echeance: "2026-10-05", statut: "emise" },
    { montant_total: 35000, montant_paye: 0, date_echeance: "2026-11-05", statut: "emise" },
    { montant_total: 99000, montant_paye: 0, date_echeance: "2026-09-05", statut: "annulee" },
  ];
  const a = aRegler(f, MARDI);
  assert.equal(a.reste, 70000);
  assert.equal(a.enRetard, true);
  assert.equal(a.echeance, "2026-10-05");
  assert.equal(a.part, 0);
});

test("rubriques : une donnée absente ne produit aucune ligne", async () => {
  const { resumeRubriques } = await A();
  const vide = resumeRubriques({}, MARDI);
  assert.deepEqual(vide, {});
  const r = resumeRubriques({
    emploi: EMPLOI, absences: [{ statut: "non_justifie" }, { statut: "justifie" }],
    notes: [{ matiere: "Calcul", valeur: 15, bareme: 20, date_eval: "2026-10-30" }], alertes: {},
    cahier: [], demandesEnCours: 0, fournitures: [],
  }, MARDI);
  assert.equal(r.emploi.texte, "Aujourd'hui : 8 h – 13 h");
  assert.equal(r.absences.texte, "1 à justifier");
  assert.equal(r.notes.texte, "Dernière : Calcul 15/20");
  assert.equal(r.cahier.texte, "Aucun devoir à venir");
  assert.equal(r.fournitures, null);
});

test("l'aperçu n'appelle jamais enfant_bulletins (elle marque « consulté »)", () => {
  for (const f of ["src/lib/apercuEnfant.js", "src/composants/ApercuEnfant.jsx"]) {
    const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(src, /enfantBulletins|enfant_bulletins/, `${f} ne doit pas lire les bulletins`);
  }
});
