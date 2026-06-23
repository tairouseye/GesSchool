import { supabase } from "@/lib/supabase.js";

// GesSchool — couche d'accès aux données « structure académique ».
// Toutes les écritures incluent ecole_id (exigé par les RLS = ecole_courante()).

// Année scolaire courante de l'école.
export async function getAnneeCourante(ecoleId) {
  const { data, error } = await supabase
    .from("annees_scolaires")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("courante", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// --- Cycles (créés à l'onboarding ; lecture seule ici) ---
export async function getCycles(ecoleId) {
  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

// --- Niveaux ---
export async function getNiveaux(ecoleId) {
  const { data, error } = await supabase
    .from("niveaux")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

export async function creerNiveau(ecoleId, cycleId, libelle, ordre) {
  const { data, error } = await supabase
    .from("niveaux")
    .insert({ ecole_id: ecoleId, cycle_id: cycleId, libelle, ordre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerNiveau(id) {
  const { error } = await supabase.from("niveaux").delete().eq("id", id);
  if (error) throw error;
}

// --- Classes (rattachées à un niveau et à l'année courante) ---
export async function getClasses(ecoleId, anneeId) {
  let q = supabase.from("classes").select("*").eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q.order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerClasse(ecoleId, niveauId, anneeId, libelle, effectifMax) {
  const { data, error } = await supabase
    .from("classes")
    .insert({
      ecole_id: ecoleId,
      niveau_id: niveauId,
      annee_id: anneeId,
      libelle,
      effectif_max: effectifMax || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerClasse(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

// --- Matières ---
export async function getMatieres(ecoleId) {
  const { data, error } = await supabase
    .from("matieres")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerMatiere(ecoleId, libelle, code, cycleId) {
  const { data, error } = await supabase
    .from("matieres")
    .insert({ ecole_id: ecoleId, libelle, code: code || null, cycle_id: cycleId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerMatiere(id) {
  const { error } = await supabase.from("matieres").delete().eq("id", id);
  if (error) throw error;
}
