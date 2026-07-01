import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { peutVoir, premierePage } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

// Garde de route :
//  - non connecté          → /connexion
//  - connecté sans profil  → /onboarding (école pas encore créée)
//  - rôle requis non détenu → page « accès refusé »
// Garde de l'espace STAFF (admin/direction/enseignant…).
export default function RouteProtegee({ children, role, exigeProfil = true }) {
  const { estConnecte, aProfil, estParent, estSuspendu, aRole, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Ecran chargement />;

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  if (estSuspendu) return <EcranSuspendu />;

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
  const { roles, modulesActifs } = useAuth();
  if (!peutVoir(roles, cle) || !moduleActif(modulesActifs, cle)) {
    return <Navigate to={premierePage(roles)} replace />;
  }
  return children;
}

// Garde de la console SUPER-ADMIN (propriétaire SaaS).
export function GardeSuper({ children }) {
  const { estConnecte, estSuperAdmin, chargement } = useAuth();
  if (chargement) return <Ecran chargement />;
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (!estSuperAdmin) return <Navigate to="/" replace />;
  return children;
}

// Garde de l'espace PILOTAGE (réservé aux promoteurs / propriétaires d'école).
export function GardePromoteur({ children }) {
  const { estPromoteur } = useAuth();
  if (!estPromoteur) return <Navigate to="/" replace />;
  return children;
}

// Garde de l'ESPACE PARENT.
export function RouteParent({ children }) {
  const { estConnecte, estParent, estSuspendu, aProfil, chargement } = useAuth();
  if (chargement) return <Ecran chargement />;
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (estSuspendu) return <EcranSuspendu />;
  if (!estParent) return <Navigate to={aProfil ? "/" : "/bienvenue"} replace />;
  return children;
}

// Écran affiché lorsqu'un compte a été suspendu par un responsable.
function EcranSuspendu() {
  const { deconnexion } = useAuth();
  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 text-creme">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Cachet size={72} className="text-or-500/60" />
        <h1 className="font-display text-xl font-bold">Compte suspendu</h1>
        <p className="text-sm text-creme/70">
          Votre accès a été suspendu par l'administration de l'établissement. Contactez votre responsable pour le réactiver.
        </p>
        <button onClick={deconnexion} className="rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-or-400">
          Déconnexion
        </button>
      </div>
    </div>
  );
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
