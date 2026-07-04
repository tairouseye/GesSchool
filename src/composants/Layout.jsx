import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { LIBELLES_ROLES } from "@/lib/permissions.js";
import { espacesAccessibles, espaceParDefaut, espaceParId, espacesDeRoute, itemsEspace } from "@/lib/espaces.js";
import { moduleActif } from "@/lib/modules.js";
import Tour from "@/composants/Tour.jsx";
import { TOUR_STAFF } from "@/lib/tours.js";

// GesSchool — shell applicatif responsive, organisé par ESPACES d'usage
// (Pédagogie / Gestion / RH & Paie / Pilotage). Sélecteur d'espace pour
// ceux qui ont accès à plusieurs ; sidebar fixe en desktop, tiroir en mobile.
export default function Layout() {
  const { ecole, profil, roles, deconnexion, estPromoteur, modulesActifs, estSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [tour, setTour] = useState(false);
  const sigle = ecole?.sigle || "GS";

  // Visite guidée au premier accès (une fois).
  useEffect(() => {
    if (localStorage.getItem("tour_staff_v1") !== "done") {
      const t = setTimeout(() => setTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);
  const fermerTour = () => { setTour(false); localStorage.setItem("tour_staff_v1", "done"); };

  // Espaces accessibles (par rôle), restreints à ceux qui ont au moins un
  // menu visible (rôle + module actif).
  const accessibles = espacesAccessibles(roles, estPromoteur).filter(
    (e) => itemsEspace(e, roles).some((it) => moduleActif(modulesActifs, it.cle))
  );
  const [espaceId, setEspaceId] = useState(() => espaceParDefaut(roles, estPromoteur)?.id);

  // Synchronise l'espace courant avec la route (si la route appartient à un
  // espace accessible non encore sélectionné, on bascule dessus).
  useEffect(() => {
    const candidats = espacesDeRoute(location.pathname).filter((e) =>
      accessibles.some((a) => a.id === e.id)
    );
    if (candidats.length && !candidats.some((e) => e.id === espaceId)) {
      setEspaceId(candidats[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const espaceCourant = espaceParId(espaceId) || espaceParDefaut(roles, estPromoteur);
  const items = itemsEspace(espaceCourant, roles).filter((it) => moduleActif(modulesActifs, it.cle));

  const changerEspace = (e) => {
    setEspaceId(e.id);
    setMenu(false);
    navigate(e.accueil);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-creme text-navy-900">
      {menu && <div className="fixed inset-0 z-30 bg-navy-900/50 lg:hidden" onClick={() => setMenu(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-navy-900 text-creme transition-transform duration-200 lg:static lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5">
          <Cachet size={40} sigle={sigle} className="text-or-500" />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold leading-none">{ecole?.nom || "GesSchool"}</p>
            <p className="text-xs text-creme/60">{sigle}</p>
          </div>
        </div>

        {/* Sélecteur d'espace (si accès à plusieurs) */}
        {accessibles.length > 1 ? (
          <div className="px-3 pb-2" data-tour="espaces">
            <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-creme/40">Espace</p>
            <div className="grid grid-cols-2 gap-1">
              {accessibles.map((e) => (
                <button
                  key={e.id}
                  onClick={() => changerEspace(e)}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                    e.id === espaceCourant?.id ? "bg-or-500 text-navy-900" : "bg-navy-800/60 text-creme/80 hover:bg-navy-800"
                  }`}
                >
                  <span>{e.icone}</span>
                  <span className="truncate">{e.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 pb-2" data-tour="espaces">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1 text-xs text-creme/70">
              {espaceCourant?.icone} {espaceCourant?.label}
            </span>
          </div>
        )}

        <nav className="mt-1 flex-1 space-y-1 overflow-y-auto px-3" data-tour="menu">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                  isActive ? "bg-or-500 font-semibold text-navy-900" : "text-creme/80 hover:bg-navy-800"
                }`
              }
            >
              <span className="w-5 text-center">{item.icone}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-navy-800 px-5 py-4" data-tour="profil">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm text-creme/90">{profil ? `${profil.prenom} ${profil.nom}` : "—"}</p>
              <p className="truncate text-xs text-creme/50">{LIBELLES_ROLES[roles[0]] || roles[0] || "utilisateur"}</p>
            </div>
            <button data-tour="aide" onClick={() => setTour(true)} title="Visite guidée" aria-label="Aide et visite guidée"
              className="grid h-7 w-7 place-items-center rounded-full border border-creme/20 text-sm text-creme/70 hover:bg-navy-800">?</button>
          </div>
          {estSuperAdmin && (
            <Link to="/super-admin" className="mt-3 block rounded-lg bg-or-500/20 px-3 py-1.5 text-center text-xs font-medium text-or-500 hover:bg-or-500/30">
              🛠️ Console super-admin
            </Link>
          )}
          <button onClick={deconnexion} className="mt-2 w-full rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
          <p className="mt-3 text-center font-mono text-[10px] text-creme/30">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-creme lg:hidden">
          <button onClick={() => setMenu(true)} className="text-2xl leading-none" aria-label="Menu">☰</button>
          <span className="font-display font-bold">{espaceCourant?.label || "GesSchool"}</span>
          <span className="ml-auto font-mono text-[10px] text-creme/40">v{__APP_VERSION__}</span>
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Tour steps={TOUR_STAFF} ouvert={tour} onFermer={fermerTour} />
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
