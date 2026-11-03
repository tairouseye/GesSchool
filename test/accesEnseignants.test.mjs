import test from "node:test";
import assert from "node:assert/strict";
import { messageEnseignant, etatAcces, fichesImprimables } from "../src/lib/accesEnseignants.js";

const ens = { prenom: "Awa", nom: "Diop", telephone: "77 123 45 67", profil_id: null };

test("le message donne les trois gestes et le code", () => {
  const m = messageEnseignant("https://gesschool.gesprosn.org", "Tut'Tank", ens, "K7M2XQ9P4R");
  assert.match(m, /Bonjour Awa/);
  assert.match(m, /Mon numéro/);
  assert.match(m, /J'ai un code/);
  assert.match(m, /K7M2XQ9P4R/);
});

test("l'état d'accès distingue connecté, prêt, sans numéro et sans code", () => {
  assert.equal(etatAcces({ ...ens, profil_id: "x" }, null), "connecte");
  assert.equal(etatAcces(ens, "ABC"), "pret");
  assert.equal(etatAcces({ ...ens, telephone: null }, "ABC"), "sans_tel");
  assert.equal(etatAcces(ens, null), "sans_code");
});

test("🔴 les fiches imprimables échappent le HTML des noms", () => {
  const html = fichesImprimables("https://x", "École <b>", [{ enseignant: { prenom: "<script>", nom: "x" }, code: "ABC" }]);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /École &lt;b&gt;/);
});
