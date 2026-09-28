import { supabase } from "@/lib/supabase.js";

// GesSchool — console super-admin (pilotage SaaS des écoles clientes).

export const STATUTS_ABO = [
  ["essai", "Essai"],
  ["actif", "Actif"],
  ["suspendu", "Suspendu"],
  ["expire", "Expiré"],
  ["annule", "Annulé"],
];

export async function getEcoles() {
  const { data, error } = await supabase.rpc("admin_ecoles");
  if (error) throw error;
  return data ?? [];
}

export async function getPlans() {
  const { data, error } = await supabase
    .from("plans_abonnement")
    .select("*")
    .eq("actif", true)
    .order("prix_mensuel");
  if (error) throw error;
  return data ?? [];
}

export async function definirAbonnement(ecoleId, planId, statut, fin) {
  const { error } = await supabase.rpc("admin_set_abonnement", {
    p_ecole: ecoleId, p_plan: planId, p_statut: statut, p_fin: fin || null,
  });
  if (error) throw error;
}

// Classer une école en démonstration : elle reste gérable normalement, mais
// sort des totaux consolidés du Pilotage de son promoteur (migration 156).
export async function marquerDemonstration(ecoleId, demo) {
  const { error } = await supabase.rpc("admin_marquer_demonstration", {
    p_ecole: ecoleId, p_demo: !!demo,
  });
  if (error) throw error;
}

export async function definirStatut(ecoleId, statut) {
  const { error } = await supabase.rpc("admin_set_statut", { p_ecole: ecoleId, p_statut: statut });
  if (error) throw error;
}

export async function definirModules(ecoleId, modules) {
  const { error } = await supabase.rpc("admin_set_modules", { p_ecole: ecoleId, p_modules: modules });
  if (error) throw error;
}
