import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contextes/AuthContext.jsx";
import RouteProtegee, { RouteParent } from "@/composants/RouteProtegee.jsx";
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
            <Route path="/" element={<TableauDeBord />} />
            <Route path="/structure" element={<Structure />} />
            <Route path="/enseignants" element={<Enseignants />} />
            <Route path="/vie-scolaire" element={<VieScolaire />} />
            <Route path="/eleves" element={<Eleves />} />
            <Route path="/eleves/:id" element={<FicheEleve />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/bulletins" element={<Bulletins />} />
            <Route path="/paiements" element={<Paiements />} />
            <Route path="/recouvrement" element={<Recouvrement />} />
            <Route path="/emploi-du-temps" element={<EmploiDuTemps />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
