// GesSchool — couleurs d'un document à partir de la charte de l'école
// (`ecoles.couleur_primaire` / `couleur_secondaire`, saisies à l'onboarding et
// en Paramètres → Apparence). Sert à l'emploi du temps ; la facture et le reçu
// ont leur propre usage (DocumentCaisse.jsx).
//
// ⚠️ DEUX COULEURS NE SUFFISENT PAS À DISTINGUER HUIT MATIÈRES. Les teintes des
// matières partent de la couleur secondaire, puis de la primaire si elle est
// assez différente, puis tournent sur le cercle des couleurs (angle d'or) en
// sautant celles trop proches d'une teinte déjà prise. Toutes sont claires
// (luminosité 88 %) : le texte navy y reste lisible (≥ 4,5:1), quelle que
// soit la charte. Garde-fou : test/charteEcole.test.mjs.
import { ratioContraste, NAVY } from "./contraste.js";

export const PRIMAIRE_DEFAUT = "#0B1F3A";
export const SECONDAIRE_DEFAUT = "#C9A227";

export function hexEnRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const enHex = (rgb) => `#${rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;

function teinteDe([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (d === 0) return null; // gris : pas de teinte
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return (h * 60 + 360) % 360;
}

function hslEnRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const ecart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const ANGLE_OR = 137.508;
const ECART_MIN = 28;

// `n` teintes claires, en commençant par la charte de l'école.
export function paletteMatieres(n, primaire, secondaire) {
  const depart = [secondaire, primaire].map((h) => hexEnRgb(h)).filter(Boolean).map(teinteDe).filter((h) => h != null);
  const prises = [];
  for (const h of depart) if (prises.every((p) => ecart(p, h) >= ECART_MIN)) prises.push(h);
  if (!prises.length) prises.push(210);
  // L'écart exigé se relâche seulement quand le cercle est plein : une grille
  // de huit matières garde des teintes bien distinctes, une de quinze en a.
  for (const min of [ECART_MIN, 18, 10, 4]) {
    for (let k = 1; prises.length < n && k < 720; k++) {
      const h = (prises[0] + k * ANGLE_OR) % 360;
      if (prises.every((p) => ecart(p, h) >= min)) prises.push(h);
    }
  }
  return prises.slice(0, n).map((h) => enHex(hslEnRgb(h, 0.62, 0.88)));
}

// En-tête dans la couleur primaire, avec un texte lisible : blanc si possible,
// navy sinon. Une primaire de luminosité moyenne (un gris, un vert vif) ne
// porte bien ni l'un ni l'autre : on la fonce juste assez pour le blanc.
export function enteteSur(hex) {
  const fond = hexEnRgb(hex) || hexEnRgb(PRIMAIRE_DEFAUT);
  const blanc = [255, 255, 255];
  if (ratioContraste(blanc, fond) >= 4.5) return { background: enHex(fond), color: "#FFFFFF" };
  if (ratioContraste(NAVY[900], fond) >= 4.5) return { background: enHex(fond), color: enHex(NAVY[900]) };
  for (let t = 0.05; t < 1; t += 0.05) {
    const c = fond.map((x) => x * (1 - t));
    if (ratioContraste(blanc, c) >= 4.5) return { background: enHex(c), color: "#FFFFFF" };
  }
  return { background: enHex(NAVY[900]), color: "#FFFFFF" };
}

// Une couleur hex éclaircie vers le blanc (alpha = part de la couleur).
export function surBlanc(hex, alpha) {
  const c = hexEnRgb(hex) || hexEnRgb(PRIMAIRE_DEFAUT);
  return enHex(c.map((x) => x * alpha + 255 * (1 - alpha)));
}

// Tout ce dont une grille d'emploi du temps a besoin, depuis la fiche école.
export function charteEmploi(ecole, nbMatieres) {
  const primaire = hexEnRgb(ecole?.couleur_primaire) ? ecole.couleur_primaire : PRIMAIRE_DEFAUT;
  const secondaire = hexEnRgb(ecole?.couleur_secondaire) ? ecole.couleur_secondaire : SECONDAIRE_DEFAUT;
  return {
    primaire, secondaire,
    entete: enteteSur(primaire),
    // Le nom de l'école en couleur primaire, sauf si elle est trop claire
    // pour être lue sur du blanc (une école en jaune, en rose pâle…).
    titre: ratioContraste(hexEnRgb(primaire), [255, 255, 255]) >= 4.5 ? primaire : enHex(NAVY[900]),
    heures: surBlanc(primaire, 0.07),
    pause: surBlanc(primaire, 0.13),
    matieres: paletteMatieres(Math.max(nbMatieres, 1), primaire, secondaire),
  };
}
