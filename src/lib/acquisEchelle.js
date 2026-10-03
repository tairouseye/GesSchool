// GesSchool — l'échelle d'observation du préscolaire (mig. 172).
//
// ⚠️ AU PRÉSCOLAIRE, ON NE NOTE PAS SUR 20. On observe. Un enfant de TPS
// n'a pas une moyenne de 12,5 en langage : il « sait nommer les objets
// usuels » — acquis, en cours d'acquisition, ou pas encore. Réutiliser les
// notes aurait produit une CONVERSATION FAUSSE avec les familles : un
// parent qui lit « 8/20 » à trois ans comprend un échec, là où
// l'enseignante voulait dire « il y arrive bientôt ».
//
// ⚠️ MODULE PUR. Les droits sont tenus par la migration 172.

export const VALEURS = [
  {
    cle: "acquis", label: "Acquis", court: "A", pastille: "🟢", ton: "success",
    aide: "L'enfant y parvient seul, de façon régulière.",
  },
  {
    cle: "en_cours", label: "En cours d'acquisition", court: "EC", pastille: "🟡", ton: "warning",
    aide: "L'enfant y parvient avec de l'aide, ou par moments.",
  },
  {
    // ⚠️ La formulation compte : « pas encore acquis » décrit un moment
    // d'un parcours. « Non acquis » sonne comme un verdict, et c'est un
    // enfant de trois ans qu'on décrit à ses parents.
    cle: "non_acquis", label: "Pas encore acquis", court: "PE", pastille: "🔴", ton: "danger",
    aide: "L'enfant ne s'en saisit pas encore. Ce n'est pas un échec : c'est une étape.",
  },
];

const PAR_CLE = Object.fromEntries(VALEURS.map((v) => [v.cle, v]));

/** Une valeur inconnue — ou absente — n'est PAS un « non acquis ». */
export function valeur(cle) {
  return PAR_CLE[cle] || null;
}

/**
 * Regroupe les observations par domaine, dans l'ordre du référentiel.
 * @param {Array} items  le référentiel ({id, domaine, libelle, ordre})
 * @param {Object} obs   eleve → item_id → { valeur, observation }
 */
export function parDomaine(items = [], obs = {}) {
  const groupes = [];
  for (const it of Array.isArray(items) ? items : []) {
    let g = groupes.find((x) => x.domaine === it.domaine);
    if (!g) { g = { domaine: it.domaine, items: [] }; groupes.push(g); }
    g.items.push({ ...it, ...(obs?.[it.id] || {}) });
  }
  return groupes;
}

/**
 * L'avancement d'un enfant : combien d'items observés, et comment.
 *
 * ⚠️ `nonEvalues` EST UNE INFORMATION, pas un reliquat. Une enseignante doit
 * voir ce qui reste à observer ; et un suivi à 3 items sur 60 ne doit pas
 * se présenter comme un bilan.
 */
export function avancement(items = [], obs = {}) {
  const n = { acquis: 0, en_cours: 0, non_acquis: 0, nonEvalues: 0 };
  for (const it of Array.isArray(items) ? items : []) {
    const v = obs?.[it.id]?.valeur;
    if (PAR_CLE[v]) n[v] += 1;
    else n.nonEvalues += 1;
  }
  const total = (Array.isArray(items) ? items : []).length;
  return { ...n, total, observes: total - n.nonEvalues };
}

/** Une phrase pour la famille, qui ne transforme pas un suivi en verdict. */
export function phraseFamille(a) {
  if (!a || !a.total) return "";
  if (!a.observes) return "Aucune observation enregistrée pour cette période.";
  const bouts = [];
  if (a.acquis) bouts.push(`${a.acquis} acquis`);
  if (a.en_cours) bouts.push(`${a.en_cours} en cours`);
  if (a.non_acquis) bouts.push(`${a.non_acquis} pas encore`);
  return `${bouts.join(" · ")} — sur ${a.observes} observation${a.observes > 1 ? "s" : ""}.`;
}
