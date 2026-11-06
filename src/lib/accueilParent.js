// GesSchool — l'accueil parent en cartes (maquette de Mme Kane, Tut'Tank,
// 05/11/2026) : une carte par enfant, qui dit d'un coup d'œil si tout est
// réglé, puis la dernière annonce. MODULE PUR : rien n'est lu ici.

import { resumeEcheancier } from "./paiementStatut.js";
import { aRegler, coursDuJour } from "./apercuEnfant.js";

//  Une couleur par enfant, la même sur sa carte et sur sa fiche.
const COULEURS = [
  { fonce: "bg-sky-700", clair: "bg-sky-50", texte: "text-sky-700" },
  { fonce: "bg-rose-700", clair: "bg-rose-50", texte: "text-rose-700" },
  { fonce: "bg-indigo-700", clair: "bg-indigo-50", texte: "text-indigo-700" },
  { fonce: "bg-emerald-700", clair: "bg-emerald-50", texte: "text-emerald-700" },
  { fonce: "bg-amber-700", clair: "bg-amber-50", texte: "text-amber-700" },
  { fonce: "bg-violet-700", clair: "bg-violet-50", texte: "text-violet-700" },
];

/** Couleur stable d'un enfant, dérivée de son identifiant. */
export function couleurEnfant(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS[h % COULEURS.length];
}

export const TONS_PASTILLE = {
  rouge: "bg-rose-100 text-rose-800", vert: "bg-emerald-100 text-emerald-800",
  bleu: "bg-sky-100 text-sky-800", neutre: "bg-navy-900/5 text-navy-900/70",
};

/** L'âge en années révolues ; `null` sans date de naissance. */
export function ageEnfant(naissance, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(naissance || "");
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const passe = now.getMonth() + 1 > mois || (now.getMonth() + 1 === mois && now.getDate() >= jour);
  return now.getFullYear() - annee - (passe ? 0 : 1);
}

/**
 * « 2 mois à payer », « Frais d'inscription et 2 mois à payer ».
 * ⚠️ L'INSCRIPTION N'EST PAS UN MOIS : la compter comme tel annonçait
 * « 3 mois à payer » pour 230 000 F dont 100 000 d'inscription. Dans
 * l'échéancier, une ligne sans `mois` est un frais ponctuel.
 */
export function libelleDus(dus = []) {
  const mois = dus.filter((l) => l?.mois).length;
  const autres = dus.filter((l) => !l?.mois);
  const frais = autres.length === 1 ? autres[0].libelle || "1 frais" : autres.length > 1 ? `${autres.length} frais` : "";
  return `${[frais, mois > 0 ? `${mois} mois` : ""].filter(Boolean).join(" et ")} à payer`;
}

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
    const { dus } = resumeEcheancier(echeancier.lignes);
    if (dus.length > 0) return { ton: "rouge", texte: libelleDus(dus) };
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
 * Ce que l'accueil met en tête : le montant à régler pour un enfant.
 * ⚠️ LE MÊME CHIFFRE QUE LA RUBRIQUE PAIEMENTS, calculé de la même façon :
 * l'échéancier s'il a des lignes, sinon les factures. Une contradiction entre
 * deux écrans a déjà touché 70 familles de Tut'Tank (relevé du 05/11/2026).
 * ⚠️ `echeancier` absent (`undefined`) = lecture en échec : on ne dit rien
 * plutôt qu'un montant faux ; `null` = base sans échéancier, on lit les factures.
 * Sans échéancier, seul le retard est une priorité : une facture qui n'est pas
 * encore due garde sa pastille sur la carte.
 *
 * @returns {{ montant: number, texte: string, declaree: boolean } | null}
 *   `declaree` : un paiement déclaré attend la caisse. Le parent n'a pas à
 *   payer une deuxième fois.
 */
export function aPayerAccueil({ echeancier, factures, declarations } = {}) {
  if (echeancier === undefined) return null;
  const declaree = Array.isArray(declarations) && declarations.some((d) => d?.statut === "en_attente");
  if (Array.isArray(echeancier?.lignes) && (echeancier.lignes.length > 0 || echeancier.statut === "exonere")) {
    const { totalDu, dus } = resumeEcheancier(echeancier.lignes);
    if (totalDu <= 0) return null;
    return { montant: totalDu, texte: libelleDus(dus), declaree };
  }
  if (!Array.isArray(factures)) return null;
  const r = aRegler(factures);
  return r.reste > 0 && r.enRetard ? { montant: r.reste, texte: "Paiement en retard", declaree } : null;
}

const heureFr = (t) => {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
};

/**
 * « Prochain cours : Sciences à 10 h », ou `null` : plus de cours aujourd'hui.
 * Un créneau sans matière (accueil, récréation, repas) n'est pas un cours.
 * Le groupe est nommé : deux groupes ont cours à la même heure, et rien ne dit
 * ici dans lequel est l'enfant.
 */
export function prochainCours(creneaux = [], now = new Date()) {
  const cours = (Array.isArray(creneaux) ? creneaux : []).filter((c) => c?.matiere);
  const { premier: c } = coursDuJour(cours, now);
  if (!c) return null;
  const groupe = /^G\d+$/i.test(c.salle || "") ? `${c.salle.toUpperCase()} · ` : "";
  const nom = `${groupe}${c.activite || c.matiere}`;
  return c.enCours ? `En cours : ${nom}` : `Prochain cours : ${nom} à ${heureFr(c.debut)}`;
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
