import { useEffect, useState, Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import { compterNonLues, mesMessagesNonLus } from "@/lib/parent.js";
import Tour from "@/composants/Tour.jsx";
import { TOUR_PARENT } from "@/lib/tours.js";

// Espace parent — coque légère (pas de sidebar de gestion).
export default function ParentLayout() {
  const { profil, deconnexion } = useAuth();
  const location = useLocation();
  const [nonLues, setNonLues] = useState(0);
  const [msgNonLus, setMsgNonLus] = useState(0);
  const [tour, setTour] = useState(false);

  // Rafraîchit les compteurs (alertes + messages) à chaque navigation.
  useEffect(() => {
    compterNonLues().then(setNonLues).catch(() => {});
    mesMessagesNonLus().then(setMsgNonLus).catch(() => {});
  }, [location.pathname]);

  // Visite guidée au premier accès.
  useEffect(() => {
    if (localStorage.getItem("tour_parent_v1") !== "done") {
      const t = setTimeout(() => setTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);
  const fermerTour = () => { setTour(false); localStorage.setItem("tour_parent_v1", "done"); };
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
          <Link to="/parent/messages" className="relative" title="Messagerie" data-tour="messagerie">
            <span className="text-xl">💬</span>
            {msgNonLus > 0 && (
              <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
                {msgNonLus > 9 ? "9+" : msgNonLus}
              </span>
            )}
          </Link>
          <Link to="/parent/notifications" className="relative" title="Alertes" data-tour="alertes">
            <span className="text-xl">🔔</span>
            {nonLues > 0 && (
              <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
                {nonLues > 9 ? "9+" : nonLues}
              </span>
            )}
          </Link>
          <button data-tour="aide-parent" onClick={() => setTour(true)} title="Visite guidée"
            className="grid h-7 w-7 place-items-center rounded-full border border-creme/20 text-sm text-creme/70 hover:bg-navy-800">?</button>
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="space-y-0.5 pb-6 text-center text-[10px] text-navy-900/40">
        <p>Développé par <span className="font-semibold text-navy-900/60">GesPro</span></p>
        <p className="text-navy-900/30">
          <a href="mailto:gespro.sn@gmail.com" className="hover:text-or-600">gespro.sn@gmail.com</a>
          {" · "}
          <a href="https://wa.me/221773435928?text=Bonjour%2C%20j%27ai%20besoin%20d%27assistance%20sur%20GesSchool."
            target="_blank" rel="noreferrer" className="hover:text-or-600">💬 Assistance WhatsApp</a>
        </p>
        <p className="font-mono text-navy-900/30">GesSchool v{__APP_VERSION__} · {__BUILD_DATE__}</p>
      </footer>

      <Tour steps={TOUR_PARENT} ouvert={tour} onFermer={fermerTour} />
    </div>
  );
}
