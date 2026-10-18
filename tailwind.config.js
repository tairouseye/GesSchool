/** @type {import('tailwindcss').Config} */
// GesSchool — identité visuelle (navy/or/crème + polices)

//  ⚠️ PLANCHER DE CONTRASTE DU TEXTE (WCAG AA : 4,5:1 pour le texte courant).
//  Plus de 1 800 textes secondaires étaient écrits `text-navy-900/40`, `/50`…
//  soit 2,5:1 à 3,3:1 — illisibles au soleil ou pour une vue faible (audit
//  ergonomie, oct. 2026). Plutôt que de retoucher 103 fichiers, l'opacité du
//  TEXTE est relevée ici, au seul endroit où elle se fabrique : `/40` rend la
//  même chose que `/65`. Les fonds et bordures pâles (`bg-navy-900/5`,
//  `border-navy-900/10`) ne passent pas par `textColor` et ne bougent pas.
//
//  Les planchers sont calculés, pas choisis à l'œil (test/contraste.test.mjs
//  les vérifie) :
//   - navy sur fond clair : 0,65 → 4,86:1 sur le fond clair le plus sombre de
//     l'app (bg-navy-900/5 posé sur crème) ; 5,2:1 sur blanc ;
//   - crème sur fond navy : 0,60 → 4,84:1 sur navy-700, le navy le plus clair.
//  Au-dessus du plancher rien ne change : /70, /80 et plein restent distincts,
//  la hiérarchie des textes est conservée.
export const PLANCHER_TEXTE = { navy: 0.65, creme: 0.6 };

const texteAvecPlancher = (rgb, plancher) => ({ opacityValue }) => {
  const a = Number(opacityValue);
  // Sans modificateur, Tailwind passe `var(--tw-text-opacity)` : on le laisse.
  if (opacityValue === undefined || Number.isNaN(a)) return `rgb(${rgb} / ${opacityValue ?? 1})`;
  return `rgb(${rgb} / ${Math.max(a, plancher)})`;
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0B1F3A", 800: "#13294B", 700: "#1C3A66" },
        // Accent « or » pilotable par variables CSS (personnalisable par école).
        or: {
          400: "rgb(var(--or-400) / <alpha-value>)",
          500: "rgb(var(--or-500) / <alpha-value>)",
          600: "rgb(var(--or-600) / <alpha-value>)",
          700: "rgb(var(--or-700) / <alpha-value>)",
        },
        creme: "#F7F5EF",
        // Couleurs SÉMANTIQUES du design system (états : succès/alerte/danger/info).
        // Distinctes de l'accent « or » (qui reste l'accent de marque).
        success: { 50: "#ECFDF3", 500: "#12805C", 600: "#0F6B4E" },
        warning: { 50: "#FFF8EB", 500: "#B25E09", 600: "#8F4B07" },
        danger: { 50: "#FEF3F2", 500: "#D92D20", 600: "#B42318" },
        info: { 50: "#EFF6FF", 500: "#1D6FD6", 600: "#175CB8" },
      },
      // Uniquement la couleur du TEXTE (voir PLANCHER_TEXTE plus haut).
      textColor: {
        navy: { 900: texteAvecPlancher("11 31 58", PLANCHER_TEXTE.navy) },
        creme: texteAvecPlancher("247 245 239", PLANCHER_TEXTE.creme),
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
