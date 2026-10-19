// GesSchool — la situation financière d'un enfant, telle que le parent la lit
// dans « Paiements ».
//
// ⚠️ MODULE PUR. Les droits sont tenus par les RPC `enfant_factures`,
// `enfant_declarations` et `enfant_facture_detail` (verrou `_parent_possede`,
// mig. 206) ; ce fichier ne fait que compter et nommer. Testé par
// test/situationParent.test.mjs.
//
// 🔴 UNE FACTURE ANNULÉE NE DOIT RIEN. Le reste à payer additionnait toutes
// les factures, annulées comprises : un parent pouvait lire une dette qui
// n'existait plus, et se voir proposer de la payer.
// Un BROUILLON n'est pas encore émis : il n'est ni montré ni compté.

const n = (v) => Number(v) || 0;

export const ETATS_FACTURE = {
  a_payer:  { cle: "a_payer",  label: "À payer",              ton: "text-rose-700 bg-rose-50" },
  partielle:{ cle: "partielle", label: "Partiellement réglée", ton: "text-or-700 bg-or-500/15" },
  reglee:   { cle: "reglee",   label: "Réglée",               ton: "text-emerald-700 bg-emerald-50" },
  annulee:  { cle: "annulee",  label: "Annulée",              ton: "text-navy-900/60 bg-navy-900/5" },
};

export const estAnnulee = (f) => f?.statut === "annulee";

/** Ce qui reste dû sur une facture. Une annulée ne doit rien ; jamais négatif. */
export function resteFacture(f) {
  if (estAnnulee(f)) return 0;
  return Math.max(0, n(f?.montant_total) - n(f?.montant_paye));
}

/** L'état affiché : à payer, partiellement réglée, réglée ou annulée. */
export function etatFacture(f) {
  if (estAnnulee(f)) return ETATS_FACTURE.annulee;
  if (resteFacture(f) <= 0) return ETATS_FACTURE.reglee;
  if (n(f?.montant_paye) > 0) return ETATS_FACTURE.partielle;
  return ETATS_FACTURE.a_payer;
}

/** Seule une facture qui doit encore quelque chose se paie. */
export const peutPayer = (f) => !estAnnulee(f) && resteFacture(f) > 0;

/** Les factures montrées au parent : tout sauf les brouillons. */
export const facturesVisibles = (factures = []) =>
  (Array.isArray(factures) ? factures : []).filter((f) => f?.statut !== "brouillon");

/**
 * La synthèse en tête de « Paiements ». Les annulées et les brouillons ne
 * comptent ni dans le facturé, ni dans le payé, ni dans le reste.
 */
export function syntheseFactures(factures = []) {
  const actives = facturesVisibles(factures).filter((f) => !estAnnulee(f));
  const facture = actives.reduce((s, f) => s + n(f.montant_total), 0);
  // Le payé est plafonné au montant de chaque facture : un trop-perçu ne doit
  // pas faire paraître le reste plus petit qu'il n'est sur les autres.
  const paye = actives.reduce((s, f) => s + Math.min(n(f.montant_paye), n(f.montant_total)), 0);
  const reste = actives.reduce((s, f) => s + resteFacture(f), 0);
  return { facture, paye, reste, aRegler: actives.filter((f) => resteFacture(f) > 0).length, nb: actives.length };
}

/**
 * Les déclarations à montrer : en attente ou rejetées. Une déclaration
 * VALIDÉE est devenue un encaissement ; elle se retrouve sous forme de reçu,
 * sur sa facture.
 */
export const declarationsAffichees = (declarations = []) =>
  (Array.isArray(declarations) ? declarations : []).filter((d) => d?.statut === "en_attente" || d?.statut === "rejete");

/** Les déclarations en attente, par facture : « paiement déclaré » sur la ligne. */
export function enAttenteParFacture(declarations = []) {
  const par = {};
  for (const d of Array.isArray(declarations) ? declarations : []) {
    if (d?.statut === "en_attente" && d.facture_id) par[d.facture_id] = (par[d.facture_id] || 0) + n(d.montant);
  }
  return par;
}

/** Une facture a-t-elle au moins un reçu (un encaissement) ? */
export const aDesRecus = (f) => n(f?.nb_paiements) > 0;

/**
 * Le reçu ouvert par défaut parmi les encaissements d'une facture : le plus
 * récent. Les encaissements arrivent dans l'ordre chronologique
 * (`enfant_facture_detail`) ; on ne s'y fie pas, on trie.
 */
export function recuParDefaut(paiements = [], prefereId = null) {
  const liste = Array.isArray(paiements) ? paiements : [];
  if (!liste.length) return null;
  if (prefereId) {
    const p = liste.find((x) => x.id === prefereId);
    if (p) return p;
  }
  // À date égale, le dernier saisi l'emporte : on inverse avant un tri stable.
  return [...liste].reverse().sort((a, b) =>
    String(b.date_paiement || "").localeCompare(String(a.date_paiement || "")))[0];
}
