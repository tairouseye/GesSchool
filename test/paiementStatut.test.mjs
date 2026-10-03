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
  assert.deepEqual(r, { en_retard: 1, a_jour: 2, non_facture: 7, total: 10 });
});

test("le résumé est robuste", async () => {
  const { resume } = await P();
  assert.deepEqual(resume([]), { en_retard: 0, a_jour: 0, non_facture: 0, total: 0 });
  assert.deepEqual(resume(), { en_retard: 0, a_jour: 0, non_facture: 0, total: 0 });
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
  assert.deepEqual(ORDRE, ["en_retard", "a_jour", "non_facture"]);
  for (const c of ORDRE) {
    assert.ok(ETATS[c].label && ETATS[c].pastille && ETATS[c].explication, `état incomplet : ${c}`);
  }
});
