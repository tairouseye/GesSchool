// =====================================================================
//  Navigation entre rubriques (parent, étudiant)
//
//  La barre de rubriques et les liens « Voir » des alertes reposent sur des
//  correspondances écrites en dur : rubrique étudiante → route, catégorie
//  d'alerte → rubrique de l'enfant. Une route renommée, une tuile retirée,
//  et le lien mène à une page blanche ou retombe en silence sur la grille.
//  Cette épreuve recoupe les listes entre elles.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUBRIQUES_ETUDIANT, rubriqueEtudiantActive } from "../src/lib/etudiantRubriques.js";

const SRC = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));
const lire = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

test("chaque rubrique étudiante correspond à une route de l'espace étudiant", () => {
  const app = lire("App.jsx");
  const bloc = app.slice(app.indexOf('path="/etudiant"'));
  for (const r of RUBRIQUES_ETUDIANT) {
    const segment = r.to.replace("/etudiant/", "");
    assert.match(bloc, new RegExp(`path="${segment}"`), `${r.label} (${r.to}) : aucune route`);
  }
});

test("la rubrique active se lit dans l'adresse, sous-pages comprises", () => {
  assert.equal(rubriqueEtudiantActive("/etudiant/notes"), "notes");
  assert.equal(rubriqueEtudiantActive("/etudiant/notes/releve/2026"), "notes");
  assert.equal(rubriqueEtudiantActive("/etudiant/notifications"), null);
  assert.equal(rubriqueEtudiantActive("/etudiant"), null);
  // Un préfixe commun ne suffit pas : /etudiant/documentsXYZ n'est pas « documents ».
  assert.equal(rubriqueEtudiantActive("/etudiant/documentsXYZ"), null);
});

test("la fiche enfant accepte une rubrique dans l'adresse", () => {
  assert.match(lire("App.jsx"), /path="enfant\/:id\/:rubrique\?"/);
});

test("chaque alerte « Voir » mène à une rubrique qui existe sur la fiche enfant", () => {
  const tuiles = [...lire("pages/ParentEnfant.jsx").matchAll(/\{\s*cle:\s*"([a-z_]+)",\s*label:/g)].map((m) => m[1]);
  assert.ok(tuiles.length >= 10, `rubriques de la fiche enfant introuvables (${tuiles.length})`);
  const bloc = lire("pages/ParentNotifications.jsx").match(/RUBRIQUE_DE\s*=\s*\{([^}]*)\}/);
  assert.ok(bloc, "table RUBRIQUE_DE introuvable");
  const cibles = [...bloc[1].matchAll(/:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(cibles.length > 0);
  for (const c of cibles) assert.ok(tuiles.includes(c), `l'alerte mène à « ${c} », absente de la fiche enfant`);
});
