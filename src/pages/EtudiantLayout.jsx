import { Suspense, useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";
import InvitePush from "@/composants/InvitePush.jsx";
import { compterNonLues } from "@/lib/parent.js";
import { mesMessagesNonLus } from "@/lib/etudiant.js";

// Espace étudiant (supérieur) — coque légère.
export default function EtudiantLayout() {
  const { profil, deconnexion } = useAuth();
  const { pathname } = useLocation();
  const surAccueil = pathname === "/etudiant" || pathname === "/etudiant/";

  //  🔴 CES DEUX PASTILLES MANQUAIENT. L'en-tête du parent porte en permanence
  //  💬 et 🔔 ; celui de l'étudiant n'avait que son nom et la déconnexion. Une
  //  réponse de la scolarité, un relevé publié ou une échéance passaient donc
  //  inaperçus : l'étudiant n'ouvre pas une page à vide pour vérifier.
  //  Rafraîchies à chaque navigation, comme les compteurs du personnel.
  const [nonLues, setNonLues] = useState(0);
  const [msgNonLus, setMsgNonLus] = useState(0);
  useEffect(() => {
    compterNonLues().then(setNonLues).catch(() => {});
    mesMessagesNonLus().then(setMsgNonLus).catch(() => {});
  }, [pathname]);

  const Pastille = ({ n }) => (n > 0 ? (
    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
      {n > 9 ? "9+" : n}
    </span>
  ) : null);

  return (
    <div className="min-h-dscreen bg-creme">
      <header className="flex items-center justify-between gap-3 border-b border-navy-900/10 bg-navy-900 px-6 py-4 text-creme">
        <Link to="/etudiant" className="flex min-w-0 items-center gap-3">
          <Cachet size={36} className="text-or-500" />
          <span className="truncate font-display text-lg font-bold">
            Ges<span className="text-or-500">School</span> <span className="text-sm font-normal text-creme/60">· Espace étudiant</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <Link to="/etudiant/messagerie" className="relative" title="Messagerie">
            <span className="text-xl">💬</span>
            <Pastille n={msgNonLus} />
          </Link>
          <Link to="/etudiant/notifications" className="relative" title="Alertes">
            <span className="text-xl">🔔</span>
            <Pastille n={nonLues} />
          </Link>
          <span className="hidden text-creme/70 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">
            Déconnexion
          </button>
        </div>
      </header>
      {/* Pas de barre de navigation : le menu, ce sont les tuiles de l'accueil.
          Une fois dans une section elles ne sont plus visibles, d'où ce retour
          — sans lui, on resterait enfermé dans la page ouverte. */}
      {!surAccueil && (
        <div className="border-b border-navy-900/10 bg-white px-4 py-2">
          <Link to="/etudiant"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-900/70 transition hover:bg-creme hover:text-navy-900">
            ← Accueil
          </Link>
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-4 p-6">
        {/*  Invitation à activer les notifications : le personnel et les
             parents l'avaient, l'étudiant non. Elle se met en veille d'un
             « Plus tard » et respecte ce choix. */}
        <InvitePush />
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
