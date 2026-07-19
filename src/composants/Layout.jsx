import { useEffect, useState, Suspense } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { ChargementPage } from "@/composants/ui.jsx";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { LIBELLES_ROLES } from "@/lib/permissions.js";
import { espacesAccessibles, espaceParDefaut, espaceParId, espacesDeRoute, routeOuvrable } from "@/lib/espaces.js";
import Tour from "@/composants/Tour.jsx";
import { TOUR_STAFF } from "@/lib/tours.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";

// GesSchool — shell applicatif responsive, organisé par ESPACES d'usage
// (Pédagogie / Gestion / RH & Paie / Pilotage). Sélecteur d'espace pour
// ceux qui ont accès à plusieurs ; sidebar fixe en desktop, tiroir en mobile.
export default function Layout() {
  const { ecole, profil, roles, deconnexion, estPromoteur, modulesActifs, estSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [tour, setTour] = useState(false);
  const [aSigner, setASigner] = useState(0);
  const [demandes, setDemandes] = useState(0);
  const sigle = ecole?.sigle || "GS";

  // Compteurs d'attente affichés en pastille sur les menus concernés
  // (rafraîchis à chaque navigation). Le staff n'avait aucun signal : une
  // demande de document arrivait sans que personne ne le sache.
  useEffect(() => {
    compterASigner().then(setASigner).catch(() => {});
    compterDemandesEnAttente(ecole?.id).then(setDemandes).catch(() => {});
  }, [location.pathname, ecole?.id]);

  const pastille = (cle) => (cle === "signatures" ? aSigner : cle === "demandes" ? demandes : 0);

  // Visite guidée au premier accès (une fois).
  useEffect(() => {
    if (localStorage.getItem("tour_staff_v1") !== "done") {
      const t = setTimeout(() => setTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);
  const fermerTour = () => { setTour(false); localStorage.setItem("tour_staff_v1", "done"); };

  // Menus d'un espace : uniquement les pages RÉELLEMENT ouvrables (rôle,
  // module actif, statut promoteur) — même critère que la garde de route,
  // pour ne jamais proposer un lien qui mènerait à un refus.
  const menusDe = (e) => (e?.items || []).filter((it) => routeOuvrable(it, roles, estPromoteur, modulesActifs));

  // Espaces accessibles (par rôle), restreints à ceux qui ont au moins un menu.
  const accessibles = espacesAccessibles(roles, estPromoteur).filter((e) => menusDe(e).length > 0);
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

  const espaceCourant = espaceParId(espaceId) || accessibles[0] || espaceParDefaut(roles, estPromoteur);
  const items = menusDe(espaceCourant)
    // « À signer » ne s'affiche que s'il reste des documents en attente.
    .filter((it) => it.cle !== "signatures" || aSigner > 0);

  const changerEspace = (e) => {
    setEspaceId(e.id);
    setMenu(false);
    // Va au PREMIER menu ouvrable de l'espace (en général l'Accueil).
    navigate(menusDe(e)[0]?.to || e.accueil);
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
              {({ isActive }) => (
                <>
                  <span className="w-5 text-center">{item.icone}</span>
                  {item.label}
                  {pastille(item.cle) > 0 && (
                    // Sur l'onglet actif (fond doré), la pastille dorée serait
                    // invisible : on inverse les couleurs.
                    <span className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${
                      isActive ? "bg-navy-900 text-or-500" : "bg-or-500 text-navy-900"
                    }`}>
                      {pastille(item.cle)}
                    </span>
                  )}
                </>
              )}
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
          <div className="mt-3 space-y-0.5 text-center">
            <p className="text-[10px] text-creme/40">
              Développé par <span className="font-semibold text-creme/60">GesPro</span>
            </p>
            <p className="text-[10px] leading-relaxed text-creme/30">
              <a href="mailto:gespro.sn@gmail.com" className="hover:text-or-500">gespro.sn@gmail.com</a>
              <br />
              <a href="https://wa.me/221773435928?text=Bonjour%2C%20j%27ai%20besoin%20d%27assistance%20sur%20GesSchool."
                target="_blank" rel="noreferrer" className="hover:text-or-500">💬 Assistance WhatsApp : +221 77 343 59 28</a>
            </p>
            <p className="font-mono text-[10px] text-creme/30">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-creme lg:hidden">
          <button onClick={() => setMenu(true)} className="text-2xl leading-none" aria-label="Menu">☰</button>
          <span className="font-display font-bold">{espaceCourant?.label || "GesSchool"}</span>
          <span className="ml-auto font-mono text-[10px] text-creme/40">v{__APP_VERSION__}</span>
        </div>
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<ChargementPage />}>
            <Outlet />
          </Suspense>
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
