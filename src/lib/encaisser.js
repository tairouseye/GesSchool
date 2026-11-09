// GesSchool — fenêtre « Encaisser » (lot 3 de l'audit du 31/10/2026).
//
// Le guichet encaissait en trois écrans : Paiements, recherche de la
// facture, ouverture, saisie. La fenêtre s'ouvre désormais de partout —
// recherche globale, tableau de bord, fiche de l'élève — et va droit au
// but : l'élève, ses factures dues, le montant, le mode.
//
// ⚠️ MODULE PUR (sauf `ouvrirEncaisser`, qui ne fait qu'émettre un
// événement). Aucun droit n'est décidé ici : l'écriture passe par la RLS de
// `paiements`, comme depuis la page Paiements.

export const EVENEMENT_ENCAISSER = "gesschool:encaisser";
//  Émis APRÈS un encaissement réussi : l'écran ouvert (fiche élève…) se met à jour.
export const EVENEMENT_ENCAISSE = "gesschool:encaisse";

/** Ce qui reste à payer sur une facture (jamais négatif). */
export const resteFacture = (f) => Math.max(0, Math.round((Number(f?.montant_total) || 0) - (Number(f?.montant_paye) || 0)));

/**
 * Les factures sur lesquelles on peut encaisser, la plus ancienne échéance
 * d'abord : c'est elle que le guichet solde en premier. Une annulée, un
 * brouillon ou une facture soldée ne se proposent pas.
 */
export function facturesAEncaisser(lignes = []) {
  const cle = (f) => f.date_echeance || f.date_emission || "9999-12-31";
  return (lignes || [])
    .filter((f) => !["annulee", "brouillon", "payee"].includes(f.statut) && resteFacture(f) > 0)
    .sort((a, b) => cle(a).localeCompare(cle(b)) || String(a.numero || "").localeCompare(String(b.numero || "")));
}

/** Le montant saisi est-il encaissable sur cette facture ? Rend l'erreur, ou null. */
export function verifierMontant(montant, facture) {
  const m = Number(montant);
  if (!facture) return "Choisissez une facture.";
  if (!montant || !Number.isFinite(m) || m <= 0) return "Indiquez le montant reçu.";
  if (m > resteFacture(facture)) return "Le montant dépasse le reste dû sur cette facture.";
  return null;
}

/**
 * Les mois SANS FACTURE cochés d'office (09/11/2026) : à Tut'Tank, un mois dû
 * n'a pas de facture tant qu'il n'est pas payé. La fenêtre ne proposait que
 * des factures — « rien à régler » pour une famille en retard. On coche les
 * mois échus et le mois en cours ; s'il n'y en a pas, le premier mois à venir.
 * `groupes` : `grouperParMois(avance_options)`, triés. `mois` = « AAAA-MM ».
 */
export function moisParDefaut(groupes = [], aujourdhui = new Date()) {
  const courant = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}`;
  const dus = groupes.filter((g) => g.mois <= courant).map((g) => g.mois);
  if (dus.length) return groupes.slice(0, groupes.findIndex((g) => g.mois === dus[dus.length - 1]) + 1).map((g) => g.mois);
  return groupes.length ? [groupes[0].mois] : [];
}

/** « en retard », « ce mois-ci » ou rien, pour un mois « AAAA-MM ». */
export function etatMois(mois, aujourdhui = new Date()) {
  const courant = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}`;
  if (mois < courant || (mois === courant && aujourdhui.getDate() > 5)) return "en retard";
  if (mois === courant) return "ce mois-ci";
  return "";
}

/**
 * Ouvre la fenêtre depuis n'importe quel écran. `eleve` ({ id, prenom, nom,
 * matricule }) la pré-remplit ; sans lui, on commence par chercher l'élève.
 */
export function ouvrirEncaisser(eleve = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_ENCAISSER, { detail: { eleve } }));
}
