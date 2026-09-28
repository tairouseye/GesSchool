import { useEffect, useState, Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import InvitePush from "@/composants/InvitePush.jsx";
import { compterNonLues, mesMessagesNonLus } from "@/lib/parent.js";
import Tour from "@/composants/Tour.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";
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
  //
  // ⚠️ ELLE ATTEND QUE LE CONTENU SOIT LÀ, et non un délai devinné. Avec un
  // `setTimeout` de 700 ms, l'étape « Vos enfants » cible une ancre encore
  // absente pendant le chargement : `Tour` la saute alors en silence — et
  // c'est l'étape principale, à la seule occasion où elle compte. Sur une
  // connexion lente le guide perdait donc son intérêt.
  //
  // Elle ne s'ouvre que sur l'accueil : trois de ses cinq étapes visent le
  // contenu de cette page.
  useEffect(() => {
    if (localStorage.getItem("tour_parent_v1") === "done") return;
    if (location.pathname !== "/parent") return;
    let fini = false;
    const debut = Date.now();
    const chercher = () => {
      if (fini) return;
      // Ancre présente, ou attente trop longue : on ouvre quand même, faute de
      // quoi un parent sans enfant rattaché n'aurait jamais le guide.
      if (document.querySelector('[data-tour="enfants"]') || Date.now() - debut > 8000) {
        fini = true; setTour(true); return;
      }
      setTimeout(chercher, 150);
    };
    const t = setTimeout(chercher, 400);
    return () => { fini = true; clearTimeout(t); };
  }, [location.pathname]);
  const fermerTour = () => { setTour(false); localStorage.setItem("tour_parent_v1", "done"); };
  return (
    <div className="min-h-dscreen bg-creme">
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
          <Link to="/parent/compte" title="Mon compte" className="text-xl leading-none hover:opacity-80">⚙️</Link>
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        {/* Bannière : mobile uniquement (sur desktop, la page « Alertes » suffit). */}
        <div className="empty:hidden lg:hidden"><InvitePush /></div>
        <Suspense fallback={<ChargementPage />}>
          {/* Les compteurs sont déjà chargés ici, à chaque navigation : on les
              transmet plutôt que de les redemander depuis l'accueil. */}
          <Outlet context={{ nonLues, msgNonLus }} />
        </Suspense>
      </main>
      <footer className="pb-6">
        <GesProSignature ton="clair" avecContacts />
      </footer>

      <Tour steps={TOUR_PARENT} ouvert={tour} onFermer={fermerTour} />
    </div>
  );
}
