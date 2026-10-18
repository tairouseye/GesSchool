// Contraste WCAG 2.x entre deux couleurs [r, g, b] (0-255).
// Seuils AA : 4,5:1 pour le texte courant, 3:1 pour le grand texte et les icônes.

const lineaire = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = ([r, g, b]) => 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);

export function ratioContraste(a, b) {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

// Couleur `avant` posée avec l'opacité `alpha` sur `fond` (ce que l'œil voit).
export const melanger = (avant, fond, alpha) => avant.map((c, i) => c * alpha + fond[i] * (1 - alpha));

// Couleurs fixes de l'identité GesSchool (tailwind.config.js).
export const BLANC = [255, 255, 255];
export const CREME = [247, 245, 239];
export const NAVY = { 900: [11, 31, 58], 800: [19, 41, 75], 700: [28, 58, 102] };
