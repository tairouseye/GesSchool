import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

// GesSchool — « Une nouvelle version est disponible ».
//
// Demandé par le promoteur (27/10/2026) : prévenir l'utilisateur d'une mise à
// jour. Avant, le service worker se remplaçait en silence (autoUpdate) et
// l'écran restait sur l'ancienne version jusqu'à une ou deux actualisations —
// sans que personne sache qu'il y avait du neuf.
//
// Désormais (registerType « prompt », vite.config.js) la nouvelle version se
// télécharge, ATTEND, et ce bandeau propose de l'installer. « Plus tard » la
// laisse en attente : elle s'installera d'elle-même à la prochaine ouverture
// de l'appli. On vérifie au démarrage, au retour sur l'onglet et toutes les
// 30 minutes : une appli de téléphone reste ouverte des jours.

const INTERVALLE = 30 * 60 * 1000;
let miseAJour = null;            // un seul enregistrement (StrictMode monte deux fois)
const abonnes = new Set();

function enregistrer() {
  if (miseAJour || typeof window === "undefined") return;
  miseAJour = registerSW({
    immediate: true,
    onNeedRefresh() { abonnes.forEach((f) => f(true)); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const verifier = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      setInterval(verifier, INTERVALLE);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") verifier();
      });
    },
  });
}

export default function MiseAJour() {
  const [dispo, setDispo] = useState(false);
  const [masque, setMasque] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    abonnes.add(setDispo);
    enregistrer();
    return () => { abonnes.delete(setDispo); };
  }, []);

  if (!dispo || masque) return null;
  return (
    <div role="status" aria-live="polite"
      className="no-print fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-creme shadow-xl sm:inset-x-auto sm:right-6">
      <span className="text-xl" aria-hidden>🔄</span>
      <p className="min-w-0 flex-1 text-sm">
        <b>Une nouvelle version de GesSchool est disponible.</b>
        <span className="block text-xs text-creme/70">La mise à jour prend quelques secondes.</span>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setMasque(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-creme/70 hover:text-creme">
          Plus tard
        </button>
        <button type="button" disabled={enCours}
          onClick={() => { setEnCours(true); miseAJour?.(true); }}
          className="rounded-lg bg-or-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-or-400 disabled:opacity-60">
          {enCours ? "…" : "Mettre à jour"}
        </button>
      </div>
    </div>
  );
}
