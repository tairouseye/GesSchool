// GesSchool — ce que l'établissement couvre, et sa pédagogie (mig. 168).
//
// Demandé : déclarer « Élémentaire (incluant le préscolaire) », « Collège »,
// « Lycée », « Université » ET LEURS COMBINAISONS — du plus simple
// (Élémentaire seul) au plus étendu (Élémentaire-Collège-Lycée-Université).
//
// ⚠️ UNE COMBINAISON N'EST PAS UNE VALEUR, C'EST UN ENSEMBLE. Énumérer
// « elementaire_college », « elementaire_college_lycee »… demanderait quinze
// valeurs pour quatre paliers. Un ensemble dit la même chose sans explosion,
// et l'écran rend le choix facile : les cas courants en un clic, les cases à
// cocher pour l'exact.
//
// ⚠️ DEUX QUESTIONS DIFFÉRENTES, DEUX FONCTIONS. « Qu'est-ce que l'école a
// DÉCLARÉ ? » sert à l'affichage ; « quelles pages lui ouvrir ? » sert au
// menu et admet un repli. Les confondre ferait écrire à l'écran que l'école
// couvre le collège et le lycée alors qu'elle n'a rien dit.

const ORDRE = ["elementaire", "college", "lycee", "formation_pro", "universite"];

export const PALIERS = [
  {
    cle: "elementaire", label: "Élémentaire", detail: "incluant le préscolaire",
    cycles: ["prescolaire", "premier_cycle"],
  },
  { cle: "college", label: "Collège", cycles: ["second_cycle"] },
  { cle: "lycee", label: "Lycée", cycles: ["lycee"] },
  {
    // ⚠️ Non demandé, mais indispensable : le « Centre de formation
    // professionnel de Diamniadio » existe en production et ne couvre QUE
    // ce palier. L'omettre lui laisserait un ensemble vide, donc aucun menu.
    cle: "formation_pro", label: "Formation professionnelle",
    cycles: ["formation_pro"],
  },
  { cle: "universite", label: "Université", detail: "LMD", cycles: ["universite"] },
];

//  Les paliers « scolaires » : ceux qui ouvrent les pages école (appel,
//  bulletins, emploi du temps par classe…). L'université a les siennes.
export const SCOLAIRES = ["elementaire", "college", "lycee", "formation_pro"];

export const LABELS = Object.fromEntries(PALIERS.map((p) => [p.cle, p.label]));

//  Les cas courants, en un clic. Formulés comme l'école les dit.
export const COMBINAISONS = [
  { cle: "el", label: "Élémentaire", paliers: ["elementaire"] },
  { cle: "el_co", label: "Élémentaire et Collège", paliers: ["elementaire", "college"] },
  { cle: "el_co_ly", label: "Élémentaire, Collège et Lycée", paliers: ["elementaire", "college", "lycee"] },
  {
    cle: "tout", label: "De l'Élémentaire à l'Université",
    paliers: ["elementaire", "college", "lycee", "universite"],
  },
  { cle: "co_ly", label: "Collège et Lycée", paliers: ["college", "lycee"] },
  { cle: "uni", label: "Université seule", paliers: ["universite"] },
  { cle: "fp", label: "Formation professionnelle", paliers: ["formation_pro"] },
];

export const PEDAGOGIES = [
  {
    cle: "classique", label: "Classique",
    detail: "un niveau par classe",
  },
  {
    cle: "montessori", label: "Montessori",
    detail: "classes multi-niveaux (TPS/PS, CI/CP…)",
  },
];

const valide = (p) => ORDRE.includes(p);
const trier = (liste) => ORDRE.filter((p) => liste.includes(p));

/**
 * Ce que l'école a RÉELLEMENT déclaré. Peut être vide — et c'est une
 * information : « non déclaré », à ne jamais afficher comme « rien ».
 */
export function paliersDeclares(ecole) {
  const p = Array.isArray(ecole?.paliers) ? ecole.paliers.filter(valide) : [];
  return trier([...new Set(p)]);
}

/**
 * Les paliers à retenir POUR OUVRIR LES PAGES, avec repli.
 *
 * ⚠️ LE REPLI EST VOLONTAIREMENT SÛR. Une école qui n'a rien déclaré doit
 * continuer de se comporter comme avant la migration 168. Renvoyer un
 * ensemble vide viderait son menu : un écran blanc est une panne, pas une
 * précaution. C'est la leçon de la migration 108, qui avait fait perdre
 * Appel, Notes et Bulletins à six écoles sur sept.
 */
export function paliersPourMenu(ecole) {
  const d = paliersDeclares(ecole);
  if (d.length) return d;
  if (ecole?.type_etablissement === "superieur") return ["universite"];
  return [...SCOLAIRES];
}

/** L'école couvre-t-elle ce palier ? (repli compris) */
export function couvre(ecole, palier) {
  return paliersPourMenu(ecole).includes(palier);
}

