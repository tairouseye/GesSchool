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

// Emploi du temps d'un enseignant (toutes ses classes).
export async function getCreneauxEnseignant(ecoleId, enseignantId) {
  const { data, error } = await supabase
    .from("emplois_du_temps")
    .select("*, matieres(libelle), classes(libelle)")
    .eq("ecole_id", ecoleId)
    .eq("enseignant_id", enseignantId)
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

// ===================================================================
//  Génération automatique — configuration + application
// ===================================================================

// --- Grille horaire (créneaux type de la semaine, jour par jour) ---
export async function getGrille(ecoleId) {
  const { data, error } = await supabase
    .from("creneaux_horaires")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("jour").order("ordre");
  if (error) throw error;
  return data ?? [];
}

// Remplace tous les créneaux d'un jour par la liste fournie.
export async function sauverGrilleJour(ecoleId, jour, lignes) {
  const { error: eDel } = await supabase
    .from("creneaux_horaires").delete().eq("ecole_id", ecoleId).eq("jour", jour);
  if (eDel) throw eDel;
  const rows = (lignes ?? []).map((l, i) => ({
    ecole_id: ecoleId, jour,
    ordre: i, heure_debut: l.heure_debut, heure_fin: l.heure_fin, pause: !!l.pause,
  }));
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from("creneaux_horaires").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

// --- Salles ---
export async function getSalles(ecoleId) {
  const { data, error } = await supabase
    .from("salles").select("*").eq("ecole_id", ecoleId).order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function creerSalle(ecoleId, nom, capacite) {
  const { data, error } = await supabase
    .from("salles").insert({ ecole_id: ecoleId, nom, capacite: capacite || null }).select().single();
  if (error) throw error;
  return data;
}
export async function supprimerSalle(id) {
  const { error } = await supabase.from("salles").delete().eq("id", id);
  if (error) throw error;
}

// --- Volumes horaires (séances/semaine par matière et par niveau) ---
export async function getVolumes(ecoleId) {
  const { data, error } = await supabase
    .from("volumes_horaires")
    .select("*")
    .eq("ecole_id", ecoleId);
  if (error) throw error;
  return data ?? [];
}
// Upsert (ou suppression si heures = 0) du volume d'une matière pour un niveau.
export async function sauverVolume(ecoleId, niveauId, matiereId, heures) {
  const h = Math.max(0, Number(heures) || 0);
  if (h === 0) {
    const { error } = await supabase.from("volumes_horaires")
      .delete().eq("ecole_id", ecoleId).eq("niveau_id", niveauId).eq("matiere_id", matiereId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("volumes_horaires").upsert(
    { ecole_id: ecoleId, niveau_id: niveauId, matiere_id: matiereId, heures: h },
    { onConflict: "ecole_id,niveau_id,matiere_id" }
  );
  if (error) throw error;
}

// --- Affectations : map "classeId:matiereId" -> enseignant_id ---
export async function getAffectationMap(ecoleId, anneeId) {
  let q = supabase.from("affectations").select("classe_id, matiere_id, enseignant_id").eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  const map = {};
  for (const a of data ?? []) map[`${a.classe_id}:${a.matiere_id}`] = a.enseignant_id;
  return map;
}

// Tous les créneaux d'emploi du temps (pour respecter les conflits des
// classes NON régénérées lors d'une génération partielle).
export async function getTousEmplois(ecoleId) {
  const { data, error } = await supabase
    .from("emplois_du_temps")
    .select("classe_id, jour, heure_debut, enseignant_id, salle")
    .eq("ecole_id", ecoleId);
  if (error) throw error;
  return data ?? [];
}

// Applique une génération : remplace l'emploi du temps des classes concernées.
export async function appliquerGeneration(ecoleId, classeIds, creneaux) {
  if (classeIds.length) {
    const { error: eDel } = await supabase
      .from("emplois_du_temps").delete().eq("ecole_id", ecoleId).in("classe_id", classeIds);
    if (eDel) throw eDel;
  }
  const rows = (creneaux ?? []).map((c) => ({
    ecole_id: ecoleId,
    classe_id: c.classe_id, jour: c.jour,
    heure_debut: c.heure_debut, heure_fin: c.heure_fin,
    matiere_id: c.matiere_id, enseignant_id: c.enseignant_id || null, salle: c.salle || null,
  }));
  if (rows.length === 0) return { inseres: 0 };
  const { error } = await supabase.from("emplois_du_temps").insert(rows);
  if (error) throw error;
  return { inseres: rows.length };
}
