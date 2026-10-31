import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Logo from "@/composants/Logo.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import InvitePush from "@/composants/InvitePush.jsx";
import { compterNonLues, mesMessagesNonLus, mesEnfants } from "@/lib/parent.js";
import Tour from "@/composants/Tour.jsx";
import InviteVisite from "@/composants/InviteVisite.jsx";
import GesProSignature from "@/composants/GesProSignature.jsx";
import PanneauBas from "@/composants/PanneauBas.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { TOUR_PARENT } from "@/lib/tours.js";
import { libelleCompteur } from "@/lib/accessibilite.js";
import { useMasqueAuDefilement, useMedia } from "@/lib/defilement.js";
import { InviteBiometrie } from "@/composants/Biometrie.jsx";

// Commande d'en-tête : 40 × 40 px, la taille d'un doigt. La pastille de
// non-lus se pose dans ce carré, sans le déborder.
const ICONE_ENTETE = "relative grid h-10 w-10 place-items-center rounded-lg hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-or-500";

const CLE_DERNIER_ENFANT = "parent_dernier_enfant";
const lire = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, v); } catch { /* stockage bloqué */ } };

// /parent/enfant/:id/:rubrique? → { id, rubrique }
const ROUTE_ENFANT = /^\/parent\/enfant\/([^/]+)(?:\/([^/]+))?/;

const Pastille = ({ n, className = "" }) => (n > 0 ? (
  <span aria-hidden="true" className={`grid h-4 min-w-4 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900 ${className}`}>
    {n > 9 ? "9+" : n}
  </span>
) : null);

