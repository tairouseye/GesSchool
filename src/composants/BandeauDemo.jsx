import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";

// Rappel permanent de la démonstration sans compte (mig. 216) : le visiteur
// sait pourquoi « Enregistrer » refuse, et où aller pour essayer pour de vrai.
//  `compact` (espace parent) : une ligne. Le bandeau complet prenait un
//  cinquième de l'écran d'un téléphone, sur chaque page.
export default function BandeauDemo({ compact = false }) {
  const { modeDemo, deconnexion } = useAuth();
  const navigate = useNavigate();
  if (!modeDemo) return null;
  //  Un parent ne crée pas d'école : il crée son compte, puis saisit le
  //  code que son école lui donne.
  const parent = modeDemo === "parent";

  // On quitte la démo vers l'onglet Inscription : elle est la même pour un
  // parent et une école, le choix du profil vient juste après. La navigation
  // d'abord : la garde des routes renverrait sinon vers la connexion, sans
  // l'onglet.
  const creer = () => { navigate("/connexion?mode=inscription", { replace: true }); deconnexion(); };

  if (compact) {
    return (
      <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-or-500/40 bg-or-500/15 px-3 py-1 text-xs text-navy-900">
        <p className="min-w-0"><b>Démo</b> · rien n&apos;est enregistré</p>
        <button type="button" onClick={creer}
          className="min-h-10 shrink-0 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-creme hover:bg-navy-800">
          {parent ? "Créer mon compte" : "Créer mon école"}
        </button>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-or-500/40 bg-or-500/15 px-4 py-3 text-sm text-navy-900">
      <p className="min-w-0 flex-1">
        <b>Mode démonstration.</b> École fictive : regardez tout, rien n'est enregistré.
      </p>
      <button type="button" onClick={creer}
        className="shrink-0 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme hover:bg-navy-800">
        {parent ? "Créer mon compte" : "Créer mon école"}
      </button>
    </div>
  );
}
