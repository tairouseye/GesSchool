import { Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";

// Espace étudiant (supérieur) — coque légère.
export default function EtudiantLayout() {
  const { profil, deconnexion } = useAuth();
  const { pathname } = useLocation();
  const surAccueil = pathname === "/etudiant" || pathname === "/etudiant/";
  return (
    <div className="min-h-dscreen bg-creme">
      <header className="flex items-center justify-between border-b border-navy-900/10 bg-navy-900 px-6 py-4 text-creme">
        <Link to="/etudiant" className="flex items-center gap-3">
          <Cachet size={36} className="text-or-500" />
          <span className="font-display text-lg font-bold">
            Ges<span className="text-or-500">School</span> <span className="text-sm font-normal text-creme/60">· Espace étudiant</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
        </div>
      </header>
      {/* Pas de barre de navigation : le menu, ce sont les tuiles de l'accueil.
          Une fois dans une section elles ne sont plus visibles, d'où ce retour
          — sans lui, on resterait enfermé dans la page ouverte. */}
      {!surAccueil && (
        <div className="border-b border-navy-900/10 bg-white px-4 py-2">
          <Link to="/etudiant"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-900/70 transition hover:bg-creme hover:text-navy-900">
            ← Accueil
          </Link>
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="pb-6">
        <GesProSignature ton="clair" avecContacts />
      </footer>
    </div>
  );
}
