import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  // Charge le profil + les rôles de l'utilisateur connecté.
  const chargerProfil = useCallback(async (userId) => {
    if (!userId) {
      setProfil(null);
      setRoles([]);
      setEcole(null);
      setEcolesPossedees([]);
      return;
    }
    const { data: p } = await supabase
      .from("profils")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfil(p ?? null);

    const { data: r } = await supabase
      .from("profil_roles")
      .select("role")
      .eq("profil_id", userId);
    setRoles((r ?? []).map((x) => x.role));

    // Écoles possédées (promoteur multi-écoles)
    const { data: prop } = await supabase
      .from("proprietaires")
      .select("ecole_id, ecoles(nom, sigle)")
      .eq("profil_id", userId);
    setEcolesPossedees(
      (prop ?? []).map((x) => ({ ecole_id: x.ecole_id, nom: x.ecoles?.nom, sigle: x.ecoles?.sigle }))
    );

    // École de rattachement (pour l'en-tête / la navigation)
    if (p?.ecole_id) {
      const { data: e } = await supabase
        .from("ecoles")
        .select("*")
        .eq("id", p.ecole_id)
        .maybeSingle();
      setEcole(e ?? null);
    } else {
      setEcole(null);
    }
  }, []);

  useEffect(() => {
    // Session initiale
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await chargerProfil(data.session?.user?.id);
      setChargement(false);
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
    ecolesPossedees,
    estPromoteur: ecolesPossedees.length > 0,
    estConnecte: !!session,
    aProfil: !!profil,
    estSuspendu: !!profil && profil.actif === false,
    estParent: roles.includes("parent"),
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
