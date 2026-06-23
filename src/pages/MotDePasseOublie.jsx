import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Alerte } from "@/composants/ui.jsx";

// Demande de réinitialisation du mot de passe (envoi e-mail).
export default function MotDePasseOublie() {
  const { motDePasseOublie } = useAuth();
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const { error } = await motDePasseOublie(email);
      if (error) throw error;
      setEnvoye(true);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-creme">
          <Cachet size={64} className="text-or-500" />
          <h1 className="mt-3 font-display text-xl font-bold">Mot de passe oublié</h1>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-xl">
          {envoye ? (
            <Alerte ton="succes">
              Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation
              vient d'être envoyé. Pensez à vérifier vos spams.
            </Alerte>
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              <p className="text-sm text-navy-900/60">
                Saisissez votre e-mail ; nous vous enverrons un lien de réinitialisation.
              </p>
              <Champ
                label="E-mail" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@ecole.sn"
              />
              <Alerte ton="erreur">{erreur}</Alerte>
              <Bouton type="submit" className="w-full" disabled={enCours}>
                {enCours ? "Envoi…" : "Envoyer le lien"}
              </Bouton>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/connexion" className="text-sm text-navy-700 hover:text-or-500">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
