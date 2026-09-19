// Correspondance des réponses Open Library / Crossref (pur, sans réseau).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const E = await chargerLib("bibenr", ['export * from "@/lib/biblio.enrichissement.js";']);

test("normaliserDoi : extrait le DOI d'une URL ou d'un copier-coller", () => {
  assert.equal(E.normaliserDoi("10.1016/j.cell.2019.03.001"), "10.1016/j.cell.2019.03.001");
  assert.equal(E.normaliserDoi("https://doi.org/10.1016/j.cell.2019.03.001"), "10.1016/j.cell.2019.03.001");
  assert.equal(E.normaliserDoi("doi:10.1038/nature12373"), "10.1038/nature12373");
  // Ponctuation de fin de phrase collée au DOI.
  assert.equal(E.normaliserDoi("voir 10.1038/nature12373."), "10.1038/nature12373");
  assert.equal(E.normaliserDoi("9782070368228"), null); // un ISBN n'est pas un DOI
  assert.equal(E.normaliserDoi(""), null);
});

test("auteurDepuisNom : ne sépare que devant une virgule explicite", () => {
  assert.deepEqual(E.auteurDepuisNom("Diop, Mamadou"), { nom: "Diop", prenom: "Mamadou" });
  // Couper au dernier espace donnerait « de Saint / Exupéry » : on s'abstient.
  assert.deepEqual(E.auteurDepuisNom("Antoine de Saint-Exupéry"),
    { nom: "Antoine de Saint-Exupéry", prenom: null });
  assert.equal(E.auteurDepuisNom("   "), null);
  assert.equal(E.auteurDepuisNom(null), null);
});

test("mapperOpenLibrary : retient titre, éditeur, année et auteurs", () => {
  const rep = {
    "ISBN:9782070368228": {
      title: "Le Petit Prince",
      subtitle: "avec les aquarelles de l'auteur",
      authors: [{ name: "Antoine de Saint-Exupéry" }],
      publishers: [{ name: "Gallimard" }],
      publish_date: "March 1943",
      subjects: Array.from({ length: 20 }, (_, i) => ({ name: `sujet${i}` })),
    },
  };
  const m = E.mapperOpenLibrary(rep, "978-2-07-036822-8");
  assert.equal(m.titre, "Le Petit Prince");
  assert.equal(m.sous_titre, "avec les aquarelles de l'auteur");
  assert.equal(m.editeur, "Gallimard");
  assert.equal(m.annee_pub, 1943);            // extraite de « March 1943 »
  assert.deepEqual(m.auteurs, [{ nom: "Antoine de Saint-Exupéry", prenom: null }]);
  assert.equal(m.mots_cles.length, 8);        // borné : pas 20 mots-clés sur la notice
  assert.equal(m.source, "Open Library");
});

test("mapperOpenLibrary : la clé est retrouvée même si l'ISBN est écrit autrement", () => {
  const rep = { "ISBN:9782070368228": { title: "T" } };
  assert.equal(E.mapperOpenLibrary(rep, "978-2-07-036822-8").titre, "T");
});

test("mapperOpenLibrary : réponse vide = null, pas une exception", () => {
  assert.equal(E.mapperOpenLibrary({}, "9782070368228"), null);
  assert.equal(E.mapperOpenLibrary(null, "x"), null);
});

test("mapperCrossref : auteurs given/family et métadonnées d'article", () => {
  const rep = {
    message: {
      title: ["A study of something"],
      author: [{ given: "Awa", family: "Ndiaye" }, { given: "P.", family: "Martin" }],
      publisher: "Elsevier",
      issued: { "date-parts": [[2019, 5, 1]] },
      "container-title": ["Journal of Things"],
      volume: "12", issue: "3", page: "45-58",
      DOI: "10.1016/j.cell.2019.03.001",
      subject: ["Biology", "Genetics"],
    },
  };
  const m = E.mapperCrossref(rep);
  assert.equal(m.titre, "A study of something");
  assert.deepEqual(m.auteurs, [{ nom: "Ndiaye", prenom: "Awa" }, { nom: "Martin", prenom: "P." }]);
  assert.equal(m.annee_pub, 2019);
  assert.equal(m.revue, "Journal of Things");
  assert.equal(m.pages, "45-58");
  assert.equal(m.doi, "10.1016/j.cell.2019.03.001");
  assert.equal(m.source, "Crossref");
});

test("mapperCrossref : entrée sans auteur nommé ni date ne casse pas", () => {
  const m = E.mapperCrossref({ message: { title: ["Rapport annuel"], author: [{ name: "OMS" }] } });
  assert.equal(m.titre, "Rapport annuel");
  assert.equal(m.annee_pub, null);
  assert.deepEqual(m.auteurs, [{ nom: "OMS", prenom: null }]);
  assert.equal(m.revue, null);
});

test("mapperCrossref : message absent = null", () => {
  assert.equal(E.mapperCrossref({}), null);
  assert.equal(E.mapperCrossref(null), null);
});
