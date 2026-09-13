// Test de la logique d'évaluation testable sans BD : attribution des mentions
// selon les seuils de la config de notation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const E = await chargerLib("eval", ['export { mention, DEFAUT_NOTATION } from "@/lib/bulletins.js";']);
const cfg = E.DEFAUT_NOTATION;

test("mention : seuils décroissants (Très Bien ≥16 … Passable ≥10, sinon Insuffisant)", () => {
  assert.equal(E.mention(18, cfg), "Très Bien");
  assert.equal(E.mention(16, cfg), "Très Bien");   // borne
  assert.equal(E.mention(15, cfg), "Bien");
  assert.equal(E.mention(14, cfg), "Bien");        // borne
  assert.equal(E.mention(13, cfg), "Assez Bien");
  assert.equal(E.mention(12, cfg), "Assez Bien");  // borne
  assert.equal(E.mention(11, cfg), "Passable");
  assert.equal(E.mention(10, cfg), "Passable");    // borne = passage
  assert.equal(E.mention(9.99, cfg), "Insuffisant");
  assert.equal(E.mention(0, cfg), "Insuffisant");
});

test("mention : absence de moyenne → tiret", () => {
  assert.equal(E.mention(null, cfg), "—");
});

test("mention : config personnalisée respectée", () => {
  const c = { mentions: [{ min: 8, libelle: "Réussi" }], insuffisant: "Échec" };
  assert.equal(E.mention(9, c), "Réussi");
  assert.equal(E.mention(7, c), "Échec");
});
