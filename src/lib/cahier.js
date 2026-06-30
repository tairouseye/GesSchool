import { supabase } from "@/lib/supabase.js";

// GesSchool — cahier de textes (séances + devoirs par classe/matière).

export async function getCahier(ecoleId, classeId, matiereId) {
  let q = supabase
    .from("cahier_textes")
    .select("*, matieres(libelle), enseignants(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId);
  if (matiereId) q = q.eq("matiere_id", matiereId);
  const { data, error } = await q
    .order("date_seance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function creerEntree(ecoleId, e) {
  const { data, error } = await supabase
    .from("cahier_textes")
    .insert({
      ecole_id: ecoleId,
      classe_id: e.classe_id,
      matiere_id: e.matiere_id || null,
      enseignant_id: e.enseignant_id || null,
      date_seance: e.date_seance || new Date().toISOString().slice(0, 10),
      contenu: e.contenu || null,
      devoirs: e.devoirs || null,
      date_pour: e.date_pour || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerEntree(id) {
  const { error } = await supabase.from("cahier_textes").delete().eq("id", id);
  if (error) throw error;
}

export async function enfantCahier(eleveId) {
  const { data, error } = await supabase.rpc("enfant_cahier", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}
