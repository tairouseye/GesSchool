import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « enseignants & affectations ».
// Les affectations (classe ↔ matière + coefficient) alimentent les
// coefficients de matière dans le calcul des bulletins.

export async function getEnseignants(ecoleId) {
  const { data, error } = await supabase
    .from("enseignants")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function creerEnseignant(ecoleId, e) {
  const { data, error } = await supabase
    .from("enseignants")
    .insert({ ecole_id: ecoleId, ...e })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majEnseignant(id, e) {
  const { data, error } = await supabase.from("enseignants").update(e).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerEnseignant(id) {
  const { error } = await supabase.from("enseignants").delete().eq("id", id);
  if (error) throw error;
}

// --- Compte enseignant (liaison par code, comme l'espace parent) ---
// Côté admin : génère/renouvelle le code d'accès d'un enseignant.
export async function genererCodeEnseignant(enseignantId) {
  const { data, error } = await supabase.rpc("generer_code_enseignant", { p_enseignant: enseignantId });
  if (error) throw error;
  return data;
}

// Côté enseignant : relie son compte via le code reçu.
export async function lierEnseignant(code) {
  const { data, error } = await supabase.rpc("lier_enseignant", { p_code: code });
  if (error) throw error;
  return data;
}

// --- Affectations ---
export async function getAffectations(ecoleId, anneeId) {
  let q = supabase
    .from("affectations")
    .select("*, enseignants(prenom, nom), classes(libelle), matieres(libelle)")
    .eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// Upsert : une matière dans une classe (pour une année) = une affectation.
export async function creerAffectation(ecoleId, { enseignant_id, classe_id, matiere_id, coefficient, annee_id }) {
  const { data, error } = await supabase
    .from("affectations")
    .upsert(
      {
        ecole_id: ecoleId,
        enseignant_id,
        classe_id,
        matiere_id,
        coefficient: Number(coefficient) || 1,
        annee_id,
      },
      { onConflict: "classe_id,matiere_id,annee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerAffectation(id) {
  const { error } = await supabase.from("affectations").delete().eq("id", id);
  if (error) throw error;
}
