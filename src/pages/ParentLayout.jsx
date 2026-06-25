import { Outlet, Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";

// Espace parent — coque légère (pas de sidebar de gestion).
export default function ParentLayout() {
  const { profil, deconnexion } = useAuth();
  return (
    <div className="min-h-full bg-creme">
      <header className="flex items-center justify-between border-b border-navy-900/10 bg-navy-900 px-6 py-4 text-creme">
        <Link to="/parent" className="flex items-center gap-3">
          <Cachet size={36} className="text-or-500" />
          <span className="font-display text-lg font-bold">
            Ges<span className="text-or-500">School</span> <span className="text-sm font-normal text-creme/60">· Espace parent</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
      <footer className="pb-6 text-center font-mono text-[10px] text-navy-900/30">
        GesSchool v{__APP_VERSION__} · {__BUILD_DATE__}
      </footer>
    </div>
  );
}
