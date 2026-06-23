import { supabase } from "@/lib/supabase.js";

// GesSchool — accès « espace parent » via RPC sécurisées (SECURITY DEFINER).

export async function mesEnfants() {
  const { data, error } = await supabase.rpc("mes_enfants");
  if (error) throw error;
  return data ?? [];
}

export async function enfantNotes(eleveId) {
  const { data, error } = await supabase.rpc("enfant_notes", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantFactures(eleveId) {
  const { data, error } = await supabase.rpc("enfant_factures", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantAbsences(eleveId) {
  const { data, error } = await supabase.rpc("enfant_absences", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function lierParent(code) {
  const { data, error } = await supabase.rpc("lier_parent", { p_code: code });
  if (error) throw error;
  return data;
}

// Côté admin : génère/renouvelle le code de liaison d'un tuteur.
export async function genererCodeTuteur(tuteurId) {
  const { data, error } = await supabase.rpc("generer_code_tuteur", { p_tuteur: tuteurId });
  if (error) throw error;
  return data;
}
