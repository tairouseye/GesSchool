import { supabase } from "@/lib/supabase.js";

// GesSchool — espace Pilotage (promoteur multi-écoles).

// Synthèse consolidée de toutes les écoles possédées.
export async function getSynthese() {
  const { data, error } = await supabase.rpc("pilotage_synthese");
  if (error) throw error;
  return data ?? [];
}

// Bascule l'école active du promoteur (pour gérer une école précise).
export async function entrerEcole(ecoleId) {
  const { error } = await supabase.rpc("entrer_ecole", { p_ecole: ecoleId });
  if (error) throw error;
}
