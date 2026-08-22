import { useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Carte, Champ, Bouton, Alerte } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";

// Espace parent — « Mon compte » : changer son mot de passe.
// La session étant active, Supabase autorise la mise à jour directe
// (definirMotDePasse → auth.updateUser) sans redemander l'ancien mot de passe.
export default function ParentCompte() {
  const { utilisateur, definirMotDePasse } = useAuth();
  const toast = useToast();
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const trop_court = mdp.length > 0 && mdp.length < 8;
  const discordent = confirmation.length > 0 && mdp !== confirmation;
  const valide = mdp.length >= 8 && mdp === confirmation;

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    if (!valide) return;
    setEnCours(true);
    try {
      const { error } = await definirMotDePasse(mdp);
      if (error) throw error;
      setMdp("");
      setConfirmation("");
      toast.succes("Mot de passe modifié. Il sera demandé à la prochaine connexion.");
    } catch (err) {
      setErreur(err.message || "Modification impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Mon compte</h1>
        <p className="text-sm text-navy-900/50">Gérez vos informations de connexion.</p>
      </div>

      <Carte className="p-6">
        <p className="text-sm text-navy-900/70">
          Connecté avec <span className="font-medium text-navy-900">{utilisateur?.email}</span>
        </p>
      </Carte>

      <Carte className="p-6">
        <h2 className="font-display text-base font-semibold text-navy-900">Changer mon mot de passe</h2>
        <p className="mt-1 text-sm text-navy-900/50">Au moins 8 caractères. Choisissez-en un que vous retiendrez.</p>
        <form onSubmit={soumettre} className="mt-4 max-w-sm space-y-4">
          <div>
            <Champ
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              placeholder="••••••••"
            />
            {trop_court && <p className="mt-1 text-xs text-rose-500">8 caractères minimum.</p>}
          </div>
          <div>
            <Champ
              label="Confirmer le mot de passe"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="••••••••"
            />
            {discordent && <p className="mt-1 text-xs text-rose-500">Les deux mots de passe ne correspondent pas.</p>}
          </div>
          {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
          <Bouton type="submit" disabled={!valide || enCours}>
            {enCours ? "Enregistrement…" : "Modifier le mot de passe"}
          </Bouton>
        </form>
      </Carte>
    </div>
  );
}
