// =====================================================================
//  Contraste du texte — WCAG AA, 4,5:1
//
//  🔴 POURQUOI CETTE ÉPREUVE EXISTE.
//  L'audit d'ergonomie d'octobre 2026 a mesuré plus de 1 800 textes
//  secondaires entre 1,9:1 et 3,3:1 (`text-navy-900/40`, `/50`…), un doré
//  `text-or-600` à 3,5:1, et des rouges/verts/orangés de la palette
//  Tailwind sous le seuil. Lisibles sur un écran de bureau, illisibles au
//  soleil ou pour une vue faible — exactement le public parent.
//
//  La correction est automatique (plancher d'opacité dans
//  tailwind.config.js, doré calculé dans src/lib/theme.js). Cette épreuve
//  verrouille les deux, et refuse qu'une classe de texte trop pâle entre
//  dans le code : elle part en production sinon, rien d'autre ne la voit.
//
//  ⚠️ CE QU'ELLE NE SAIT PAS FAIRE : connaître le fond réel d'un texte.
//  Elle suppose un fond clair (crème, le plus défavorable des fonds clairs
//  usuels), sauf pour les couleurs réservées au fond navy, listées dans
//  SUR_FOND_NAVY avec leur raison. Un `text-or-500` posé sur fond clair lui
//  échappe donc : c'est la règle d'usage écrite dans theme.js.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import config, { PLANCHER_TEXTE } from "../tailwind.config.js";
import { ratioContraste, melanger, BLANC, CREME, NAVY } from "../src/lib/contraste.js";
import { nuancesAccent, accentPeuVisible, COULEUR_DEFAUT, CIBLE_TEXTE } from "../src/lib/theme.js";

const require = createRequire(import.meta.url);
const PALETTE = require("tailwindcss/colors");
const RACINE = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));
const SEUIL = 4.5;

const hexEnRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const NAVY_SUR_CREME = melanger(NAVY[900], CREME, 0.05); // bg-navy-900/5 sur crème : le fond clair le plus sombre
const FONDS_CLAIRS = { blanc: BLANC, crème: CREME, "navy/5 sur crème": NAVY_SUR_CREME };

test("plancher navy : le texte le plus pâle tient 4,5:1 sur tous les fonds clairs", () => {
  for (const [nom, fond] of Object.entries(FONDS_CLAIRS)) {
    const r = ratioContraste(melanger(NAVY[900], fond, PLANCHER_TEXTE.navy), fond);
    assert.ok(r >= SEUIL, `navy à ${PLANCHER_TEXTE.navy} sur ${nom} : ${r.toFixed(2)}:1`);
  }
});

test("plancher crème : le texte le plus pâle tient 4,5:1 sur tous les navy", () => {
  for (const [nuance, fond] of Object.entries(NAVY)) {
    const r = ratioContraste(melanger(CREME, fond, PLANCHER_TEXTE.creme), fond);
    assert.ok(r >= SEUIL, `crème à ${PLANCHER_TEXTE.creme} sur navy-${nuance} : ${r.toFixed(2)}:1`);
  }
});

test("le plancher est bien appliqué par la configuration, et seulement en dessous", () => {
  const navy = config.theme.extend.textColor.navy[900];
  const creme = config.theme.extend.textColor.creme;
  assert.equal(navy({ opacityValue: "0.4" }), `rgb(11 31 58 / ${PLANCHER_TEXTE.navy})`);
  assert.equal(navy({ opacityValue: "0.8" }), "rgb(11 31 58 / 0.8)", "au-dessus du plancher, rien ne change");
  assert.equal(creme({ opacityValue: "0.3" }), `rgb(247 245 239 / ${PLANCHER_TEXTE.creme})`);
  // Sans modificateur, Tailwind passe une variable CSS : elle doit traverser intacte.
  assert.equal(navy({ opacityValue: "var(--tw-text-opacity)" }), "rgb(11 31 58 / var(--tw-text-opacity))");
  // Les fonds ne passent pas par textColor : `bg-navy-900/5` reste pâle.
  assert.equal(config.theme.extend.colors.navy[900], "#0B1F3A");
});

// Couleurs qu'une école pourrait choisir, y compris les pires pour du texte.
const COULEURS_ECOLE = [COULEUR_DEFAUT, "#FFFF00", "#FFFFFF", "#F9A8D4", "#FDE68A", "#A7F3D0", "#22D3EE",
  "#F97316", "#E11D48", "#16A34A", "#1D4ED8", "#7C3AED", "#000000", "#808080"];

