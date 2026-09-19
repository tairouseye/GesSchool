// GesSchool — pagination serveur, utilitaire partagé.
//
// Ces deux fonctions vivaient dans `biblio.regles.js`, seul module à paginer
// jusqu'ici. Elles n'ont rien de bibliothécaire : elles deviennent le socle
// commun à mesure que les autres pages passent en pagination serveur.
// `biblio.regles.js` les réexporte, pour ne casser aucun import existant.

// Bornes `.range()` d'une page. La taille est PLAFONNÉE : une requête sans
// limite est exactement ce que cette pagination existe pour empêcher.
export function bornesPagination(page = 0, taille = 20) {
  const p = Math.max(0, Number(page) || 0);
  const t = Math.min(200, Math.max(1, Number(taille) || 20));
  const debut = p * t;
  return { debut, fin: debut + t - 1, taille: t, page: p };
}

export function nbPages(total, taille = 20) {
  const t = Math.max(1, Number(taille) || 20);
  return Math.max(1, Math.ceil((Number(total) || 0) / t));
}

// Plafond des lectures « complètes » assumées : impression d'une feuille de
// présence, export, envoi en masse. On ne charge jamais tout, mais on accepte
// un lot plus large que l'affichage — avec une borne, et un signal quand elle
// est atteinte pour que l'appelant puisse prévenir l'utilisateur.
export const PLAFOND_LOT = 1000;
