// Règles d'acquisition (logique pure, sans BD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const A = await chargerLib("acq", ['export * from "@/lib/acquisitions.js";']);

test("totalCommande : somme quantité × prix unitaire", () => {
  assert.equal(A.totalCommande([
    { quantite: 3, prix_unitaire: 12000 },
    { quantite: 1, prix_unitaire: 8500 },
  ]), 44500);
});

test("totalCommande : robuste aux valeurs absentes ou textuelles", () => {
  assert.equal(A.totalCommande(), 0);
  assert.equal(A.totalCommande([]), 0);
  // Les champs numériques reviennent parfois en texte depuis PostgREST.
  assert.equal(A.totalCommande([{ quantite: "2", prix_unitaire: "1500.50" }]), 3001);
  assert.equal(A.totalCommande([{ quantite: null, prix_unitaire: 9000 }]), 0);
  assert.equal(A.totalCommande([{ quantite: 2 }]), 0);
});

test("resteARecevoir : jamais négatif", () => {
  assert.equal(A.resteARecevoir({ quantite: 5, quantite_recue: 2 }), 3);
  assert.equal(A.resteARecevoir({ quantite: 5, quantite_recue: 5 }), 0);
  // Ne doit pas produire de « -1 exemplaire à recevoir » si la base dérive.
  assert.equal(A.resteARecevoir({ quantite: 2, quantite_recue: 7 }), 0);
  assert.equal(A.resteARecevoir({ quantite: 4 }), 4);
});

test("chaque statut de commande et de suggestion a un libellé et un ton", () => {
  for (const [cle, v] of Object.entries(A.STATUTS_COMMANDE)) {
    assert.ok(v.label, `statut de commande sans libellé : ${cle}`);
    assert.ok(v.ton, `statut de commande sans ton : ${cle}`);
  }
  for (const [cle, v] of Object.entries(A.STATUTS_SUGGESTION)) {
    assert.ok(v.label, `statut de suggestion sans libellé : ${cle}`);
    assert.ok(v.ton, `statut de suggestion sans ton : ${cle}`);
  }
});
