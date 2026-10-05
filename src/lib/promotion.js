// GesSchool — où va un élève à la fin de l'année, Montessori comprise.
//
// 🔴 CE QUI NE MARCHAIT PAS. Les classes multi-niveaux (migration 164) notent
// le niveau RÉEL de l'enfant dans `inscriptions.sous_niveau_id` : dans la
// classe « TPS/PS A », l'un est TPS et l'autre PS. Mais le passage d'année
// ignorait complètement cette colonne :
//
//   1. il lisait le niveau de la CLASSE (le niveau combiné) et proposait le
//      niveau d'ordre suivant — donc le TPS et le PS recevaient la MÊME
//      proposition, et l'enfant de TPS sautait une année ;
//   2. la réinscription n'écrivait pas `sous_niveau_id`, donc le niveau réel
//      saisi l'an passé était EFFACÉ à chaque changement d'année.
//
// Autrement dit, la fonction qui distingue l'école de notre cliente
// pionnière Montessori se vidait d'elle-même tous les ans.
//
// ⚠️ MODULE PUR, et c'est voulu : la règle de progression est une règle
// métier, elle doit être éprouvable sans base de données. `annee.js` ne fait
// que lui passer les niveaux, les sous-niveaux et l'inscription courante.

/**
 * Où va cet élève l'an prochain ?
 *
 * La règle, dans l'ordre :
 *  1. s'il a un sous-niveau ET qu'un sous-niveau SUIVANT existe dans le même
 *     niveau → il reste dans le même niveau combiné et avance d'un cran
 *     (TPS → PS, toujours dans « TPS/PS ») ;
 *  2. sinon → niveau d'ordre suivant ; si ce niveau a lui aussi des
 *     sous-niveaux, il atterrit sur le PREMIER (PS → « CI/CP », en CI) ;
 *  3. s'il n'y a pas de niveau suivant → il sort de l'établissement.
 *
 * ⚠️ Cas d'un élève SANS sous-niveau dans un niveau qui en a : on ne peut pas
 * deviner son niveau réel, donc on ne l'invente pas — il est traité comme
 * étant au dernier cran, c'est-à-dire exactement comme avant cette fonction.
 * Aucune donnée existante ne change donc de comportement.
 *
 * @param {object} o
 * @param {string} o.niveauId        niveau (combiné ou simple) de sa classe
 * @param {string|null} o.sousNiveauId  son niveau réel, s'il est connu
 * @param {Array<{id:string, ordre:number, libelle?:string}>} o.niveaux
 * @param {Array<{id:string, niveau_id:string, ordre:number, libelle?:string}>} o.sousNiveaux
 * @returns {{niveau_id:string|null, sous_niveau_id:string|null, sortant:boolean, memeNiveau:boolean}}
 */
export function prochaineEtape({ niveauId, sousNiveauId = null, niveaux = [], sousNiveaux = [] } = {}) {
  const rien = { niveau_id: null, sous_niveau_id: null, sortant: true, memeNiveau: false };
  if (!niveauId) return rien;

  const dansCeNiveau = (id) => trier((sousNiveaux || []).filter((s) => s.niveau_id === id));

  // 1. Avancer d'un sous-niveau, sans changer de classe.
  if (sousNiveauId) {
    const fratrie = dansCeNiveau(niveauId);
    const i = fratrie.findIndex((s) => s.id === sousNiveauId);
    if (i >= 0 && i + 1 < fratrie.length) {
      return { niveau_id: niveauId, sous_niveau_id: fratrie[i + 1].id, sortant: false, memeNiveau: true };
    }
  }

  // 2. Niveau suivant, et son premier sous-niveau s'il en a.
  const actuel = (niveaux || []).find((n) => n.id === niveauId);
  if (!actuel) return rien;
  const suivant = trier(niveaux)
    .filter((n) => Number(n.ordre) > Number(actuel.ordre))[0] || null;
  if (!suivant) return rien;

  const premiers = dansCeNiveau(suivant.id);
  return {
    niveau_id: suivant.id,
    sous_niveau_id: premiers.length ? premiers[0].id : null,
    sortant: false,
    memeNiveau: false,
  };
}

//  Tri par `ordre`, puis par ancienneté de création, puis par identifiant.
//
//  ⚠️ JAMAIS PAR LIBELLÉ, et c'est un piège réel : la migration 164 laisse
//  `ordre` à 0 par défaut, et l'alphabet met « PS » AVANT « TPS ». Un
//  départage alphabétique aurait donc fait du PS le premier cran de
//  « TPS/PS » — et promu les TPS deux crans d'un coup. L'ordre de création
//  est le seul signal disponible qui reflète l'intention de l'école : elle
//  saisit ses sous-niveaux dans l'ordre où les enfants les traversent.
//
//  Le `id` en dernier ressort garantit la stabilité : sans lui, deux
//  sous-niveaux créés dans la même transaction pourraient s'échanger d'une
//  exécution à l'autre, et la proposition de passage changerait toute seule.
function trier(liste) {
  return [...(liste || [])].sort(
    (a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0)
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))
      || String(a.id || "").localeCompare(String(b.id || ""))
  );
}

/**
 * Le chemin lisible d'une promotion, pour l'écran de passage d'année.
 * « TPS/PS A · TPS → PS » dit quelque chose ; « TPS/PS A → MS/GS » mentait.
 */
export function libelleEtape({ sousNiveauActuel, niveauCible, sousNiveauCible, memeNiveau }) {
  const dep = sousNiveauActuel ? ` · ${sousNiveauActuel}` : "";
  if (memeNiveau) return `${dep ? dep.slice(3) : ""} → ${sousNiveauCible || ""}`.trim();
  const arr = [niveauCible, sousNiveauCible].filter(Boolean).join(" · ");
  return `${dep ? dep.slice(3) + " " : ""}→ ${arr}`.trim();
}
