// GesSchool — le circuit du bulletin : brouillon → validé → publié.
//
// Point 6 de la visite. Jusqu'ici il n'y avait aucun état : écrire un
// bulletin le rendait AUSSITÔT visible du parent — la fonction s'appelle
// encore `publierBulletins` et son commentaire disait « persiste les
// bulletins calculés → visibles par les parents ». Aucune relecture n'était
// possible avant diffusion.
//
// ⚠️ MODULE PUR : il ne décide RIEN sur les droits réels. Il dit seulement
// quelles actions PROPOSER à l'écran. Les droits sont tenus par la
// migration 166 — policies, déclencheur sur `statut` et RPC
// `avancer_bulletins`. Ce qui est caché ici est refusé là-bas : l'inverse
// serait un contrôle frontend pris pour une sécurité.

export const ETATS = ["brouillon", "valide", "publie"];

export const LIBELLES = {
  brouillon: "Brouillon",
  valide: "Validé",
  publie: "Publié",
};

//  Ce que l'état signifie POUR LA FAMILLE. C'est la seule question que se
//  pose l'école : « est-ce que le parent le voit ? »
export const EXPLICATIONS = {
  brouillon: "En relecture — le parent ne le voit pas.",
  valide: "Arrêté par la direction — le parent ne le voit pas encore.",
  publie: "Visible dans l'espace parent.",
};

export const TON = { brouillon: "neutre", valide: "warning", publie: "success" };

/**
 * L'état d'ensemble d'une classe, à partir des compteurs par état.
 * Une classe dont les bulletins sont dispersés entre deux états n'est NI
 * l'un NI l'autre : on le dit, au lieu de choisir pour l'école.
 *
 * @param {{brouillon:number, valide:number, publie:number}} compte
 */
export function etatGlobal(compte = {}) {
  const b = Number(compte.brouillon || 0);
  const v = Number(compte.valide || 0);
  const p = Number(compte.publie || 0);
  const total = b + v + p;
  if (total === 0) return { etat: null, total: 0, melange: false };
  const presents = [["brouillon", b], ["valide", v], ["publie", p]].filter(([, n]) => n > 0);
  if (presents.length > 1) return { etat: null, total, melange: true };
  return { etat: presents[0][0], total, melange: false };
}

/**
 * Les actions à PROPOSER pour une classe et une période.
 *
 * @param {object} o
 * @param {object} o.compte          compteurs par état (etat_bulletins)
 * @param {boolean} o.peutAvancer    l'utilisateur a-t-il la direction ?
 * @param {boolean} o.conseilComplet le PV porte-t-il ses deux signatures ?
 * @returns {Array<{cle:string, statut:string, label:string, bloque?:string}>}
 */
export function actions({ compte = {}, peutAvancer = false, conseilComplet = false } = {}) {
  const { etat, total, melange } = etatGlobal(compte);
  //  Aucun bulletin enregistré : il n'y a rien à faire avancer. On ne
  //  propose pas une action qui échouerait.
  if (total === 0) return [];
  //  L'enseignant voit l'état de sa classe — c'est utile — mais n'arrête ni
  //  ne diffuse rien. La migration 166 le refuse de toute façon.
  if (!peutAvancer) return [];

  const out = [];
  const reste = (s) => Number(compte[s] || 0) > 0;

  if (melange || reste("brouillon")) {
    out.push({ cle: "valider", statut: "valide", label: "Valider" });
  }
  if (melange || reste("brouillon") || reste("valide")) {
    out.push({
      cle: "publier", statut: "publie", label: "Publier aux parents",
      //  ⚠️ On n'INTERDIT pas : on AVERTIT. Une école peut avoir une raison
      //  de diffuser avant d'avoir réuni les signatures — un rattrapage, un
      //  conseil reporté. Bloquer l'enverrait dans une impasse, et la base
      //  n'exige pas le PV pour publier.
      bloque: conseilComplet ? null : "Le procès-verbal n'est pas encore signé par les deux responsables.",
    });
  }
  if (reste("publie")) {
    out.push({
      cle: "retirer", statut: "brouillon", label: "Retirer de l'espace parent",
      bloque: "Les familles qui l'ont déjà consulté ne le verront plus.",
    });
  }
  return out;
}

/**
 * Les bulletins arrêtés ou diffusés qui ne correspondent PLUS aux notes.
 *
 * 🔴 POURQUOI CETTE FONCTION EXISTE.
 * `bulletins` stocke un INSTANTANÉ : moyenne, rang, effectif, mention
 * (migration 001). Le calcul, lui, vit dans `calculerBulletins` et se relance
 * à la demande. Côté famille, l'espace parent sert les NOTES vivantes et le
 * BULLETIN figé : une note corrigée après la diffusion fait donc apparaître la
 * correction dans « Notes » et laisse l'ancienne moyenne dans « Bulletins ».
 * Personne n'était prévenu — ni la famille, ni la direction, qui voyait
 * pourtant les deux chiffres côte à côte sur le même écran sans qu'ils soient
 * comparés.
 *
 * ⚠️ LA COMPARAISON SE FAIT ICI, PAS EN SQL. La règle de calcul (coefficients,
 * barème de l'école, note absente neutre) n'existe qu'à un seul endroit :
 * `calculerBulletins`. La réécrire en SQL pour comparer aurait créé deux
 * implémentations de la même règle, donc deux vérités à maintenir.
 *
 * Un BROUILLON périmé n'est pas signalé : rien n'a été arrêté ni diffusé, et
 * le recalculer est le geste normal. Ce qui compte, c'est ce que l'école a
 * arrêté (`valide`) ou montré aux familles (`publie`).
 *
 * @param {object} o
 * @param {Array<{eleve:object, moyenne:number|null, rang:number|null}>} o.calculs
 *        sortie de `calculerBulletins` (`.eleves`)
 * @param {Array<{eleve_id:string, moyenne_generale:number|null, rang:number|null, statut:string, consulte_le?:string|null}>} o.enregistres
 * @returns {{nb:number, publies:number, consultes:number, detail:Array, manquants:number}}
 */
