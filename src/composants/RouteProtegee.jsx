import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";

// Garde de route :
//  - non connecté          → /connexion
//  - connecté sans profil  → /onboarding (école pas encore créée)
//  - rôle requis non détenu → page « accès refusé »
export default function RouteProtegee({ children, role, exigeProfil = true }) {
  const { estConnecte, aProfil, aRole, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Ecran chargement />;

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  if (exigeProfil && !aProfil) {
    return <Navigate to="/onboarding" replace />;
  }

  if (role && !aRole(role)) {
    return <Ecran message="Accès refusé : vous n'avez pas les droits requis." />;
  }

  return children;
}

function Ecran({ chargement, message }) {
  return (
    <div className="grid min-h-full place-items-center bg-navy-900 text-creme">
      <div className="flex flex-col items-center gap-4">
        <Cachet size={88} className={`text-or-500 ${chargement ? "animate-pulse" : ""}`} />
        <p className="text-sm text-creme/70">{chargement ? "Chargement…" : message}</p>
      </div>
    </div>
  );
}
