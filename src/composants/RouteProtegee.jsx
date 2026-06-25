import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { peutVoir, premierePage } from "@/lib/permissions.js";

// Garde de route :
//  - non connecté          → /connexion
//  - connecté sans profil  → /onboarding (école pas encore créée)
//  - rôle requis non détenu → page « accès refusé »
// Garde de l'espace STAFF (admin/direction/enseignant…).
export default function RouteProtegee({ children, role, exigeProfil = true }) {
  const { estConnecte, aProfil, estParent, aRole, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Ecran chargement />;

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  // Un parent n'a rien à faire dans l'espace de gestion → espace parent.
  if (estParent) {
    return <Navigate to="/parent" replace />;
  }

  if (exigeProfil && !aProfil) {
    return <Navigate to="/bienvenue" replace />;
  }

  if (role && !aRole(role)) {
    return <Ecran message="Accès refusé : vous n'avez pas les droits requis." />;
  }

  return children;
}

// Garde de page selon le rôle (RBAC). À utiliser à l'intérieur de l'espace staff.
// Si l'utilisateur n'a pas accès à la page, on le renvoie vers sa première
// page autorisée (jamais de cul-de-sac).
export function Garde({ cle, children }) {
  const { roles } = useAuth();
  if (!peutVoir(roles, cle)) {
    return <Navigate to={premierePage(roles)} replace />;
  }
  return children;
}

// Garde de l'ESPACE PARENT.
export function RouteParent({ children }) {
  const { estConnecte, estParent, aProfil, chargement } = useAuth();
  if (chargement) return <Ecran chargement />;
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (!estParent) return <Navigate to={aProfil ? "/" : "/bienvenue"} replace />;
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
