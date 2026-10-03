// =====================================================================
//  L'échelle d'observation du préscolaire — migration 172
//
//  🔴 Au préscolaire on n'évalue pas, on OBSERVE. Ces épreuves portent
//  surtout sur ce qui se dit à une famille : c'est un enfant de trois ans
//  qu'on décrit, et une formulation maladroite fait plus de dégâts qu'un
//  défaut d'affichage.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const A = () => chargerLib("acqech", ['export * from "@/lib/acquisEchelle.js";']);

test("trois valeurs, et aucune n'est un verdict", async () => {
  const { VALEURS, valeur } = await A();
  assert.deepEqual(VALEURS.map((v) => v.cle), ["acquis", "en_cours", "non_acquis"]);
  // 🔴 « Pas encore acquis » décrit un moment d'un parcours ; « non acquis »
  // sonne comme une sanction. La nuance n'est pas cosmétique : ce libellé
  // est lu par les parents d'un enfant de trois ans.
  assert.equal(valeur("non_acquis").label, "Pas encore acquis");
  assert.match(valeur("non_acquis").aide, /pas un échec/);
  for (const v of VALEURS) assert.ok(v.label && v.aide && v.pastille && v.ton, v.cle);
});

test("🔴 une valeur absente n'est PAS un « pas encore acquis »", async () => {
  const { valeur } = await A();
  // Confondre « non observé » et « non acquis » ferait dire à l'école que
  // l'enfant échoue, là où elle n'a simplement rien noté.
  for (const x of [undefined, null, "", "bizarre"]) assert.equal(valeur(x), null, `« ${x} »`);
});

test("les items se regroupent par domaine, dans l'ordre du référentiel", async () => {
  const { parDomaine } = await A();
  const items = [
    { id: "1", domaine: "Langage", libelle: "Nommer", ordre: 1 },
    { id: "2", domaine: "Langage", libelle: "Écouter", ordre: 2 },
    { id: "3", domaine: "Vivre ensemble", libelle: "Partager", ordre: 1 },
  ];
  const g = parDomaine(items, { 1: { valeur: "acquis" } });
  assert.deepEqual(g.map((x) => x.domaine), ["Langage", "Vivre ensemble"]);
  assert.equal(g[0].items.length, 2);
  assert.equal(g[0].items[0].valeur, "acquis", "l'observation est fusionnée dans l'item");
  assert.equal(g[0].items[1].valeur, undefined, "et l'absence reste une absence");
  assert.deepEqual(parDomaine([], {}), []);
  assert.deepEqual(parDomaine(), []);
});

test("🔴 ce qui reste à observer est une information, pas un reliquat", async () => {
  const { avancement } = await A();
  const items = Array.from({ length: 60 }, (_, i) => ({ id: String(i) }));
  const a = avancement(items, { 0: { valeur: "acquis" }, 1: { valeur: "en_cours" }, 2: { valeur: "non_acquis" } });
  assert.deepEqual(a, {
    acquis: 1, en_cours: 1, non_acquis: 1, nonEvalues: 57, total: 60, observes: 3,
  });
  // Une enseignante doit voir qu'il reste 57 items : un suivi à 3 sur 60
  // ne doit pas se présenter comme un bilan.
  assert.equal(a.nonEvalues, 57);
});

test("une valeur inattendue compte comme non observée, jamais comme un échec", async () => {
  const { avancement } = await A();
  const a = avancement([{ id: "a" }, { id: "b" }], { a: { valeur: "n_importe_quoi" } });
  assert.equal(a.nonEvalues, 2);
  assert.equal(a.non_acquis, 0, "aucune observation n'est inventée");
});

test("la phrase pour la famille ne transforme pas un suivi en verdict", async () => {
  const { avancement, phraseFamille } = await A();
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(
    phraseFamille(avancement(items, { a: { valeur: "acquis" }, b: { valeur: "en_cours" } })),
    "1 acquis · 1 en cours — sur 2 observations.");
  // 🔴 Rien d'observé : on le DIT, au lieu d'afficher « 0 acquis » qui se
  // lirait comme un bilan catastrophique.
  assert.equal(phraseFamille(avancement(items, {})),
    "Aucune observation enregistrée pour cette période.");
  assert.equal(phraseFamille(avancement([], {})), "");
  assert.equal(phraseFamille(null), "");
  // Le singulier est respecté : « sur 1 observation », pas « 1 observations ».
  assert.match(phraseFamille(avancement(items, { a: { valeur: "acquis" } })), /sur 1 observation\.$/);
});
