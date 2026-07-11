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
