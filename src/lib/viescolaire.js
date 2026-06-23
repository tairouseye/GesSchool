import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « vie scolaire » : absences/retards + incidents.

export const STATUTS_JUSTIF = {
  non_justifie: { label: "Non justifié", ton: "rouge" },
  en_attente: { label: "En attente", ton: "or" },
  justifie: { label: "Justifié", ton: "vert" },
};

// Absences/retards d'une classe pour une date donnée.
export async function getAbsencesJour(ecoleId, classeId, date) {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("date_abs", date);
  if (error) throw error;
  return data ?? [];
}

// Enregistre l'appel : remplace les absences/retards de la classe pour la date.
// entries: [{ eleve_id, etat: 'present'|'absence'|'retard', motif }]
export async function enregistrerAppel(ecoleId, classeId, date, entries, saisiPar) {
  // 1) on efface l'existant de ce jour pour cette classe
  const { error: eDel } = await supabase
    .from("absences")
    .delete()
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("date_abs", date);
  if (eDel) throw eDel;

  // 2) on insère les absents / retards
  const lignes = entries
    .filter((e) => e.etat === "absence" || e.etat === "retard")
    .map((e) => ({
      ecole_id: ecoleId,
      eleve_id: e.eleve_id,
      classe_id: classeId,
      type: e.etat,
      date_abs: date,
      motif: e.motif || null,
      statut: "non_justifie",
      saisi_par: saisiPar || null,
    }));
  if (lignes.length) {
    const { error } = await supabase.from("absences").insert(lignes);
    if (error) throw error;
  }
}

export async function justifierAbsence(id, statut) {
  const { error } = await supabase.from("absences").update({ statut }).eq("id", id);
  if (error) throw error;
}

// Liste récente des absences (avec élève + classe) pour le suivi.
export async function getAbsencesRecentes(ecoleId, limit = 100) {
  const { data, error } = await supabase
    .from("absences")
    .select("*, eleves(prenom, nom), classes(libelle)")
    .eq("ecole_id", ecoleId)
    .order("date_abs", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// --- Incidents (sanctions / observations / félicitations) ---
export async function getIncidents(ecoleId, limit = 100) {
  const { data, error } = await supabase
    .from("incidents")
    .select("*, eleves(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .order("date_incident", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function creerIncident(ecoleId, inc, saisiPar) {
  const { data, error } = await supabase
    .from("incidents")
    .insert({ ecole_id: ecoleId, saisi_par: saisiPar || null, ...inc })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerIncident(id) {
  const { error } = await supabase.from("incidents").delete().eq("id", id);
  if (error) throw error;
}
