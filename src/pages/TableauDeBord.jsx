import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte } from "@/composants/ui.jsx";

// Tableau de bord — accueil de l'espace admin.
// Les KPIs réels seront calculés en Phase 1 (élèves, recouvrement, etc.).
const KPIS = [
  { label: "Élèves inscrits", valeur: "—", note: "Phase 1" },
  { label: "Taux de recouvrement", valeur: "—", note: "Phase 1" },
  { label: "Encaissé (mois)", valeur: "—", note: "Phase 1" },
  { label: "Moyenne générale", valeur: "—", note: "Phase 1" },
];

export default function TableauDeBord() {
  const { ecole, profil } = useAuth();
  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre={ecole?.nom} />
      <div className="space-y-6 p-8">
        <Carte className="p-6">
          <h2 className="font-display text-xl font-bold text-navy-900">
            Bonjour {profil?.prenom} 👋
          </h2>
          <p className="mt-1 text-sm text-navy-900/50">
            Bienvenue dans l'espace d'administration de votre établissement.
          </p>
        </Carte>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((k) => (
            <Carte key={k.label} className="p-5">
              <p className="text-sm text-navy-900/50">{k.label}</p>
              <p className="mt-2 font-display text-3xl font-bold text-navy-900">{k.valeur}</p>
              <p className="mt-2 text-xs text-navy-900/30">{k.note}</p>
            </Carte>
          ))}
        </div>

        <Carte className="p-6">
          <h3 className="font-display text-lg font-semibold text-navy-900">Prochaine étape</h3>
          <p className="mt-1 text-sm text-navy-900/60">
            Configurez votre{" "}
            <Link to="/structure" className="font-medium text-or-500 hover:underline">
              structure académique
            </Link>{" "}
            (niveaux, classes, matières), puis nous attaquerons les élèves, bulletins et paiements.
          </p>
        </Carte>
      </div>
    </>
  );
}
