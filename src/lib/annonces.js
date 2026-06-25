import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « annonces & communication ».
// Staff : accès tenant classique (ecole_id). Parent : via RPC SECURITY DEFINER.

export const CIBLES = [
  ["tous", "Toute l'école"],
  ["parents", "Parents"],
  ["enseignants", "Enseignants"],
  ["classe", "Une classe"],
];

export function libelleCible(cible) {
  return (CIBLES.find((c) => c[0] === cible) || [])[1] || "Toute l'école";
}

// --- Côté staff ---
export async function getAnnonces(ecoleId) {
  const { data, error } = await supabase
    .from("annonces")
    .select("*, classes(libelle), profils(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .order("publie_le", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function creerAnnonce(ecoleId, a, auteurId) {
  const { data, error } = await supabase
    .from("annonces")
    .insert({
      ecole_id: ecoleId,
      titre: a.titre,
      contenu: a.contenu || null,
      cible: a.cible || "tous",
      classe_id: a.cible === "classe" ? a.classe_id || null : null,
      auteur_id: auteurId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerAnnonce(id) {
  const { error } = await supabase.from("annonces").delete().eq("id", id);
  if (error) throw error;
}

// --- Côté parent (RPC sécurisée) ---
export async function annoncesParent() {
  const { data, error } = await supabase.rpc("annonces_parent");
  if (error) throw error;
  return data ?? [];
}
