/** @type {import('tailwindcss').Config} */
// GesSchool — identité visuelle (navy/or/crème + polices)
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0B1F3A", 800: "#13294B", 700: "#1C3A66" },
        or: { 500: "#C9A227", 400: "#D9B84A" },
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
