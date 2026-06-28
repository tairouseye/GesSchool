import { supabase } from "@/lib/supabase.js";

// GesSchool — relances d'impayés : paliers configurables + journal + envois.
// S'appuie sur les RPC de la migration 019 et le pipeline notifications → push.

// Variables utilisables dans les modèles de message (pour l'aide à la saisie).
export const VARIABLES_MODELE = ["{ecole}", "{eleve}", "{montant}", "{devise}", "{echeance}", "{jours_retard}"];

// --- Règles (paliers) ---
export async function getRegles(ecoleId) {
  const { data, error } = await supabase
    .from("regles_relance")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre")
    .order("jours");
  if (error) throw error;
  return data ?? [];
}

export async function creerRegle(ecoleId, r) {
  const { error } = await supabase.from("regles_relance").insert({ ecole_id: ecoleId, ...r });
  if (error) throw error;
}

export async function majRegle(id, r) {
  const { error } = await supabase.from("regles_relance").update(r).eq("id", id);
  if (error) throw error;
}

export async function supprimerRegle(id) {
  const { error } = await supabase.from("regles_relance").delete().eq("id", id);
  if (error) throw error;
}

// --- Journal des relances ---
export async function getRelances(ecoleId, limit = 200) {
  const { data, error } = await supabase
    .from("relances")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId)
    .order("envoye_le", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// --- Envois ---
// Relance manuelle d'un élève (total dû, 1 notification + push).
export async function relancerEleve(eleveId) {
  const { error } = await supabase.rpc("relancer_eleve", { p_eleve: eleveId });
  if (error) throw error;
}

// Lance toutes les relances dues de MON école (réservé gestion).
export async function lancerTout() {
  const { data, error } = await supabase.rpc("relancer_tout");
  if (error) throw error;
  return data; // nombre de relances envoyées
}
