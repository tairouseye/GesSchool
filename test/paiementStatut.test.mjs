// =====================================================================
//  L'indicateur de paiement — migration 170
//
//  🔴 POURQUOI TROIS ÉTATS. Relevé en production : 8 factures pour
//  96 élèves inscrits. Un indicateur à deux états afficherait « en
//  retard » pour 88 familles qui n'ont jamais été facturées — faux, et
//  accusatoire. Ces épreuves verrouillent cette distinction.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const P = () => chargerLib("paiestat", ['export * from "@/lib/paiementStatut.js";']);

test("🔴 « sans facture » n'est pas « en retard »", async () => {
  const { etat } = await P();
  assert.equal(etat("non_facture").ton, "neutre", "ton neutre, pas alarmant");
  assert.equal(etat("en_retard").ton, "danger");
  assert.equal(etat("a_jour").ton, "success");
  // La formulation désigne ce qui manque — la facture — et non une famille
  // en défaut. C'est l'école qui a du travail, pas le parent.
  assert.match(etat("non_facture").explication, /rien n'est dû/);
});

test("un état inconnu ne devient jamais une accusation", async () => {
  const { etat } = await P();
  // Fail-safe : si la base rendait un jour un état inattendu, on affiche
  // « non facturé » et non « en retard ».
  for (const x of ["", null, undefined, "bizarre", 0]) {
    assert.equal(etat(x).cle, "non_facture", `état « ${x} »`);
  }
});

test("🔴 le résumé compte AUSSI les familles sans facture", async () => {
  const { resume } = await P();
  // C'est l'information la plus utile à l'école aujourd'hui : ne compter
  // que les retards laisserait croire que tout va bien.
  const r = resume([
    { statut: "a_jour" }, { statut: "a_jour" },
    { statut: "en_retard" },
    ...Array.from({ length: 7 }, () => ({ statut: "non_facture" })),
  ]);
  assert.deepEqual(r, { en_retard: 1, a_jour: 2, en_avance: 0, exonere: 0, non_facture: 7, total: 10 });
});

test("le résumé est robuste", async () => {
  const { resume } = await P();
  const vide = { en_retard: 0, a_jour: 0, en_avance: 0, exonere: 0, non_facture: 0, total: 0 };
  assert.deepEqual(resume([]), vide);
  assert.deepEqual(resume(), vide);
  // Une ligne mal formée est comptée comme « non facturé », jamais ignorée :
  // un total qui ne correspond pas à l'effectif serait pire.
  assert.equal(resume([{}, { statut: "x" }]).non_facture, 2);
});

test("la phrase dit ce qu'il y a à faire", async () => {
  const { resume, phrase } = await P();
  assert.equal(phrase(resume([{ statut: "a_jour" }, { statut: "a_jour" }])),
    "Les 2 familles sont à jour.");
  assert.equal(phrase(resume([{ statut: "en_retard" }, { statut: "non_facture" }])),
    "1 en retard · 1 sans facture");
  // Le cas réel de Tut'Tank : presque personne n'est facturé.
  const tuttank = resume(Array.from({ length: 96 }, (_, i) => ({ statut: i < 8 ? "a_jour" : "non_facture" })));
  assert.equal(phrase(tuttank), "88 sans facture");
  assert.equal(phrase(resume([])), "", "aucun effectif : aucune phrase");
  assert.equal(phrase(null), "");
});

test("les états sont ordonnés par urgence", async () => {
  const { ORDRE, ETATS } = await P();
  assert.deepEqual(ORDRE, ["en_retard", "a_jour", "en_avance", "exonere", "non_facture"]);
  for (const c of ORDRE) {
    assert.ok(ETATS[c].label && ETATS[c].pastille && ETATS[c].explication, `état incomplet : ${c}`);
  }
});

// =====================================================================
//  Mig. 210 — l'échéancier : rouge / vert / bleu, et l'exonéré
// =====================================================================
test("🔴 rouge, vert, bleu : chaque état a sa couleur ET son libellé", async () => {
  const { etat } = await P();
  assert.match(etat("en_retard").texte, /rose/);
  assert.match(etat("a_jour").texte, /emerald/);
  assert.match(etat("en_avance").texte, /sky/);
  // La couleur n'est jamais seule : un libellé et une pastille l'accompagnent.
  for (const c of ["en_retard", "a_jour", "en_avance", "exonere"]) {
    assert.ok(etat(c).label && etat(c).pastille, c);
  }
});

test("🔴 un élève exonéré n'est ni en retard ni « sans facture »", async () => {
  const { etat, resume } = await P();
  assert.equal(etat("exonere").ton, "neutre");
  assert.match(etat("exonere").explication, /rien n'est dû/);
  const r = resume([{ statut: "exonere" }, { statut: "en_avance" }, { statut: "a_jour" }]);
  assert.equal(r.exonere, 1);
  assert.equal(r.en_retard, 0);
  assert.equal(r.total, 3);
});

test("la phrase signale les familles en avance", async () => {
  const { resume, phrase } = await P();
  assert.equal(phrase(resume([{ statut: "a_jour" }, { statut: "en_avance" }])),
    "Les 2 familles sont à jour · 1 en avance.");
});

test("l'échéancier : payé, dû, à venir — et le reste dû d'une ligne entamée", async () => {
  const { resumeEcheancier, libelleLigne } = await P();
  const r = resumeEcheancier([
    { libelle: "Inscription", mois: null, montant: 55000, paye: 55000, etat: "paye" },
    { libelle: "Scolarité — Octobre 2026", mois: "2026-10", montant: 55000, paye: 55000, etat: "paye" },
    { libelle: "Scolarité — Novembre 2026", mois: "2026-11", montant: 55000, paye: 0, etat: "en_retard" },
    { libelle: "Scolarité — Décembre 2026", mois: "2026-12", montant: 55000, paye: 0, etat: "partiel" },
    { libelle: "Scolarité — Janvier 2027", mois: "2027-01", montant: 55000, paye: 0, etat: "a_venir" },
  ]);
  assert.equal(r.payes.length, 2);
  assert.equal(r.dus.length, 2);
  assert.equal(r.aVenir.length, 1);
  assert.equal(r.totalPaye, 110000);
  assert.equal(r.totalDu, 110000);
  assert.equal(r.totalAnnee, 275000);
  assert.equal(libelleLigne({ libelle: "Scolarité — Octobre 2026", mois: "2026-10" }), "Octobre 2026");
  assert.equal(libelleLigne({ libelle: "Inscription", mois: null }), "Inscription");
  assert.deepEqual(resumeEcheancier(null).payes, []);
});

// --- Le détail des paiements (mig. 212) ------------------------------------
test("détail : description, statut du modèle, date et mode", async () => {
  const { lignesDetail } = await P();
  const L = lignesDetail({
    lignes: [
      { libelle: "Inscription", montant: 100000, etat: "paye", date_paiement: "2026-08-15", mode: "especes" },
      { mois: "2026-10", libelle: "Mensualité — Octobre 2026", montant: 60000, etat: "paye", date_paiement: "2026-09-12", mode: "wave,especes" },
      { mois: "2026-11", libelle: "Mensualité — Novembre 2026", montant: 60000, etat: "en_retard" },
      { mois: "2026-12", libelle: "Mensualité — Décembre 2026", montant: 60000, etat: "a_venir" },
      { mois: "2027-01", libelle: "Mensualité — Janvier 2027", montant: 60000, etat: "paye", mode: "orange_money" },
    ],
    autres: [{ libelle: "Sortie pédagogique", montant: 12000, etat: "a_venir" }],
  }, "2026-11");
  assert.deepEqual(L.map((l) => l.description),
    ["Inscription", "Octobre", "Novembre", "Décembre", "Janvier", "Sortie pédagogique"]);
  assert.deepEqual(L.map((l) => l.statut.txt),
    ["Payé", "Payé", "Impayé", "En attente", "Payé d'avance", "En attente"]);
  assert.equal(L[1].mode, "Wave, Espèces");
  assert.equal(L[4].mode, "Orange Money");
  assert.equal(L[2].mode, "");
  assert.equal(L[0].date, "2026-08-15");
  assert.equal(L[2].date, null);
  assert.equal(new Set(L.map((l) => l.cle)).size, L.length, "clés uniques");
});

test("détail : sans échéancier ou ancienne base (sans `autres`), pas d'erreur", async () => {
  const { lignesDetail } = await P();
  assert.deepEqual(lignesDetail(null), []);
  assert.equal(lignesDetail({ lignes: [{ libelle: "Inscription", montant: 1, etat: "bizarre" }] })[0].statut.txt, "En attente");
});
