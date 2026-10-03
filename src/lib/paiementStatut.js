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

export const ETATS = {
  a_jour: {
    cle: "a_jour", label: "À jour", court: "À jour", ton: "success", pastille: "🟢",
    explication: "Aucune facture échue impayée.",
  },
  en_retard: {
    cle: "en_retard", label: "En retard", court: "Retard", ton: "danger", pastille: "🔴",
    explication: "Au moins une facture échue reste impayée.",
  },
  non_facture: {
    cle: "non_facture", label: "Non facturé", court: "Non facturé", ton: "neutre", pastille: "⚪",
    //  ⚠️ La formulation compte : elle désigne ce qui manque — la facture —
    //  et non une famille en défaut.
    explication: "Aucune facture émise pour cette année : rien n'est dû.",
  },
};

export const ORDRE = ["en_retard", "a_jour", "non_facture"];

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
  const par = { en_retard: 0, a_jour: 0, non_facture: 0 };
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const c = ETATS[l?.statut] ? l.statut : "non_facture";
    par[c] += 1;
  }
  return { ...par, total: par.en_retard + par.a_jour + par.non_facture };
}

/** Une phrase qui dit ce qu'il y a à faire, ou que tout va bien. */
export function phrase(r) {
  if (!r || !r.total) return "";
  const bouts = [];
  if (r.en_retard) bouts.push(`${r.en_retard} en retard`);
  if (r.non_facture) bouts.push(`${r.non_facture} sans facture`);
  if (!bouts.length) return `Les ${r.total} familles sont à jour.`;
  return bouts.join(" · ");
}
