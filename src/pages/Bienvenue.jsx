import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { lierParent } from "@/lib/parent.js";
import { lierEnseignant } from "@/lib/enseignants.js";
import { rejoindre } from "@/lib/membres.js";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Alerte } from "@/composants/ui.jsx";

// Landing pour un utilisateur connecté sans profil : créer une école (staff)
// ou se rattacher à ses enfants via un code (parent).
export default function Bienvenue() {
  const { utilisateur, aProfil, estParent, deconnexion, rafraichirProfil } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | 'parent' | 'enseignant' | 'membre'
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Lien d'invitation : code mémorisé par /rejoindre → pré-remplir en mode membre.
  useEffect(() => {
    const c = localStorage.getItem("invit_code");
    if (c) { setCode(c.toUpperCase()); setMode("membre"); }
  }, []);

  // Déjà rattaché → rediriger
  if (estParent) return <Navigate to="/parent" replace />;
  if (aProfil) return <Navigate to="/" replace />;

  async function lier(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      if (mode === "membre") {
        await rejoindre(code.trim());
        localStorage.removeItem("invit_code");
        await rafraichirProfil();
        navigate("/", { replace: true });
      } else if (mode === "enseignant") {
        await lierEnseignant(code.trim());
        await rafraichirProfil();
        navigate("/", { replace: true });
      } else {
        await lierParent(code.trim());
        await rafraichirProfil();
        navigate("/parent", { replace: true });
      }
    } catch (err) {
      setErreur(/invalide/i.test(err.message) ? "Code invalide. Vérifiez auprès de l'établissement." : err.message);
    } finally {
      setEnCours(false);
    }
  }

  const estCode = mode === "parent" || mode === "enseignant" || mode === "membre";
  const libelleEspace = mode === "membre" ? "Espace personnel" : mode === "enseignant" ? "Espace enseignant" : "Espace parent";

  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-creme">
          <Cachet size={64} className="text-or-500" />
          <h1 className="mt-3 font-display text-2xl font-bold">Bienvenue sur GesSchool</h1>
          <p className="text-sm text-creme/60">{utilisateur?.email}</p>
        </div>

        {estCode ? (
          <div className="rounded-2xl bg-white p-7 shadow-xl">
            <h2 className="font-display text-lg font-semibold text-navy-900">{libelleEspace}</h2>
            <p className="mt-1 text-sm text-navy-900/60">
              Saisissez le <strong>code d'invitation</strong> communiqué par {mode === "parent" ? "l'établissement de votre enfant" : "votre établissement"}.
            </p>
            <form onSubmit={lier} className="mt-4 space-y-4">
              <Champ
                label="Code d'invitation"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EX. 3F9A2B7C"
                className="font-mono tracking-widest"
              />
              <Alerte ton="erreur">{erreur}</Alerte>
              <Bouton type="submit" className="w-full" disabled={enCours || !code.trim()}>
                {enCours ? "Liaison…" : "Rejoindre l'établissement"}
              </Bouton>
            </form>
            <button
              onClick={() => { setMode(null); setCode(""); setErreur(""); localStorage.removeItem("invit_code"); }}
              className="mt-4 text-sm text-navy-700 hover:text-or-500"
            >
              ← Retour
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => navigate("/onboarding")}
              className="rounded-2xl bg-white p-6 text-left shadow-xl transition hover:ring-2 hover:ring-or-500"
            >
              <div className="text-2xl">🏫</div>
              <p className="mt-3 font-display text-lg font-bold text-navy-900">Je gère une école</p>
              <p className="mt-1 text-sm text-navy-900/50">Créer mon établissement et son espace d'administration.</p>
            </button>
            <button
              onClick={() => setMode("membre")}
              className="rounded-2xl bg-white p-6 text-left shadow-xl transition hover:ring-2 hover:ring-or-500"
            >
              <div className="text-2xl">🧑‍💼</div>
              <p className="mt-3 font-display text-lg font-bold text-navy-900">Je suis un membre du personnel</p>
              <p className="mt-1 text-sm text-navy-900/50">Responsable, comptable, secrétaire, surveillant… avec un code d'invitation.</p>
            </button>
            <button
              onClick={() => setMode("enseignant")}
              className="rounded-2xl bg-white p-6 text-left shadow-xl transition hover:ring-2 hover:ring-or-500"
            >
              <div className="text-2xl">🧑‍🏫</div>
              <p className="mt-3 font-display text-lg font-bold text-navy-900">Je suis un enseignant</p>
              <p className="mt-1 text-sm text-navy-900/50">Gérer ma classe et mes matières avec un code de liaison.</p>
            </button>
            <button
              onClick={() => setMode("parent")}
              className="rounded-2xl bg-white p-6 text-left shadow-xl transition hover:ring-2 hover:ring-or-500"
            >
              <div className="text-2xl">👪</div>
              <p className="mt-3 font-display text-lg font-bold text-navy-900">Je suis un parent</p>
              <p className="mt-1 text-sm text-navy-900/50">Suivre la scolarité de mon enfant avec un code de liaison.</p>
            </button>
          </div>
        )}

        <div className="mt-5 text-center">
          <button onClick={deconnexion} className="text-xs text-creme/40 hover:text-creme/70">Déconnexion</button>
        </div>
      </div>
    </div>
  );
}
