import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contextes/AuthContext.jsx";
import RouteProtegee, { RouteParent, Garde, GardePromoteur, GardeSuper, EcranSansAcces } from "@/composants/RouteProtegee.jsx";
import { Feedback } from "@/composants/Feedback.jsx";
import ErrorBoundary from "@/composants/ErrorBoundary.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import { premiereRoute, routeOuvrable } from "@/lib/espaces.js";
import { estRoleComplet } from "@/lib/permissions.js";

// Coques + 1er écran : chargés d'emblée (points d'entrée du routeur).
import Layout from "@/composants/Layout.jsx";
import ParentLayout from "@/pages/ParentLayout.jsx";
import Connexion from "@/pages/Connexion.jsx";

// Pages : chargées à la demande (un chunk par page). L'app reste légère et
// les modules non ouverts ne pèsent pas sur le chargement initial.
const MotDePasseOublie = lazy(() => import("@/pages/MotDePasseOublie.jsx"));
const ReinitMotDePasse = lazy(() => import("@/pages/ReinitMotDePasse.jsx"));
const Onboarding = lazy(() => import("@/pages/Onboarding.jsx"));
const Bienvenue = lazy(() => import("@/pages/Bienvenue.jsx"));
const ParentAccueil = lazy(() => import("@/pages/ParentAccueil.jsx"));
const ParentEnfant = lazy(() => import("@/pages/ParentEnfant.jsx"));
const ParentNotifications = lazy(() => import("@/pages/ParentNotifications.jsx"));
const ParentMessagerie = lazy(() => import("@/pages/ParentMessagerie.jsx"));
const Messagerie = lazy(() => import("@/pages/Messagerie.jsx"));
const TableauDeBord = lazy(() => import("@/pages/TableauDeBord.jsx"));
const Structure = lazy(() => import("@/pages/Structure.jsx"));
const Eleves = lazy(() => import("@/pages/Eleves.jsx"));
const FicheEleve = lazy(() => import("@/pages/FicheEleve.jsx"));
const Notes = lazy(() => import("@/pages/Notes.jsx"));
const Bulletins = lazy(() => import("@/pages/Bulletins.jsx"));
const Paiements = lazy(() => import("@/pages/Paiements.jsx"));
const Enseignants = lazy(() => import("@/pages/Enseignants.jsx"));
const VieScolaire = lazy(() => import("@/pages/VieScolaire.jsx"));
const Recouvrement = lazy(() => import("@/pages/Recouvrement.jsx"));
const EmploiDuTemps = lazy(() => import("@/pages/EmploiDuTemps.jsx"));
const Annonces = lazy(() => import("@/pages/Annonces.jsx"));
const Comptabilite = lazy(() => import("@/pages/Comptabilite.jsx"));
const RH = lazy(() => import("@/pages/RH.jsx"));
const Pilotage = lazy(() => import("@/pages/Pilotage.jsx"));
const PassageAnnee = lazy(() => import("@/pages/PassageAnnee.jsx"));
const AccueilPedagogie = lazy(() => import("@/pages/AccueilPedagogie.jsx"));
const Fournitures = lazy(() => import("@/pages/Fournitures.jsx"));
const Appel = lazy(() => import("@/pages/Appel.jsx"));
const CahierTextes = lazy(() => import("@/pages/CahierTextes.jsx"));
const Progression = lazy(() => import("@/pages/Progression.jsx"));
const Assiduite = lazy(() => import("@/pages/Assiduite.jsx"));
const Classement = lazy(() => import("@/pages/Classement.jsx"));
const Parametres = lazy(() => import("@/pages/Parametres.jsx"));
const Certificats = lazy(() => import("@/pages/Certificats.jsx"));
const Demandes = lazy(() => import("@/pages/Demandes.jsx"));
const Membres = lazy(() => import("@/pages/Membres.jsx"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin.jsx"));
const Cantine = lazy(() => import("@/pages/Cantine.jsx"));
const Transport = lazy(() => import("@/pages/Transport.jsx"));
const ASigner = lazy(() => import("@/pages/ASigner.jsx"));

// Lien profond d'invitation : /rejoindre?code=XXXX → mémorise le code puis
// oriente vers la connexion (nouveau membre) ou l'accueil (déjà rattaché).
function Rejoindre() {
  const { estConnecte, aProfil } = useAuth();
  const [params] = useSearchParams();
  const code = params.get("code");
  if (code) { try { localStorage.setItem("invit_code", code.toUpperCase()); } catch { /* ignore */ } }
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (aProfil) return <Navigate to="/" replace />;
  return <Navigate to="/bienvenue" replace />;
}

// Redirige vers l'espace d'accueil selon le rôle de l'utilisateur.
function RedirectionAccueil() {
  const { roles, estPromoteur, modulesActifs } = useAuth();
  // Un enseignant « pur » arrive directement sur l'appel de sa classe — mais
  // seulement si la page lui est réellement ouverte (module Vie scolaire actif).
  const appel = { to: "/appel", cle: "appel" };
  if (roles.includes("enseignant") && !estRoleComplet(roles) && !estPromoteur
      && routeOuvrable(appel, roles, estPromoteur, modulesActifs)) {
    return <Navigate to="/appel" replace />;
  }
  // Sinon : première page RÉELLEMENT ouvrable. Si aucune, on l'annonce au lieu
  // de renvoyer vers un accueil que la garde refusera (boucle infinie).
  const cible = premiereRoute(roles, estPromoteur, modulesActifs);
  if (!cible) return <EcranSansAcces />;
  return <Navigate to={cible} replace />;
}

// Adresse inconnue. On l'annonce au lieu de rediriger en silence : une
// redirection muette masque les liens cassés (et les fautes de frappe).
function PageIntrouvable() {
  const { estConnecte } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-navy-900 px-4 text-creme">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="font-display text-5xl font-bold text-or-500">404</p>
        <h1 className="font-display text-xl font-bold">Page introuvable</h1>
        <p className="text-sm text-creme/70">
          Cette adresse n'existe pas ou n'existe plus. Le lien que vous avez suivi est
          peut-être périmé.
        </p>
        <a href={estConnecte ? "#/" : "#/connexion"}
          className="rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-or-400">
          {estConnecte ? "Retour à l'accueil" : "Aller à la connexion"}
        </a>
      </div>
    </div>
  );
}

// GesSchool — routeur applicatif (Phase 0).
export default function App() {
  return (
    <AuthProvider>
      <Feedback>
      <HashRouter>
        <ErrorBoundary>
        <Suspense fallback={<ChargementPage />}>
        <Routes>
          {/* Public */}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser" element={<ReinitMotDePasse />} />
          <Route path="/rejoindre" element={<Rejoindre />} />

          {/* Connecté sans profil → choix (école ou parent) */}
          <Route
            path="/bienvenue"
            element={
              <RouteProtegee exigeProfil={false}>
                <Bienvenue />
              </RouteProtegee>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RouteProtegee exigeProfil={false}>
                <Onboarding />
              </RouteProtegee>
            }
          />

          {/* Console super-admin (propriétaire SaaS) */}
          <Route path="/super-admin" element={<GardeSuper><SuperAdmin /></GardeSuper>} />

          {/* Espace parent */}
          <Route
            path="/parent"
            element={
              <RouteParent>
                <ParentLayout />
              </RouteParent>
            }
          >
            <Route index element={<ParentAccueil />} />
            <Route path="enfant/:id" element={<ParentEnfant />} />
            <Route path="notifications" element={<ParentNotifications />} />
            <Route path="messages" element={<ParentMessagerie />} />
          </Route>

          {/* Espace protégé (profil + école requis) avec shell */}
          <Route
            element={
              <RouteProtegee>
                <Layout />
              </RouteProtegee>
            }
          >
            <Route path="/" element={<RedirectionAccueil />} />
            <Route path="/pilotage" element={<GardePromoteur><Pilotage /></GardePromoteur>} />
            <Route path="/passage-annee" element={<GardePromoteur><PassageAnnee /></GardePromoteur>} />
            <Route path="/pedagogie" element={<Garde cle="_pedagogie"><AccueilPedagogie /></Garde>} />
            <Route path="/gestion" element={<Garde cle="_gestion"><TableauDeBord /></Garde>} />
            <Route path="/structure" element={<Garde cle="structure"><Structure /></Garde>} />
            <Route path="/enseignants" element={<Garde cle="enseignants"><Enseignants /></Garde>} />
            <Route path="/vie-scolaire" element={<Garde cle="vie_scolaire"><VieScolaire /></Garde>} />
            <Route path="/fournitures" element={<Garde cle="fournitures"><Fournitures /></Garde>} />
            <Route path="/appel" element={<Garde cle="appel"><Appel /></Garde>} />
            <Route path="/cahier-textes" element={<Garde cle="cahier"><CahierTextes /></Garde>} />
            <Route path="/progression" element={<Garde cle="progression"><Progression /></Garde>} />
            <Route path="/assiduite" element={<Garde cle="assiduite"><Assiduite /></Garde>} />
            <Route path="/classement" element={<Garde cle="classement"><Classement /></Garde>} />
            <Route path="/eleves" element={<Garde cle="eleves"><Eleves /></Garde>} />
            <Route path="/eleves/:id" element={<Garde cle="eleves"><FicheEleve /></Garde>} />
            <Route path="/notes" element={<Garde cle="notes"><Notes /></Garde>} />
            <Route path="/bulletins" element={<Garde cle="bulletins"><Bulletins /></Garde>} />
            <Route path="/paiements" element={<Garde cle="paiements"><Paiements /></Garde>} />
            <Route path="/recouvrement" element={<Garde cle="recouvrement"><Recouvrement /></Garde>} />
            <Route path="/emploi-du-temps" element={<Garde cle="emploi"><EmploiDuTemps /></Garde>} />
            <Route path="/annonces" element={<Garde cle="annonces"><Annonces /></Garde>} />
            <Route path="/messagerie" element={<Garde cle="messagerie"><Messagerie /></Garde>} />
            <Route path="/parametres" element={<Garde cle="parametres"><Parametres /></Garde>} />
            <Route path="/certificats" element={<Garde cle="certificats"><Certificats /></Garde>} />
            <Route path="/demandes" element={<Garde cle="demandes"><Demandes /></Garde>} />
            <Route path="/membres" element={<Garde cle="membres"><Membres /></Garde>} />
            <Route path="/a-signer" element={<Garde cle="signatures"><ASigner /></Garde>} />
            <Route path="/comptabilite" element={<Garde cle="comptabilite"><Comptabilite /></Garde>} />
            <Route path="/cantine" element={<Garde cle="cantine"><Cantine /></Garde>} />
            <Route path="/transport" element={<Garde cle="transport"><Transport /></Garde>} />
            <Route path="/rh" element={<Garde cle="rh"><RH /></Garde>} />
          </Route>

          <Route path="*" element={<PageIntrouvable />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </HashRouter>
      </Feedback>
    </AuthProvider>
  );
}
