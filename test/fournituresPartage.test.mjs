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
  assert.deepEqual(aAcheter(LISTE).map((f) => f.libelle), ["Cahier 96 pages", "Boîte de craies"]);
  assert.equal(aAcheter([]).length, 0);
  assert.equal(aAcheter().length, 0);
});

// --- Classement -----------------------------------------------------------

test("separerPrefixe : le tiret cadratin sépare, le trait d'union NON", async () => {
  const { separerPrefixe } = await charger();
  assert.deepEqual(separerPrefixe("Livres — BLED CM1/CM2"), { categorie: "Livres", libelle: "BLED CM1/CM2" });
  assert.deepEqual(separerPrefixe("Petit matériel — Taille-crayon avec réservoir"),
    { categorie: "Petit matériel", libelle: "Taille-crayon avec réservoir" });
  // Un trait d'union interne ne doit jamais être pris pour un séparateur.
  assert.deepEqual(separerPrefixe("Taille-crayon avec réservoir"),
    { categorie: null, libelle: "Taille-crayon avec réservoir" });
  assert.deepEqual(separerPrefixe("Règle plate 30 cm"), { categorie: null, libelle: "Règle plate 30 cm" });
  assert.deepEqual(separerPrefixe(null), { categorie: null, libelle: "" });
});

test("categoriser : le classement écrit par l'école prime sur la devinette", async () => {
  const { categoriser } = await charger();
  // « Gomme » serait devinée « Stylos & crayons » ; l'école l'a rangée
  // ailleurs, c'est elle qui décide.
  assert.equal(categoriser("Petit matériel — Gomme").label, "Petit matériel");
  assert.equal(categoriser("Gomme").label, "Stylos & crayons");
  // « Autres » et « Maison » : le premier est un fourre-tout, pas le second.
  assert.equal(categoriser("Autres — Gourde").id, "divers");
  assert.equal(categoriser("Maison — Trousse").label, "Maison");
});

test("categoriser : la devinette range les libellés sans préfixe", async () => {
  const { categoriser } = await charger();
  const cat = (l) => categoriser(l).label;
  assert.equal(cat("Cahier de dessin grand format"), "Cahiers");
  assert.equal(cat("Protège-cahiers (bleu, vert)"), "Cahiers", "accents et trait d'union");
  assert.equal(cat("Rame de papier A4"), "Cahiers");
  assert.equal(cat("Dictionnaire Larousse"), "Livres & manuels");
  assert.equal(cat("Manuels (Maths, Physique)"), "Livres & manuels");
  assert.equal(cat("Bic bleu"), "Stylos & crayons");
  assert.equal(cat("Boîte de crayons de couleur"), "Stylos & crayons");
  assert.equal(cat("Surligneur jaune"), "Stylos & crayons");
  // Le fourre-tout assumé.
  assert.equal(cat("Cartable"), "Divers");
  assert.equal(cat("Gourde"), "Divers");
  assert.equal(cat("Compas"), "Divers");
});

test("grouperFournitures : ordre demandé, Divers toujours en dernier", async () => {
  const { grouperFournitures } = await charger();
  const g = grouperFournitures([
    { libelle: "Cartable", quantite: 1 },
    { libelle: "Bic bleu", quantite: 4 },
    { libelle: "Dictionnaire Larousse", quantite: 1 },
    { libelle: "Cahier 96 pages", quantite: 6 },
  ]);
  assert.deepEqual(g.map((x) => x.label), ["Cahiers", "Livres & manuels", "Stylos & crayons", "Divers"]);
  assert.deepEqual(g[0].items.map((i) => i.libelle), ["Cahier 96 pages"]);
});

test("grouperFournitures : le préfixe est retiré des libellés affichés", async () => {
  const { grouperFournitures } = await charger();
  const g = grouperFournitures([
    { libelle: "Petit matériel — Gomme", quantite: 1 },
    { libelle: "Petit matériel — Stylos (2 bleus)", quantite: 1 },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, "Petit matériel");
  assert.deepEqual(g[0].items.map((i) => i.libelle), ["Gomme", "Stylos (2 bleus)"],
    "sinon chaque ligne répéterait « Petit matériel — » sous son propre titre");
});

// --- Message --------------------------------------------------------------

test("messageFournitures : groupé, avec quantités, notes et mention optionnel", async () => {
  const { messageFournitures, aAcheter } = await charger();
  const m = messageFournitures(aAcheter(LISTE), { enfant: "Awa Diop", classe: "CE1", ecole: "Tut'Tank" });

  assert.ok(m.startsWith("Fournitures à acheter — Awa Diop — CE1"), "l'en-tête dit de qui il s'agit");
  assert.ok(m.includes("*Cahiers*"), "les titres de groupe sont en gras WhatsApp");
  assert.ok(m.includes("• 6 × Cahier 96 pages — grands carreaux"), "quantité et note, utiles en magasin");
  assert.ok(m.includes("• Boîte de craies (optionnel)"), "une quantité de 1 ne s'écrit pas");
  assert.ok(m.includes("(Tut'Tank)"));
  assert.ok(!m.includes("Blouse"), "un article fourni par l'école ne doit JAMAIS figurer");
  assert.ok(!m.includes("Manuel de lecture"), "ni celui que la note dit disponible à l'école");
});

test("messageFournitures : un seul groupe → pas de titre inutile", async () => {
  const { messageFournitures } = await charger();
  const m = messageFournitures([
    { libelle: "Cahier 96 pages", quantite: 6, obligatoire: true },
    { libelle: "Cahier de dessin", quantite: 1, obligatoire: true },
  ]);
  assert.ok(!m.includes("*"), "un titre unique n'apprendrait rien");
  assert.ok(m.includes("• 6 × Cahier 96 pages"));
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

// --- Colonne `categorie` (migration 144) ----------------------------------

test("categoriser : la colonne saisie prime sur le préfixe ET sur la devinette", async () => {
  const { categoriser } = await charger();
  // L'école a rangé « Gomme » dans Petit matériel : la colonne fait foi.
  assert.equal(categoriser({ libelle: "Gomme", categorie: "Petit matériel" }).label, "Petit matériel");
  // Elle prime aussi sur un préfixe resté dans un libellé non rattrapé.
  assert.equal(categoriser({ libelle: "Livres — BLED", categorie: "Maison" }).label, "Maison");
  // « Autres » saisi en colonne est ramené au fourre-tout, comme en préfixe.
  assert.equal(categoriser({ libelle: "Gourde", categorie: "Autres" }).id, "divers");
  // Colonne vide ou blanche → on retombe sur le préfixe, puis la devinette.
  assert.equal(categoriser({ libelle: "Livres — BLED", categorie: "  " }).label, "Livres");
  assert.equal(categoriser({ libelle: "Cahier 96 pages", categorie: null }).label, "Cahiers");
});

test("grouperFournitures : la colonne et le préfixe cohabitent pendant la transition", async () => {
  const { grouperFournitures } = await charger();
  // Une école rattrapée par la 144 et une autre pas encore : les deux
  // doivent produire le même groupe.
  const g = grouperFournitures([
    { libelle: "Cahiers de 100 pages", categorie: "Cahiers", quantite: 3 },
    { libelle: "Cahiers — Cahiers de 50 pages", quantite: 2 },
  ]);
  assert.equal(g.length, 1, "même catégorie, un seul groupe");
  assert.deepEqual(g[0].items.map((i) => i.libelle), ["Cahiers de 100 pages", "Cahiers de 50 pages"]);
});
