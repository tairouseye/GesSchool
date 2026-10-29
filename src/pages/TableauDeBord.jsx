import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, Kpi, Skeleton } from "@/composants/ui.jsx";
import { statsGestion } from "@/lib/dashboard.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { MODES } from "@/lib/paiements.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

const fmtMontant = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return String(v);
};
const modeLabel = (m) => (MODES.find((x) => x[0] === m) || [])[1] || m;

// Tableau de bord Gestion (refonte du 29/10/2026, maquette
// docs/maquette-refonte-interface.html) : « À faire aujourd'hui » d'abord,
// une ligne et un bouton par action, puis les chiffres avec leur tendance.
export default function TableauDeBord() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(null);
  const [stats, setStats] = useState(null);
  const [aSigner, setASigner] = useState(0);
  const [demandes, setDemandes] = useState(0);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [s, sig, dem] = await Promise.all([
          statsGestion(ecoleId, an?.id),
          compterASigner().catch(() => 0),
          compterDemandesEnAttente(ecoleId).catch(() => 0),
        ]);
        setStats(s); setASigner(sig); setDemandes(dem);
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
  const modes = stats ? Object.entries(stats.parMode).sort((a, b) => b[1] - a[1]) : [];
  const totalMode = modes.reduce((s, [, v]) => s + v, 0);
  const maxSerie = stats ? Math.max(1, ...stats.serie.map((s) => s.montant)) : 1;

  const aFaire = stats ? [
    ouvert("paiements") && stats.declEnAttente > 0 && {
      to: "/paiements", ton: "or", icone: "💳", bouton: "Valider",
      titre: `${stats.declEnAttente} paiement${stats.declEnAttente > 1 ? "s" : ""} mobile${stats.declEnAttente > 1 ? "s" : ""} à valider`,
      detail: "Déclarés par les parents depuis l'appli" },
    ouvert("recouvrement") && stats.nbEnRetard > 0 && {
      to: "/recouvrement", ton: "rouge", icone: "🔔", bouton: "Relancer",
      titre: `${stats.nbEnRetard} élève${stats.nbEnRetard > 1 ? "s" : ""} en impayé`,
      detail: `${fmtMontant(stats.retardMontant)} ${devise} en retard` },
    ouvert("recouvrement") && stats.echeanceNb > 0 && {
      to: "/recouvrement", ton: "navy", icone: "📅", bouton: "Voir",
      titre: `${stats.echeanceNb} échéance${stats.echeanceNb > 1 ? "s" : ""} dans les 7 jours`,
      detail: `${fmtMontant(stats.echeanceMontant)} ${devise} attendus` },
    ouvert("signatures") && aSigner > 0 && {
      to: "/a-signer", ton: "bleu", icone: "✍️", bouton: "Signer",
      titre: `${aSigner} document${aSigner > 1 ? "s" : ""} à signer`, detail: "En attente de votre signature" },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "violet", icone: "📄", bouton: "Traiter",
      titre: `${demandes} demande${demandes > 1 ? "s" : ""} de document`, detail: "Certificats et attestations demandés par les familles" },
  ].filter(Boolean) : [];

  //  « jeudi 29 octobre » → « Jeudi 29 octobre » (la classe `capitalize`
  //  mettrait aussi une majuscule au mois).
  const jourBrut = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const jour = jourBrut.charAt(0).toUpperCase() + jourBrut.slice(1);

  return (
    <>
      <EnTete titre="Gestion" sousTitre={annee ? `${ecole?.nom} · Année ${annee.libelle}` : ecole?.nom}
        action={ouvert("paiements") && (
          <Link to="/paiements" className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-creme hover:bg-navy-800">
            + Encaisser un paiement
          </Link>
        )} />
      <div className="space-y-6 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div>
          <p className="text-sm text-navy-900/60">{jour}</p>
          <h2 className="font-display text-2xl font-bold text-navy-900">Bonjour {profil?.prenom}</h2>
        </div>

        {/* À faire aujourd'hui */}
        <Carte>
          <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
            <h3 className="font-semibold text-navy-900">À faire aujourd'hui</h3>
            {aFaire.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{aFaire.length}</span>
            )}
          </div>
          {chargement ? (
            <div className="space-y-3 p-5 sm:p-6"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : aFaire.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-sm text-navy-900/60 sm:px-6">Rien à traiter pour l'instant ✓</p>
          ) : (
            <ul className="divide-y divide-navy-900/5 px-2 pb-2 pt-3">
              {aFaire.map((a) => <LigneAFaire key={a.titre} {...a} />)}
            </ul>
          )}
        </Carte>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi chargement={chargement} label="Élèves inscrits" valeur={stats && String(stats.effectif)}
            sous={stats?.nouveaux ? `+${stats.nouveaux} ce mois` : null} ton="or" />
          <Kpi chargement={chargement} label="Taux de recouvrement" valeur={stats && `${stats.tauxRecouvrement.toFixed(0)} %`} ton="vert" />
          <Kpi chargement={chargement} label="Encaissé ce mois" valeur={stats && fmtMontant(stats.encMois)} suffixe={devise}
            sous={stats ? `Aujourd'hui ${fmtMontant(stats.encJour)} · semaine ${fmtMontant(stats.encSemaine)}` : null}
            serie={stats?.serie.map((s) => s.montant)} ton="or" tonValeur="text-navy-900" />
          <Kpi chargement={chargement} label="Reste à encaisser" valeur={stats && fmtMontant(reste)} suffixe={devise} ton="rouge" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Graphe encaissements : le mois en cours en or */}
          <Carte className="p-6 lg:col-span-2">
            <h3 className="font-semibold text-navy-900">Encaissements — 6 derniers mois</h3>
            {stats && (
              <div className="mt-6 flex h-52 items-end gap-3 sm:gap-4">
                {stats.serie.map((s, i) => {
                  const dernier = i === stats.serie.length - 1;
                  return (
                    <div key={s.cle} className="flex h-full flex-1 flex-col items-center gap-2">
                      <span className={`text-xs font-semibold ${dernier ? "text-navy-900" : "text-navy-900/60"}`}>{fmtMontant(s.montant)}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div className={`w-full rounded-lg transition-all ${dernier ? "bg-or-500" : "bg-navy-900/80"}`}
                          style={{ height: `${(s.montant / maxSerie) * 100}%`, minHeight: s.montant > 0 ? 4 : 0 }}
                          title={`${fmtMontant(s.montant)} ${devise}`} />
                      </div>
                      <span className="text-xs text-navy-900/60">{s.mois}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {stats && stats.serie.every((s) => s.montant === 0) && (
              <p className="mt-4 text-xs text-navy-900/60">Aucun encaissement sur la période.</p>
            )}
          </Carte>

          {/* Recouvrement de l'année */}
          <Carte className="p-6">
            <h3 className="font-semibold text-navy-900">Recouvrement {annee?.libelle}</h3>
            {stats && (
              <>
                <p className="mt-4 font-display text-3xl font-bold text-navy-900">{stats.tauxRecouvrement.toFixed(0)} %</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-900/10">
                  <div className={`h-full rounded-full ${stats.tauxRecouvrement >= 80 ? "bg-emerald-500" : stats.tauxRecouvrement >= 60 ? "bg-or-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(100, stats.tauxRecouvrement)}%` }} />
                </div>
                <dl className="mt-5 space-y-2.5 text-sm">
                  <Ligne label="Facturé" valeur={`${fmtMontant(stats.totalFacture)} ${devise}`} />
                  <Ligne label="Encaissé" valeur={`${fmtMontant(stats.totalPaye)} ${devise}`} ton="text-emerald-700" />
                  <Ligne label="Reste à encaisser" valeur={`${fmtMontant(reste)} ${devise}`} ton="text-rose-700" />
                </dl>
              </>
            )}
          </Carte>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Principaux impayés */}
          <Carte className="p-6 lg:col-span-2">
            <div className="flex items-center">
              <h3 className="font-semibold text-navy-900">Principaux impayés</h3>
              {ouvert("recouvrement") && (
                <Link to="/recouvrement" className="ml-auto text-sm font-medium text-navy-700 hover:text-or-600">Voir le recouvrement →</Link>
              )}
            </div>
            {!stats || stats.topDebiteurs.length === 0 ? (
              <p className="mt-3 text-sm text-navy-900/60">Aucun impayé en retard 🎉</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-900/5">
                {stats.topDebiteurs.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-xs font-bold text-rose-700">
                      {d.nom.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                    </span>
                    <span className="truncate font-medium text-navy-900">{d.nom}</span>
                    <span className="ml-auto shrink-0 font-mono font-semibold text-rose-700">{fmtMontant(d.reste)} {devise}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          {/* Répartition par mode */}
          <Carte className="p-6">
            <h3 className="mb-4 font-semibold text-navy-900">Modes de paiement (ce mois)</h3>
            {modes.length === 0 ? (
              <p className="text-sm text-navy-900/60">Aucun encaissement ce mois.</p>
            ) : (
              <ul className="space-y-3">
                {modes.map(([m, v]) => (
                  <li key={m}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-navy-900/70">{modeLabel(m)}</span>
                      <span className="font-mono text-navy-900">{fmtMontant(v)} {devise}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900/10">
                      <div className="h-full rounded-full bg-or-500" style={{ width: `${totalMode ? (v / totalMode) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}

const TONS_AFAIRE = {
  or: "bg-amber-100 text-amber-700",
  rouge: "bg-rose-100 text-rose-700",
  navy: "bg-navy-900/10 text-navy-900",
  bleu: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
};

// Une ligne cliquable en entier ; le « bouton » dit l'action qui attend.
function LigneAFaire({ to, ton, icone, titre, detail, bouton }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-navy-900/[0.03] sm:px-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg ${TONS_AFAIRE[ton]}`} aria-hidden="true">{icone}</span>
        <span className="min-w-0">
          <span className="block font-medium text-navy-900">{titre}</span>
          <span className="block text-sm text-navy-900/60">{detail}</span>
        </span>
        <span className="ml-auto shrink-0 rounded-lg border border-navy-900/15 px-3 py-1.5 text-sm font-semibold text-navy-900 group-hover:border-navy-900/40">
          {bouton}
        </span>
      </Link>
    </li>
  );
}

function Ligne({ label, valeur, ton = "text-navy-900" }) {
  return (
    <div className="flex justify-between">
      <dt className="text-navy-900/60">{label}</dt>
      <dd className={`font-mono font-semibold ${ton}`}>{valeur}</dd>
    </div>
  );
}
