// GesSchool — l'état de paiement d'une famille, tel qu'on l'affiche.
//
// Demandé à la visite, et précisé par l'école : « à jour signifie paiement ».
//
// ⚠️ TROIS ÉTATS, PAS DEUX. Relevé en production : 8 factures pour
// 96 élèves inscrits. Un indicateur à deux états afficherait donc « en
// retard » pour 88 familles qui n'ont simplement jamais été facturées — une
// information fausse, et accusatrice. L'état « non facturé » dit la vérité :
// le travail reste à faire du côté de l'école, pas de la famille.
//
// ⚠️ MODULE PUR. Les droits sont tenus par la RPC `statut_paiement_classe`
// (mig. 170), qui ne rend QUE ces états — jamais un montant, jamais une
// échéance. Ce fichier ne fait que les nommer.
//
// ⚠️ DEPUIS LA MIG. 210, LE STATUT VIENT DE L'ÉCHÉANCIER, pas des seules
// factures : ce que l'élève doit, mois par mois, d'après les frais de son
// niveau (échéance le 5, retard à partir du 6). Deux états s'ajoutent :
// « en avance » (un mois futur déjà payé) et « exonéré » (rien n'est dû).
// Rouge / vert / bleu, demandés par le promoteur (25/10/2026) — et JAMAIS
// la couleur seule : chaque état garde son libellé et sa pastille.

export const ETATS = {
  a_jour: {
    cle: "a_jour", label: "À jour", court: "À jour", ton: "success", pastille: "🟢",
    texte: "text-emerald-700",
    explication: "Tout ce qui était dû est payé.",
  },
  en_retard: {
    cle: "en_retard", label: "En retard", court: "Retard", ton: "danger", pastille: "🔴",
    texte: "text-rose-700",
    explication: "Au moins un mois (ou l'inscription) dû n'est pas payé.",
  },
  en_avance: {
    cle: "en_avance", label: "En avance", court: "Avance", ton: "info", pastille: "🔵",
    texte: "text-sky-700",
    explication: "À jour, et au moins un mois à venir est déjà payé.",
  },
  exonere: {
    cle: "exonere", label: "Exonéré", court: "Exonéré", ton: "neutre", pastille: "⚪",
    texte: "text-navy-900/60",
    explication: "L'élève est exonéré : rien n'est dû.",
  },
  non_facture: {
    cle: "non_facture", label: "Non facturé", court: "Non facturé", ton: "neutre", pastille: "⚪",
    texte: "",
    //  ⚠️ La formulation compte : elle désigne ce qui manque — la facture —
    //  et non une famille en défaut.
    explication: "Aucune facture émise pour cette année : rien n'est dû.",
  },
};

export const ORDRE = ["en_retard", "a_jour", "en_avance", "exonere", "non_facture"];

/** Jamais `undefined` : un état inconnu se comporte comme « non facturé ». */
export function etat(cle) {
  return ETATS[cle] || ETATS.non_facture;
}

/**
 * Le compte par état, pour un bandeau de synthèse.
 * ⚠️ On compte AUSSI les non facturés : c'est l'information la plus utile
 * à l'école aujourd'hui (88 familles sur 96 n'ont pas de facture).
 */
export function resume(lignes = []) {
  const par = { en_retard: 0, a_jour: 0, en_avance: 0, exonere: 0, non_facture: 0 };
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const c = ETATS[l?.statut] ? l.statut : "non_facture";
    par[c] += 1;
  }
  return { ...par, total: Object.values(par).reduce((a, b) => a + b, 0) };
}

/** Une phrase qui dit ce qu'il y a à faire, ou que tout va bien. */
export function phrase(r) {
  if (!r || !r.total) return "";
  const bouts = [];
  if (r.en_retard) bouts.push(`${r.en_retard} en retard`);
  if (r.non_facture) bouts.push(`${r.non_facture} sans facture`);
  if (!bouts.length) {
    return r.en_avance ? `Les ${r.total} familles sont à jour · ${r.en_avance} en avance.` : `Les ${r.total} familles sont à jour.`;
  }
  return bouts.join(" · ");
}

/**
 * L'échéancier d'un élève (mig. 210), regroupé pour l'affichage :
 * ce qui est payé, ce qui est dû (en retard ou entamé), ce qui est à venir.
 * Les montants viennent de la base ; on ne fait que les additionner.
 */
export function resumeEcheancier(lignes = []) {
  const L = Array.isArray(lignes) ? lignes : [];
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const payes = L.filter((l) => l?.etat === "paye");
  const dus = L.filter((l) => l?.etat === "en_retard" || l?.etat === "partiel");
  const aVenir = L.filter((l) => l?.etat === "a_venir");
  return {
    payes, dus, aVenir,
    totalPaye: payes.reduce((s, l) => s + num(l.paye), 0),
    totalDu: dus.reduce((s, l) => s + num(l.montant) - num(l.paye), 0),
    totalAnnee: L.reduce((s, l) => s + num(l.montant), 0),
  };
}

/** « Octobre 2026 » pour une ligne mensuelle, le libellé du frais sinon. */
export function libelleLigne(l) {
  if (!l) return "";
  if (l.mois && typeof l.libelle === "string" && l.libelle.includes(" — ")) return l.libelle.split(" — ").slice(1).join(" — ");
  return l.libelle || "";
}
