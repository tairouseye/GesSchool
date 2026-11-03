// =====================================================================
//  L'aide contextuelle (bouton « ? » de chaque écran) mène-t-elle quelque
//  part ? — garde-fou du lot 1 de l'audit de prise en main (03/11/2026).
//
//  Une ancre suit le titre d'une section du manuel : renommer un titre la
//  casse en silence, et le « ? » ouvrirait le manuel au début. Et un écran
//  neuf sans entrée n'aurait pas de « ? » du tout.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AIDE_PAGES, sectionAide } from "../src/lib/aidePages.js";

const RACINE = process.cwd();
const html = fs.readFileSync(path.join(RACINE, "public", "mode-emploi.html"), "utf8");
const espaces = fs.readFileSync(path.join(RACINE, "src", "lib", "espaces.js"), "utf8");
const ancres = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test("🔴 chaque ancre d'aide existe dans le mode d'emploi publié", () => {
  const cassees = Object.entries(AIDE_PAGES).filter(([, a]) => !ancres.has(a)).map(([r, a]) => `${r} → #${a}`);
  assert.deepEqual(cassees, [], "ancre(s) absente(s) de public/mode-emploi.html : un titre du manuel a changé ? "
    + "Corrigez src/lib/aidePages.js (et régénérez le manuel avec « node docs/md2html.mjs »)");
});

test("🔴 chaque écran du menu a sa section d'aide", () => {
  const routes = [...new Set([...espaces.matchAll(/\{\s*to:\s*"([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(routes.length > 40, `extraction douteuse : ${routes.length} routes`);
  const sans = routes.filter((r) => !sectionAide(r));
  assert.deepEqual(sans, [], "écran(s) sans aide : ajoutez-les à src/lib/aidePages.js");
});

test("la route la plus précise l'emporte", () => {
  assert.equal(sectionAide("/parametres/structure"), AIDE_PAGES["/parametres/structure"]);
  assert.equal(sectionAide("/parametres/identite"), AIDE_PAGES["/parametres"]);
  assert.equal(sectionAide("/eleves/123"), AIDE_PAGES["/eleves"]);
  assert.equal(sectionAide("/inconnue"), null);
});
