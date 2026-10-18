// =====================================================================
//  Paramètres rangés par thème — les listes doivent se recouper
//
//  L'écran tient en trois listes écrites à la main : les SECTIONS (sommaire,
//  adresses), le `switch` qui affiche chacune, et les droits de
//  SECTIONS_PARAMETRES (permissions.js). Une section ajoutée au sommaire sans
//  son `case` s'ouvre sur un panneau vide ; une clé renommée d'un seul côté
//  la cache à tous les responsables, sauf au promoteur — qui ne verrait donc
//  jamais le défaut.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chargerPermissions } from "./bundle.helper.mjs";

// permissions.js importe via l'alias `@/` : on passe par le harnais commun.
const { peutVoirSection } = await chargerPermissions();

const SRC = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));
const page = fs.readFileSync(path.join(SRC, "pages/Parametres.jsx"), "utf8");
const bloc = page.match(/const SECTIONS = \[([\s\S]*?)\n\];/);
const sections = [...(bloc?.[1] || "").matchAll(/cle:\s*"([a-z_]+)",\s*slug:\s*"([a-z-]+)",\s*groupe:\s*"([^"]+)"/g)]
  .map(([, cle, slug, groupe]) => ({ cle, slug, groupe }));

// Sections dont la visibilité ne passe pas par `peutVoirSection` (cf. `visibles`).
const HORS_DROITS = { paiement: "réservée au rôle complet (estRoleComplet)" };

test("les huit sections sont lues dans la page", () => {
  assert.equal(sections.length, 8, `sections trouvées : ${sections.map((s) => s.cle).join(", ")}`);
});

test("chaque section a une adresse unique et un affichage", () => {
  const slugs = sections.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length, "deux sections partagent une adresse");
  for (const s of sections) {
    assert.match(page, new RegExp(`case "${s.cle}":\\s*return <`), `« ${s.cle} » : aucun case dans contenu()`);
  }
});

test("les thèmes sont ceux validés, dans l'ordre", () => {
  const ordre = [...new Set(sections.map((s) => s.groupe))];
  assert.deepEqual(ordre, ["Établissement", "Scolarité", "Finances", "Abonnement"]);
});

test("chaque section soumise aux droits a une entrée dans SECTIONS_PARAMETRES", () => {
  // Le promoteur voit tout ; un directeur doit voir au moins signataires et
  // notation. Une clé absente de SECTIONS_PARAMETRES rend `false` pour tout
  // rôle partiel : on vérifie qu'au moins UN rôle partiel peut la voir, sauf
  // pour les sections réservées au promoteur (liste vide, assumée).
  const reservees = ["etablissement", "modules", "matricule"];
  const partiels = ["direction", "comptable", "secretaire"];
  for (const s of sections) {
    if (HORS_DROITS[s.cle]) continue;
    assert.equal(peutVoirSection(["admin_ecole"], s.cle), true, `${s.cle} : invisible même au promoteur`);
    const ouverte = partiels.some((r) => peutVoirSection([r], s.cle));
    if (reservees.includes(s.cle)) assert.equal(ouverte, false, `${s.cle} : devrait rester réservée au promoteur`);
    else assert.equal(ouverte, true, `${s.cle} : aucun responsable ne peut la voir — clé absente de SECTIONS_PARAMETRES ?`);
  }
});

test("la route accepte une section dans l'adresse", () => {
  const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
  assert.match(app, /path="\/parametres\/:section\?"/);
});
