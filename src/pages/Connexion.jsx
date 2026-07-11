import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Alerte } from "@/composants/ui.jsx";

// Page Connexion / Inscription (onglets).
export default function Connexion() {
  const { connexion, inscription } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("connexion"); // 'connexion' | 'inscription'
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setInfo("");
    setEnCours(true);
    try {
      if (mode === "connexion") {
        const { error } = await connexion(email, mdp);
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { data, error } = await inscription(email, mdp);
        if (error) throw error;
        // Selon la config Supabase, une confirmation e-mail peut être requise.
        if (data.session) navigate("/", { replace: true });
        else setInfo("Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      }
    } catch (err) {
      setErreur(traduireErreur(err.message));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-creme">
          <Cachet size={72} className="text-or-500" />
          <h1 className="mt-3 font-display text-2xl font-bold">
            Ges<span className="text-or-500">School</span>
          </h1>
          <p className="text-sm text-creme/60">Gestion scolaire multi-écoles</p>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-xl">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-creme p-1">
            {["connexion", "inscription"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErreur(""); setInfo(""); }}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? "bg-navy-900 text-creme" : "text-navy-900/60 hover:text-navy-900"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={soumettre} className="space-y-4">
            <Champ
              label="E-mail" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@ecole.sn"
            />
            <Champ
              label="Mot de passe" type="password" required minLength={6}
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              value={mdp} onChange={(e) => setMdp(e.target.value)}
              placeholder="••••••••"
            />

            <Alerte ton="erreur">{erreur}</Alerte>
            <Alerte ton="succes">{info}</Alerte>

            <Bouton type="submit" className="w-full" disabled={enCours}>
              {enCours ? "Patientez…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Bouton>
          </form>

          {mode === "connexion" && (
            <div className="mt-4 text-center">
              <Link to="/mot-de-passe-oublie" className="text-sm text-navy-700 hover:text-or-500">
                Mot de passe oublié ?
              </Link>
            </div>
          )}
        </div>
        <div className="mt-6 space-y-1 text-center text-[11px] text-creme/40">
          <p>Développé par <span className="font-semibold text-creme/70">GesPro</span></p>
          <p className="text-creme/30">
            <a href="mailto:gespro.sn@gmail.com" className="hover:text-or-500">gespro.sn@gmail.com</a>
          </p>
          <p className="text-creme/30">
            Assistance : <a href="tel:+221773435928" className="hover:text-or-500">+221 77 343 59 28</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function traduireErreur(msg = "") {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou mot de passe incorrect.";
  if (/user already registered/i.test(msg)) return "Un compte existe déjà avec cet e-mail.";
  if (/email not confirmed/i.test(msg)) return "E-mail non confirmé. Vérifiez votre boîte de réception.";
  if (/password should be at least/i.test(msg)) return "Le mot de passe doit faire au moins 6 caractères.";
  return msg || "Une erreur est survenue.";
}
