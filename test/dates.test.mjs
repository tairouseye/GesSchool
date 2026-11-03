import test from "node:test";
import assert from "node:assert/strict";
import { dateFr } from "../src/lib/dates.js";

test("une date SQL s'affiche JJ/MM/AAAA, sans décalage de fuseau", () => {
  assert.equal(dateFr("2026-08-07"), "07/08/2026");
  assert.equal(dateFr("2026-01-01"), "01/01/2026");
  assert.equal(dateFr("2026-08-07T23:30:00+00:00"), "07/08/2026");
});

test("une valeur vide ou inattendue ne casse pas l'affichage", () => {
  assert.equal(dateFr(null), "");
  assert.equal(dateFr(""), "");
  assert.equal(dateFr("bientôt"), "bientôt");
});
