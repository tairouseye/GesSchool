import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Le message part chez un commerçant : il doit être lisible dans un rayon de
// magasin, et surtout ne JAMAIS contenir un article que l'école fournit déjà
// — le parent le paierait deux fois.
const charger = () => chargerLib("fournitures", ['export * from "@/lib/fournituresPartage.js";']);

const LISTE = [
  { libelle: "Cahier 96 pages", quantite: 6, obligatoire: true, note: "grands carreaux", fourni_ecole: false },
  { libelle: "Blouse", quantite: 1, obligatoire: true, note: null, fourni_ecole: true },
  { libelle: "Boîte de craies", quantite: 1, obligatoire: false, note: null, fourni_ecole: false },
  { libelle: "Manuel de lecture", quantite: 1, obligatoire: true, note: "disponible à l'école", fourni_ecole: false },
];

test("fourniParEcole : la case fait foi, la note sert de repli", async () => {
  const { fourniParEcole } = await charger();
  assert.equal(fourniParEcole(LISTE[1]), true, "case cochée");
  assert.equal(fourniParEcole(LISTE[0]), false);
  // Listes saisies avant la migration 105 : la case n'existait pas, seule la
  // note disait « école ».
  assert.equal(fourniParEcole(LISTE[3]), true, "repli sur la note");
  assert.equal(fourniParEcole(null), false, "jamais d'exception sur une entrée vide");
  assert.equal(fourniParEcole({}), false);
});

test("aAcheter : ce que l'école fournit est écarté", async () => {
  const { aAcheter } = await charger();
  const r = aAcheter(LISTE);
  assert.deepEqual(r.map((f) => f.libelle), ["Cahier 96 pages", "Boîte de craies"]);
  assert.equal(aAcheter([]).length, 0);
  assert.equal(aAcheter().length, 0);
});

test("messageFournitures : lisible, avec quantités, notes et mention optionnel", async () => {
  const { messageFournitures, aAcheter } = await charger();
  const m = messageFournitures(aAcheter(LISTE), { enfant: "Awa Diop", classe: "CE1", ecole: "Tut'Tank" });

  assert.ok(m.startsWith("Fournitures à acheter — Awa Diop — CE1"), "l'en-tête dit de qui il s'agit");
  assert.ok(m.includes("• 6 × Cahier 96 pages — grands carreaux"), "quantité et note, utiles en magasin");
  assert.ok(m.includes("• Boîte de craies (optionnel)"), "une quantité de 1 ne s'écrit pas");
  assert.ok(m.includes("(Tut'Tank)"));
  assert.ok(!m.includes("Blouse"), "un article fourni par l'école ne doit JAMAIS figurer");
  assert.ok(!m.includes("Manuel de lecture"), "ni celui que la note dit disponible à l'école");
});

test("messageFournitures : liste vide → message explicite, pas une coquille", async () => {
  const { messageFournitures } = await charger();
  const m = messageFournitures([], { enfant: "Awa Diop" });
  assert.ok(m.includes("Rien à acheter"));
  assert.ok(!m.includes("•"));
});

test("messageFournitures : sans contexte enfant, l'en-tête reste propre", async () => {
  const { messageFournitures } = await charger();
  const m = messageFournitures([{ libelle: "Ardoise", quantite: 1, obligatoire: true }]);
  assert.equal(m.split("\n")[0], "Fournitures à acheter", "pas de tirets orphelins");
  assert.ok(m.includes("• Ardoise"));
});

test("lienPartageWhatsApp : sans destinataire, et le texte est encodé", async () => {
  const { lienPartageWhatsApp } = await charger();
  const l = lienPartageWhatsApp("6 × Cahier & règle\nBlouse");
  assert.ok(l.startsWith("https://wa.me/?text="), "aucun numéro imposé : le parent choisit");
  assert.ok(l.includes("%0A"), "les retours à la ligne survivent");
  assert.ok(l.includes("%26"), "l'esperluette est encodée, sinon le texte est tronqué");
  assert.ok(!l.includes(" "), "aucune espace brute dans l'URL");
});