/** Des pages « école » sont-elles pertinentes ? */
export function couvreScolaire(ecole) {
  const p = paliersPourMenu(ecole);
  return SCOLAIRES.some((s) => p.includes(s));
}

/** Des pages « supérieur » (LMD) sont-elles pertinentes ? */
export function couvreSuperieur(ecole) {
  return paliersPourMenu(ecole).includes("universite");
}

/**
 * Le type à retenir POUR LE VOCABULAIRE (« élève » / « étudiant »).
 *
 * ⚠️ Ce n'est PAS la même question que « quelles pages ouvrir ». Un
 * établissement qui va de l'élémentaire à l'université a surtout des
 * élèves : on garde « élève » comme mot courant, les pages du supérieur
 * portant déjà leurs propres intitulés (`labelSup`). Seul un établissement
 * exclusivement universitaire parle d'étudiants partout.
 */
export function typeDominant(ecole) {
  return couvreSuperieur(ecole) && !couvreScolaire(ecole) ? "superieur" : "ecole";
}

/** Les cycles que l'école devrait créer dans Structure, d'après ses paliers. */
export function cyclesAttendus(paliers = []) {
  const liste = Array.isArray(paliers) ? paliers : [];
  const out = [];
  for (const p of PALIERS) {
    if (liste.includes(p.cle)) for (const c of p.cycles) if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** « Élémentaire, Collège et Lycée » — pour l'afficher d'un trait. */
export function resume(paliers = []) {
  const l = trier((Array.isArray(paliers) ? paliers : []).filter(valide)).map((p) => LABELS[p]);
  if (!l.length) return "";
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
}

/** La combinaison courante qui correspond exactement, s'il y en a une. */
export function combinaisonDe(paliers = []) {
  const a = trier((Array.isArray(paliers) ? paliers : []).filter(valide)).join("|");
  return COMBINAISONS.find((c) => trier(c.paliers).join("|") === a) || null;
}

/**
 * Un trou dans l'échelle scolaire : élémentaire et lycée sans le collège.
 *
 * ⚠️ ON SIGNALE SANS INTERDIRE. Un établissement peut avoir une raison que
 * nous ignorons — une école qui ferme son collège le temps d'un chantier,
 * par exemple. Bloquer l'enverrait dans une impasse ; le lui dire suffit.
 */
export function trou(paliers = []) {
  const echelle = ["elementaire", "college", "lycee"];
  const pris = echelle.map((p) => (Array.isArray(paliers) ? paliers : []).includes(p));
  const premier = pris.indexOf(true);
  const dernier = pris.lastIndexOf(true);
  if (premier < 0) return null;
  for (let i = premier; i <= dernier; i += 1) {
    if (!pris[i]) return LABELS[echelle[i]];
  }
  return null;
}

/** La pédagogie ne se demande que si l'élémentaire est couvert. */
export function pedagogiePertinente(paliers = []) {
  return (Array.isArray(paliers) ? paliers : []).includes("elementaire");
}

/**
 * Ce qui part en base, à partir de ce que l'écran a recueilli.
 *
 * ⚠️ `type_etablissement` EST TENU À JOUR AUTOMATIQUEMENT. Le champ n'est
 * plus proposé à la saisie : il portait déjà deux significations
 * contradictoires — statut juridique (mig. 001) puis bascule école /
 * supérieur (mig. 108) — et cette confusion avait fait perdre leur menu à
 * six écoles sur sept. On le DÉDUIT désormais des paliers, pour que les
 * anciens consommateurs restent cohérents sans qu'on ait à leur faire
 * confiance.
 *
 * ⚠️ Et tant qu'aucun palier n'est déclaré, on NE TOUCHE PAS au type :
 * l'école garde exactement le comportement qu'elle avait.
 */
export function profilAEnregistrer(f = {}, colonnesDisponibles = true) {
  //  ⚠️ Tant que la migration 168 n'est pas appliquee, ces deux colonnes
  //  n'existent pas : les envoyer ferait echouer TOUT l'enregistrement de la
  //  fiche etablissement. On les retire, et le reste s'enregistre.
  if (!colonnesDisponibles) {
    const { paliers: _p, pedagogie_elementaire: _pe, ...reste } = f;
    return reste;
  }
  const paliers = paliersDeclares({ paliers: f.paliers });
  const universitaireSeul = paliers.length > 0 && paliers.every((p) => p === "universite");
  return {
    ...f,
    paliers,
    type_etablissement: paliers.length
      ? (universitaireSeul ? "superieur" : "ecole")
      : f.type_etablissement,
    //  La pédagogie ne vaut que si l'élémentaire est couvert : on la vide
    //  sinon, plutôt que de laisser une valeur qui ne veut plus rien dire.
    pedagogie_elementaire: pedagogiePertinente(paliers) ? (f.pedagogie_elementaire || null) : null,
  };
}
