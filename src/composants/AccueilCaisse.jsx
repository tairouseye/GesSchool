import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte } from "@/composants/ui.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { CadreAccueil, Gestes, AFaire, Reperes } from "@/composants/AccueilMetier.jsx";
import { statsGestion } from "@/lib/dashboard.js";
import { getAnneeCourante, compterAdoption } from "@/lib/academique.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { ouvrirEncaisser } from "@/lib/encaisser.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

//  L'ACCUEIL DE LA SECRÉTAIRE / CAISSE, sur le modèle de l'espace parent
//  (05/11/2026). Elle travaille au guichet, un parent devant elle : chercher
//  un élève et encaisser d'abord, puis ce qui attend, puis la caisse du jour.
export default function AccueilCaisse() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [stats, setStats] = useState(null);
  const [demandes, setDemandes] = useState(0);
  const [adoption, setAdoption] = useState(null);
  const [erreur, setErreur] = useState("");
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [s, dem] = await Promise.all([statsGestion(ecoleId, an), compterDemandesEnAttente(ecoleId).catch(() => 0)]);
        if (!vivant) return;
        setStats(s); setDemandes(dem);
        compterAdoption(ecoleId).then((a) => { if (vivant) setAdoption(a); }).catch(() => {});
      } catch (e) { if (vivant) setErreur(e.message); }
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  //  La fenêtre de recherche globale vit dans la coque : même geste que Ctrl+K.
  const chercher = () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  const parentsSansCode = adoption ? Math.max(adoption.tuteurs - adoption.tuteursRelies, 0) : 0;
  const aTraiter = [
    ouvert("paiements") && stats?.declEnAttente > 0 && {
      to: "/paiements?onglet=declarations", ton: "or", bouton: "Vérifier",
      titre: `${pl(stats.declEnAttente, "paiement déclaré", "paiements déclarés")} par les parents`, detail: "Preuve jointe, à valider" },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "bleu", bouton: "Préparer",
      titre: pl(demandes, "document demandé", "documents demandés"), detail: "Par les familles, depuis leur téléphone" },
    ouvert("codes_parents") && parentsSansCode > 0 && {
      to: "/codes-parents", ton: "navy", bouton: "Distribuer",
      titre: `${pl(parentsSansCode, "parent")} pas encore connecté${parentsSansCode > 1 ? "s" : ""}`, detail: "Leur remettre leur code" },
  ].filter(Boolean);
  const gestes = [
    ouvert("paiements") && { titre: "Encaisser", sous: "Un paiement, un reçu", icone: "paiements", fond: "principal", onClick: () => ouvrirEncaisser() },
    ouvert("eleves") && { titre: "Inscrire un élève", sous: "Nouveau ou réinscription", icone: "eleves", fond: "bleu", to: "/eleves" },
    ouvert("certificats") && { titre: "Faire un document", sous: "Certificat, attestation", icone: "documents", fond: "vert", to: "/certificats" },
  ].filter(Boolean);

  return (
    <CadreAccueil prenom={profil?.prenom} droite={(
      <button type="button" onClick={chercher}
        className="flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border-2 border-or-500 bg-white px-4 text-left text-navy-900/70 sm:w-[28rem]">
        <Icone name="eleves" className="h-5 w-5 shrink-0" />
        Chercher un élève ou un parent
      </button>
    )}>
      <Alerte ton="erreur">{erreur}</Alerte>
      <Gestes items={gestes} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <AFaire lignes={aTraiter} chargement={!stats && !erreur} />
        {ouvert("paiements") && stats && (
          <Reperes titre="La caisse aujourd'hui" to="/paiements" lien="Voir les paiements"
            lignes={[["Aujourd'hui", `${fmt(stats.encJour)} ${devise}`], ["Cette semaine", `${fmt(stats.encSemaine)} ${devise}`]]} />
        )}
      </div>
    </CadreAccueil>
  );
}
