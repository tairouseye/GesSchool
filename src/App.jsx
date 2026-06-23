import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contextes/AuthContext.jsx";
import RouteProtegee from "@/composants/RouteProtegee.jsx";
import Connexion from "@/pages/Connexion.jsx";
import MotDePasseOublie from "@/pages/MotDePasseOublie.jsx";
import ReinitMotDePasse from "@/pages/ReinitMotDePasse.jsx";
import Onboarding from "@/pages/Onboarding.jsx";
import Accueil from "@/pages/Accueil.jsx";

// GesSchool — routeur applicatif (Phase 0.3).
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser" element={<ReinitMotDePasse />} />

          {/* Connecté sans école → onboarding (pas d'exigence de profil) */}
          <Route
            path="/onboarding"
            element={
              <RouteProtegee exigeProfil={false}>
                <Onboarding />
              </RouteProtegee>
            }
          />

          {/* Espace protégé (profil + école requis) */}
          <Route
            path="/"
            element={
              <RouteProtegee>
                <Accueil />
              </RouteProtegee>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
