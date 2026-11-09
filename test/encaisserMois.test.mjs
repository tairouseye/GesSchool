// La fenêtre « Encaisser » propose aussi les MOIS SANS FACTURE (09/11/2026) :
// une famille en retard sur un mois non facturé ressortait « rien à régler ».
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const { moisParDefaut, etatMois } = await chargerLib("encaisserMois", ['export * from "@/lib/encaisser.js";']);

const g = (mois) => ({ mois, libelle: mois, total: 65000, lignes: [] });
const NOV = new Date(2026, 10, 9);

test("les mois échus et le mois en cours sont cochés d'office", () => {
  assert.deepEqual(moisParDefaut([g("2026-10"), g("2026-11"), g("2026-12")], NOV), ["2026-10", "2026-11"]);
});

test("une famille à jour : le premier mois à venir seulement", () => {
  assert.deepEqual(moisParDefaut([g("2026-12"), g("2027-01")], NOV), ["2026-12"]);
});

test("un trou (octobre facturé, pas novembre) : on coche jusqu'au dernier mois dû", () => {
  assert.deepEqual(moisParDefaut([g("2026-09"), g("2026-11"), g("2027-01")], NOV), ["2026-09", "2026-11"]);
});

test("aucun mois : rien de coché", () => {
  assert.deepEqual(moisParDefaut([], NOV), []);
});

test("l'état d'un mois : échéance le 5", () => {
  assert.equal(etatMois("2026-10", NOV), "en retard");
  assert.equal(etatMois("2026-11", NOV), "en retard");
  assert.equal(etatMois("2026-11", new Date(2026, 10, 3)), "ce mois-ci");
  assert.equal(etatMois("2026-12", NOV), "");
});
