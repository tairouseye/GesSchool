// Analyse d'un import de notices (logique pure, sans BD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const I = await chargerLib("bibimport", ['export * from "@/lib/biblio.import.js";']);

test("devinerMapping : reconnaît les en-têtes courants, FR et EN", () => {
  const m = I.devinerMapping(["Titre", "Auteur", "Éditeur", "Année", "ISBN", "Nb exemplaires"]);
  assert.equal(m.titre, "Titre");
  assert.equal(m.auteur_libre, "Auteur");
  assert.equal(m.editeur, "Éditeur");
  assert.equal(m.annee_pub, "Année");
  assert.equal(m.isbn, "ISBN");
  assert.equal(m.quantite, "Nb exemplaires");

  const en = I.devinerMapping(["title", "author", "publisher", "year", "keywords"]);
  assert.equal(en.titre, "title");
  assert.equal(en.auteur_libre, "author");
  assert.equal(en.mots_cles, "keywords");
});

test("devinerMapping : colonne absente = chaîne vide, jamais undefined", () => {
  const m = I.devinerMapping(["Titre"]);
  assert.equal(m.titre, "Titre");
  assert.equal(m.editeur, "");
});

test("normaliserIsbn : comparable malgré tirets, espaces et casse", () => {
  assert.equal(I.normaliserIsbn("978-2-07-036822-8"), "9782070368228");
  assert.equal(I.normaliserIsbn(" 2 07 036822 x "), "207036822X"); // clé de contrôle ISBN-10
  assert.equal(I.normaliserIsbn(""), null);
  assert.equal(I.normaliserIsbn(null), null);
});

test("normaliserAnnee : extrait l'année, refuse l'absurde", () => {
  assert.equal(I.normaliserAnnee("2019"), 2019);
  assert.equal(I.normaliserAnnee("c2019"), 2019);
  assert.equal(I.normaliserAnnee("2019-2020"), 2019);
  assert.equal(I.normaliserAnnee("15/03/1998"), 1998);
  assert.equal(I.normaliserAnnee("inconnue"), null);
  assert.equal(I.normaliserAnnee(""), null);
  // Une année très future est une faute de frappe, pas une donnée.
  assert.equal(I.normaliserAnnee("2999"), null);
});

test("normaliserQuantite : entier positif borné", () => {
  assert.equal(I.normaliserQuantite("3"), 3);
  assert.equal(I.normaliserQuantite(" 12 "), 12);
  assert.equal(I.normaliserQuantite("2,7"), 2);
  assert.equal(I.normaliserQuantite(""), 0);
  assert.equal(I.normaliserQuantite("abc"), 0);
  assert.equal(I.normaliserQuantite("-5"), 0);
  // Garde-fou : une ligne ne doit pas créer des milliers d'exemplaires.
  assert.equal(I.normaliserQuantite("99999"), 500);
});

test("normaliserType : synonymes tolérés, repli sur « livre »", () => {
  assert.equal(I.normaliserType("Ouvrage"), "livre");
  assert.equal(I.normaliserType("PÉRIODIQUE"), "revue");
  assert.equal(I.normaliserType("Thèse"), "these");
  assert.equal(I.normaliserType("n'importe quoi"), "livre");
  assert.equal(I.normaliserType(""), "livre");
});

test("normaliserMotsCles : virgule, point-virgule ou barre", () => {
  assert.deepEqual(I.normaliserMotsCles("droit, fiscalité ; OHADA|UEMOA"),
    ["droit", "fiscalité", "OHADA", "UEMOA"]);
  assert.deepEqual(I.normaliserMotsCles(""), []);
  assert.deepEqual(I.normaliserMotsCles("  ,  ,"), []);
});

