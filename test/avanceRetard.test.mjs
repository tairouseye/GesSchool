import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const { reglerRetard } = await chargerLib("avance", ['export * from "@/lib/avance.js";']);

const groupes = [
  { mois: "2026-10", libelle: "Octobre 2026", total: 65000 },
  { mois: "2026-11", libelle: "Novembre 2026", total: 65000 },
  { mois: "2026-12", libelle: "Décembre 2026", total: 65000 },
];
const du = (mois, autres = {}) => ({ etat: "en_retard", mois, montant: 65000, paye: 0, ...autres });

test("le bouton règle les mois en retard, et les nomme", () => {
  assert.deepEqual(reglerRetard([du("2026-10"), du("2026-11")], groupes),
    { dernier: "2026-11", nb: 2, total: 130000, libelle: "Octobre et Novembre 2026" });
});

test("🔴 l'inscription n'entre pas dans le bouton : elle a le sien", () => {
  const inscription = { etat: "en_retard", mois: null, montant: 100000, paye: 0, facture_id: "f1" };
  assert.equal(reglerRetard([inscription, du("2026-10")], groupes).total, 65000);
  assert.equal(reglerRetard([inscription], groupes), null);
});

test("un mois déjà facturé se paie sur sa facture : pas de bouton", () => {
  assert.equal(reglerRetard([du("2026-10", { facture_id: "f2" })], groupes), null);
});

test("un mois que la fenêtre ne propose pas : pas de bouton", () => {
  assert.equal(reglerRetard([du("2026-09")], groupes), null);
  assert.equal(reglerRetard([], groupes), null);
});
