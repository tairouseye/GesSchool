import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase.js";
import { appliquerAccent } from "@/lib/theme.js";

// GesSchool — contexte d'authentification.
// Expose : session, profil applicatif, rôles, école courante + actions.
// Le profil et les rôles sont créés à l'onboarding (Phase 0.4) ; un
// utilisateur fraîchement inscrit n'a donc pas encore de profil.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [roles, setRoles] = useState([]);
  const [ecole, setEcole] = useState(null);
  const [ecolesPossedees, setEcolesPossedees] = useState([]);
  const [chargement, setChargement] = useState(true);
  // ⚠️ Distingue « cet utilisateur n'a pas de profil » (il doit créer son
  // école) de « je n'ai pas RÉUSSI à lire son profil » (réseau coupé, jeton
  // en cours de renouvellement, RLS qui refuse). Sans cette distinction, la
  // moindre erreur de lecture renvoyait un utilisateur établi sur l'écran de
  // bienvenue — et le `replace` de la garde l'y laissait.
  const [erreurProfil, setErreurProfil] = useState(null);
  // Numéro de la dernière demande : `onAuthStateChange` se déclenche à chaque
  // renouvellement de jeton, et deux chargements peuvent se croiser. Une
  // réponse en retard ne doit pas écraser une plus récente.
  const demande = useRef(0);

  // Charge le profil + les rôles de l'utilisateur connecté.
  const chargerProfil = useCallback(async (userId) => {
    const n = ++demande.current;
    if (!userId) {
      setProfil(null);
      setRoles([]);
      setEcole(null);
      setEcolesPossedees([]);
      setErreurProfil(null);
      return;
    }
    // Profil, rôles et écoles possédées sont indépendants → EN PARALLÈLE
    // (au lieu de 3 allers-retours en série, rejoués à chaque événement d'auth).
    let rp, rr, rprop;
    try {
      [rp, rr, rprop] = await Promise.all([
        supabase.from("profils").select("*").eq("id", userId).maybeSingle(),
        supabase.from("profil_roles").select("role").eq("profil_id", userId),
        supabase.from("proprietaires").select("ecole_id, ecoles(nom, sigle)").eq("profil_id", userId),
      ]);
    } catch (e) {
      if (n === demande.current) setErreurProfil(e.message || "Connexion au serveur impossible.");
      return;
    }
    if (n !== demande.current) return;   // une demande plus récente a pris la main

    // ⚠️ Une ERREUR n'est pas une absence de profil. On ne touche à rien :
    // l'état précédent reste valable, et l'interface propose de réessayer.
    if (rp.error) {
      setErreurProfil(rp.error.message || "Profil illisible.");
      return;
    }

    setErreurProfil(null);
    setProfil(rp.data ?? null);
    setRoles((rr.data ?? []).map((x) => x.role));
    setEcolesPossedees(
      (rprop.data ?? []).map((x) => ({ ecole_id: x.ecole_id, nom: x.ecoles?.nom, sigle: x.ecoles?.sigle }))
    );

    // École de rattachement (dépend de profil.ecole_id) → 2ᵉ vague.
    if (rp.data?.ecole_id) {
      const { data: e } = await supabase.from("ecoles").select("*").eq("id", rp.data.ecole_id).maybeSingle();
      if (n === demande.current) setEcole(e ?? null);
    } else {
      setEcole(null);
    }
  }, []);

  useEffect(() => {
    // Session initiale
    // `finally` : si le chargement du profil échoue, l'écran d'attente ne
    // doit pas rester figé pour autant — la garde affichera l'erreur.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      try { await chargerProfil(data.session?.user?.id); }
      finally { setChargement(false); }
    });

    // Écoute des changements (login / logout / refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await chargerProfil(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [chargerProfil]);

  // Applique l'accent de l'école (login, changement d'école, sauvegarde).
  // couleur_secondaire = accent doré, déjà saisi à l'onboarding et en Paramètres.
  useEffect(() => {
    appliquerAccent(ecole?.couleur_secondaire);
  }, [ecole?.couleur_secondaire]);

  // --- Actions ---
  const connexion = (email, motDePasse) =>
    supabase.auth.signInWithPassword({ email, password: motDePasse });

  const inscription = (email, motDePasse) =>
    supabase.auth.signUp({ email, password: motDePasse });

  const deconnexion = () => supabase.auth.signOut();

  // Réinitialisation par CODE à 6 chiffres (évite le conflit lien ↔ HashRouter).
  // ⚙️ Le template e-mail Supabase « Reset Password » doit contenir {{ .Token }}.
  const motDePasseOublie = (email) =>
    supabase.auth.resetPasswordForEmail(email);

  // Vérifie le code reçu par e-mail → ouvre une session « recovery ».
  const verifierCodeReset = (email, code) =>
    supabase.auth.verifyOtp({ email: (email || "").trim(), token: (code || "").trim(), type: "recovery" });

  // À appeler APRÈS verifierCodeReset (une fois la session recovery active).
  const definirMotDePasse = (motDePasse) =>
    supabase.auth.updateUser({ password: motDePasse });

  const rafraichirProfil = () => chargerProfil(session?.user?.id);

  const valeur = {
    session,
    utilisateur: session?.user ?? null,
    profil,
    roles,
    ecole,
    ecoleId: profil?.ecole_id ?? null,
    modulesActifs: ecole?.modules_actifs ?? null,
    typeEtablissement: ecole?.type_etablissement ?? "ecole",
    ecolesPossedees,
    estPromoteur: ecolesPossedees.length > 0,
    estConnecte: !!session,
    aProfil: !!profil,
    // Vrai seulement si la lecture a ABOUTI et n'a rien trouvé : c'est la
    // seule situation où proposer la création d'une école.
    sansProfil: !profil && !erreurProfil,
    erreurProfil,
    estSuspendu: !!profil && profil.actif === false,
    estParent: roles.includes("parent"),
    estEtudiant: roles.includes("etudiant"),
    estSuperAdmin: roles.includes("super_admin"),
    chargement,
    aRole: (r) => roles.includes(r),
    connexion,
    inscription,
    deconnexion,
    motDePasseOublie,
    verifierCodeReset,
    definirMotDePasse,
    rafraichirProfil,
  };

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
