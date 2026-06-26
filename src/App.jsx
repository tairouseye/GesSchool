import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contextes/AuthContext.jsx";
import RouteProtegee, { RouteParent, Garde, GardePromoteur } from "@/composants/RouteProtegee.jsx";
import { espaceParDefaut } from "@/lib/espaces.js";
import Layout from "@/composants/Layout.jsx";
import Connexion from "@/pages/Connexion.jsx";
import MotDePasseOublie from "@/pages/MotDePasseOublie.jsx";
import ReinitMotDePasse from "@/pages/ReinitMotDePasse.jsx";
import Onboarding from "@/pages/Onboarding.jsx";
import Bienvenue from "@/pages/Bienvenue.jsx";
import ParentLayout from "@/pages/ParentLayout.jsx";
import ParentAccueil from "@/pages/ParentAccueil.jsx";
import ParentEnfant from "@/pages/ParentEnfant.jsx";
import TableauDeBord from "@/pages/TableauDeBord.jsx";
import Structure from "@/pages/Structure.jsx";
import Eleves from "@/pages/Eleves.jsx";
import FicheEleve from "@/pages/FicheEleve.jsx";
import Notes from "@/pages/Notes.jsx";
import Bulletins from "@/pages/Bulletins.jsx";
import Paiements from "@/pages/Paiements.jsx";
import Enseignants from "@/pages/Enseignants.jsx";
import VieScolaire from "@/pages/VieScolaire.jsx";
import Recouvrement from "@/pages/Recouvrement.jsx";
import EmploiDuTemps from "@/pages/EmploiDuTemps.jsx";
import Annonces from "@/pages/Annonces.jsx";
import Comptabilite from "@/pages/Comptabilite.jsx";
import RH from "@/pages/RH.jsx";
import Pilotage from "@/pages/Pilotage.jsx";
import AccueilPedagogie from "@/pages/AccueilPedagogie.jsx";

// Redirige vers l'espace d'accueil selon le rôle de l'utilisateur.
function RedirectionAccueil() {
  const { roles, estPromoteur } = useAuth();
  const espace = espaceParDefaut(roles, estPromoteur);
  return <Navigate to={espace?.accueil || "/gestion"} replace />;
}

// GesSchool — routeur applicatif (Phase 0).
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser" element={<ReinitMotDePasse />} />

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
            <Route path="/pedagogie" element={<Garde cle="_pedagogie"><AccueilPedagogie /></Garde>} />
            <Route path="/gestion" element={<Garde cle="_gestion"><TableauDeBord /></Garde>} />
            <Route path="/structure" element={<Garde cle="structure"><Structure /></Garde>} />
            <Route path="/enseignants" element={<Garde cle="enseignants"><Enseignants /></Garde>} />
            <Route path="/vie-scolaire" element={<Garde cle="vie_scolaire"><VieScolaire /></Garde>} />
            <Route path="/eleves" element={<Garde cle="eleves"><Eleves /></Garde>} />
            <Route path="/eleves/:id" element={<Garde cle="eleves"><FicheEleve /></Garde>} />
            <Route path="/notes" element={<Garde cle="notes"><Notes /></Garde>} />
            <Route path="/bulletins" element={<Garde cle="bulletins"><Bulletins /></Garde>} />
            <Route path="/paiements" element={<Garde cle="paiements"><Paiements /></Garde>} />
            <Route path="/recouvrement" element={<Garde cle="recouvrement"><Recouvrement /></Garde>} />
            <Route path="/emploi-du-temps" element={<Garde cle="emploi"><EmploiDuTemps /></Garde>} />
            <Route path="/annonces" element={<Garde cle="annonces"><Annonces /></Garde>} />
            <Route path="/comptabilite" element={<Garde cle="comptabilite"><Comptabilite /></Garde>} />
            <Route path="/rh" element={<Garde cle="rh"><RH /></Garde>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
