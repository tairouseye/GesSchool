import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { readFileSync } from "node:fs";

// Version de l'app injectée au build (affichée dans l'UI pour repérer
// quelle version tourne réellement — utile face au cache PWA).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const dateBuild = new Date().toISOString().slice(0, 10);

// GesSchool — config Vite + PWA (web + mobile installable, code unique)
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(dateBuild),
  },
  // Chemins relatifs : fonctionne en local ET sous un sous-chemin
  // GitHub Pages (https://user.github.io/GesSchool/).
  base: "./",
  build: {
    rollupOptions: {
      output: {
        // Libs stables isolées → meilleur cache long terme (une modif de page
        // n'invalide pas ce chunk). Les pages sont découpées via React.lazy.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        // Handler de notifications push ajouté au service worker généré.
        importScripts: ["push-sw.js"],
        // Pas de navigateFallback absolu : routage géré par HashRouter
        // (compatible sous-chemin GitHub Pages).
      },
      includeAssets: ["favicon.svg", "icone.svg", "push-sw.js"],
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
