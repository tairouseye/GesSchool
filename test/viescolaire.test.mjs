// =====================================================================
//  Feuille de présence — la différence ne doit JAMAIS écraser une
//  justification (correctif du 01/10/2026)
//
//  `enregistrerAppel` faisait un DELETE de toutes les absences de la classe
//  pour la journée, puis un INSERT avec `statut: 'non_justifie'`. Refaire la
//  feuille — second passage, correction, deux personnes qui la saisissent —
//  remettait donc à zéro le travail du secrétariat : le statut repassait à
//  « non justifié » et la justification déposée par le parent (mig. 024)
//  disparaissait. Perte silencieuse et irréversible, en production.
//
//  Le correctif procède par différence, ce qui rend l'opération IDEMPOTENTE :
//  rejouer la même feuille ne produit aucune écriture.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const vie = () => chargerLib("viescolaire", ['export * from "@/lib/viescolaire.js";']);
const CTX = { ecoleId: "ec", classeId: "cl", date: "2026-10-01", saisiPar: "moi" };

test("🔴 une absence déjà justifiée n'est ni supprimée ni réinsérée", async () => {
  const { diffAppel } = await vie();
  const d = diffAppel({
    ...CTX,
    existantes: [{ id: "a1", eleve_id: "e1", type: "absence", motif: "malade" }],
    entries: [{ eleve_id: "e1", etat: "absence", motif: "malade" }],
  });
  // Aucune écriture : c'est ce qui préserve `statut` et `justification`.
  assert.deepEqual(d, { aSupprimer: [], aMettreAJour: [], aInserer: [] });
});

test("rejouer la feuille à l'identique n'écrit rien (idempotence)", async () => {
  const { diffAppel } = await vie();
  const existantes = [
    { id: "a1", eleve_id: "e1", type: "absence", motif: null },
    { id: "a2", eleve_id: "e2", type: "retard", motif: "transport" },
  ];
  const entries = [
    { eleve_id: "e1", etat: "absence" },
    { eleve_id: "e2", etat: "retard", motif: "transport" },
    { eleve_id: "e3", etat: "present" },
  ];
  const d = diffAppel({ ...CTX, existantes, entries });
  assert.equal(d.aSupprimer.length + d.aMettreAJour.length + d.aInserer.length, 0);
});

test("corriger un absent en présent retire sa ligne", async () => {
  const { diffAppel } = await vie();
  const d = diffAppel({
    ...CTX,
    existantes: [{ id: "a1", eleve_id: "e1", type: "absence", motif: null }],
    entries: [{ eleve_id: "e1", etat: "present" }],
  });
  assert.deepEqual(d.aSupprimer, ["a1"]);
  assert.equal(d.aInserer.length, 0);
});

test("passer d'absence à retard MODIFIE la ligne au lieu de la recréer", async () => {
  const { diffAppel } = await vie();
  // Recréer la ligne remettrait `statut` à « non_justifie » : c'était le bug.
  const d = diffAppel({
    ...CTX,
    existantes: [{ id: "a1", eleve_id: "e1", type: "absence", motif: null }],
    entries: [{ eleve_id: "e1", etat: "retard", motif: "bus" }],
  });
  assert.deepEqual(d.aMettreAJour, [{ id: "a1", type: "retard", motif: "bus" }]);
  assert.deepEqual(d.aSupprimer, []);
  assert.equal(d.aInserer.length, 0);
});

test("un nouvel absent est inséré, non justifié", async () => {
  const { diffAppel } = await vie();
  const d = diffAppel({ ...CTX, existantes: [], entries: [{ eleve_id: "e9", etat: "absence", motif: "fièvre" }] });
  assert.equal(d.aInserer.length, 1);
  assert.deepEqual(d.aInserer[0], {
    ecole_id: "ec", eleve_id: "e9", classe_id: "cl", type: "absence",
    date_abs: "2026-10-01", motif: "fièvre", statut: "non_justifie", saisi_par: "moi",
  });
});

test("⚠️ un élève hors de la feuille n'est jamais touché", async () => {
  const { diffAppel } = await vie();
  // `absences` n'a aucune contrainte liant la ligne à une inscription active :
  // un élève désinscrit, ou absent d'une autre classe ce jour-là, garde ses
  // lignes. L'ancien DELETE global les emportait.
  const d = diffAppel({
    ...CTX,
    existantes: [{ id: "autre", eleve_id: "e_parti", type: "absence", motif: null }],
    entries: [{ eleve_id: "e1", etat: "present" }],
  });
  assert.deepEqual(d.aSupprimer, [], "la ligne de l'élève hors feuille reste");
});

test("les doublons du même jour sont ramenés à une seule ligne", async () => {
  const { diffAppel } = await vie();
  // Faute de contrainte d'unicité, deux saisies concurrentes ont pu créer deux
  // lignes. On garde la première (donc sa justification) et on retire l'autre.
  const d = diffAppel({
    ...CTX,
    existantes: [
      { id: "a1", eleve_id: "e1", type: "absence", motif: null },
      { id: "a2", eleve_id: "e1", type: "absence", motif: null },
    ],
    entries: [{ eleve_id: "e1", etat: "absence" }],
  });
  assert.deepEqual(d.aSupprimer, ["a2"]);
  assert.deepEqual(d.aMettreAJour, []);
});

test("feuille vide : aucune écriture, même avec de l'existant", async () => {
  const { diffAppel } = await vie();
  const d = diffAppel({ ...CTX, existantes: [{ id: "a1", eleve_id: "e1", type: "absence" }], entries: [] });
  assert.deepEqual(d, { aSupprimer: [], aMettreAJour: [], aInserer: [] });
});
