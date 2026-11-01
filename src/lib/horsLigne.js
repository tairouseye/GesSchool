// GesSchool — lecture hors ligne de l'espace parent (lot 4 de l'audit du 31/10/2026).
//
// LE MANQUE. Sur un réseau instable, le parent ne voyait plus rien — « Aucune
// note », une page blanche — et ne savait pas pourquoi. Le service worker ne
// peut pas aider ici : les lectures parent sont des RPC Supabase, envoyées en
// POST, et le cache du navigateur ne garde pas les réponses POST.
//
// LE PRINCIPE. Chaque lecture parent réussie est gardée sur le téléphone ;
// si une lecture échoue POUR CAUSE DE RÉSEAU, on rend la dernière copie et on
// le dit (bandeau « Hors ligne », avec l'heure de la copie). Une erreur qui
// n'est pas réseau (droit refusé, fonction absente) n'est JAMAIS masquée.
//
// 🔴 TÉLÉPHONE PARTAGÉ. Les copies sont rangées sous l'identifiant du compte,
// et TOUT est effacé à la déconnexion (`viderCacheHorsLigne`, AuthContext).

const PREFIXE = "gs_hl:";
export const EVENEMENT_HORS_LIGNE = "gesschool:hors-ligne";

/** Une erreur de transport, et non un refus du serveur. */
export function estErreurReseau(e, enLigne = typeof navigator === "undefined" ? true : navigator.onLine) {
  if (enLigne === false) return true;
  const m = String(e?.message || e || "");
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|err_internet_disconnected/i.test(m);
}

/** Le cache, sur un stockage donné (localStorage en vrai, un faux en test). */
export function creerCache(stockage) {
  let uid = null;
  const cle = (k) => `${PREFIXE}${uid}:${k}`;
  return {
    definirUtilisateur(id) { uid = id || null; },
    lire(k) {
      if (!uid || !stockage) return null;
      try { const v = stockage.getItem(cle(k)); return v ? JSON.parse(v) : null; } catch { return null; }
    },
    ecrire(k, data, le = new Date().toISOString()) {
      if (!uid || !stockage) return;
      //  Stockage plein ou interdit (navigation privée) : on s'en passe.
      try { stockage.setItem(cle(k), JSON.stringify({ le, data })); } catch { /* sans cache */ }
    },
    vider() {
      if (!stockage) return;
      try {
        const cles = [];
        for (let i = 0; i < stockage.length; i++) { const k = stockage.key(i); if (k?.startsWith(PREFIXE)) cles.push(k); }
        cles.forEach((k) => stockage.removeItem(k));
      } catch { /* rien à vider */ }
    },
  };
}

let local = null;
try { local = typeof window !== "undefined" ? window.localStorage : null; } catch { local = null; }
export const cache = creerCache(local);

export const definirUtilisateurHorsLigne = (uid) => cache.definirUtilisateur(uid);
export const viderCacheHorsLigne = () => cache.vider();

function signaler(depuisCache, le = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_HORS_LIGNE, { detail: { depuisCache, le } }));
}

/**
 * Lit par `charger()` et garde le résultat ; sur erreur RÉSEAU, rend la
 * dernière copie (et prévient le bandeau). Sans copie, l'erreur remonte.
 */
export async function avecRepli(cleCache, charger, c = cache) {
  try {
    const data = await charger();
    c.ecrire(cleCache, data);
    signaler(false);
    return data;
  } catch (e) {
    if (estErreurReseau(e)) {
      const copie = c.lire(cleCache);
      if (copie) { signaler(true, copie.le); return copie.data; }
    }
    throw e;
  }
}
