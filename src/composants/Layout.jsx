import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";

// GesSchool — shell applicatif responsive (sidebar fixe en desktop,
// tiroir en mobile via le bouton ☰).
const NAV = [
  { to: "/", label: "Tableau de bord", icone: "▦", exact: true },
  { to: "/eleves", label: "Élèves", icone: "👤" },
  { to: "/notes", label: "Notes", icone: "✎" },
  { to: "/bulletins", label: "Bulletins", icone: "🎓" },
  { to: "/paiements", label: "Paiements", icone: "₣" },
  { to: "/recouvrement", label: "Recouvrement", icone: "🔔" },
  { to: "/structure", label: "Structure", icone: "🏫" },
  { to: "/enseignants", label: "Enseignants", icone: "🧑‍🏫" },
  { to: "/vie-scolaire", label: "Vie scolaire", icone: "📋" },
  { to: "/emploi-du-temps", label: "Emploi du temps", icone: "🗓️" },
  { to: "/annonces", label: "Annonces", icone: "📣" },
];

export default function Layout() {
  const { ecole, profil, roles, deconnexion } = useAuth();
  const [menu, setMenu] = useState(false);
  const sigle = ecole?.sigle || "GS";

  return (
    <div className="flex h-screen overflow-hidden bg-creme text-navy-900">
      {/* Voile (mobile) */}
      {menu && <div className="fixed inset-0 z-30 bg-navy-900/50 lg:hidden" onClick={() => setMenu(false)} />}

      {/* Sidebar : fixe en desktop, tiroir en mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-navy-900 text-creme transition-transform duration-200 lg:static lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-6">
          <Cachet size={42} sigle={sigle} className="text-or-500" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-none">{ecole?.nom || "GesSchool"}</p>
            <p className="text-xs text-creme/60">{sigle}</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setMenu(false)}
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
          <p className="truncate text-sm text-creme/90">{profil ? `${profil.prenom} ${profil.nom}` : "—"}</p>
          <p className="truncate text-xs text-creme/50">{roles[0] || "utilisateur"}</p>
          <button onClick={deconnexion} className="mt-3 w-full rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
          <p className="mt-3 text-center font-mono text-[10px] text-creme/30">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barre du haut (mobile) */}
        <div className="flex items-center gap-3 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-creme lg:hidden">
          <button onClick={() => setMenu(true)} className="text-2xl leading-none" aria-label="Menu">☰</button>
          <span className="font-display font-bold">{ecole?.nom || "GesSchool"}</span>
          <span className="ml-auto font-mono text-[10px] text-creme/40">v{__APP_VERSION__}</span>
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// En-tête de page réutilisable (responsive).
export function EnTete({ titre, sousTitre, action }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 bg-creme/80 px-4 py-4 backdrop-blur sm:px-8 sm:py-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">{titre}</h1>
        {sousTitre && <p className="text-sm text-navy-900/50">{sousTitre}</p>}
      </div>
      {action}
    </header>
  );
}
