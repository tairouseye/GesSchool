// GesSchool — accent « or » personnalisable par école.
// Le navy et le crème restent fixes (identité GesSchool) ; seul l'accent doré
// est pilotable par l'école, via les variables CSS --or-400..700 (cf. index.css).
import { ratioContraste, melanger, luminance, CREME, NAVY } from "./contraste.js";

// Accent doré d'origine (repli).
export const COULEUR_DEFAUT = "#C9A227";

// Hex #RRGGBB → triplet [r, g, b].
function hexEnRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const eclaircir = ([r, g, b], t) =>
  [r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t].map((x) => Math.round(x));
const foncer = ([r, g, b], t) => [r * (1 - t), g * (1 - t), b * (1 - t)].map((x) => Math.round(x));

//  ⚠️ OR-600 ET OR-700 SONT DES COULEURS DE TEXTE, ET LEUR CONTRASTE EST CALCULÉ.
//  Elles étaient dérivées à taux fixe (-18 %, -35 %) : avec le doré d'origine,
//  `text-or-600` ne donnait que 3,5:1 sur blanc — et une école qui choisit un
//  jaune ou un rose clair obtenait un texte illisible sans le savoir. On fonce
//  désormais jusqu'à 4,5:1 (marge comprise) sur les fonds clairs où ces
//  textes sont posés : la page crème, la pastille `bg-or-500/15` sur crème, et
//  `bg-navy-900/5` sur crème — le fond clair le plus sombre de l'application.
//  `or-500` et `or-400` restent la couleur de l'école telle quelle : c'est
//  l'accent de marque, posé sur le navy (6,8:1 avec le doré d'origine).
//  Garde-fou : test/contraste.test.mjs, sur une gamme de couleurs d'école.
export const CIBLE_TEXTE = 4.6;

function foncerJusqua(rgb, tMin, fonds) {
  for (let t = tMin; t < 1; t += 0.01) {
    const c = foncer(rgb, t);
    if (fonds.every((f) => ratioContraste(c, f) >= CIBLE_TEXTE)) return c;
  }
  return [0, 0, 0];
}

// Les quatre nuances [r, g, b] de l'accent, couleur invalide → accent d'origine.
export function nuancesAccent(hex) {
  const base = hexEnRgb(hex) || hexEnRgb(COULEUR_DEFAUT);
  const fonds = [CREME, melanger(base, CREME, 0.15), melanger(NAVY[900], CREME, 0.05)];
  const n600 = foncerJusqua(base, 0.18, fonds);
  // 700 : toujours plus foncé que 600, et au moins aussi foncé qu'avant (-35 %).
  const a = foncer(base, 0.35);
  const b = foncer(n600, 0.2);
  const n700 = luminance(a) < luminance(b) ? a : b;
  return { 400: eclaircir(base, 0.2), 500: base, 600: n600, 700: n700 };
}

// L'accent tel quel (or-500) sur le navy des en-têtes : sous 3:1 (seuil des
// grands textes et icônes), le logo et les menus actifs ne ressortent plus.
export function accentPeuVisible(hex) {
  return ratioContraste(nuancesAccent(hex)[500], NAVY[900]) < 3;
}

// Applique l'accent de l'école (ou l'accent par défaut si couleur absente/invalide).
export function appliquerAccent(hex) {
  const root = document.documentElement;
  for (const [k, rgb] of Object.entries(nuancesAccent(hex))) {
    root.style.setProperty(`--or-${k}`, rgb.join(" "));
  }
}
