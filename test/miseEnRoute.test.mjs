import test from "node:test";
import assert from "node:assert/strict";
import { etapesMiseEnRoute } from "../src/lib/miseEnRoute.js";

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
