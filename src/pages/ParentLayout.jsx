import { useEffect, useRef, useState, Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import InvitePush from "@/composants/InvitePush.jsx";
import { compterNonLues, mesMessagesNonLus } from "@/lib/parent.js";
import Tour from "@/composants/Tour.jsx";
import InviteVisite from "@/composants/InviteVisite.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";
import { TOUR_PARENT } from "@/lib/tours.js";
import { libelleCompteur } from "@/lib/accessibilite.js";

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

  // Visite guidée : PROPOSÉE au premier accès (voir InviteVisite), plus lancée
  // d'office. L'invitation ne paraît que sur l'accueil : trois des cinq étapes
  // visent le contenu de cette page.
  //
  // ⚠️ LE LANCEMENT ATTEND QUE LE CONTENU SOIT LÀ, et non un délai deviné.
  // Sans quoi l'étape « Vos enfants » cible une ancre encore absente pendant
  // le chargement : `Tour` la saute alors en silence — et c'est l'étape
  // principale. Le parent peut cliquer avant la fin du chargement.
  const surAccueil = location.pathname === "/parent" || location.pathname === "/parent/";
  const attente = useRef(null);
  useEffect(() => () => clearTimeout(attente.current), []);
  const lancerVisite = () => {
    const debut = Date.now();
    const chercher = () => {
      // Ancre présente, ou attente trop longue : on ouvre quand même, faute de
      // quoi un parent sans enfant rattaché n'aurait jamais le guide.
      if (document.querySelector('[data-tour="enfants"]') || Date.now() - debut > 8000) { setTour(true); return; }
      attente.current = setTimeout(chercher, 150);
    };
    chercher();
  };
  const fermerTour = () => { setTour(false); localStorage.setItem("tour_parent_v1", "done"); };
  return (
    <div className="min-h-dscreen bg-creme">
      {/*  ⚠️ L'EN-TÊTE DOIT TENIR DANS 320 PX. Il mesurait 421 px : à 390 px
           « Déconnexion » était coupé de 31 px, à 320 px de 101 px (audit
           ergonomie, oct. 2026). Les actions ne rétrécissent jamais ; c'est la
           marque qui cède : sous-titre masqué sous 640 px, nom masqué sous
           380 px — le sceau reste, et mène toujours à l'accueil. */}
      <header className="flex items-center justify-between gap-2 border-b border-navy-900/10 bg-navy-900 px-4 py-4 text-creme sm:px-6">
        <Link to="/parent" aria-label="GesSchool — accueil de l'espace parent" className="flex min-w-0 items-center gap-3">
          <Cachet size={36} className="shrink-0 text-or-500" />
          <span className="truncate font-display text-lg font-bold max-[379px]:hidden">
            Ges<span className="text-or-500">School</span> <span className="hidden text-sm font-normal text-creme/60 sm:inline">· Espace parent</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2.5 text-sm sm:gap-3">
          {/* Nom accessible explicite (avec le nombre de non-lus) : l'emoji et
              le `title` seuls sont restitués de façon variable par les lecteurs
              d'écran. Emoji et pastille sont donc masqués à leur intention. */}
          <Link to="/parent/messages" className="relative" title="Messagerie" data-tour="messagerie"
            aria-label={libelleCompteur("Messagerie", msgNonLus, "message non lu", "messages non lus")}>
            <span className="text-xl" aria-hidden="true">💬</span>
            {msgNonLus > 0 && (
              <span aria-hidden="true" className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
                {msgNonLus > 9 ? "9+" : msgNonLus}
              </span>
            )}
          </Link>
          <Link to="/parent/notifications" className="relative" title="Alertes" data-tour="alertes"
            aria-label={libelleCompteur("Alertes", nonLues, "alerte non lue", "alertes non lues")}>
            <span className="text-xl" aria-hidden="true">🔔</span>
            {nonLues > 0 && (
              <span aria-hidden="true" className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
                {nonLues > 9 ? "9+" : nonLues}
              </span>
            )}
          </Link>
          <button data-tour="aide-parent" onClick={() => setTour(true)} title="Visite guidée" aria-label="Visite guidée"
            className="grid h-7 w-7 place-items-center rounded-full border border-creme/20 text-sm text-creme/70 hover:bg-navy-800">?</button>
          <Link to="/parent/compte" title="Mon compte" aria-label="Mon compte" className="text-xl leading-none hover:opacity-80">
            <span aria-hidden="true">⚙️</span>
          </Link>
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-2.5 py-1.5 text-xs text-creme/80 hover:bg-navy-800 sm:px-3">
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

      {surAccueil && (
        <InviteVisite cle="tour_parent_v1" onLancer={lancerVisite}
          className="inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-96" />
      )}
      <Tour steps={TOUR_PARENT} ouvert={tour} onFermer={fermerTour} />
    </div>
  );
}