// Espace parent — coque légère (pas de sidebar de gestion).
//
//  📱 LE PARENT EST SUR TÉLÉPHONE (choix du promoteur, 31/10/2026). Sous
//  1024 px, les commandes de l'en-tête descendent dans une barre d'onglets en
//  bas, à portée du pouce, et en-tête comme onglets s'effacent quand on fait
//  défiler la page vers le bas (voir `useMasqueAuDefilement`). Au-delà,
//  l'en-tête d'origine reste tel quel.
export default function ParentLayout() {
  const { profil, deconnexion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [nonLues, setNonLues] = useState(0);
  const [msgNonLus, setMsgNonLus] = useState(0);
  const [tour, setTour] = useState(false);
  const [enfants, setEnfants] = useState([]);
  const [panneau, setPanneau] = useState(null); // "enfants" | "plus" | null

  const grand = useMedia("(min-width: 1024px)");
  //  Pendant la visite guidée, rien ne bouge : elle fait défiler la page
  //  jusqu'à sa cible, et la cible (un onglet) s'effacerait sous la bulle.
  const [masque, setMasque] = useMasqueAuDefilement(!grand && !tour);

  // Rafraîchit les compteurs (alertes + messages) à chaque navigation.
  useEffect(() => {
    compterNonLues().then(setNonLues).catch(() => {});
    mesMessagesNonLus().then(setMsgNonLus).catch(() => {});
    setMasque(false); // nouvelle page : on montre où l'on est
  }, [location.pathname, setMasque]);

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

  //  Les enfants, pour en changer depuis n'importe quelle rubrique. Relus en
  //  revenant à l'accueil : c'est là qu'on en rattache un nouveau.
  useEffect(() => { mesEnfants().then(setEnfants).catch(() => {}); }, [surAccueil]);
  const [, idEnfant, rubrique] = location.pathname.match(ROUTE_ENFANT) || [];
  useEffect(() => { if (idEnfant) ecrire(CLE_DERNIER_ENFANT, idEnfant); }, [idEnfant]);
  const enfantAffiche = enfants.find((e) => e.eleve_id === idEnfant);
  //  « Mon enfant » rouvre le dernier consulté ; à défaut, le seul ; à défaut,
  //  on demande lequel.
  const dernier = enfants.find((e) => e.eleve_id === (idEnfant || lire(CLE_DERNIER_ENFANT)))
    || (enfants.length === 1 ? enfants[0] : null);
  //  Changer d'enfant garde la rubrique : on passe des notes de l'aîné à
  //  celles du cadet en un geste. Si le cadet ne l'a pas (pas de cantine…),
  //  ParentEnfant retombe de lui-même sur sa grille.
  const allerA = (e) => {
    setPanneau(null);
    navigate(`/parent/enfant/${e.eleve_id}${rubrique ? `/${rubrique}` : ""}`);
  };

  //  ⚠️ LA BARRE DE RUBRIQUES SE COLLE SOUS L'EN-TÊTE. Toutes deux sont
  //  collées en haut ; sans ce décalage, la barre passait sous l'en-tête. On
  //  publie sa hauteur, ou 0 quand il s'efface ou n'est pas collé (grand écran).
  const entete = useRef(null);
  const [hauteur, setHauteur] = useState(0);
  useEffect(() => {
    const el = entete.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setHauteur(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--haut-entete", `${grand || masque ? 0 : hauteur}px`);
  }, [grand, masque, hauteur]);
  useEffect(() => () => document.documentElement.style.removeProperty("--haut-entete"), []);

  //  Les ancres de la visite guidée ne doivent exister qu'UNE fois, sur la
  //  commande VISIBLE : `Tour` prend la première trouvée, et une commande
  //  masquée n'a pas de position à éclairer.
  const ancre = (nom, surGrand) => (surGrand === grand ? { "data-tour": nom } : {});

  const onglets = [
    { cle: "accueil", label: "Accueil", icone: "_gestion", to: "/parent", actif: surAccueil },
    { cle: "enfant", label: "Mon enfant", icone: "eleves", to: dernier ? `/parent/enfant/${dernier.eleve_id}` : enfants.length > 1 ? null : "/parent", actif: !!idEnfant },
    { cle: "messages", label: "Messages", icone: "messagerie", to: "/parent/messages", n: msgNonLus, actif: location.pathname.startsWith("/parent/messages"), tour: "messagerie",
      aria: libelleCompteur("Messages", msgNonLus, "message non lu", "messages non lus") },
    { cle: "alertes", label: "Alertes", icone: "recouvrement", to: "/parent/notifications", n: nonLues, actif: location.pathname.startsWith("/parent/notifications"), tour: "alertes",
      aria: libelleCompteur("Alertes", nonLues, "alerte non lue", "alertes non lues") },
  ];
  const classeOnglet = (actif) => `relative flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-or-500 ${
    actif ? "font-bold text-navy-900 before:absolute before:inset-x-[22%] before:top-0 before:h-[3px] before:rounded-b before:bg-or-500" : "text-navy-900/55"
  }`;
  const surPlus = ["/parent/compte", "/parent/textes"].some((p) => location.pathname.startsWith(p));

  return (
    <div className="min-h-dscreen bg-fond max-lg:pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      {/*  ⚠️ L'EN-TÊTE DOIT TENIR DANS 320 PX. Il mesurait 421 px : à 390 px
           « Déconnexion » était coupé de 31 px, à 320 px de 101 px (audit
           ergonomie, oct. 2026). Les actions ne rétrécissent jamais ; c'est la
           marque qui cède.
           ⚠️ ET CHAQUE COMMANDE FAIT 40 × 40 PX (audit parent, 20/10/2026) :
           les icônes ne mesuraient que 20 à 28 px, trop petites pour un doigt.
           Pour que tout tienne : sous 420 px, « Déconnexion » devient une
           icône (nom accessible et infobulle conservés) ; le nom de la marque
           ne paraît qu'à partir de 520 px — le sceau reste, et mène toujours
           à l'accueil. 320 px : 32 + 36 + 8 + 5 × 40 + 4 × 4 = 292 px.
           Sous 1024 px, ces commandes sont dans les onglets du bas : il ne
           reste ici que le sceau, la marque et le choix de l'enfant. */}
      <header ref={entete} onFocus={() => setMasque(false)}
        className={`z-30 flex items-center justify-between gap-2 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-creme max-lg:sticky max-lg:top-0 motion-safe:transition-transform motion-safe:duration-300 sm:px-6 sm:py-4 ${masque ? "max-lg:-translate-y-full" : ""}`}>
        <Link to="/parent" aria-label="GesSchool — accueil de l'espace parent" className="flex min-w-0 items-center gap-3">
          <Logo size={36} className="shrink-0 text-or-500" />
          {/* Les commandes parties dans les onglets, la marque a la place de
              paraître aussi sur les petits écrans ; elle cède devant le choix
              de l'enfant (`truncate`). */}
          <span className="truncate font-display text-lg font-bold">
            Ges<span className="text-or-500">School</span> <span className="hidden text-sm font-normal text-creme/60 sm:inline">· Espace parent</span>
          </span>
        </Link>
        <div className="flex min-w-0 shrink-0 items-center gap-1 text-sm sm:gap-2">
          {/*  Choix de l'enfant, dès qu'il y en a deux : sans revenir à
               l'accueil, et en restant sur la même rubrique. */}
          {enfantAffiche && enfants.length > 1 && (
            <button type="button" onClick={() => setPanneau("enfants")} aria-haspopup="dialog"
              aria-label={`Changer d'enfant (actuellement ${enfantAffiche.prenom} ${enfantAffiche.nom})`}
              className="flex h-10 min-w-0 max-w-[11rem] items-center gap-2 rounded-lg border border-creme/20 px-2.5 hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-or-500">
              <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-or-500 text-[11px] font-bold text-navy-900">
                {(enfantAffiche.prenom || "?").charAt(0)}
              </span>
              <span className="truncate font-semibold">{enfantAffiche.prenom}</span>
              <span aria-hidden="true" className="text-creme/60">▾</span>
            </button>
          )}
          {/* Nom accessible explicite (avec le nombre de non-lus) : l'emoji et
              le `title` seuls sont restitués de façon variable par les lecteurs
              d'écran. Emoji et pastille sont donc masqués à leur intention. */}
          <Link to="/parent/messages" className={`${ICONE_ENTETE} max-lg:hidden`} title="Messagerie" {...ancre("messagerie", true)}
            aria-label={libelleCompteur("Messagerie", msgNonLus, "message non lu", "messages non lus")}>
            <span className="text-xl" aria-hidden="true">💬</span>
            <Pastille n={msgNonLus} className="absolute -right-0.5 top-0" />
          </Link>
          <Link to="/parent/notifications" className={`${ICONE_ENTETE} max-lg:hidden`} title="Alertes" {...ancre("alertes", true)}
            aria-label={libelleCompteur("Alertes", nonLues, "alerte non lue", "alertes non lues")}>
            <span className="text-xl" aria-hidden="true">🔔</span>
            <Pastille n={nonLues} className="absolute -right-0.5 top-0" />
          </Link>
          <button {...ancre("aide-parent", true)} onClick={() => setTour(true)} title="Visite guidée" aria-label="Visite guidée"
            className={`${ICONE_ENTETE} max-lg:hidden`}>
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border border-creme/20 text-sm text-creme/70">?</span>
          </button>
          <Link to="/parent/compte" title="Mon compte" aria-label="Mon compte" className={`${ICONE_ENTETE} max-lg:hidden`}>
            <span className="text-xl leading-none" aria-hidden="true">⚙️</span>
          </Link>
          <span className="hidden text-creme/70 lg:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} title="Déconnexion" aria-label="Déconnexion"
            className="grid h-10 min-w-10 place-items-center rounded-lg border border-creme/20 px-3 text-xs text-creme/80 hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-or-500 max-lg:hidden">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        {/* Bannière : mobile uniquement (sur desktop, la page « Alertes » suffit). */}
        <div className="empty:hidden lg:hidden"><InvitePush /></div>
        <div className="empty:hidden"><InviteBiometrie /></div>
        <Suspense fallback={<ChargementPage />}>
          {/* Les compteurs sont déjà chargés ici, à chaque navigation : on les
              transmet plutôt que de les redemander depuis l'accueil. */}
          <Outlet context={{ nonLues, msgNonLus }} />
        </Suspense>
      </main>
      <footer className="pb-6">
        <GesProSignature ton="clair" avecContacts />
      </footer>

      {/*  Onglets du bas (téléphone). Quatre destinations et « Plus » : au-delà
           de cinq, les cibles passent sous la largeur d'un doigt à 320 px. */}
      <nav aria-label="Navigation principale" onFocus={() => setMasque(false)}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        className={`fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-navy-900/10 bg-white motion-safe:transition-transform motion-safe:duration-300 lg:hidden ${masque ? "translate-y-full" : ""}`}>
        {onglets.map((o) => {
          const contenu = (
            <>
              <span className="relative">
                <Icone name={o.icone} className={`h-6 w-6 ${o.actif ? "text-navy-900" : ""}`} />
                <Pastille n={o.n} className="absolute -right-2.5 -top-1" />
              </span>
              {o.label}
            </>
          );
          return o.to ? (
            <Link key={o.cle} to={o.to} aria-current={o.actif ? "page" : undefined} aria-label={o.aria}
              className={classeOnglet(o.actif)} {...(o.tour ? ancre(o.tour, false) : {})}>{contenu}</Link>
          ) : (
            <button key={o.cle} type="button" onClick={() => setPanneau("enfants")} aria-haspopup="dialog"
              className={classeOnglet(o.actif)}>{contenu}</button>
          );
        })}
        <button type="button" onClick={() => setPanneau("plus")} aria-haspopup="dialog" {...ancre("aide-parent", false)}
          className={classeOnglet(surPlus)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Plus
        </button>
      </nav>

      <PanneauBas ouvert={panneau === "enfants"} onFermer={() => setPanneau(null)} titre="Mes enfants">
        <ul className="divide-y divide-navy-900/10">
          {enfants.map((e) => {
            const courant = e.eleve_id === idEnfant;
            return (
              <li key={e.eleve_id}>
                <button type="button" onClick={() => allerA(e)} aria-current={courant ? "true" : undefined}
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${courant ? "bg-navy-900 text-or-400" : "bg-or-500/20 text-navy-900"}`}>
                    {(e.prenom || "?").charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy-900">{e.prenom} {e.nom}</span>
                    {e.classe && <span className="block truncate text-xs text-navy-900/60">{e.classe}{e.ecole ? ` · ${e.ecole}` : ""}</span>}
                  </span>
                  {courant && <span className="text-xs font-semibold text-or-700">Affiché</span>}
                </button>
              </li>
            );
          })}
          <li>
            <Link to="/parent" onClick={() => setPanneau(null)} className="flex min-h-12 items-center gap-3 py-2 text-sm font-medium text-navy-700">
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-navy-900/25">＋</span>
              Rattacher un autre enfant
            </Link>
          </li>
        </ul>
      </PanneauBas>

      <PanneauBas ouvert={panneau === "plus"} onFermer={() => setPanneau(null)} titre={profil ? `${profil.prenom} ${profil.nom}` : "Mon espace"}>
        <ul className="divide-y divide-navy-900/10 text-navy-900">
          <li><Link to="/parent/compte" onClick={() => setPanneau(null)} className="flex min-h-12 items-center gap-3 py-2">
            <Icone name="parametres" className="h-5 w-5 text-or-600" /> Mon compte
            <span className="ml-auto text-xs text-navy-900/50">mot de passe, empreinte</span></Link></li>
          <li><Link to="/parent/textes" onClick={() => setPanneau(null)} className="flex min-h-12 items-center gap-3 py-2">
            <Icone name="_documentation" className="h-5 w-5 text-or-600" /> Règlement et textes de l&apos;école</Link></li>
          <li><button type="button" onClick={() => { setPanneau(null); setTour(true); }} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
            <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full border border-or-600 text-[11px] text-or-600">?</span> Visite guidée</button></li>
          <li><button type="button" onClick={deconnexion} className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-rose-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
            Déconnexion</button></li>
        </ul>
      </PanneauBas>

      {surAccueil && (
        <InviteVisite cle="tour_parent_v1" onLancer={lancerVisite}
          className="inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-6 sm:w-96 lg:bottom-6" />
      )}
      <Tour steps={TOUR_PARENT} ouvert={tour} onFermer={fermerTour} />
    </div>
  );
}