test("decouperAuteurs : « Nom, Prénom » et séparateurs multiples", () => {
  assert.deepEqual(I.decouperAuteurs("Diop, Mamadou"), [{ nom: "Diop", prenom: "Mamadou" }]);
  assert.deepEqual(I.decouperAuteurs("Senghor ; Césaire"),
    [{ nom: "Senghor", prenom: null }, { nom: "Césaire", prenom: null }]);
  assert.deepEqual(I.decouperAuteurs("Kane / Fall"),
    [{ nom: "Kane", prenom: null }, { nom: "Fall", prenom: null }]);
  // Trop de virgules = ambigu : on préfère garder le nom complet plutôt
  // que d'inventer un découpage faux.
  assert.deepEqual(I.decouperAuteurs("Diop, Fall, Sow"), [{ nom: "Diop, Fall, Sow", prenom: null }]);
  assert.deepEqual(I.decouperAuteurs(""), []);
});

test("cleAuteur : insensible à la casse et aux accents", () => {
  assert.equal(I.cleAuteur({ nom: "Césaire", prenom: "Aimé" }), I.cleAuteur({ nom: "CESAIRE", prenom: "aime" }));
  assert.notEqual(I.cleAuteur({ nom: "Diop", prenom: "A" }), I.cleAuteur({ nom: "Diop", prenom: "B" }));
});

const MAPPING = { titre: "Titre", auteur_libre: "Auteur", isbn: "ISBN", annee_pub: "Annee", quantite: "Qte" };

test("analyser : écarte les lignes sans titre", () => {
  const r = I.analyser([
    { Titre: "Le Petit Prince", Auteur: "Saint-Exupéry", ISBN: "", Annee: "1943", Qte: "2" },
    { Titre: "   ", Auteur: "X", ISBN: "", Annee: "", Qte: "" },
  ], MAPPING);
  assert.equal(r.valides.length, 1);
  assert.equal(r.rejets.length, 1);
  // Numéro de ligne tel qu'il apparaît dans le tableur (en-tête = ligne 1).
  assert.equal(r.rejets[0].ligne, 3);
  assert.equal(r.valides[0].quantite, 2);
});

test("analyser : dédoublonne les ISBN À L'INTÉRIEUR du fichier, garde le premier", () => {
  const r = I.analyser([
    { Titre: "A", Auteur: "", ISBN: "978-2-07-036822-8", Annee: "", Qte: "" },
    { Titre: "B", Auteur: "", ISBN: "9782070368228", Annee: "", Qte: "" }, // même ISBN, écrit autrement
    { Titre: "C", Auteur: "", ISBN: "", Annee: "", Qte: "" },
    { Titre: "D", Auteur: "", ISBN: "", Annee: "", Qte: "" },
  ], MAPPING);
  assert.equal(r.valides.length, 3);              // A, C, D
  assert.equal(r.valides[0].titre, "A");
  assert.equal(r.doublons.length, 1);
  assert.equal(r.doublons[0].premiere, 2);
  // Deux lignes sans ISBN ne sont PAS des doublons : rien ne permet de l'affirmer.
  assert.deepEqual(r.valides.map((n) => n.titre), ["A", "C", "D"]);
});

test("analyser : total reflète le fichier, pas le résultat", () => {
  const r = I.analyser([{ Titre: "A" }, { Titre: "" }], MAPPING);
  assert.equal(r.total, 2);
  assert.equal(r.valides.length + r.rejets.length + r.doublons.length, 2);
});

test("analyser : fichier vide ou mapping incomplet ne jette pas", () => {
  assert.deepEqual(I.analyser([], {}).valides, []);
  const r = I.analyser([{ Autre: "x" }], {});
  assert.equal(r.valides.length, 0);
  assert.equal(r.rejets.length, 1);
});

test("enLots : découpe sans perdre ni dupliquer", () => {
  const l = Array.from({ length: 450 }, (_, i) => i);
  const lots = I.enLots(l, 200);
  assert.equal(lots.length, 3);
  assert.deepEqual(lots.map((x) => x.length), [200, 200, 50]);
  assert.deepEqual(lots.flat(), l);
  assert.deepEqual(I.enLots([], 200), []);
  // Une taille absurde ne doit pas produire de boucle infinie.
  assert.equal(I.enLots([1, 2, 3], 0).length, 1);
});
