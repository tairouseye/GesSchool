import { supabase } from "@/lib/supabase.js";

// GesSchool — module Cantine (abonnements, repas, menu). RLS = Gestion.

// --- Abonnements ---
export async function getAbonnements(ecoleId) {
  const { data, error } = await supabase
    .from("cantine_abonnements")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function enregistrerAbonnement(ecoleId, a) {
  const ligne = {
    ecole_id: ecoleId,
    eleve_id: a.eleve_id,
    formule: a.formule || "mensuel",
    tarif: Number(a.tarif) || 0,
    regime: a.regime?.trim() || null,
    actif: a.actif ?? true,
  };
  if (a.id) {
    const { error } = await supabase.from("cantine_abonnements").update(ligne).eq("id", a.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cantine_abonnements").insert({ ...ligne, solde: Number(a.solde) || 0 });
    if (error) throw error;
  }
}

export async function supprimerAbonnement(id) {
  const { error } = await supabase.from("cantine_abonnements").delete().eq("id", id);
  if (error) throw error;
}

// Recharge le solde prépayé (delta positif).
export async function rechargerSolde(id, soldeActuel, montant) {
  const { error } = await supabase.from("cantine_abonnements")
    .update({ solde: Number(soldeActuel || 0) + Number(montant || 0) }).eq("id", id);
  if (error) throw error;
}

// --- Pointage des repas ---
export async function getRepas(ecoleId, date) {
  const { data, error } = await supabase
    .from("cantine_repas").select("eleve_id")
    .eq("ecole_id", ecoleId).eq("date_repas", date);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.eleve_id));
}

// Marque un repas pris. Pour un prépayé, décompte le tarif du solde.
export async function marquerRepas(ecoleId, abo, date) {
  const cout = abo.formule === "prepaye" ? Number(abo.tarif) || 0 : 0;
  if (cout > 0 && Number(abo.solde || 0) < cout) {
    throw new Error("Solde prépayé insuffisant — rechargez d'abord.");
  }
  const { error } = await supabase.from("cantine_repas")
    .upsert({ ecole_id: ecoleId, eleve_id: abo.eleve_id, date_repas: date, cout }, { onConflict: "ecole_id,eleve_id,date_repas" });
  if (error) throw error;
  if (cout > 0) await rechargerSolde(abo.id, abo.solde, -cout);
}

export async function annulerRepas(ecoleId, abo, date) {
  const { error } = await supabase.from("cantine_repas").delete()
    .eq("ecole_id", ecoleId).eq("eleve_id", abo.eleve_id).eq("date_repas", date);
  if (error) throw error;
  if (abo.formule === "prepaye") await rechargerSolde(abo.id, abo.solde, Number(abo.tarif) || 0);
}

// --- Menu de la semaine ---
export async function getMenu(ecoleId, lundiISO) {
  const { data, error } = await supabase
    .from("cantine_menus").select("jour, plats")
    .eq("ecole_id", ecoleId).eq("semaine", lundiISO);
  if (error) throw error;
  const map = {};
  for (const m of data ?? []) map[m.jour] = m.plats || "";
  return map;
}

export async function setMenuJour(ecoleId, lundiISO, jour, plats) {
  const { error } = await supabase.from("cantine_menus")
    .upsert({ ecole_id: ecoleId, semaine: lundiISO, jour, plats: plats || null }, { onConflict: "ecole_id,semaine,jour" });
  if (error) throw error;
}
