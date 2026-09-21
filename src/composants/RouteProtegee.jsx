import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import { premiereRoute } from "@/lib/espaces.js";

// Garde de route :
//  - non connecté          → /connexion
//  - connecté sans profil  → /onboarding (école pas encore créée)
//  - rôle requis non détenu → page « accès refusé »
// Garde de l'espace STAFF (admin/direction/enseignant…).
export default function RouteProtegee({ children, role, exigeProfil = true }) {
  const { estConnecte, aProfil, sansProfil, erreurProfil, estParent, estEtudiant, estSuspendu, aRole, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Ecran chargement />;

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  // ⚠️ Le profil n'a pas pu être LU (réseau, jeton en renouvellement…).
  // Ce n'est pas la même chose qu'un compte sans école : envoyer ici vers
  // « Bienvenue » disait à un utilisateur établi qu'il n'avait pas de compte.
  if (erreurProfil) return <EcranProfilIllisible />;

  if (estSuspendu) return <EcranSuspendu />;

  // Un parent n'a rien à faire dans l'espace de gestion → espace parent.
  if (estParent) {
    return <Navigate to="/parent" replace />;
  }

  // Un étudiant (supérieur) → son espace dédié.
  if (estEtudiant) {
    return <Navigate to="/etudiant" replace />;
  }

  // `sansProfil` et non `!aProfil` : la lecture doit avoir ABOUTI.
  if (exigeProfil && sansProfil) {
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
  const { roles, estPromoteur, modulesActifs } = useAuth();
  const location = useLocation();
  if (!peutVoir(roles, cle) || !moduleActif(modulesActifs, cle)) {
    const repli = premiereRoute(roles, estPromoteur, modulesActifs);
    // Pas de repli, ou repli = la page qu'on vient de refuser → on affiche un
    // écran explicite. Rediriger ici créerait une boucle infinie.
    if (!repli || repli === location.pathname) return <EcranSansAcces />;
    return <Navigate to={repli} replace />;
  }
  return children;
}

// Aucun accès : ni page autorisée, ni module actif. Cas typique d'un membre
// invité dont le rôle n'a pas encore été attribué.
export function EcranSansAcces() {
  const { deconnexion, profil } = useAuth();
  return (
    <div className="grid min-h-dscreen place-items-center bg-navy-900 px-4 text-creme">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Cachet size={72} className="text-or-500/60" />
        <h1 className="font-display text-xl font-bold">Aucun accès pour l'instant</h1>
        <p className="text-sm text-creme/70">
          {profil ? `${profil.prenom}, votre` : "Votre"} compte est bien rattaché à l'établissement,
          mais aucun rôle ne vous a encore été attribué. Demandez à la direction de vous en donner un
          dans « Membres ».
        </p>
        <a href="https://wa.me/221773435928?text=Bonjour%2C%20mon%20compte%20GesSchool%20n%27a%20aucun%20acc%C3%A8s."
          target="_blank" rel="noreferrer"
          className="rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-or-400">
          💬 Contacter l'assistance
        </a>
        <button onClick={deconnexion} className="text-xs text-creme/60 underline hover:text-creme">
          Déconnexion
        </button>
      </div>
    </div>
  );
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
  const { estConnecte, estParent, estSuspendu, sansProfil, erreurProfil, chargement } = useAuth();
  if (chargement) return <Ecran chargement />;
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (erreurProfil) return <EcranProfilIllisible />;
  if (estSuspendu) return <EcranSuspendu />;
  if (!estParent) return <Navigate to={sansProfil ? "/bienvenue" : "/"} replace />;
  return children;
}

// Garde de l'ESPACE ÉTUDIANT (supérieur).
export function RouteEtudiant({ children }) {
  const { estConnecte, estEtudiant, estSuspendu, sansProfil, erreurProfil, chargement } = useAuth();
  if (chargement) return <Ecran chargement />;
  if (!estConnecte) return <Navigate to="/connexion" replace />;
  if (erreurProfil) return <EcranProfilIllisible />;
  if (estSuspendu) return <EcranSuspendu />;
  if (!estEtudiant) return <Navigate to={sansProfil ? "/bienvenue" : "/"} replace />;
  return children;
}

// Le profil n'a pas pu être lu. On le DIT, avec un bouton pour réessayer —
// plutôt que de conclure que l'utilisateur n'a pas de compte et de l'envoyer
// créer une école qu'il possède déjà.
function EcranProfilIllisible() {
  const { erreurProfil, rafraichirProfil, deconnexion } = useAuth();
  return (
    <div className="grid min-h-dscreen place-items-center bg-navy-900 px-4 text-creme">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Cachet size={72} className="text-or-500/60" />
        <h1 className="font-display text-xl font-bold">Connexion au serveur interrompue</h1>
        <p className="text-sm text-creme/70">
          Votre compte existe bien — c&apos;est la lecture de votre profil qui a échoué.
          Vérifiez votre connexion, puis réessayez.
        </p>
        {erreurProfil && (
          <p className="rounded-lg bg-white/5 px-3 py-2 font-mono text-[11px] text-creme/50">{erreurProfil}</p>
        )}
        <button onClick={rafraichirProfil}
          className="rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-or-400">
          Réessayer
        </button>
        <button onClick={deconnexion} className="text-xs text-creme/60 underline hover:text-creme">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

// Écran affiché lorsqu'un compte a été suspendu par un responsable.
function EcranSuspendu() {
  const { deconnexion } = useAuth();
  return (
    <div className="grid min-h-dscreen place-items-center bg-navy-900 px-4 text-creme">
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
    <div className="grid min-h-dscreen place-items-center bg-navy-900 text-creme">
      <div className="flex flex-col items-center gap-4">
        <Cachet size={88} className={`text-or-500 ${chargement ? "animate-pulse" : ""}`} />
        <p className="text-sm text-creme/70">{chargement ? "Chargement…" : message}</p>
      </div>
    </div>
  );
}
