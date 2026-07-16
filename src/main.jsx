import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Filet de sécurité « cache PWA périmé » : après un déploiement, une version
// en cache peut référencer un fichier de page (chunk) qui n'existe plus sur le
// serveur → la page « ne s'ouvre pas ». On recharge alors la page pour récupérer
// la version fraîche (recommandation officielle Vite). Anti-boucle : au plus un
// rechargement toutes les 10 s.
function rechargerSiChunkPerime() {
  const dernier = Number(sessionStorage.getItem("gs_reload_chunk") || 0);
  if (Date.now() - dernier > 10000) {
    sessionStorage.setItem("gs_reload_chunk", String(Date.now()));
    window.location.reload();
  }
}
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); rechargerSiChunkPerime(); });
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || e?.reason || "");
  if (/dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(msg)) rechargerSiChunkPerime();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
