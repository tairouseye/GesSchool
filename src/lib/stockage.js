import { supabase } from "@/lib/supabase.js";

// GesSchool — accès au stockage privé via URLs signées (temporaires).

// Extrait le chemin objet depuis une valeur stockée (chemin direct ou,
// pour compat, ancienne URL publique du même bucket).
function cheminDepuis(bucket, valeur) {
  if (!valeur) return null;
  const marqueur = `/object/public/${bucket}/`;
  const i = valeur.indexOf(marqueur);
  return i >= 0 ? valeur.slice(i + marqueur.length) : valeur;
}

// URL signée valable `expire` secondes (1h par défaut).
export async function urlSignee(bucket, valeur, expire = 3600) {
  const chemin = cheminDepuis(bucket, valeur);
  if (!chemin) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(chemin, expire);
  if (error) return null;
  return data?.signedUrl || null;
}
