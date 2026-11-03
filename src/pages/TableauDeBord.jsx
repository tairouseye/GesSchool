import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Alerte } from "@/composants/ui.jsx";
import {
  Salutation, Bloc, Chiffre, Evolution, GraphiqueAnnuel, Agenda, ListeCompacte,
  BarresListe, Anneau, FilActivite, RaccourcisBloc, ilYa,
} from "@/composants/TableauBord.jsx";
import { statsGestion, periodesAnnee } from "@/lib/dashboard.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { MODES } from "@/lib/paiements.js";
import { ouvrirEncaisser } from "@/lib/encaisser.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { peutVoir, estRoleComplet } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import MiseEnRoute from "@/composants/MiseEnRoute.jsx";

const fmtMontant = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2).replace(".", ",").replace(/,?0+$/, "")} M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} k`;
  return String(v);
};
const modeLabel = (m) => (MODES.find((x) => x[0] === m) || [])[1] || m;
const COULEURS_MODE = { especes: "#0b1f3a", wave: "#1d9bf0", orange_money: "#f97316", free_money: "#dc2626", cheque: "#64748b", virement: "#0d9488" };
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;
const initiales = (nom) => String(nom || "").split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";

// Tableau de bord Gestion — version « Classter » validée le 31/10/2026
// (docs/maquette-tableaux-classter.html, onglet 1) : chiffres avec leur
// évolution, l'année comparée à la précédente, agenda, à traiter,
// recouvrement par classe, modes de paiement, activité récente.
export default function TableauDeBord() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(null);
  const [stats, setStats] = useState(null);
  const [periodes, setPeriodes] = useState([]);
  const [aSigner, setASigner] = useState(0);
  const [demandes, setDemandes] = useState(0);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [s, per, sig, dem] = await Promise.all([
          statsGestion(ecoleId, an),
          periodesAnnee(ecoleId, an?.id).catch(() => ({ liste: [] })),
          compterASigner().catch(() => 0),
          compterDemandesEnAttente(ecoleId).catch(() => 0),
        ]);
        setStats(s); setPeriodes(per.liste); setASigner(sig); setDemandes(dem);
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId]);

  //  Une action n'est proposée que si l'écran qui la traite est ouvert à ce
  //  rôle et que le module est actif : un bouton qui mène à un refus ne sert à rien.
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);
  const reste = stats ? stats.totalFacture - stats.totalPaye : 0;

  const aTraiter = stats ? [
    ouvert("paiements") && stats.declEnAttente > 0 && {
      to: "/paiements", ton: "or", bouton: "Valider", titre: `${pl(stats.declEnAttente, "paiement mobile", "paiements mobiles")} à valider` },
    ouvert("recouvrement") && stats.nbEnRetard > 0 && {
      to: "/recouvrement", ton: "rouge", bouton: "Relancer", titre: `${pl(stats.nbEnRetard, "élève")} en impayé` },
    ouvert("recouvrement") && stats.echeanceNb > 0 && {
      to: "/recouvrement", ton: "navy", bouton: "Voir", titre: `${pl(stats.echeanceNb, "échéance")} dans les 7 jours` },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "violet", bouton: "Traiter", titre: `${pl(demandes, "demande")} de document` },
    ouvert("signatures") && aSigner > 0 && {
      to: "/a-signer", ton: "bleu", bouton: "Signer", titre: `${pl(aSigner, "document")} à signer` },
  ].filter(Boolean) : [];

  //  Agenda : les échéances de paiement à venir, puis les fins de période.
  const jour = new Date().toISOString().slice(0, 10);
  const agenda = stats ? [
    ...stats.echeances.map((e) => ({
      date: e.date, ton: "rouge", titre: "Échéance de paiement",
      detail: `${pl(e.familles, "famille")} · ${fmtMontant(e.montant)} ${devise} attendus` })),
    ...periodes.filter((p) => p.date_fin && p.date_fin >= jour).map((p) => ({
      date: p.date_fin, ton: "violet", titre: `Fin : ${p.libelle}`, detail: "Bulletins à préparer" })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4) : [];

  const evolEffectif = stats?.effectifN1 ? stats.effectif - stats.effectifN1 : null;
  const evolEnc = stats?.encMoisN1 ? ((stats.encMois - stats.encMoisN1) / stats.encMoisN1) * 100 : null;
  const moisCourant = new Date().toLocaleDateString("fr-FR", { month: "long" });

  return (
    <>
      <EnTete titre="Gestion" sousTitre={annee ? `${ecole?.nom} · Année ${annee.libelle}` : ecole?.nom}
        action={ouvert("paiements") && (
          <button type="button" onClick={() => ouvrirEncaisser()} className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-creme hover:bg-navy-800">
            + Encaisser un paiement
          </button>
        )} />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Salutation prenom={profil?.prenom}>Voici l'essentiel de {ecole?.nom || "votre établissement"}.</Salutation>

        {/*  Mise en route (prise en main, lot 2) : pour ceux qui paramètrent
             l'école — promoteur et direction —, tant qu'elle n'est pas finie. */}
        {(estRoleComplet(roles) || (roles || []).includes("direction")) && (
          <MiseEnRoute ecoleId={ecoleId} ecole={ecole} modulesActifs={modulesActifs} compacte />
        )}

        {/* Chiffres clés, chacun avec son évolution */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Chiffre chargement={chargement} label="Élèves inscrits" icone="👤" ton="bleu" valeur={stats?.effectif}
            ligne={stats && (evolEffectif != null
              ? <Evolution delta={evolEffectif} texte={`par rapport à l'an passé${stats.nouveaux ? ` · +${stats.nouveaux} ce mois` : ""}`} />
              : <span className="text-navy-900/55">{stats.nouveaux ? `+${stats.nouveaux} ce mois` : "Année en cours"}</span>)} />
          <Chiffre chargement={chargement} label={`Encaissé en ${moisCourant}`} icone="₣" ton="or" valeur={stats && fmtMontant(stats.encMois)} suffixe={devise}
            ligne={stats && (evolEnc != null
              ? <Evolution delta={Math.round(evolEnc)} format={(v) => `${v} %`} texte={`par rapport à ${moisCourant} dernier`} />
              : <span className="text-navy-900/55">Aujourd'hui {fmtMontant(stats.encJour)} · semaine {fmtMontant(stats.encSemaine)}</span>)} />
          <Chiffre chargement={chargement} label="Taux de recouvrement" icone="%" ton="vert"
            valeur={stats && `${stats.tauxRecouvrement.toFixed(0)} %`}
            tonValeur={stats && stats.tauxRecouvrement >= 80 ? "text-emerald-700" : stats && stats.tauxRecouvrement >= 60 ? "text-or-600" : "text-rose-700"}
            barre={stats?.tauxRecouvrement}
            ligne={stats && <span className="text-navy-900/55">{fmtMontant(stats.totalPaye)} encaissés sur {fmtMontant(stats.totalFacture)} {devise}</span>} />
          <Chiffre chargement={chargement} label="Impayés en retard" icone="!" ton="rouge"
            valeur={stats && fmtMontant(stats.retardMontant)} suffixe={devise} tonValeur={stats?.retardMontant > 0 ? "text-rose-700" : "text-navy-900"}
            ligne={stats && <span className="text-navy-900/55">{pl(stats.nbEnRetard, "élève")} · reste total {fmtMontant(reste)} {devise}</span>} />
        </div>

        {/* L'année, comparée à la précédente · agenda */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Bloc titre={`Encaissements par mois${annee ? ` — ${annee.libelle}` : ""}`} className="lg:col-span-2">
            {stats && <GraphiqueAnnuel points={stats.annuel} format={fmtMontant} legende={[annee?.libelle || "Cette année", "Année précédente"]} />}
          </Bloc>
          <Bloc titre="Agenda" to={ouvert("recouvrement") ? "/recouvrement" : null} lien="Échéances">
            <Agenda items={agenda} />
          </Bloc>
        </div>

        {/* À traiter · recouvrement par classe · modes */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Bloc titre="À traiter" compteur={aTraiter.length}>
            <ListeCompacte items={aTraiter} />
          </Bloc>
          <Bloc titre="Recouvrement par classe" to={ouvert("situation_paiements") ? "/situation-paiements" : null} lien="Détail">
            <BarresListe vide="Toutes les classes sont à jour ✓"
              items={(stats?.classes || []).slice(0, 6).map((c) => ({
                label: c.libelle, pct: c.taux, droite: `${Math.round(c.taux)} %`,
                ton: c.taux >= 80 ? "vert" : c.taux >= 60 ? "or" : "rouge",
              }))} />
          </Bloc>
          <Bloc titre={`Modes de paiement (${moisCourant})`}>
            <Anneau vide="Aucun encaissement ce mois."
              parts={Object.entries(stats?.parMode || {}).sort((a, b) => b[1] - a[1])
                .map(([m, v]) => ({ label: modeLabel(m), val: v, couleur: COULEURS_MODE[m] || "#94a3b8" }))} />
          </Bloc>
        </div>

        {/* Activité récente · raccourcis */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Bloc titre="Activité récente" className="lg:col-span-2">
            <FilActivite items={(stats?.activite || []).map((a) => a.type === "paiement"
              ? { initiales: initiales(a.eleve), ton: "vert", titre: `Paiement de ${fmtMontant(a.montant)} ${devise}`, detail: [a.eleve, modeLabel(a.mode)].filter(Boolean).join(" · "), quand: ilYa(a.date) }
              : { initiales: initiales(a.eleve), ton: "bleu", titre: "Nouvelle inscription", detail: [a.eleve, a.classe].filter(Boolean).join(" en "), quand: ilYa(a.date) })} />
          </Bloc>
          <Bloc titre="Raccourcis">
            <RaccourcisBloc items={[
              ouvert("eleves") && { to: "/eleves", icone: "👤", label: "Inscrire un élève" },
              ouvert("paiements") && { icone: "₣", label: "Encaisser", onClick: () => ouvrirEncaisser() },
              ouvert("situation_paiements") && { to: "/situation-paiements", icone: "💳", label: "Situation des paiements" },
              ouvert("annonces") && { to: "/annonces", icone: "📣", label: "Écrire aux familles" },
            ]} />
          </Bloc>
        </div>
      </div>
    </>
  );
}
