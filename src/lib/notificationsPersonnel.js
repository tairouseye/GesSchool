import { supabase } from "@/lib/supabase.js";

// GesSchool — la cloche du PERSONNEL (lot 2 de l'audit, mig. 219).
//
// Les notifications du personnel vivent dans la même table que celles des
// parents ; la RLS ne laisse lire que les siennes (mig. 191). On filtre
// QUAND MÊME sur le destinataire : le super-administrateur, lui, lit toute
// la table pour le dépannage, et sa cloche ne doit pas déverser celles de
// toutes les familles de la plateforme.

// Où mène chaque catégorie (mig. 219). Une catégorie inconnue n'a pas de lien.
export const LIENS = {
  paiement_declare: "/paiements",
  justificatif: "/assiduite",
  message_parent: "/messagerie",
  demande_document: "/demandes",
};
export const ICONES = { paiement_declare: "💳", justificatif: "📝", message_parent: "💬", demande_document: "📄" };

export async function compterNonLuesPersonnel(profilId, ecoleId) {
  if (!profilId || !ecoleId) return 0;
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("destinataire_id", profilId).eq("ecole_id", ecoleId).eq("lu", false);
  if (error) throw error;
  return count ?? 0;
}

export async function notificationsPersonnel(profilId, ecoleId, limite = 30) {
  if (!profilId || !ecoleId) return [];
  const { data, error } = await supabase.from("notifications").select("id, titre, message, categorie, lu, created_at")
    .eq("destinataire_id", profilId).eq("ecole_id", ecoleId)
    .order("created_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function marquerLuesPersonnel(profilId, ecoleId, ids = null) {
  let q = supabase.from("notifications").update({ lu: true })
    .eq("destinataire_id", profilId).eq("ecole_id", ecoleId).eq("lu", false);
  if (ids) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
}
