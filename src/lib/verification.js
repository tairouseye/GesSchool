import { supabase } from "@/lib/supabase.js";

// GesSchool — authentification des documents officiels par QR code.
// Chaque document valide (facture, reçu, bulletin, paie, certificat…) porte un
// QR renvoyant vers la page publique /verifier, qui interroge la RPC
// `verifier_document` (lecture seule, accessible sans compte) et atteste le
// document à partir de sa source. AUCUNE écriture n'est faite à l'impression :
// le code encode simplement le type + l'identifiant stable de l'enregistrement.

// --- Construction des codes opaques (type~id[~id2]) ---
export const codeFacture = (id) => `facture~${id}`;         // facture + reçu de paiement
export const codePaie = (id) => `paie~${id}`;                // bulletin de paie
export const codeDepense = (id) => `depense~${id}`;          // reçu de dépense
export const codeDoc = (id) => `doc~${id}`;                  // certificat / attestation
export const codeReleve = (id) => `releve~${id}`;            // relevé de notes (LMD)
export const codeBulletinId = (id) => `bulletin~${id}`;      // bulletin (id connu — espace parent)
export const codeBulletin = (eleveId, periodeId) => `bulletin~${eleveId}~${periodeId}`; // bulletin (élève+période — espace gestion)

// URL publique de vérification — indépendante du domaine d'hébergement
// (production, prévisualisation, sous-chemin GitHub Pages ou localhost).
export function urlVerification(code) {
  if (typeof window === "undefined" || !code) return "";
  const racine = `${window.location.origin}${window.location.pathname}`;
  return `${racine}#/verifier?d=${encodeURIComponent(code)}`;
}

// Interroge la RPC publique. Renvoie { ok:false } si le document est introuvable
// ou non valide. Ne lève jamais pour un simple "non trouvé".
export async function verifierDocument(code) {
  if (!code) return { ok: false };
  const { data, error } = await supabase.rpc("verifier_document", { p_code: code });
  if (error) return { ok: false, erreur: error.message };
  return data || { ok: false };
}
