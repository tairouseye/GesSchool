import { supabase } from "@/lib/supabase.js";

// GesSchool — cahier de progression (planification des leçons).

export const STATUTS = [
  ["a_faire", "À faire", "bg-navy-900/5 text-navy-900/60"],
  ["en_cours", "En cours", "bg-or-500/15 text-or-600"],
  ["fait", "Fait", "bg-emerald-500/10 text-emerald-700"],
];

export async function getProgressions(ecoleId, classeId, matiereId) {
  let q = supabase
    .from("progressions")
    .select("*, matieres(libelle), periodes(libelle, ordre)")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId);
  if (matiereId) q = q.eq("matiere_id", matiereId);
  const { data, error } = await q
    .order("date_prevue", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function creerEtape(ecoleId, e) {
  const { data, error } = await supabase
    .from("progressions")
    .insert({
      ecole_id: ecoleId,
      classe_id: e.classe_id,
      matiere_id: e.matiere_id || null,
      enseignant_id: e.enseignant_id || null,
      periode_id: e.periode_id || null,
      titre: e.titre,
      description: e.description || null,
      date_prevue: e.date_prevue || null,
      statut: "a_faire",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majStatut(id, statut) {
  const { error } = await supabase.from("progressions").update({ statut }).eq("id", id);
  if (error) throw error;
}

export async function supprimerEtape(id) {
  const { error } = await supabase.from("progressions").delete().eq("id", id);
  if (error) throw error;
}
