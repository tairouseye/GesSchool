// =====================================================================
//  Paramètres en sous-pages (/parametres/:rubrique)
//
//  La liste des rubriques est écrite en dur et recoupe trois choses qui
//  peuvent diverger : les droits par section (SECTIONS_PARAMETRES), les
//  composants de la page (une rubrique sans composant = écran blanc) et la
//  route. Cette épreuve les recoupe, et fige qui voit quoi.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUBRIQUES_PARAMETRES, GROUPES_PARAMETRES, rubriquesVisibles, grouperRubriques }
  from "../src/lib/parametresRubriques.js";
import { chargerPermissions } from "./bundle.helper.mjs";

const P = await chargerPermissions();
const SRC = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));
const lire = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

// Comme la page : droits réels de permissions.js, modules au choix.
const pour = (roles, modules = null) => rubriquesVisibles({
  voit: (s) => P.peutVoirSection(roles, s),
  estComplet: P.estRoleComplet(roles),
  moduleOk: (m) => P.moduleActif(modules, m),
}).map((r) => r.id);

test("identifiants uniques, groupe connu, utilisables dans une adresse", () => {
  const ids = RUBRIQUES_PARAMETRES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of RUBRIQUES_PARAMETRES) {
    assert.match(r.id, /^[a-z-]+$/, r.id);
    assert.ok(GROUPES_PARAMETRES.includes(r.groupe), `${r.id} : groupe ${r.groupe}`);
  }
});

test("chaque rubrique a son composant dans la page", () => {
  const page = lire("pages/Parametres.jsx");
  const bloc = page.slice(page.indexOf("const RUBRIQUES = {"), page.indexOf("return (", page.indexOf("const RUBRIQUES = {")));
  for (const r of RUBRIQUES_PARAMETRES) {
    assert.match(bloc, new RegExp(`(^|\\s|")${r.id}"?: \\(\\) =>`, "m"), `${r.id} : aucun composant`);
  }
});

test("la rubrique entre dans l'adresse", () => {
  assert.match(lire("App.jsx"), /path="\/parametres\/:rubrique\?"/);
});

test("le promoteur voit toutes les rubriques, dans l'ordre des groupes", () => {
  assert.deepEqual(pour(["admin_ecole"]), RUBRIQUES_PARAMETRES.map((r) => r.id));
  assert.deepEqual(grouperRubriques(RUBRIQUES_PARAMETRES).map((g) => g.groupe), GROUPES_PARAMETRES);
});

test("chaque responsable ne voit que son domaine", () => {
  assert.deepEqual(pour(["direction"]), ["structure", "notation", "signataires"]);
  assert.deepEqual(pour(["comptable"]), ["champs-eleve", "relances"]);
  assert.deepEqual(pour(["secretaire"]), ["champs-eleve"]);
  assert.deepEqual(pour(["enseignant"]), []);
});

test("les relances suivent le module Recouvrement", () => {
  assert.deepEqual(pour(["comptable"], ["eleves"]), ["champs-eleve"]);
  assert.ok(!pour(["admin_ecole"], ["eleves"]).includes("relances"));
});

test("paiement en ligne et modules : promoteur seul, quels que soient les rôles cumulés", () => {
  const tous = ["direction", "comptable", "rh", "secretaire", "enseignant", "surveillant"];
  const vus = pour(tous);
  assert.ok(!vus.includes("paiement-en-ligne"));
  assert.ok(!vus.includes("modules"));
  // Les trois rubriques de l'ancienne fiche « Établissement » non plus.
  for (const id of ["identite", "couverture", "apparence", "matricule"]) assert.ok(!vus.includes(id), id);
});

test("le menu général reconnaît les sous-pages", () => {
  assert.ok(P.routeCouvre("/parametres", "/parametres"));
  assert.ok(P.routeCouvre("/parametres", "/parametres/notation"));
  assert.ok(!P.routeCouvre("/parametres", "/parametresX"));
  assert.ok(P.routeCouvre("/", "/"));
  assert.ok(!P.routeCouvre("/", "/eleves"));
  // Sans quoi l'espace courant ne suivait pas une adresse /parametres/xxx ouverte directement.
  assert.ok(P.espacesDeRoute("/parametres/notation").length > 0);
});
