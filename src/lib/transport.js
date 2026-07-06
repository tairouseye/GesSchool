import { supabase } from "@/lib/supabase.js";

// GesSchool — module Transport scolaire. RLS = Gestion.

// Convertit une heure "HH:MM" en minutes (vide → tout à la fin).
function minutes(h) {
  const m = String(h || "").match(/(\d{1,2})\D+(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 99999;
}

// --- Circuits & arrêts ---
export async function getCircuits(ecoleId) {
  const { data, error } = await supabase
    .from("transport_circuits")
    .select("*, transport_arrets(id, libelle, ordre, heure)")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  // Arrêts triés par HEURE croissante (puis ordre en cas d'égalité).
  return (data ?? []).map((c) => ({
    ...c,
    arrets: (c.transport_arrets || []).sort((a, b) => minutes(a.heure) - minutes(b.heure) || (a.ordre - b.ordre)),
  }));
}

export async function enregistrerCircuit(ecoleId, c) {
  const ligne = {
    ecole_id: ecoleId, nom: c.nom?.trim(), vehicule: c.vehicule?.trim() || null,
    chauffeur: c.chauffeur?.trim() || null, chauffeur_tel: c.chauffeur_tel?.trim() || null,
    heure_depart: c.heure_depart?.trim() || null, actif: c.actif ?? true,
  };
  if (c.id) {
    const { error } = await supabase.from("transport_circuits").update(ligne).eq("id", c.id);
    if (error) throw error;
    return c.id;
  }
  const { data, error } = await supabase.from("transport_circuits").insert(ligne).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function supprimerCircuit(id) {
  const { error } = await supabase.from("transport_circuits").delete().eq("id", id);
  if (error) throw error;
}

export async function ajouterArret(ecoleId, circuitId, a) {
  const { error } = await supabase.from("transport_arrets").insert({
    ecole_id: ecoleId, circuit_id: circuitId, libelle: a.libelle?.trim(),
    ordre: Number(a.ordre) || 0, heure: a.heure?.trim() || null,
  });
  if (error) throw error;
}

export async function modifierArret(id, a) {
  const { error } = await supabase.from("transport_arrets")
    .update({ libelle: a.libelle?.trim(), heure: a.heure?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

export async function supprimerArret(id) {
  const { error } = await supabase.from("transport_arrets").delete().eq("id", id);
  if (error) throw error;
}

// --- Abonnements ---
export async function getAbonnements(ecoleId) {
  const { data, error } = await supabase
    .from("transport_abonnements")
    .select("*, eleves(prenom, nom, matricule), transport_circuits(nom), transport_arrets(libelle)")
    .eq("ecole_id", ecoleId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function enregistrerAbonnement(ecoleId, a) {
  const ligne = {
    ecole_id: ecoleId, eleve_id: a.eleve_id,
    circuit_id: a.circuit_id || null, arret_id: a.arret_id || null,
    trajet: a.trajet || "aller_retour", tarif: Number(a.tarif) || 0, actif: a.actif ?? true,
  };
  if (a.id) {
    const { error } = await supabase.from("transport_abonnements").update(ligne).eq("id", a.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("transport_abonnements").insert(ligne);
    if (error) throw error;
  }
}

export async function supprimerAbonnement(id) {
  const { error } = await supabase.from("transport_abonnements").delete().eq("id", id);
  if (error) throw error;
}

// --- Embarquement (pointage) ---
export async function getPointages(ecoleId, circuitId, date, sens) {
  const { data, error } = await supabase
    .from("transport_pointages").select("eleve_id, embarque, debarque")
    .eq("ecole_id", ecoleId).eq("circuit_id", circuitId).eq("date_p", date).eq("sens", sens);
  if (error) throw error;
  const map = {};
  for (const p of data ?? []) map[p.eleve_id] = { embarque: p.embarque, debarque: p.debarque };
  return map;
}

export async function setPointage(ecoleId, circuitId, eleveId, date, sens, champs) {
  const { error } = await supabase.from("transport_pointages").upsert(
    { ecole_id: ecoleId, circuit_id: circuitId, eleve_id: eleveId, date_p: date, sens, ...champs },
    { onConflict: "ecole_id,eleve_id,date_p,sens" }
  );
  if (error) throw error;
}
