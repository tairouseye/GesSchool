import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Alerte } from "@/composants/ui.jsx";

// Réinitialisation par CODE à 6 chiffres (2 étapes) — évite le conflit
// lien ↔ HashRouter qui empêchait l'ancien flux d'aboutir.
export default function MotDePasseOublie() {
  const { motDePasseOublie, verifierCodeReset, definirMotDePasse } = useAuth();
  const navigate = useNavigate();
  const [etape, setEtape] = useState("email"); // 'email' | 'code'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mdp, setMdp] = useState("");
  const [confirme, setConfirme] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyerCode(e) {
    e.preventDefault();
    setErreur(""); setEnCours(true);
    try {
      const { error } = await motDePasseOublie(email.trim());
      if (error) throw error;
      setEtape("code");
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  }

  async function reinitialiser(e) {
    e.preventDefault();
    setErreur("");
    if (mdp !== confirme) return setErreur("Les deux mots de passe ne correspondent pas.");
    setEnCours(true);
    try {
      const { error: e1 } = await verifierCodeReset(email, code);
      if (e1) throw new Error(/token|otp|invalid|expired/i.test(e1.message) ? "Code invalide ou expiré." : e1.message);
      const { error: e2 } = await definirMotDePasse(mdp);
      if (e2) throw e2;
      navigate("/", { replace: true });
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  }

  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-creme">
          <img src="/gespro.png" alt="GesPro" className="h-16 w-16 rounded-full bg-white p-1 shadow-lg" />
          <h1 className="mt-3 font-display text-xl font-bold">Mot de passe oublié</h1>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-xl">
          {etape === "email" ? (
            <form onSubmit={envoyerCode} className="space-y-4">
              <p className="text-sm text-navy-900/60">
                Saisissez votre e‑mail : nous vous enverrons un <strong>code de vérification</strong>.
              </p>
              <Champ label="E‑mail" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="vous@ecole.sn" />
              <Alerte ton="erreur">{erreur}</Alerte>
              <Bouton type="submit" className="w-full" disabled={enCours}>
                {enCours ? "Envoi…" : "Envoyer le code"}
              </Bouton>
            </form>
          ) : (
            <form onSubmit={reinitialiser} className="space-y-4">
              <p className="text-sm text-navy-900/60">
                Un code a été envoyé à <strong>{email}</strong>. Saisissez‑le puis choisissez votre nouveau mot de passe.
                <br /><span className="text-navy-900/40">Pensez à vérifier vos spams.</span>
              </p>
              <Champ label="Code reçu par e‑mail" required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric" placeholder="••••••" className="text-center font-mono text-lg tracking-[0.4em]" />
              <Champ label="Nouveau mot de passe" type="password" required minLength={6}
                value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••" />
              <Champ label="Confirmer" type="password" required minLength={6}
                value={confirme} onChange={(e) => setConfirme(e.target.value)} placeholder="••••••••" />
              <Alerte ton="erreur">{erreur}</Alerte>
              <Bouton type="submit" className="w-full" disabled={enCours || code.length < 6}>
                {enCours ? "Validation…" : "Réinitialiser le mot de passe"}
              </Bouton>
              <button type="button" onClick={() => { setEtape("email"); setErreur(""); }}
                className="w-full text-center text-xs text-navy-700 hover:text-or-500">
                ← Modifier l'e‑mail / renvoyer un code
              </button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/connexion" className="text-sm text-navy-700 hover:text-or-500">← Retour à la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
