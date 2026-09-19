// Harnais de test — bundle les modules « purs » de src/lib (qui utilisent
// l'alias @/) en un module ESM importable par node:test, SANS dépendance
// supplémentaire (esbuild est déjà là, tiré par Vite).
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");

let cache = null;

// Bundle permissions + modules + formules + espaces et renvoie l'espace de noms.
export async function chargerPermissions() {
  if (cache) return cache;
  // Tout est écrit dans un dossier temporaire (jamais dans test/, sinon le
  // fichier d'entrée serait ramassé comme un test).
  const dir = mkdtempSync(join(tmpdir(), "gesschool-test-"));
  const entree = join(dir, "__entry.mjs");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(entree, [
    'export * from "@/lib/permissions.js";',
    'export * from "@/lib/modules.js";',
    'export * from "@/lib/formules.js";',
    'export { ESPACES, espacesAccessibles, espaceParDefaut, espaceParId, premiereRoute, routeOuvrable, itemPourType, grouperItems, normaliserType } from "@/lib/espaces.js";',
  ].join("\n"));
  const sortie = join(dir, "bundle.mjs");
  await build({
    entryPoints: [entree],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: sortie,
    alias: { "@": join(RACINE, "src") },
    logLevel: "error",
  });
  cache = await import(pathToFileURL(sortie).href);
  return cache;
}

// Bundle générique d'un ou plusieurs modules src/lib (réexports) → namespace.
const _cacheGen = new Map();
export async function chargerLib(cle, exportsLignes) {
  if (_cacheGen.has(cle)) return _cacheGen.get(cle);
  const dir = mkdtempSync(join(tmpdir(), `gesschool-${cle}-`));
  const entree = join(dir, "__entry.mjs");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(entree, exportsLignes.join("\n"));
  const sortie = join(dir, "bundle.mjs");
  await build({
    entryPoints: [entree], bundle: true, format: "esm", platform: "node",
    outfile: sortie, alias: { "@": join(RACINE, "src") }, logLevel: "error",
    // Shim des variables Vite (certains modules importent supabase.js qui lit
    // import.meta.env au chargement) — valeurs factices, aucun appel réseau ici.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://placeholder.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("placeholder-anon-key"),
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
    },
  });
  const ns = await import(pathToFileURL(sortie).href);
  _cacheGen.set(cle, ns);
  return ns;
}
export const chargerTarif = () => chargerLib("tarif", ['export * from "@/lib/tarification.js";']);
export const chargerEDT = () => chargerLib("edt", ['export * from "@/lib/generateurEDT.js";']);

let cachePaie = null;

// Bundle le moteur de paie pur (paie.js + bareme.js) — sans Supabase.
export async function chargerPaie() {
  if (cachePaie) return cachePaie;
  const dir = mkdtempSync(join(tmpdir(), "gesschool-paie-"));
  const entree = join(dir, "__entry.mjs");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(entree, [
    'export * from "@/lib/paie.js";',
    'export * from "@/lib/bareme.js";',
  ].join("\n"));
  const sortie = join(dir, "bundle.mjs");
  await build({
    entryPoints: [entree], bundle: true, format: "esm", platform: "node",
    outfile: sortie, alias: { "@": join(RACINE, "src") }, logLevel: "error",
  });
  cachePaie = await import(pathToFileURL(sortie).href);
  return cachePaie;
}
