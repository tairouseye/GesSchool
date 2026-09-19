import { supabase } from "@/lib/supabase.js";

// GesSchool — Bibliothèque : inventaire (récolement).
//
// Le scan et le rapprochement sont des RPC (migration 124) : comparer le réel
// au catalogue exige un anti-jointure que l'on ne fait pas au navigateur.

export const RESULTATS_SCAN = {
  ok:             { label: "Compté", ton: "success" },
  deja:           { label: "Déjà scanné", ton: "neutre" },
  hors_perimetre: { label: "Hors périmètre", ton: "warning" },
  inconnu:        { label: "Code inconnu", ton: "danger" },
};

export async function getCampagnes(ecoleId) {
  const { data, error } = await supabase.from("biblio_inventaires")
    .select("*, biblio_bibliotheques(nom), biblio_localisations(libelle)")
    .eq("ecole_id", ecoleId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function creerCampagne(ecoleId, c) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("biblio_inventaires")
    .insert({ ecole_id: ecoleId, cree_par: u?.user?.id || null, ...c }).select().single();
  if (error) throw error;
  return data;
}

export async function cloturerCampagne(id) {
  const { error } = await supabase.from("biblio_inventaires")
    .update({ statut: "cloture", fin: new Date().toISOString().slice(0, 10) }).eq("id", id);
  if (error) throw error;
}

export async function supprimerCampagne(id) {
  const { error } = await supabase.from("biblio_inventaires").delete().eq("id", id);
  if (error) throw error;
}

// Scanne un code-barres. Renvoie { resultat, titre, cote, statut, code_barres }.
export async function scanner(campagneId, code) {
  const { data, error } = await supabase.rpc("scanner_inventaire",
    { p_inventaire: campagneId, p_code: code });
  if (error) throw error;
  return data || {};
}

// Rapport de récolement : compteurs + les 100 premiers manquants.
export async function rapport(campagneId) {
  const { data, error } = await supabase.rpc("rapport_inventaire", { p_inventaire: campagneId });
  if (error) throw error;
  return data || {};
}
