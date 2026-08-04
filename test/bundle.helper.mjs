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
    'export { ESPACES, espacesAccessibles, espaceParDefaut, premiereRoute, routeOuvrable } from "@/lib/espaces.js";',
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
