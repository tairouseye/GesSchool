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

// Couleurs des tuiles (mobile) : une pastel par module, texte foncé lisible.
const TUILES_COULEURS = [
  "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800", "bg-orange-100 text-orange-800", "bg-lime-100 text-lime-800",
  "bg-fuchsia-100 text-fuchsia-800",
];

// GesSchool — shell applicatif responsive, organisé par ESPACES d'usage.
// Desktop : sidebar (menu latéral dense). Mobile : barre de navigation basse
// (espaces) + sous-modules en tuiles colorées.
export default function Layout() {
  const { ecole, profil, roles, deconnexion, estPromoteur, modulesActifs, estSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);      // (desktop, hérité — non utilisé en mobile)
  const [tuiles, setTuiles] = useState(true);   // mobile : grille de tuiles de l'espace
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
    // Mobile : on atterrit sur la grille de tuiles de l'espace. Desktop :
    // les tuiles sont masquées, on ouvre directement la 1re page.
    setTuiles(true);
    navigate(menusDe(e)[0]?.to || e.accueil);
  };

  // Ouvrir une page depuis une tuile (mobile) : referme la grille.
  const ouvrirTuile = (to) => { setTuiles(false); navigate(to); };

  return (
    <div className="flex h-screen overflow-hidden bg-creme text-navy-900">
      {/* Sidebar : desktop uniquement (sur mobile → barre basse + tuiles) */}
      <aside className="hidden w-64 flex-col bg-navy-900 text-creme lg:flex">
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
        {/* Barre du haut (mobile) : école + bouton grille (ouvre/ferme les tuiles) */}
        <div className="flex items-center gap-2.5 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-creme lg:hidden">
          <Cachet size={26} sigle={sigle} className="text-or-500" />
          <span className="truncate font-display font-bold">{ecole?.nom || "GesSchool"}</span>
          <button onClick={() => setTuiles((t) => !t)} aria-label="Menu des modules"
            className={`ml-auto grid h-9 w-9 place-items-center rounded-xl text-lg ${tuiles ? "bg-or-500 text-navy-900" : "bg-navy-800 text-creme/80"}`}>▦</button>
        </div>

        <main className="relative flex-1 overflow-auto pb-16 lg:pb-0">
          <Suspense fallback={<ChargementPage />}>
            <Outlet />
          </Suspense>

          {/* Grille de tuiles (mobile) : sous-modules de l'espace courant */}
          {tuiles && (
            <div className="absolute inset-0 z-20 overflow-auto bg-creme p-4 lg:hidden">
              <p className="mb-1 font-display text-lg font-bold text-navy-900">{espaceCourant?.icone} {espaceCourant?.label}</p>
              <p className="mb-4 text-xs text-navy-900/50">Touchez un module pour l'ouvrir.</p>
              <div className="grid grid-cols-2 gap-3">
                {items.map((item, i) => {
                  const c = TUILES_COULEURS[i % TUILES_COULEURS.length];
                  return (
                    <button key={item.to} onClick={() => ouvrirTuile(item.to)}
                      className={`relative flex min-h-[92px] flex-col items-start justify-between rounded-2xl p-4 text-left shadow-sm transition active:scale-95 ${c}`}>
                      <span className="text-2xl leading-none">{item.icone}</span>
                      <span className="text-sm font-semibold">{item.label}</span>
                      {pastille(item.cle) > 0 && (
                        <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white shadow">
                          {pastille(item.cle)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Barre de navigation basse (mobile) : les espaces */}
        {accessibles.length > 1 && (
          <nav className="grid flex-none border-t border-white/10 bg-navy-900 text-creme lg:hidden"
            style={{ gridTemplateColumns: `repeat(${accessibles.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Espaces">
            {accessibles.map((e) => {
              const actif = e.id === espaceCourant?.id;
              return (
                <button key={e.id} onClick={() => changerEspace(e)} role="tab" aria-selected={actif}
                  className={`flex flex-col items-center gap-1 py-2 ${actif ? "text-or-500" : "text-creme/60"}`}>
                  <span className="text-xl leading-none">{e.icone}</span>
                  <span className="text-[10px] font-semibold">{e.label}</span>
                </button>
              );
            })}
          </nav>
        )}
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