test("doré : or-600 et or-700 sont lisibles sur fond clair, quelle que soit la couleur de l'école", () => {
  for (const hex of COULEURS_ECOLE) {
    const n = nuancesAccent(hex);
    const fonds = { ...FONDS_CLAIRS, "pastille or-500/15 sur crème": melanger(n[500], CREME, 0.15) };
    for (const k of [600, 700]) {
      for (const [nom, fond] of Object.entries(fonds)) {
        const r = ratioContraste(n[k], fond);
        assert.ok(r >= SEUIL, `${hex} → or-${k} sur ${nom} : ${r.toFixed(2)}:1`);
      }
    }
    assert.ok(ratioContraste(n[700], CREME) >= ratioContraste(n[600], CREME), `${hex} : or-700 doit être au moins aussi foncé que or-600`);
  }
  assert.ok(CIBLE_TEXTE >= SEUIL);
});

test("doré : l'avertissement de Paramètres repère les accents invisibles sur le navy", () => {
  assert.equal(accentPeuVisible(COULEUR_DEFAUT), false);
  assert.equal(accentPeuVisible("#000000"), true);
  assert.equal(accentPeuVisible("#1D4ED8"), true);
  assert.equal(accentPeuVisible("#FFFF00"), false);
});

test("index.css porte exactement les nuances calculées pour le doré d'origine", () => {
  // Sinon une école SANS couleur garde les anciennes valeurs, illisibles :
  // `appliquerAccent` n'est appelé qu'une fois l'école chargée.
  const css = fs.readFileSync(path.join(RACINE, "index.css"), "utf8");
  for (const [k, rgb] of Object.entries(nuancesAccent(COULEUR_DEFAUT))) {
    const m = css.match(new RegExp(`--or-${k}:\\s*([0-9 ]+);`));
    assert.ok(m, `--or-${k} absent de index.css`);
    assert.equal(m[1].trim(), rgb.join(" "), `--or-${k} : index.css diverge du calcul de theme.js`);
  }
});

// ---------------------------------------------------------------------
//  Toutes les classes de couleur de texte du code
// ---------------------------------------------------------------------

// Réservées au fond navy (barre latérale, en-têtes, écrans sombres) : elles
// y sont lisibles et ne le seraient pas sur fond clair. Chaque entrée dit où.
const SUR_FOND_NAVY = {
  "text-emerald-300": "pastille « notifications actives », barre latérale (Layout.jsx)",
  "text-or-400": "accent de marque au survol, sur navy",
  "text-or-500": "accent de marque : logo, menus actifs, en-têtes — 6,8:1 sur navy avec le doré d'origine",
};

// Ignorées : sans couleur propre, ou posées sur un fond coloré qui les porte
// (boutons pleins), ou traitées ailleurs (crème : plancher sur navy, ci-dessus).
const IGNOREES = new Set(["white", "black", "transparent", "current", "inherit", "creme"]);

function fichiersSource(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersSource(p));
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Couleur [r,g,b] d'une teinte, ou null si inconnue (classe de taille, etc.).
function resoudre(nom, nuance) {
  if (nom === "or") return nuance ? nuancesAccent(COULEUR_DEFAUT)[nuance] || null : null;
  const perso = config.theme.extend.colors[nom];
  const v = perso?.[nuance] ?? PALETTE[nom]?.[nuance];
  return typeof v === "string" && v.startsWith("#") ? hexEnRgb(v) : null;
}

test("aucune classe de texte du code ne descend sous 4,5:1 sur fond clair", () => {
  const motif = /(?<![\w-])text-([a-z]+)-(\d{2,3})(?:\/(\d{1,3}))?(?![\w/-])/g;
  const fautes = new Map();
  let vues = 0;
  for (const f of fichiersSource(RACINE)) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(motif)) {
      const [classe, nom, nuance, op] = m;
      if (IGNOREES.has(nom)) continue;
      const base = classe.replace(/\/\d+$/, "");
      if (SUR_FOND_NAVY[base]) continue;
      const rgb = resoudre(nom, nuance);
      if (!rgb) continue;
      vues++;
      let alpha = op ? Number(op) / 100 : 1;
      if (nom === "navy" && nuance === "900") alpha = Math.max(alpha, PLANCHER_TEXTE.navy);
      const r = ratioContraste(melanger(rgb, CREME, alpha), CREME);
      if (r < SEUIL) {
        const ou = `${path.relative(RACINE, f)}`;
        const cle = `${classe} (${r.toFixed(2)}:1)`;
        fautes.set(cle, [...new Set([...(fautes.get(cle) || []), ou])]);
      }
    }
  }
  assert.ok(vues > 1000, `trop peu de classes analysées (${vues}) : le motif ne trouve plus rien ?`);
  const liste = [...fautes].map(([c, fs]) => `${c} — ${fs.slice(0, 4).join(", ")}${fs.length > 4 ? "…" : ""}`);
  assert.deepEqual(liste, [], "Texte trop pâle sur fond clair. Prendre la nuance au-dessus ; "
    + "si la couleur est réservée au fond navy, l'ajouter à SUR_FOND_NAVY en disant où.");
});
