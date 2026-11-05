import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte } from "@/composants/ui.jsx";
import { CadreAccueil, Gestes, AFaire, Reperes } from "@/composants/AccueilMetier.jsx";
import { statsGestion } from "@/lib/dashboard.js";
import { getAnneeCourante, compterAdoption } from "@/lib/academique.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { ouvrirEncaisser } from "@/lib/encaisser.js";
import { aTraiterGestion } from "@/lib/aTraiter.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

//  L'ACCUEIL DU COMPTABLE (05/11/2026) : encaisser, relancer, dépenser, puis ce
//  qui attend. Le tableau de bord Gestion reste à un toucher.
export default function AccueilComptable() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [d, setD] = useState({ stats: null, demandes: 0, aSigner: 0, adoption: null });
  const [erreur, setErreur] = useState("");
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [stats, demandes, aSigner] = await Promise.all([
          statsGestion(ecoleId, an), compterDemandesEnAttente(ecoleId).catch(() => 0), compterASigner().catch(() => 0),
        ]);
        if (!vivant) return;
        setD((x) => ({ ...x, stats, demandes, aSigner }));
        compterAdoption(ecoleId).then((adoption) => { if (vivant) setD((x) => ({ ...x, adoption })); }).catch(() => {});
      } catch (e) { if (vivant) setErreur(e.message); }
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  const s = d.stats;
  const gestes = [
    ouvert("paiements") && { titre: "Encaisser", sous: "Un paiement, un reçu", icone: "paiements", fond: "principal", onClick: () => ouvrirEncaisser() },
    ouvert("recouvrement") && { titre: "Voir les impayés", sous: s?.nbEnRetard ? `${s.nbEnRetard} élève${s.nbEnRetard > 1 ? "s" : ""} en retard` : "Relancer les familles", icone: "recouvrement", fond: "jaune", to: "/recouvrement" },
    ouvert("comptabilite") && { titre: "Saisir une dépense", sous: "Trésorerie et comptes", icone: "comptabilite", fond: "vert", to: "/comptabilite?onglet=depenses" },
  ].filter(Boolean);

  return (
    <CadreAccueil prenom={profil?.prenom}>
      <Alerte ton="erreur">{erreur}</Alerte>
      <Gestes items={gestes} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <AFaire lignes={aTraiterGestion({ ...d, ouvert })} chargement={!s && !erreur} />
        {s && (
          <Reperes titre="Les chiffres" to="/gestion?chiffres=1" lien="Voir le tableau de bord"
            lignes={[
              ["Aujourd'hui", `${fmt(s.encJour)} ${devise}`],
              ["Ce mois", `${fmt(s.encMois)} ${devise}`],
              ["Impayés en retard", `${fmt(s.retardMontant)} ${devise}`, s.retardMontant > 0 ? "text-rose-700" : ""],
              ["Recouvrement", `${s.tauxRecouvrement.toFixed(0)} %`],
            ]} />
        )}
      </div>
    </CadreAccueil>
  );
}
