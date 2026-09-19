import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contextes/AuthContext.jsx";
import RouteProtegee, { RouteParent, RouteEtudiant, Garde, GardePromoteur, GardeSuper, EcranSansAcces } from "@/composants/RouteProtegee.jsx";
import { Feedback } from "@/composants/Feedback.jsx";
import ErrorBoundary from "@/composants/ErrorBoundary.jsx";
import { ChargementPage } from "@/composants/ui.jsx";
import { premiereRoute, routeOuvrable, itemPourType } from "@/lib/espaces.js";
import { estRoleComplet } from "@/lib/permissions.js";

// Coques + 1er écran : chargés d'emblée (points d'entrée du routeur).
import Layout from "@/composants/Layout.jsx";
import ParentLayout from "@/pages/ParentLayout.jsx";
import Connexion from "@/pages/Connexion.jsx";

// Pages : chargées à la demande (un chunk par page). L'app reste légère et
// les modules non ouverts ne pèsent pas sur le chargement initial.
const MotDePasseOublie = lazy(() => import("@/pages/MotDePasseOublie.jsx"));
const APropos = lazy(() => import("@/pages/APropos.jsx"));
const Verifier = lazy(() => import("@/pages/Verifier.jsx"));
const ReinitMotDePasse = lazy(() => import("@/pages/ReinitMotDePasse.jsx"));
const Onboarding = lazy(() => import("@/pages/Onboarding.jsx"));
const Bienvenue = lazy(() => import("@/pages/Bienvenue.jsx"));
const ParentAccueil = lazy(() => import("@/pages/ParentAccueil.jsx"));
const ParentEnfant = lazy(() => import("@/pages/ParentEnfant.jsx"));
const ParentNotifications = lazy(() => import("@/pages/ParentNotifications.jsx"));
const ParentMessagerie = lazy(() => import("@/pages/ParentMessagerie.jsx"));
const ParentCompte = lazy(() => import("@/pages/ParentCompte.jsx"));
const Messagerie = lazy(() => import("@/pages/Messagerie.jsx"));
const TableauDeBord = lazy(() => import("@/pages/TableauDeBord.jsx"));
const Structure = lazy(() => import("@/pages/Structure.jsx"));
const Filieres = lazy(() => import("@/pages/Filieres.jsx"));
const InscriptionsSup = lazy(() => import("@/pages/InscriptionsSup.jsx"));
const NotesLMD = lazy(() => import("@/pages/NotesLMD.jsx"));
const Deliberations = lazy(() => import("@/pages/Deliberations.jsx"));
const CodesEtudiants = lazy(() => import("@/pages/CodesEtudiants.jsx"));
const Bibliotheque = lazy(() => import("@/pages/Bibliotheque.jsx"));
const BiblioCirculation = lazy(() => import("@/pages/BiblioCirculation.jsx"));
const BiblioDepots = lazy(() => import("@/pages/BiblioDepots.jsx"));
const BiblioAcquisitions = lazy(() => import("@/pages/BiblioAcquisitions.jsx"));
const BiblioInventaire = lazy(() => import("@/pages/BiblioInventaire.jsx"));
const EtudiantLayout = lazy(() => import("@/pages/EtudiantLayout.jsx"));
const EtudiantAccueil = lazy(() => import("@/pages/EtudiantAccueil.jsx"));
const EtudiantBibliotheque = lazy(() => import("@/pages/EtudiantBibliotheque.jsx"));
const EtudiantDepots = lazy(() => import("@/pages/EtudiantDepots.jsx"));
const EtudiantNotes = lazy(() => import("@/pages/EtudiantNotes.jsx"));
const EtudiantScolarite = lazy(() => import("@/pages/EtudiantScolarite.jsx"));
const EtudiantDocuments = lazy(() => import("@/pages/EtudiantDocuments.jsx"));
const EtudiantActualites = lazy(() => import("@/pages/EtudiantActualites.jsx"));
const EtudiantCarte = lazy(() => import("@/pages/EtudiantCarte.jsx"));
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
const Abonnement = lazy(() => import("@/pages/Abonnement.jsx"));
const Organigramme = lazy(() => import("@/pages/Organigramme.jsx"));
const Documentation = lazy(() => import("@/pages/Documentation.jsx"));
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
const CodesParents = lazy(() => import("@/pages/CodesParents.jsx"));
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
  const { roles, estPromoteur, modulesActifs, ecole } = useAuth();
  const typeEtab = ecole?.type_etablissement;
  // Un enseignant « pur » arrive directement sur l'appel de sa classe — mais
  // seulement si la page lui est réellement ouverte (module Vie scolaire actif)
  // et pertinente pour le type d'établissement (l'appel n'existe pas au supérieur).
  const appel = { to: "/appel", cle: "appel", types: ["ecole"] };
  if (roles.includes("enseignant") && !estRoleComplet(roles) && !estPromoteur
      && routeOuvrable(appel, roles, estPromoteur, modulesActifs) && itemPourType(appel, typeEtab)) {
    return <Navigate to="/appel" replace />;
  }
  // Sinon : première page RÉELLEMENT ouvrable. Si aucune, on l'annonce au lieu
  // de renvoyer vers un accueil que la garde refusera (boucle infinie).
  const cible = premiereRoute(roles, estPromoteur, modulesActifs, typeEtab);
  if (!cible) return <EcranSansAcces />;
  return <Navigate to={cible} replace />;
}

