// =====================================================================
//  Garde-fou : aucun identifiant utilisé sans être déclaré ni importé
//
//  Né d'un défaut livré le 28/09/2026 : `Annonces.jsx` appelait
//  `getNiveaux(ecoleId)` sans l'importer. `vite build` a réussi, les 111
//  tests sont passés — et la page a explosé à l'ouverture sur
//  « Can't find variable: getNiveaux ».
//
//  ⚠️ C'EST LE POINT AVEUGLE DE NOTRE CHAÎNE : un empaqueteur ne résout
//  que les IMPORTS. Un identifiant libre est, pour lui, une variable
//  globale parfaitement licite ; l'erreur n'apparaît qu'à l'exécution, sur
//  la page concernée, chez l'utilisateur. Aucun de nos tests n'ouvre les
//  pages — ce test comble donc un trou que ni le build ni la suite ne
//  voient, et il le fait sur TOUTE l'arborescence d'un coup.
//
//  On ne cherche pas les erreurs de portée (un vrai linter le ferait) mais
//  les noms JAMAIS déclarés dans le fichier : c'est exactement la classe de
//  défaut ci-dessus, et elle se détecte sans faux positif.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import esbuild from "esbuild";

const RACINE = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));
const CONFIG_VITE = path.resolve(fileURLToPath(new URL("../vite.config.js", import.meta.url)));

// Les constantes injectées au build sont lues dans la configuration, pas
// codées ici : une liste en dur mentirait dès qu'on en ajouterait une.
function constantesInjectees() {
  const src = fs.readFileSync(CONFIG_VITE, "utf8");
  const bloc = src.match(/define:\s*\{([\s\S]*?)\n\s*\}/);
  if (!bloc) return [];
  return [...bloc[1].matchAll(/(__[A-Z0-9_]+__)\s*:/g)].map((m) => m[1]);
}

// Globals de la plate-forme et intrinsèques ECMAScript. Volontairement
// restreinte : une liste trop large masquerait le défaut qu'on traque.
const GLOBAUX = new Set([
  "window", "document", "navigator", "location", "history", "screen",
  "console", "fetch", "Headers", "Request", "Response", "FormData", "Blob", "File",
  "URL", "URLSearchParams", "crypto", "atob", "btoa", "structuredClone",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
  "localStorage", "sessionStorage", "indexedDB", "caches", "Notification",
  "alert", "confirm", "prompt", "matchMedia", "getComputedStyle",
  "Image", "Audio", "Event", "CustomEvent", "AbortController", "AbortSignal",
  "IntersectionObserver", "ResizeObserver", "MutationObserver", "performance",
  "TextEncoder", "TextDecoder", "ReadableStream", "WebSocket", "Worker",
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt",
  "Math", "JSON", "Date", "RegExp", "Error", "TypeError", "RangeError",
  "SyntaxError", "ReferenceError", "Promise", "Map", "Set", "WeakMap", "WeakSet",
  "Proxy", "Reflect", "Intl", "globalThis", "NaN", "Infinity", "undefined",
  "parseInt", "parseFloat", "isNaN", "isFinite", "Function", "ArrayBuffer",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  "Uint8Array", "Int8Array", "Uint16Array", "Uint32Array", "Float32Array",
  "Float64Array", "DataView", "arguments", "process",
  ...constantesInjectees(),
]);

function fichiersSource(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersSource(p));
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

function nomsDeMotif(p, out) {
  if (!p) return;
  switch (p.type) {
    case "Identifier": out.add(p.name); return;
    case "ObjectPattern":
      for (const x of p.properties) {
        if (x.type === "RestElement") nomsDeMotif(x.argument, out);
        else nomsDeMotif(x.value, out);
      }
      return;
    case "ArrayPattern": for (const x of p.elements) nomsDeMotif(x, out); return;
    case "AssignmentPattern": nomsDeMotif(p.left, out); return;
    case "RestElement": nomsDeMotif(p.argument, out); return;
  }
}

