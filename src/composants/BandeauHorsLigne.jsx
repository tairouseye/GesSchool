import { useEffect, useState } from "react";
import { EVENEMENT_HORS_LIGNE } from "@/lib/horsLigne.js";

const heure = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const auj = new Date().toDateString() === d.toDateString();
  return auj
    ? `aujourd'hui à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

// Bandeau « Hors ligne » (lot 4 de l'audit du 31/10/2026). Dit POURQUOI
// l'écran ne bouge plus, et de quand datent les informations affichées.
// `copies` : l'espace garde-t-il des copies (parent) ? Sinon on dit
// simplement que rien ne peut se charger.
export default function BandeauHorsLigne({ copies = false }) {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [copie, setCopie] = useState(null); // { le } quand l'écran montre une copie
  const [retour, setRetour] = useState(false); // la connexion vient de revenir

  useEffect(() => {
    const on = () => { setEnLigne(true); setRetour(true); };
    const off = () => { setEnLigne(false); setRetour(false); };
    const cache = (e) => {
      if (e.detail?.depuisCache) setCopie((c) => ({ le: c?.le && c.le < e.detail.le ? c.le : e.detail.le }));
      else if (navigator.onLine) { setCopie(null); setRetour(false); }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(EVENEMENT_HORS_LIGNE, cache);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(EVENEMENT_HORS_LIGNE, cache);
    };
  }, []);

  if (enLigne && !copie) return null;

  if (enLigne && copie && retour) {
    return (
      <div role="status" className="no-print flex items-center gap-3 bg-emerald-700 px-4 py-2 text-sm text-white">
        <span className="min-w-0 flex-1">Connexion retrouvée.</span>
        <button type="button" onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">Actualiser</button>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="no-print flex items-start gap-2 bg-navy-900 px-4 py-2 text-sm text-creme">
      <span aria-hidden="true">📡</span>
      <span className="min-w-0 flex-1">
        <b>Hors ligne.</b>{" "}
        {copies
          ? copie?.le
            ? `Vous voyez les informations enregistrées sur ce téléphone ${heure(copie.le)}.`
            : "Vous voyez les dernières informations enregistrées sur ce téléphone."
          : "Les informations ne peuvent pas se charger. Vérifiez votre connexion."}
        {copies && <span className="block text-xs text-creme/70">Les envois (paiement, message, justificatif) attendront le retour du réseau.</span>}
      </span>
    </div>
  );
}
