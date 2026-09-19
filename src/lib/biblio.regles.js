// GesSchool — Bibliothèque : RÈGLES DE CIRCULATION (logique pure, testable).
// Aucun accès réseau ici : échéances, quotas, renouvellements, pénalités et
// bornes de pagination. Mêmes principes que le moteur de paie / LMD.

const JOUR_MS = 86400000;

// "2026-09-19" -> Date (UTC, sans dérive de fuseau)
export function versDate(d) {
  if (!d) return null;
  if (d instanceof Date) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// Date -> "AAAA-MM-JJ"
export function versISO(d) {
  const dt = versDate(d);
  return dt ? dt.toISOString().slice(0, 10) : null;
}

// Nombre de jours entiers entre deux dates (b - a). Négatif si b précède a.
export function joursEntre(a, b) {
  const da = versDate(a), db = versDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / JOUR_MS);
}

// Échéance = date d'emprunt + durée de la règle.
export function calculerEcheance(dateEmprunt, dureeJours) {
  const d = versDate(dateEmprunt);
  if (!d) return null;
  const n = Number(dureeJours);
  d.setUTCDate(d.getUTCDate() + (Number.isFinite(n) ? n : 0));
  return versISO(d);
}

// Jours de retard à une date donnée (0 si dans les temps).
export function joursRetard(dateEcheance, aujourdhui) {
  return Math.max(0, joursEntre(dateEcheance, aujourdhui));
}

export function estEnRetard(emprunt, aujourdhui) {
  if (!emprunt || emprunt.statut !== "en_cours") return false;
  return joursRetard(emprunt.date_echeance, aujourdhui) > 0;
}

// L'usager peut-il emprunter ? Renvoie { ok, motif }.
export function verifierEmprunt({ empruntsEnCours = 0, retardsEnCours = 0, regle } = {}) {
  if (!regle) return { ok: false, motif: "Aucune règle de prêt définie pour ce profil." };
  if (regle.actif === false) return { ok: false, motif: "Les prêts sont désactivés pour ce profil." };
  const max = Number(regle.max_emprunts) || 0;
  if (empruntsEnCours >= max) {
    return { ok: false, motif: `Quota atteint (${empruntsEnCours}/${max} emprunts en cours).` };
  }
  if (retardsEnCours > 0) {
    return { ok: false, motif: `${retardsEnCours} document(s) en retard à rendre d'abord.` };
  }
  return { ok: true, motif: null };
}

// Renouvellement possible ? Renvoie { ok, motif, nouvelleEcheance }.
export function verifierRenouvellement({ emprunt, regle, aujourdhui } = {}) {
  if (!emprunt || emprunt.statut !== "en_cours") {
    return { ok: false, motif: "Cet emprunt n'est pas en cours.", nouvelleEcheance: null };
  }
  if (!regle) return { ok: false, motif: "Aucune règle de prêt définie.", nouvelleEcheance: null };
  const maxR = Number(regle.renouvellements_max) || 0;
  const faits = Number(emprunt.renouvellements) || 0;
  if (faits >= maxR) {
    return { ok: false, motif: `Nombre maximum de renouvellements atteint (${faits}/${maxR}).`, nouvelleEcheance: null };
  }
  if (joursRetard(emprunt.date_echeance, aujourdhui) > 0) {
    return { ok: false, motif: "Document en retard : renouvellement impossible.", nouvelleEcheance: null };
  }
  return { ok: true, motif: null, nouvelleEcheance: calculerEcheance(aujourdhui, regle.duree_jours) };
}

// Pénalité de retard. 0 si les pénalités sont désactivées (cas par défaut).
export function calculerPenalite({ dateEcheance, dateRetour, regle } = {}) {
  if (!regle || !regle.penalites_actives) return 0;
  const jours = joursRetard(dateEcheance, dateRetour);
  if (jours <= 0) return 0;
  return Math.round(jours * (Number(regle.penalite_jour) || 0));
}

// Rang du prochain arrivant dans la file d'attente d'une ressource.
// ⚠️ N'est PLUS utilisé pour créer une réservation : le rang est attribué en
// base par trigger (migration 126), car la RLS empêche l'usager de voir la
// file et le calcul côté client renvoyait toujours 1. Conservé pour l'affichage
// et les simulations côté gestion, qui a bien la visibilité complète.
export function rangSuivant(reservationsActives = []) {
  const rangs = reservationsActives
    .filter((r) => r && (r.statut === "active" || r.statut === "disponible"))
    .map((r) => Number(r.rang) || 0);
  return (rangs.length ? Math.max(...rangs) : 0) + 1;
}

// Bornes pour `.range()` de Supabase (pagination serveur).
export function bornesPagination(page = 0, taille = 20) {
  const p = Math.max(0, Number(page) || 0);
  const t = Math.min(200, Math.max(1, Number(taille) || 20)); // borne dure : jamais de requête illimitée
  const debut = p * t;
  return { debut, fin: debut + t - 1, taille: t, page: p };
}

// Nombre total de pages pour un total d'éléments donné.
export function nbPages(total, taille = 20) {
  const t = Math.max(1, Number(taille) || 20);
  return Math.max(1, Math.ceil((Number(total) || 0) / t));
}
