// GesSchool — assistant d'inscription (lot 5 de l'audit du 31/10/2026, P2-12).
//
// Inscrire un élève et donner l'accès à ses parents prenait quatre écrans :
// Élèves, fiche (responsables), Paiements (facture), Codes parents. L'assistant
// les enchaîne : Élève → Famille → Frais et premier paiement → Code parent.
//
// ⚠️ MODULE PUR. Les écritures réutilisent les fonctions existantes
// (`creerEleve`, `inscrire`, `ajouterTuteur`, `genererFacturesEnLot`,
// `encaisser`, `genererCodeTuteur`) : mêmes règles, mêmes droits (RLS).

const simple = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Les élèves déjà enregistrés qui pourraient être le MÊME enfant : même
 * prénom et même nom (accents, casse et tirets ignorés). Quand les deux
 * dates de naissance sont connues et diffèrent, ce n'est pas un doublon —
 * deux « Awa Diop » nés à des dates différentes sont deux enfants.
 *
 * Le matricule ne peut pas servir : l'assistant le génère, il est neuf.
 */
export function doublonsPossibles(existants = [], { prenom, nom, date_naissance } = {}) {
  const p = simple(prenom), n = simple(nom);
  if (!p || !n) return [];
  return (existants || []).filter((e) => simple(e.prenom) === p && simple(e.nom) === n
    && !(date_naissance && e.date_naissance && e.date_naissance !== date_naissance));
}

/** Les frais de la grille qui visent ce niveau : le niveau, son cycle, ou toute l'école. */
export function fraisApplicables(frais = [], niveauId = null, cycleId = null) {
  return (frais || []).filter((fr) => (!fr.niveau_id && !fr.cycle_id)
    || (niveauId && fr.niveau_id === niveauId) || (cycleId && fr.cycle_id === cycleId));
}

/**
 * Cochés d'office : les frais obligatoires — l'inscription, et la mensualité
 * du mois en cours. Un frais réservé aux « anciens » (réinscription) ne
 * concerne pas un élève qu'on inscrit pour la première fois.
 */
export function fraisParDefaut(applicables = []) {
  return Object.fromEntries((applicables || [])
    .filter((fr) => fr.obligatoire && fr.public !== "anciens")
    .map((fr) => [fr.id, true]));
}

/** Le message à remettre au parent avec son code (même texte que Codes parents). */
export function messageCodeParent(origin, ecoleNom, prenomEnfant, code) {
  return `Bonjour, voici votre accès à l'espace parent GesSchool${ecoleNom ? ` (${ecoleNom})` : ""} pour suivre `
    + `${prenomEnfant || "votre enfant"} : notes, absences et paiements.\n\n`
    + `1) Ouvrez ${origin}\n2) Touchez « Mon numéro », puis « J'ai un code parent »\n`
    + `3) Votre numéro, ce code : ${code}, et un mot de passe de votre choix`;
}
