import { Suspense } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";

// Espace étudiant (supérieur) — coque légère.
export default function EtudiantLayout() {
  const { profil, deconnexion } = useAuth();
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
      {/* Navigation de l'espace étudiant */}
      <nav className="flex gap-1 overflow-x-auto border-b border-navy-900/10 bg-white px-4 py-2">
        {[
          ["/etudiant", "Accueil", true],
          ["/etudiant/notes", "Mes résultats", false],
          ["/etudiant/bibliotheque", "Bibliothèque", false],
          ["/etudiant/depots", "Mon dépôt", false],
        ].map(([to, label, exact]) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? "bg-navy-900 text-creme" : "text-navy-900/70 hover:bg-creme"
              }`
            }>
            {label}
          </NavLink>
        ))}
      </nav>

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
