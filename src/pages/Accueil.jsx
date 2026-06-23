import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Carte } from "@/composants/ui.jsx";

// Accueil protégé (temporaire — sera remplacé par le tableau de bord en Phase 1).
// Valide la chaîne auth complète : session, profil, rôles, école.
export default function Accueil() {
  const { utilisateur, profil, roles, deconnexion } = useAuth();
  return (
    <div className="min-h-full bg-creme">
      <header className="flex items-center justify-between border-b border-navy-900/10 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <Cachet size={40} className="text-navy-900" />
          <span className="font-display text-lg font-bold text-navy-900">
            Ges<span className="text-or-500">School</span>
          </span>
        </div>
        <Bouton variante="fantome" onClick={deconnexion}>Déconnexion</Bouton>
      </header>

      <main className="mx-auto max-w-2xl p-8">
        <Carte className="p-7">
          <h1 className="font-display text-2xl font-bold text-navy-900">Bienvenue 👋</h1>
          <p className="mt-1 text-sm text-navy-900/50">
            Authentification opérationnelle — socle de la Phase 0.
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <Ligne label="Utilisateur" valeur={utilisateur?.email} />
            <Ligne label="Profil" valeur={profil ? `${profil.prenom} ${profil.nom}` : "—"} />
            <Ligne label="École (ecole_id)" valeur={profil?.ecole_id ?? "—"} mono />
            <Ligne label="Rôles" valeur={roles.length ? roles.join(", ") : "aucun"} />
          </dl>

          <p className="mt-6 rounded-xl bg-creme px-4 py-3 text-xs text-navy-900/50">
            Prochaine étape : <strong>Phase 0.4 — Onboarding établissement</strong> (création
            de l'école, cycles, année scolaire), puis la structure académique.
          </p>
        </Carte>
      </main>
    </div>
  );
}

function Ligne({ label, valeur, mono }) {
  return (
    <div className="flex items-center justify-between border-b border-navy-900/5 pb-2">
      <dt className="text-navy-900/50">{label}</dt>
      <dd className={`font-medium text-navy-900 ${mono ? "font-mono text-xs" : ""}`}>{valeur}</dd>
    </div>
  );
}
