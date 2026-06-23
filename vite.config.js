import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// GesSchool — config Vite + PWA (web + mobile installable, code unique)
export default defineConfig({
  // Chemins relatifs : fonctionne en local ET sous un sous-chemin
  // GitHub Pages (https://user.github.io/GesSchool/).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icone.svg"],
      manifest: {
        name: "GesSchool — Gestion scolaire",
        short_name: "GesSchool",
        description: "SaaS de gestion scolaire multi-écoles",
        lang: "fr",
        start_url: ".",
        scope: "./",
        display: "standalone",
        background_color: "#0B1F3A",
        theme_color: "#0B1F3A",
        icons: [
          { src: "icone.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          // TODO: ajouter pwa-192x192.png et pwa-512x512.png pour installabilité complète
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // Pas de navigateFallback absolu : routage géré par HashRouter
        // (compatible sous-chemin GitHub Pages).
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
