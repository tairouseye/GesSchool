// =====================================================================
//  Recherche globale (Ctrl+K) — lot 2 de l'audit du 31/10/2026
//
//  Ce que l'épreuve verrouille :
//   • un numéro se retrouve quels que soient les espaces saisis ou
//     enregistrés, et pas en dessous de 4 chiffres (tout correspondrait) ;
//   • les caractères réservés du filtre PostgREST ne passent pas dans la
//     requête (une virgule ou une parenthèse casserait le `or=(…)`) ;
//   • la recherche d'écrans ignore accents et casse, et exige tous les mots ;
//   • aucune lecture ne contourne la RLS : pas de RPC, pas de clé de service.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const R = () => chargerLib("recherche", ['export * from "@/lib/recherche.js";']);

test("téléphone : les chiffres comptent, pas les espaces", async () => {
  const { motifTelephone } = await R();
  assert.equal(motifTelephone("77 12"), "*7*7*1*2*");
  assert.equal(motifTelephone("+221 77"), "*2*2*1*7*7*");
  assert.equal(motifTelephone("771"), null);
  assert.equal(motifTelephone("Diop"), null);
});

test("les caractères réservés du filtre sont retirés", async () => {
  const { nettoyer } = await R();
  assert.equal(nettoyer("  Diop, (Awa)  "), "Diop Awa");
  assert.equal(nettoyer("50%*"), "50");
});

test("écrans : sans accents, tous les mots", async () => {
  const { chercherPages } = await R();
  const pages = [
    { to: "/eleves", label: "Élèves & inscriptions", espace: "Gestion" },
    { to: "/paiements", label: "Paiements", espace: "Gestion" },
    { to: "/situation-paiements", label: "Situation des paiements", espace: "Gestion" },
  ];
  assert.deepEqual(chercherPages(pages, "eleves").map((p) => p.to), ["/eleves"]);
  assert.deepEqual(chercherPages(pages, "PAIEMENT").map((p) => p.to), ["/paiements", "/situation-paiements"]);
  assert.deepEqual(chercherPages(pages, "situation paie").map((p) => p.to), ["/situation-paiements"]);
  assert.deepEqual(chercherPages(pages, "  "), []);
});

test("la recherche lit les tables sous RLS, jamais par une porte dérobée", () => {
  const src = readFileSync("src/lib/recherche.js", "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /\.rpc\(/);
  assert.doesNotMatch(src, /service_role|SERVICE_KEY/i);
  //  Chaque requête est bornée à l'école courante.
  assert.equal((src.match(/\.from\(/g) || []).length, (src.match(/\.eq\("ecole_id", ecoleId\)/g) || []).length);
});
