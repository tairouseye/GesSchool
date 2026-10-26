import { etat as etatPaiement, resumeEcheancier, libelleLigne, lignesDetail } from "@/lib/paiementStatut.js";

// L'échéancier d'un élève (mig. 210) : ce qui est dû, payé, à venir.
// Partagé par la fiche élève (école) et la rubrique Paiements (parent).
//
// ⚠️ JAMAIS LA COULEUR SEULE : chaque ligne dit aussi son état en toutes
// lettres (« En retard », « Payé », « Payé d'avance »…).

const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "");
const moisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const TONS_BADGE = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-500/25",
  danger: "bg-rose-50 text-rose-700 ring-rose-500/25",
  info: "bg-sky-50 text-sky-700 ring-sky-500/25",
  neutre: "bg-navy-900/5 text-navy-900/60 ring-navy-900/10",
};

/** Badge d'état de paiement : pastille + libellé. */
export function BadgeStatut({ statut, className = "" }) {
  const e = etatPaiement(statut);
  return (
    <span title={e.explication}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONS_BADGE[e.ton] || TONS_BADGE.neutre} ${className}`}>
      <span aria-hidden="true">{e.pastille}</span>{e.label}
    </span>
  );
}

function etatLigne(l) {
  if (l.etat === "paye") {
    return l.mois && l.mois > moisCourant()
      ? { txt: "Payé d'avance", cls: "text-sky-700", rond: "bg-sky-500" }
      : { txt: "Payé", cls: "text-emerald-700", rond: "bg-emerald-500" };
  }
  if (l.etat === "en_retard") return { txt: "En retard", cls: "text-rose-700", rond: "bg-rose-500" };
  if (l.etat === "partiel") return { txt: "Payé en partie", cls: "text-amber-700", rond: "bg-amber-500" };
  return { txt: `À payer au plus tard le ${fmtDate(l.echeance)}`, cls: "text-navy-900/50", rond: "bg-navy-900/20" };
}

/**
 * @param donnees  { statut, lignes, tarif } rendu par `eleve_echeancier` /
 *                 `enfant_echeancier`.
 */
export default function Echeancier({ donnees }) {
  const lignes = donnees?.lignes || [];
  const r = resumeEcheancier(lignes);
  if (donnees?.statut === "exonere") {
    return <p className="text-sm text-navy-900/60">Élève exonéré : rien n'est dû pour cette année.</p>;
  }
  if (lignes.length === 0) {
    return <p className="text-sm text-navy-900/50">Aucun frais n'est encore défini pour cette classe.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>Payé : <b className="text-emerald-700">{fmt(r.totalPaye)} XOF</b></span>
        {r.totalDu > 0 && <span>Dû : <b className="text-rose-700">{fmt(r.totalDu)} XOF</b></span>}
        <span className="text-navy-900/50">Année : {fmt(r.totalAnnee)} XOF</span>
      </div>
      <ul className="divide-y divide-navy-900/5 rounded-xl border border-navy-900/10">
        {lignes.map((l) => {
          const e = etatLigne(l);
          return (
            <li key={l.libelle} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.rond}`} />
                <span className="truncate font-medium text-navy-900">{libelleLigne(l)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className={`text-xs font-medium ${e.cls}`}>{e.txt}</span>
                <span className="w-24 text-right tabular-nums text-navy-900/70">{fmt(l.montant)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// « 15/08/26 » : le format du modèle du promoteur. La date vient de la base
// ('AAAA-MM-JJ') : on la découpe, sans passer par un fuseau horaire.
const dateCourte = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "—";
};

const TONS_DETAIL = {
  success: "text-emerald-700",
  info: "text-sky-700",
  danger: "text-rose-700",
  warning: "text-amber-700",
  neutre: "text-navy-900/50",
};

/**
 * Le détail des paiements d'un élève (mig. 212), au format du promoteur :
 * Description · Montant · Statut · Date · Mode de paiement.
 */
export function DetailPaiements({ donnees }) {
  const lignes = lignesDetail(donnees);
  if (donnees?.statut === "exonere" && lignes.length === 0) {
    return <p className="text-sm text-navy-900/60">Élève exonéré : rien n'est dû pour cette année.</p>;
  }
  if (lignes.length === 0) {
    return <p className="text-sm text-navy-900/50">Aucun frais n'est encore défini pour cette classe.</p>;
  }
  return (
    //  Défilement horizontal DANS le tableau sur un petit écran : la page,
    //  elle, ne défile jamais de côté.
    <div className="overflow-x-auto rounded-xl border border-navy-900/10">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">Détail des paiements</caption>
        <thead className="bg-navy-900/[0.03] text-xs text-navy-900/60">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Description</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Montant</th>
            <th scope="col" className="px-3 py-2 font-medium">Statut</th>
            <th scope="col" className="px-3 py-2 font-medium">Date</th>
            <th scope="col" className="px-3 py-2 font-medium">Mode de paiement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-900/5">
          {lignes.map((l) => (
            <tr key={l.cle}>
              <td className="px-3 py-2 font-medium text-navy-900">{l.description}</td>
              <td className="px-3 py-2 text-right tabular-nums text-navy-900/80">{fmt(l.montant)}</td>
              <td className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${TONS_DETAIL[l.statut.ton] || TONS_DETAIL.neutre}`}>{l.statut.txt}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-navy-900/70">{dateCourte(l.date)}</td>
              <td className="px-3 py-2 text-navy-900/70">{l.mode || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
