import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte } from "@/composants/ui.jsx";
import { CadreAccueil, Gestes, AFaire, Reperes } from "@/composants/AccueilMetier.jsx";
import MiseEnRoute from "@/composants/MiseEnRoute.jsx";
import { statsPedagogie, blocsPedagogie, donneesAppelsDuJour } from "@/lib/dashboard.js";
import { classesSansAppel } from "@/lib/maJournee.js";
import { getAnneeCourante, compterAdoption } from "@/lib/academique.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { aTraiterPedagogie } from "@/lib/aTraiter.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

//  L'ACCUEIL DU RESPONSABLE PÉDAGOGIQUE (05/11/2026). Ce qui demande une
//  décision vient d'abord, puis ses gestes ; le tableau de bord Pédagogie
//  reste à un toucher.
export default function AccueilResponsable() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const [d, setD] = useState({ stats: null, blocs: null, annee: null, demandes: 0, aSigner: 0, sansAppel: [], adoption: null });
  const [erreur, setErreur] = useState("");
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);

  useEffect(() => {
    let vivant = true;
    const maj = (x) => { if (vivant) setD((v) => ({ ...v, ...x })); };
    (async () => {
      try {
        const annee = await getAnneeCourante(ecoleId);
        const [stats, aSigner, demandes] = await Promise.all([
          statsPedagogie(ecoleId, annee?.id), compterASigner().catch(() => 0), compterDemandesEnAttente(ecoleId).catch(() => 0),
        ]);
        maj({ annee, stats, aSigner, demandes });
        compterAdoption(ecoleId).then((adoption) => maj({ adoption })).catch(() => {});
        donneesAppelsDuJour(ecoleId, annee?.id).then((a) => a && maj({ sansAppel: classesSansAppel(a) })).catch(() => {});
        blocsPedagogie(ecoleId, annee, stats.effectif).then((blocs) => maj({ blocs })).catch(() => {});
      } catch (e) { if (vivant) setErreur(e.message); }
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  const s = d.stats;
  const gestes = [
    ouvert("assiduite") && { titre: "Absences du jour", sous: s ? `${s.absJour} aujourd'hui` : "", icone: "assiduite", fond: "bleu", to: "/assiduite" },
    ouvert("bulletins") && { titre: "Bulletins", sous: "Relire, signer, publier", icone: "bulletins", fond: "violet", to: "/bulletins" },
    ouvert("annonces") && { titre: "Écrire une annonce", sous: "Aux familles", icone: "annonces", fond: "jaune", to: "/annonces" },
    ouvert("messagerie") && { titre: "Messages", sous: "Parents et équipe", icone: "messagerie", fond: "vert", to: "/messagerie" },
  ].filter(Boolean);

  return (
    <CadreAccueil prenom={profil?.prenom}>
      <Alerte ton="erreur">{erreur}</Alerte>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <AFaire titre="À faire maintenant" chargement={!s && !erreur}
          lignes={aTraiterPedagogie({ ...d, ouvert, direction: true })} />
        {s && (
          <Reperes titre="L'école aujourd'hui" to="/pedagogie?chiffres=1" lien="Voir le tableau de bord"
            lignes={[
              ["Absents aujourd'hui", s.absJour, s.absJour > 0 ? "text-rose-700" : ""],
              ["Absences cette semaine", s.absSemaine],
              ["Notes saisies", s.nbNotes],
            ]} />
        )}
      </div>
      <Gestes items={gestes} colonnes="sm:grid-cols-2" />
      {/*  En bas : sur un téléphone, ses neuf étapes repoussaient hors de
          l'écran ce qui demande une décision aujourd'hui. */}
      <MiseEnRoute ecoleId={ecoleId} ecole={ecole} modulesActifs={modulesActifs} compacte />
    </CadreAccueil>
  );
}
