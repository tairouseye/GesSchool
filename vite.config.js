import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { readFileSync } from "node:fs";

// Version de l'app injectée au build (affichée dans l'UI pour repérer
// quelle version tourne réellement — utile face au cache PWA).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const dateBuild = new Date().toISOString().slice(0, 10);

// Politique de sécurité du contenu (audit du 02/11/2026). GitHub Pages ne
// permet aucun en-tête HTTP : elle passe donc par une balise <meta>, posée
// À LA COMPILATION seulement — en développement, Vite injecte un script en
// ligne (rafraîchissement React) qu'elle bloquerait.
//  · scripts : uniquement ceux du site (aucun script en ligne, aucun CDN) ;
//    c'est elle qui rend une injection HTML inoffensive ;
//  · données : Supabase (API + temps réel), et OpenLibrary / Crossref pour
//    l'enrichissement des notices de la bibliothèque ;
//  · styles en ligne permis : React pose des `style=…`, l'écran d'ouverture
//    et l'impression ont des <style>.
// ⚠️ `frame-ancestors` (anti-iframe) est IGNORÉ dans une <meta> : il faudrait
// un en-tête HTTP, donc un hébergeur qui en permet.
function politiqueContenu(supabaseUrl) {
  const sb = (supabaseUrl || "").replace(/\/$/, "");
  const ws = sb.replace(/^https:/, "wss:");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${sb} ${ws} https://openlibrary.org https://api.crossref.org`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// GesSchool — config Vite + PWA (web + mobile installable, code unique)
export default defineConfig(({ mode }) => ({
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
    {
      name: "politique-contenu",
      apply: "build",
      transformIndexHtml: (html) => html.replace("<head>",
        `<head>
    <meta http-equiv="Content-Security-Policy" content="${politiqueContenu(loadEnv(mode, process.cwd(), "VITE_").VITE_SUPABASE_URL)}" />`),
    },
    VitePWA({
      //  « prompt » : la nouvelle version attend, et le bandeau MiseAJour.jsx
      //  propose de l'installer (promoteur, 27/10/2026). En autoUpdate elle
      //  s'installait en silence et l'écran restait sur l'ancienne.
      registerType: "prompt",
      manifest: {
        name: "GesSchool — Gestion scolaire",
        short_name: "GesSchool",
        description: "L'école connectée, la gestion simplifiée",
        lang: "fr",
        start_url: ".",
        scope: "./",
        display: "standalone",
        background_color: "#0B1F3A",
        theme_color: "#0B1F3A",
        icons: [
          { src: "gesschool-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "gesschool-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "gesschool-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Purge les anciens caches précachés à chaque mise à jour du SW.
        // Plus de skipWaiting/clientsClaim : la nouvelle version ATTEND que
        // l'utilisateur clique « Mettre à jour » (ou rouvre l'appli).
        cleanupOutdatedCaches: true,
        // Handler de notifications push ajouté au service worker généré.
        importScripts: ["push-sw.js"],
        // Pas de navigateFallback absolu : routage géré par HashRouter
        // (compatible sous-chemin GitHub Pages).
      },
      includeAssets: ["icone.svg", "gesschool-192.png", "gesschool-512.png", "gesschool-maskable-512.png", "gesschool-180.png", "gespro.png", "gespro-logo.png", "push-sw.js"],
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
}));
