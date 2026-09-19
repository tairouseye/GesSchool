import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Le montant en lettres figure sur des documents de caisse opposables :
// une faute d'accord y est visible par tout le monde. Les irrégularités du
// français (70/80/90, le « s » de cents, l'invariabilité de mille) sont
// exactement les endroits où une implémentation naïve se trompe.
const charger = () => chargerLib("lettres", ['export * from "@/lib/montantEnLettres.js";']);

test("les vingtaines et leurs « et un »", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(0), "zéro");
  assert.equal(f(16), "seize");
  assert.equal(f(17), "dix-sept");
  assert.equal(f(21), "vingt et un");
  assert.equal(f(22), "vingt-deux");
  assert.equal(f(31), "trente et un");
  assert.equal(f(61), "soixante et un");
});

test("soixante-dix et quatre-vingt-dix : la vraie difficulté", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(70), "soixante-dix");
  assert.equal(f(71), "soixante et onze", "71 garde le « et », contrairement à 91");
  assert.equal(f(77), "soixante-dix-sept");
  assert.equal(f(90), "quatre-vingt-dix");
  assert.equal(f(91), "quatre-vingt-onze", "91 n'a PAS de « et »");
  assert.equal(f(99), "quatre-vingt-dix-neuf");
});

test("quatre-vingts : le « s » que 81 perd", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(80), "quatre-vingts");
  assert.equal(f(81), "quatre-vingt-un", "pas de « et », et pas de « s »");
  assert.equal(f(82), "quatre-vingt-deux");
});

test("cent : accord seulement s'il est multiplié ET terminal", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(100), "cent", "jamais « un cent »");
  assert.equal(f(101), "cent un");
  assert.equal(f(200), "deux cents");
  assert.equal(f(201), "deux cent un", "suivi de quelque chose : pas de « s »");
  assert.equal(f(280), "deux cent quatre-vingts");
});

test("mille est invariable, million et milliard s'accordent", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(1000), "mille", "jamais « un mille »");
  assert.equal(f(1001), "mille un");
  assert.equal(f(2000), "deux mille", "mille ne prend jamais de « s »");
  assert.equal(f(1000000), "un million");
  assert.equal(f(2000000), "deux millions");
  assert.equal(f(1000000000), "un milliard");
  assert.equal(f(2500000), "deux millions cinq cent mille");
});

test("« mille » bloque l'accord, « million » ne le bloque pas", async () => {
  const { nombreEnLettres: f } = await charger();
  // Mille n'est pas un nom : le groupe qui le précède perd sa marque.
  assert.equal(f(80000), "quatre-vingt mille");
  assert.equal(f(200000), "deux cent mille");
  assert.equal(f(300000), "trois cent mille");
  // Million et milliard sont des noms : l'accord tient.
  assert.equal(f(80000000), "quatre-vingts millions");
  assert.equal(f(200000000), "deux cents millions");
  assert.equal(f(80000000000), "quatre-vingts milliards");
});

test("un montant réel de scolarité", async () => {
  const { nombreEnLettres: f } = await charger();
  assert.equal(f(125000), "cent vingt-cinq mille");
  assert.equal(f(375000), "trois cent soixante-quinze mille");
  assert.equal(f(1250000), "un million deux cent cinquante mille");
});

test("montantEnLettres : devise accordée et phrase capitalisée", async () => {
  const { montantEnLettres: m } = await charger();
  assert.equal(m(125000, "XOF"), "Cent vingt-cinq mille francs CFA");
  assert.equal(m(1, "XOF"), "Un franc CFA", "au singulier, pas de « s »");
  assert.equal(m(0, "XOF"), "Zéro franc CFA");
  assert.equal(m(2500, "EUR"), "Deux mille cinq cents euros");
  assert.equal(m(150, "CDF"), "Cent cinquante francs congolais");
});

test("montantEnLettres : entrées douteuses n'explosent pas", async () => {
  const { montantEnLettres: m } = await charger();
  assert.equal(m(null), "Zéro franc CFA");
  assert.equal(m(undefined), "Zéro franc CFA");
  assert.equal(m("15000"), "Quinze mille francs CFA", "un montant arrivant en texte reste lisible");
  assert.equal(m(1500.75), "Mille cinq cents francs CFA", "les centimes ne se disent pas en francs CFA");
  assert.equal(m(-200), "Deux cents francs CFA");
  // Une devise inconnue ne doit pas produire « undefined ».
  assert.equal(m(10, "GNF"), "Dix GNF");
});
