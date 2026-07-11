// GesSchool — accent « or » personnalisable par école.
// Le navy et le crème restent fixes (identité GesSchool) ; seul l'accent doré
// est pilotable par l'école, via les variables CSS --or-400..700 (cf. index.css).

// Accent doré d'origine (repli).
export const COULEUR_DEFAUT = "#C9A227";

const DEFAUT = {
  400: "217 184 74",
  500: "201 162 39",
  600: "166 132 20",
  700: "133 104 16",
};

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

// Applique l'accent de l'école (ou l'accent par défaut si couleur absente/invalide).
// Les nuances 400/600/700 sont dérivées de la teinte 500 fournie.
export function appliquerAccent(hex) {
  const root = document.documentElement;
  const base = hexEnRgb(hex);
  if (!base) {
    for (const [k, v] of Object.entries(DEFAUT)) root.style.setProperty(`--or-${k}`, v);
    return;
  }
  const set = (k, rgb) => root.style.setProperty(`--or-${k}`, rgb.join(" "));
  set(400, eclaircir(base, 0.2));
  set(500, base);
  set(600, foncer(base, 0.18));
  set(700, foncer(base, 0.35));
}