export function bulletinsPerimes({ calculs = [], enregistres = [] } = {}) {
  const parEleve = new Map((enregistres || []).map((b) => [b.eleve_id, b]));
  const detail = [];
  let manquants = 0;

  for (const c of calculs || []) {
    const id = c?.eleve?.id;
    if (!id) continue;
    const b = parEleve.get(id);
    //  Pas encore enregistré : ce n'est pas « périmé », c'est « jamais écrit ».
    //  Les compteurs du circuit disent déjà combien de bulletins existent.
    if (!b) { manquants++; continue; }
    if (b.statut !== "valide" && b.statut !== "publie") continue;

    const ecarts = [];
    if (!memeNombre(b.moyenne_generale, c.moyenne)) {
      ecarts.push({ champ: "moyenne", stocke: nombreOuNull(b.moyenne_generale), calcule: nombreOuNull(c.moyenne) });
    }
    //  Le rang peut changer SANS que la note de l'élève bouge : il suffit
    //  qu'un camarade soit corrigé. Un rang faux sur un bulletin imprimé est
    //  une erreur au même titre qu'une moyenne fausse.
    if (!memeNombre(b.rang, c.rang)) {
      ecarts.push({ champ: "rang", stocke: nombreOuNull(b.rang), calcule: nombreOuNull(c.rang) });
    }
    if (ecarts.length === 0) continue;

    detail.push({
      eleve_id: id,
      nom: `${c.eleve?.prenom || ""} ${c.eleve?.nom || ""}`.trim() || "—",
      statut: b.statut,
      consulte: !!b.consulte_le,
      ecarts,
    });
  }

  return {
    nb: detail.length,
    publies: detail.filter((d) => d.statut === "publie").length,
    //  Les familles qui ont DÉJÀ lu le mauvais chiffre : ce sont celles qu'il
    //  faudra prévenir, et le nombre qui doit décider d'agir tout de suite.
    consultes: detail.filter((d) => d.consulte).length,
    detail,
    manquants,
  };
}

//  `numeric(5,2)` en base contre un arrondi JavaScript : on compare à 0,01
//  près, sinon 12.34 et 12.340000000000001 passeraient pour un écart.
function memeNombre(a, b) {
  const x = nombreOuNull(a);
  const y = nombreOuNull(b);
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) < 0.005;
}

function nombreOuNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Les deux signatures attendues sur le procès-verbal, et leur état.
 * L'école a été explicite : « il faut 2 signatures » — le responsable
 * pédagogique DU CYCLE, et le responsable de la Gestion.
 *
 * @param {Array<{qualite:string, nom?:string, signe_le?:string}>} signatures
 */
export function etatSignatures(signatures = []) {
  const liste = Array.isArray(signatures) ? signatures : [];
  const trouve = (q) => liste.find((s) => s.qualite === q) || null;
  const attendues = [
    { qualite: "pedagogique", label: "Responsable pédagogique du cycle" },
    { qualite: "gestion", label: "Responsable de la gestion" },
  ];
  const detail = attendues.map((a) => ({ ...a, signature: trouve(a.qualite) }));
  return { detail, complet: detail.every((d) => d.signature), manquantes: detail.filter((d) => !d.signature).length };
}

/**
 * Peut-on proposer à cette personne de signer, et dans quelle qualité ?
 *
 * ⚠️ `estResponsableDuCycle` doit venir du SERVEUR (la liste des
 * responsables du cycle de la classe), jamais d'une déduction sur le rôle :
 * tout compte `direction` couvre l'école entière, or l'école a justement
 * deux responsables pédagogiques distincts.
 */
export function qualitesSignables({ roles = [], estResponsableDuCycle = false, dejaSignePar = [] } = {}) {
  const a = (r) => roles.includes(r);
  const out = [];
  if (estResponsableDuCycle) out.push("pedagogique");
  //  ⚠️ PAS `direction` ICI. Le helper serveur `est_gestion()` vaut vrai
  //  pour la direction : s'en servir aurait permis à un responsable
  //  pédagogique de fournir les DEUX signatures, et le « PV à deux
  //  signatures » n'en aurait exigé qu'une. On nomme les rôles de l'espace
  //  Gestion, comme le fait la migration 166.
  if (a("admin_ecole") || a("super_admin") || a("comptable") || a("secretaire")) out.push("gestion");
  //  Une même personne ne peut pas poser les deux signatures : la base le
  //  garantit par une contrainte d'unicité, l'écran ne doit donc pas le
  //  proposer.
  return dejaSignePar.length ? [] : out;
}
