/** @type {import('tailwindcss').Config} */
// GesSchool — identité visuelle (navy/or/crème + polices)
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
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