// Adresse inconnue. On l'annonce au lieu de rediriger en silence : une
// redirection muette masque les liens cassés (et les fautes de frappe).
function PageIntrouvable() {
  const { estConnecte } = useAuth();
  return (
    <div className="grid min-h-dscreen place-items-center bg-navy-900 px-4 text-creme">
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
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/verifier" element={<Verifier />} />

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
            <Route path="compte" element={<ParentCompte />} />
          </Route>

          {/* Espace étudiant (supérieur) */}
          <Route
            path="/etudiant"
            element={
              <RouteEtudiant>
                <EtudiantLayout />
              </RouteEtudiant>
            }
          >
            <Route index element={<EtudiantAccueil />} />
            <Route path="bibliotheque" element={<EtudiantBibliotheque />} />
            <Route path="notes" element={<EtudiantNotes />} />
            <Route path="scolarite" element={<EtudiantScolarite />} />
            <Route path="documents" element={<EtudiantDocuments />} />
            <Route path="actualites" element={<EtudiantActualites />} />
            <Route path="carte" element={<EtudiantCarte />} />
            <Route path="depots" element={<EtudiantDepots />} />
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
            <Route path="/abonnement" element={<GardePromoteur><Abonnement /></GardePromoteur>} />
            <Route path="/organigramme" element={<GardePromoteur><Organigramme /></GardePromoteur>} />
            <Route path="/documentation" element={<GardePromoteur><Documentation /></GardePromoteur>} />
            <Route path="/pedagogie" element={<Garde cle="_pedagogie"><AccueilPedagogie /></Garde>} />
            <Route path="/gestion" element={<Garde cle="_gestion"><TableauDeBord /></Garde>} />
            <Route path="/structure" element={<Garde cle="structure"><Structure /></Garde>} />
            <Route path="/filieres" element={<Garde cle="filieres"><Filieres /></Garde>} />
            <Route path="/inscriptions-sup" element={<Garde cle="inscriptions_sup"><InscriptionsSup /></Garde>} />
            <Route path="/notes-lmd" element={<Garde cle="notes_lmd"><NotesLMD /></Garde>} />
            <Route path="/deliberations" element={<Garde cle="deliberations_sup"><Deliberations /></Garde>} />
            <Route path="/codes-etudiants" element={<Garde cle="codes_etudiants"><CodesEtudiants /></Garde>} />
            <Route path="/bibliotheque" element={<Garde cle="bibliotheque"><Bibliotheque /></Garde>} />
            <Route path="/biblio-circulation" element={<Garde cle="biblio_circulation"><BiblioCirculation /></Garde>} />
            <Route path="/biblio-depots" element={<Garde cle="biblio_depots"><BiblioDepots /></Garde>} />
            <Route path="/biblio-acquisitions" element={<Garde cle="biblio_acquisitions"><BiblioAcquisitions /></Garde>} />
            <Route path="/biblio-inventaire" element={<Garde cle="biblio_inventaire"><BiblioInventaire /></Garde>} />
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
            <Route path="/codes-parents" element={<Garde cle="codes_parents"><CodesParents /></Garde>} />
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
