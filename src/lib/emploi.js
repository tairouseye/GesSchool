import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « emploi du temps » (créneaux par classe).

export const JOURS = [
  [1, "Lundi"], [2, "Mardi"], [3, "Mercredi"],
  [4, "Jeudi"], [5, "Vendredi"], [6, "Samedi"],
];

export async function getCreneaux(ecoleId, classeId) {
  const { data, error } = await supabase
    .from("emplois_du_temps")
    .select("*, matieres(libelle), enseignants(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .order("jour")
    .order("heure_debut");
  if (error) throw error;
  return data ?? [];
}

export async function creerCreneau(ecoleId, c) {
  const { data, error } = await supabase
    .from("emplois_du_temps")
    .insert({ ecole_id: ecoleId, ...c })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerCreneau(id) {
  const { error } = await supabase.from("emplois_du_temps").delete().eq("id", id);
  if (error) throw error;
}
