import { useState } from "react";

//  Invitation à la visite guidée, au lieu de la lancer d'office.
//
//  ⚠️ LA VISITE NE S'IMPOSE PLUS. Elle s'ouvrait seule au premier accès et
//  recouvrait le tableau de bord : il fallait la traiter avant de pouvoir
//  travailler (audit ergonomie, oct. 2026). La carte, elle, ne bloque rien et
//  ne prend pas le focus ; on la traite quand on veut.
//
//  - « Lancer la visite » : ouvre la visite. C'est sa fermeture (fin ou
//    « Passer ») qui la marque comme vue, comme avant.
//  - « Plus tard »        : reproposée dans quelques jours.
//  - « Ne plus proposer » : marquée comme vue, définitivement.
//  Dans tous les cas, le bouton « ? » de l'en-tête la relance.
const REPORT_MS = 3 * 24 * 3600 * 1000;

function lire(cle) {
  try { return localStorage.getItem(cle); } catch { return null; }
}
function ecrire(cle, val) {
  try { localStorage.setItem(cle, val); } catch { /* stockage indisponible : tant pis */ }
}

function aProposer(cle) {
  if (lire(cle) === "done") return false;
  const report = Number(lire(`${cle}_report`) || 0);
  return !report || Date.now() - report > REPORT_MS;
}

export default function InviteVisite({ cle, onLancer, className = "" }) {
  const [visible, setVisible] = useState(() => aProposer(cle));
  // Relu à chaque rendu : une visite lancée par le bouton « ? » puis fermée
  // marque « vue », et la carte doit alors disparaître d'elle-même.
  if (!visible || lire(cle) === "done") return null;

  const lancer = () => { setVisible(false); onLancer(); };
  const plusTard = () => { ecrire(`${cle}_report`, String(Date.now())); setVisible(false); };
  const jamais = () => { ecrire(cle, "done"); setVisible(false); };

  return (
    <section aria-label="Visite guidée"
      className={`fixed z-30 rounded-2xl border border-or-500/30 bg-white p-4 shadow-xl ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">🧭</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-900">Première visite ?</p>
          <p className="mt-0.5 text-sm text-navy-900/70">
            Découvrez l&apos;essentiel en une minute. Vous pourrez la relancer à tout moment avec le bouton « ? ».
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={lancer}
              className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme hover:bg-navy-800">
              Lancer la visite
            </button>
            <button onClick={plusTard}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-900/70 hover:bg-creme hover:text-navy-900">
              Plus tard
            </button>
            <button onClick={jamais}
              className="ml-auto px-1 py-1.5 text-xs text-navy-900/70 underline-offset-2 hover:text-navy-900 hover:underline">
              Ne plus proposer
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
