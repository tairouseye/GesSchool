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

// =====================================================================
//  Le DÉTAIL des paiements d'un élève (mig. 212), au format demandé par
//  le promoteur (26/10/2026) : Description · Montant · Statut · Date ·
//  Mode de paiement. L'inscription, chaque mois, puis les autres frais
//  facturés (sortie pédagogique…).
//  Statuts du modèle : « Payé », « Impayé » (échéance passée), « En
//  attente » (pas encore dû) ; plus « Payé en partie » et « Payé
//  d'avance » (le bleu du code couleur).
// =====================================================================

export const MODES_PAIEMENT = {
  especes: "Espèces", wave: "Wave", orange_money: "Orange Money", free_money: "Free Money",
  virement: "Virement", cheque: "Chèque", carte: "Carte",
};

/** « Espèces », « Wave, Espèces »… ; "" sans paiement. */
export function libelleMode(modes) {
  if (!modes) return "";
  return String(modes).split(",").map((m) => m.trim()).filter(Boolean)
    .map((m) => MODES_PAIEMENT[m] || m).join(", ");
}

const STATUTS_DETAIL = {
  paye: { txt: "Payé", ton: "success" },
  avance: { txt: "Payé d'avance", ton: "info" },
  en_retard: { txt: "Impayé", ton: "danger" },
  partiel: { txt: "Payé en partie", ton: "warning" },
  a_venir: { txt: "En attente", ton: "neutre" },
};

/** Le mois « Octobre » d'une ligne « Mensualité — Octobre 2026 ». */
function descriptionLigne(l) {
  const lib = libelleLigne(l);
  return l?.mois ? lib.replace(/\s+\d{4}$/, "") : lib;
}

/**
 * Les lignes du détail. `moisCourant` : 'AAAA-MM' (aujourd'hui par défaut) —
 * un mois payé après lui est « payé d'avance ».
 */
export function lignesDetail(donnees, moisCourant) {
  const d = new Date();
  const mc = moisCourant || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const lignes = Array.isArray(donnees?.lignes) ? donnees.lignes : [];
  const autres = Array.isArray(donnees?.autres) ? donnees.autres : [];
  const une = (l, autre) => {
    let cle = STATUTS_DETAIL[l?.etat] ? l.etat : "a_venir";
    if (cle === "paye" && l.mois && l.mois > mc) cle = "avance";
    return {
      cle: (autre ? "autre:" : "") + (l?.libelle || ""),
      description: descriptionLigne(l),
      montant: Number(l?.montant) || 0,
      statut: { cle, ...STATUTS_DETAIL[cle] },
      date: l?.date_paiement || null,
      mode: libelleMode(l?.mode),
    };
  };
  return [...lignes.map((l) => une(l, false)), ...autres.map((l) => une(l, true))];
}
