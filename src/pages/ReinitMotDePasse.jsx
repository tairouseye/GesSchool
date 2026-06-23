import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Alerte } from "@/composants/ui.jsx";

// Définition d'un nouveau mot de passe après clic sur le lien e-mail.
// Supabase ouvre une session "recovery" via detectSessionInUrl.
export default function ReinitMotDePasse() {
  const { definirMotDePasse } = useAuth();
  const navigate = useNavigate();
  const [mdp, setMdp] = useState("");
  const [confirme, setConfirme] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    if (mdp !== confirme) return setErreur("Les deux mots de passe ne correspondent pas.");
    setEnCours(true);
    try {
      const { error } = await definirMotDePasse(mdp);
      if (error) throw error;
      navigate("/", { replace: true });
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
          <h1 className="mt-3 font-display text-xl font-bold">Nouveau mot de passe</h1>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-xl">
          <form onSubmit={soumettre} className="space-y-4">
            <Champ
              label="Nouveau mot de passe" type="password" required minLength={6}
              value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••"
            />
            <Champ
              label="Confirmer" type="password" required minLength={6}
              value={confirme} onChange={(e) => setConfirme(e.target.value)} placeholder="••••••••"
            />
            <Alerte ton="erreur">{erreur}</Alerte>
            <Bouton type="submit" className="w-full" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Mettre à jour"}
            </Bouton>
          </form>
        </div>
      </div>
    </div>
  );
}