function analyser(ast) {
  const declares = new Set();
  const utilises = new Map();               // nom → première ligne

  const visiter = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { for (const x of n) visiter(x); return; }
    if (typeof n.type !== "string") return;

    switch (n.type) {
      case "ImportDefaultSpecifier": case "ImportNamespaceSpecifier": case "ImportSpecifier":
        declares.add(n.local.name); return;
      case "ImportDeclaration": case "ExportAllDeclaration":
        visiter(n.specifiers); return;                 // `source` est un littéral
      case "ExportSpecifier":
        visiter(n.local); return;                      // `exported` est un nom, pas une référence
      case "MetaProperty": return;                     // import.meta
      case "VariableDeclarator":
        nomsDeMotif(n.id, declares); visiter(n.init); return;
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression":
        if (n.id) declares.add(n.id.name);
        for (const p of n.params) nomsDeMotif(p, declares);
        visiter(n.body); return;
      case "ClassDeclaration": case "ClassExpression":
        if (n.id) declares.add(n.id.name);
        visiter(n.superClass); visiter(n.body); return;
      case "CatchClause":
        if (n.param) nomsDeMotif(n.param, declares);
        visiter(n.body); return;
      case "LabeledStatement":
        declares.add(n.label.name); visiter(n.body); return;
      case "BreakStatement": case "ContinueStatement": return;
      case "MemberExpression":
        visiter(n.object);
        if (n.computed) visiter(n.property);
        return;
      case "Property":
        if (n.computed) visiter(n.key);
        visiter(n.value); return;
      case "MethodDefinition": case "PropertyDefinition":
        if (n.computed) visiter(n.key);
        visiter(n.value); return;
      case "Identifier":
        if (!utilises.has(n.name)) utilises.set(n.name, n.loc?.start.line);
        return;
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "range") continue;
      visiter(n[k]);
    }
  };
  visiter(ast);
  return { declares, utilises };
}

// Rend la liste des identifiants libres d'une source. Exportable de fait :
// le test de garde plus bas s'en sert pour vérifier qu'il détecte vraiment.
function identifiantsLibres(source, loader) {
  const js = esbuild.transformSync(source, {
    loader, format: "esm", target: "esnext", jsx: "automatic",
  }).code;
  const ast = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const { declares, utilises } = analyser(ast);
  const libres = [];
  for (const [nom, ligne] of utilises) {
    if (!declares.has(nom) && !GLOBAUX.has(nom)) libres.push({ nom, ligne });
  }
  return libres;
}

test("aucun identifiant utilisé sans être déclaré ni importé", () => {
  const trouves = [];
  for (const f of fichiersSource(RACINE)) {
    const source = fs.readFileSync(f, "utf8");
    const loader = f.endsWith(".jsx") ? "jsx" : "js";
    let libres;
    try { libres = identifiantsLibres(source, loader); }
    catch (e) { assert.fail(`${path.relative(RACINE, f)} illisible : ${e.message}`); }
    for (const { nom, ligne } of libres) {
      trouves.push(`src/${path.relative(RACINE, f).replace(/\\/g, "/")}:${ligne} — ${nom}`);
    }
  }
  assert.deepEqual(trouves, [],
    `Identifiant(s) utilisé(s) sans déclaration ni import — la page explosera à l'ouverture :\n  ${trouves.join("\n  ")}`);
});

// Un garde-fou qui ne détecte rien est pire qu'aucun garde-fou : il rassure.
// On rejoue donc le défaut d'origine, en miniature.
test("le garde-fou détecte bien le défaut qu'il traque", () => {
  const fautif = `
    import { getClasses } from "@/lib/academique.js";
    export default function Page({ ecoleId }) {
      const a = getClasses(ecoleId);
      const b = getNiveaux(ecoleId);      // jamais importé
      return <div>{a}{b}</div>;
    }`;
  const libres = identifiantsLibres(fautif, "jsx").map((x) => x.nom);
  assert.deepEqual(libres, ["getNiveaux"]);

  const corrige = fautif.replace('{ getClasses }', '{ getClasses, getNiveaux }');
  assert.deepEqual(identifiantsLibres(corrige, "jsx"), []);
});
