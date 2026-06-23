import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";

// GesSchool — shell applicatif (sidebar + en-tête), identité navy/or.
const NAV = [
  { to: "/", label: "Tableau de bord", icone: "▦", exact: true },
  { to: "/eleves", label: "Élèves", icone: "👤" },
  { to: "/bulletins", label: "Bulletins", icone: "🎓" },
  { to: "/paiements", label: "Paiements", icone: "₣" },
  { to: "/structure", label: "Structure", icone: "🏫" },
];

export default function Layout() {
  const { ecole, profil, roles, deconnexion } = useAuth();
  const sigle = ecole?.sigle || "GS";
  return (
    <div className="flex h-screen overflow-hidden bg-creme text-navy-900">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-navy-900 text-creme">
        <div className="flex items-center gap-3 px-6 py-6">
          <Cachet size={42} sigle={sigle} className="text-or-500" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-none">
              {ecole?.nom || "GesSchool"}
            </p>
            <p className="text-xs text-creme/60">{sigle}</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  isActive ? "bg-or-500 font-semibold text-navy-900" : "text-creme/80 hover:bg-navy-800"
                }`
              }
            >
              <span className="w-5 text-center">{item.icone}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-navy-800 px-5 py-4">
          <p className="truncate text-sm text-creme/90">
            {profil ? `${profil.prenom} ${profil.nom}` : "—"}
          </p>
          <p className="truncate text-xs text-creme/50">{roles[0] || "utilisateur"}</p>
          <button
            onClick={deconnexion}
            className="mt-3 w-full rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// En-tête de page réutilisable.
export function EnTete({ titre, sousTitre, action }) {
  return (
    <header className="flex items-center justify-between border-b border-navy-900/10 bg-creme/80 px-8 py-5 backdrop-blur">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">{titre}</h1>
        {sousTitre && <p className="text-sm text-navy-900/50">{sousTitre}</p>}
      </div>
      {action}
    </header>
  );
}
