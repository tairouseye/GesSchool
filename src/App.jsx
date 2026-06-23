import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contextes/AuthContext.jsx";
import RouteProtegee from "@/composants/RouteProtegee.jsx";
import Layout from "@/composants/Layout.jsx";
import Connexion from "@/pages/Connexion.jsx";
import MotDePasseOublie from "@/pages/MotDePasseOublie.jsx";
import ReinitMotDePasse from "@/pages/ReinitMotDePasse.jsx";
import Onboarding from "@/pages/Onboarding.jsx";
import TableauDeBord from "@/pages/TableauDeBord.jsx";
import Structure from "@/pages/Structure.jsx";
import Eleves from "@/pages/Eleves.jsx";
import FicheEleve from "@/pages/FicheEleve.jsx";
import Notes from "@/pages/Notes.jsx";
import Bulletins from "@/pages/Bulletins.jsx";
import EnConstruction from "@/pages/EnConstruction.jsx";

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

          {/* Connecté sans école → onboarding */}
          <Route
            path="/onboarding"
            element={
              <RouteProtegee exigeProfil={false}>
                <Onboarding />
              </RouteProtegee>
            }
          />

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
            <Route path="/eleves" element={<Eleves />} />
            <Route path="/eleves/:id" element={<FicheEleve />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/bulletins" element={<Bulletins />} />
            <Route path="/paiements" element={<EnConstruction titre="Paiements" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
