import { supabase } from "@/lib/supabase.js";

// GesSchool — accès au stockage privé via URLs signées (temporaires).
//
// Perf : les URLs signées sont mises en CACHE (jusqu'à leur expiration) et les
// requêtes simultanées pour le même objet sont DÉDOUBLONNÉES. Une liste qui se
// re-rend, un composant qui se remonte, ou deux vignettes du même fichier ne
// déclenchent donc qu'UNE seule signature. Pour une liste, préférer `urlsSignees`
// (un seul appel réseau pour N objets).

// Extrait le chemin objet depuis une valeur stockée (chemin direct ou,
// pour compat, ancienne URL publique du même bucket).
function cheminDepuis(bucket, valeur) {
  if (!valeur) return null;
  const marqueur = `/object/public/${bucket}/`;
  const i = valeur.indexOf(marqueur);
  return i >= 0 ? valeur.slice(i + marqueur.length) : valeur;
}

const cache = new Map(); // `${bucket}:${chemin}` -> { url, exp } (exp en ms)
const enVol = new Map(); // `${bucket}:${chemin}` -> Promise<url> (requêtes en cours)
const cle = (bucket, chemin) => `${bucket}:${chemin}`;
// « frais » = encore valable, avec une marge de 30 s pour éviter d'utiliser une
// URL qui expire à l'instant même où l'image se charge.
const frais = (e) => e && e.exp > Date.now() + 30000;

// URL signée valable `expire` secondes (1h par défaut). Cache + dédoublonnage.
export async function urlSignee(bucket, valeur, expire = 3600) {
  const chemin = cheminDepuis(bucket, valeur);
  if (!chemin) return null;
  const k = cle(bucket, chemin);
  const c = cache.get(k);
  if (frais(c)) return c.url;
  if (enVol.has(k)) return enVol.get(k);
  const p = supabase.storage
    .from(bucket)
    .createSignedUrl(chemin, expire)
    .then(({ data, error }) => {
      enVol.delete(k);
      if (error || !data?.signedUrl) return null;
      cache.set(k, { url: data.signedUrl, exp: Date.now() + expire * 1000 });
      return data.signedUrl;
    })
    .catch(() => { enVol.delete(k); return null; });
  enVol.set(k, p);
  return p;
}

// Génère en UN SEUL appel les URLs signées de plusieurs objets (createSignedUrls),
// en réutilisant le cache pour ceux déjà connus. Renvoie une Map valeur -> url.
// À appeler par les listes avant le rendu pour éviter le N+1 (une requête par photo).
export async function urlsSignees(bucket, valeurs, expire = 3600) {
  const out = new Map();
  const manquants = []; // { valeur, chemin }
  for (const v of valeurs || []) {
    const chemin = cheminDepuis(bucket, v);
    if (!chemin) { out.set(v, null); continue; }
    const c = cache.get(cle(bucket, chemin));
    if (frais(c)) out.set(v, c.url);
    else manquants.push({ valeur: v, chemin });
  }
  if (manquants.length) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(manquants.map((m) => m.chemin), expire);
    if (!error && Array.isArray(data)) {
      data.forEach((d, i) => {
        const m = manquants[i];
        const url = d?.signedUrl || null;
        if (url) cache.set(cle(bucket, m.chemin), { url, exp: Date.now() + expire * 1000 });
        out.set(m.valeur, url);
      });
    } else {
      for (const m of manquants) out.set(m.valeur, null);
    }
  }
  return out;
}
