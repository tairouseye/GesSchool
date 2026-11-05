// GesSchool — l'accueil parent en cartes (maquette de Mme Kane, Tut'Tank,
// 05/11/2026) : une carte par enfant, qui dit d'un coup d'œil si tout est
// réglé, puis la dernière annonce. MODULE PUR : rien n'est lu ici.

import { resumeEcheancier } from "./paiementStatut.js";
import { aRegler } from "./apercuEnfant.js";

/**
 * La pastille de paiement d'une carte enfant.
 * L'échéancier (mig. 210) dit combien de MOIS sont dus : c'est ainsi qu'un
 * parent compte (« novembre n'est pas payé »). Sans échéancier, les factures.
 * `null` tant que rien n'est chargé : la carte n'affiche alors pas d'état
 * plutôt qu'un « À jour » qui pourrait être faux.
 *
 * @returns {{ ton: "rouge"|"vert"|"bleu"|"neutre", texte: string } | null}
 */
export function pastillePaiement(echeancier, factures) {
  if (echeancier && echeancier.statut) {
    if (echeancier.statut === "exonere") return { ton: "neutre", texte: "Exonéré" };
    const dus = resumeEcheancier(echeancier.lignes).dus.length;
    if (dus > 0) return { ton: "rouge", texte: dus > 1 ? `${dus} mois à payer` : "1 mois à payer" };
    if (echeancier.statut === "en_avance") return { ton: "bleu", texte: "Payé d'avance" };
    if (echeancier.statut === "a_jour") return { ton: "vert", texte: "À jour" };
  }
  if (Array.isArray(factures)) {
    if (factures.length === 0) return null;
    const r = aRegler(factures);
    if (r.reste > 0) return { ton: "rouge", texte: r.enRetard ? "Paiement en retard" : "Paiement à venir" };
    return { ton: "vert", texte: "À jour" };
  }
  return null;
}

/**
 * La dernière annonce reçue, tous enfants confondus. Une annonce adressée à
 * toute l'école arrive une fois par enfant : on ne la garde qu'une fois.
 *
 * @param parEnfant  [{ prenom, annonces: [{ id, titre, contenu, publie_le }] }]
 */
export function derniereAnnonce(parEnfant = []) {
  let meilleure = null;
  for (const e of parEnfant) {
    for (const a of Array.isArray(e?.annonces) ? e.annonces : []) {
      if (!a?.publie_le) continue;
      if (!meilleure || a.publie_le > meilleure.publie_le) meilleure = a;
    }
  }
  return meilleure;
}
