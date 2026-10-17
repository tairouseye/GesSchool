// GesSchool — le paiement anticipé (mig. 202), côté écran.
//
// ⚠️ MODULE PUR. Les prix et les mois disponibles viennent de la base
// (`avance_options`) : ce fichier ne fait que les regrouper et les additionner
// pour l'affichage. Le montant réellement déclaré est recalculé par la base à
// partir des mois choisis — jamais repris de l'écran.

/**
 * Les lignes rendues par `avance_options`, regroupées par mois.
 * Un mois peut porter plusieurs frais (scolarité + un autre frais mensuel).
 * @returns {{mois:string, libelle:string, total:number, lignes:object[]}[]}
 */
export function grouperParMois(lignes = []) {
  const par = new Map();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l?.mois) continue;
    const g = par.get(l.mois) || { mois: l.mois, libelle: l.libelle_mois || l.mois, total: 0, lignes: [] };
    g.total += Number(l.montant) || 0;
    g.lignes.push(l);
    par.set(l.mois, g);
  }
  return [...par.values()].sort((a, b) => a.mois.localeCompare(b.mois));
}

/** Le total des mois cochés. */
export function totalDesMois(groupes = [], choisis = []) {
  const s = new Set(choisis);
  return groupes.filter((g) => s.has(g.mois)).reduce((t, g) => t + g.total, 0);
}

/**
 * Le choix par défaut : le PREMIER mois proposé. C'est le cas fréquent — le
 * parent paie le mois qui vient — et il n'a plus qu'à valider.
 */
export function choixParDefaut(groupes = []) {
  return groupes.length ? [groupes[0].mois] : [];
}

/**
 * Cocher un mois coche aussi ceux qui le PRÉCÈDENT ; décocher un mois
 * décoche ceux qui le SUIVENT. Payer décembre en laissant novembre impayé
 * n'a pas de sens pour une famille, et laisserait un trou que la caisse
 * devrait expliquer.
 */
export function basculerMois(groupes = [], choisis = [], mois) {
  const ordre = groupes.map((g) => g.mois);
  const i = ordre.indexOf(mois);
  if (i < 0) return choisis;
  return choisis.includes(mois) ? ordre.slice(0, i) : ordre.slice(0, i + 1);
}

/** « Novembre 2026, Décembre 2026 » → « Novembre et Décembre 2026 », pour une phrase. */
export function resumeMois(libelles = []) {
  const l = libelles.filter(Boolean);
  if (l.length <= 1) return l[0] || "";
  const annees = new Set(l.map((x) => x.split(" ").pop()));
  const noms = annees.size === 1 ? l.map((x) => x.split(" ").slice(0, -1).join(" ")) : l;
  const fin = annees.size === 1 ? ` ${[...annees][0]}` : "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}${fin}`;
}

/**
 * Les mois déjà couverts par une avance — la sienne ou celle de l'AUTRE
 * parent —, encore en attente ou validée, pour la carte « Payer d'avance ».
 * Sans elle, le second parent voit un mois disparaître de la liste sans
 * comprendre pourquoi. Lignes rendues par `enfant_declarations`.
 */
export function avancesCouvertes(declarations = []) {
  return (Array.isArray(declarations) ? declarations : [])
    .filter((d) => d?.avance && (d.statut === "en_attente" || d.statut === "valide"))
    .map((d) => ({
      id: d.id,
      mois: d.avance,
      enAttente: d.statut === "en_attente",
      par: d.declarant && d.declarant !== "Vous" ? d.declarant : null,
    }));
}

/**
 * Les libellés RÉSERVÉS par des paiements anticipés encore en attente,
 * indexés par élève — pour que la facturation en lot ne facture pas un mois
 * que le parent vient de payer et que la caisse n'a pas encore validé.
 */
export function libellesReserves(declarations = []) {
  const map = {};
  for (const d of Array.isArray(declarations) ? declarations : []) {
    if (d?.statut !== "en_attente" || !d.eleve_id || !Array.isArray(d.avance_lignes)) continue;
    for (const l of d.avance_lignes) {
      if (l?.libelle) (map[d.eleve_id] ||= new Set()).add(l.libelle);
    }
  }
  return map;
}
