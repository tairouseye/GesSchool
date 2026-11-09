import test from "node:test";
import assert from "node:assert/strict";
import { etapesMiseEnRoute, compterPeriodesDatees } from "../src/lib/miseEnRoute.js";

const ok = (etapes) => Object.fromEntries(etapes.map((e) => [e.id, e.ok]));

test("une école qui vient d'être créée n'a aucune étape faite", () => {
  const e = etapesMiseEnRoute({ niveaux: 0, classes: 0, periodes: 3, periodesDatees: 0 });
  assert.equal(e.length, 9);
  assert.ok(e.every((x) => !x.ok));
});

test("🔴 Tut'Tank (03/11) : élèves inscrits, mais enseignants et parents pas connectés", () => {
  const e = ok(etapesMiseEnRoute({
    niveaux: 5, classes: 8, matieres: 11, frais: 15, inscriptions: 126, periodes: 3, periodesDatees: 3,
    enseignants: 10, affectations: 40, enseignantsRelies: 0, tuteurs: 145, tuteursRelies: 4, mobile: true,
  }));
  assert.equal(e.eleves, true);
  assert.equal(e.comptes_enseignants, false);
  assert.equal(e.parents, false, "4 parents sur 145 ne suffisent pas");
});

test("des trimestres en partie datés ne valident pas l'étape", () => {
  assert.equal(ok(etapesMiseEnRoute({ periodes: 3, periodesDatees: 2 })).periodes, false);
  assert.equal(ok(etapesMiseEnRoute({ periodes: 3, periodesDatees: 3 })).periodes, true);
});

test("sans le module Encaissements, ni grille tarifaire ni paiement mobile", () => {
  const ids = etapesMiseEnRoute({}, { paiements: false }).map((x) => x.id);
  assert.equal(ids.length, 7);
  assert.ok(!ids.includes("frais") && !ids.includes("mobile"));
});

test("chaque étape mène à un écran", () => {
  for (const e of etapesMiseEnRoute({})) assert.match(e.to, /^\/[a-z]/, e.id);
});

test("🔴 adoption : Tut'Tank voit ses 10 enseignants sans compte et 141 parents à connecter", async () => {
  const { lignesAdoption } = await import("../src/lib/miseEnRoute.js");
  const l = lignesAdoption({ enseignants: 10, enseignantsRelies: 0, tuteurs: 145, tuteursRelies: 4 }, () => true);
  assert.equal(l.length, 2);
  assert.match(l[0].titre, /10 enseignants sans compte/);
  assert.match(l[1].titre, /141 parents pas encore connectés \(4 \/ 145\)/);
  assert.equal(lignesAdoption({ enseignants: 10, enseignantsRelies: 0 }, (c) => c !== "enseignants").length, 0);
  assert.equal(lignesAdoption({ enseignants: 2, enseignantsRelies: 2, tuteurs: 3, tuteursRelies: 3 }, () => true).length, 0);
});

test("un trimestre ne compte que s'il est daté dans l'année scolaire", () => {
  const annee = { date_debut: "2026-10-01", date_fin: "2027-07-31" };
  const t = (d, f) => ({ date_debut: d, date_fin: f });
  //  La démo du 09/11/2026 : trois trimestres de l'année précédente.
  assert.deepEqual(compterPeriodesDatees([t("2025-10-01", "2025-12-20"), t("2026-01-05", "2026-03-28"), t("2026-04-06", "2026-06-30")], annee),
    { datees: 0, hors: 3 });
  assert.deepEqual(compterPeriodesDatees([t("2026-10-01", "2026-12-20"), t(null, null), t("2027-04-06", "2027-06-30")], annee),
    { datees: 2, hors: 0 });
  //  Année sans dates : on ne peut pas juger, une période datée compte.
  assert.deepEqual(compterPeriodesDatees([t("2025-10-01", "2025-12-20")], null), { datees: 1, hors: 0 });
  const e = etapesMiseEnRoute({ periodes: 3, periodesDatees: 0, periodesHorsAnnee: 3 }).find((x) => x.id === "periodes");
  assert.equal(e.ok, false);
  assert.equal(e.detail, "3 périodes hors de l'année");
});

test("les étapes s'accordent : niveaux, datées, connectés, reliés", () => {
  const d = Object.fromEntries(etapesMiseEnRoute({ niveaux: 9, classes: 12, periodes: 3, periodesDatees: 3,
    enseignants: 12, enseignantsRelies: 0, tuteurs: 32, tuteursRelies: 3 }).map((x) => [x.id, x.detail]));
  assert.equal(d.structure, "9 niveaux · 12 classes");
  assert.equal(d.periodes, "3 / 3 datées");
  assert.equal(d.comptes_enseignants, "0 / 12 connectés");
  assert.equal(d.parents, "3 / 32 reliés");
});
