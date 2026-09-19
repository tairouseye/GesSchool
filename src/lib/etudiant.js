import { supabase } from "@/lib/supabase.js";

// GesSchool — espace ÉTUDIANT (supérieur). L'étudiant majeur a son compte
// (lié à sa fiche via un code), et gère notamment le consentement d'accès
// de ses parents à ses notes.

// Lie le compte connecté à sa fiche étudiant via le code de l'établissement.
export async function lierEtudiant(code) {
  const { data, error } = await supabase.rpc("lier_etudiant", { p_code: (code || "").trim() });
  if (error) throw error;
  return data;
}

// Dossier de l'étudiant connecté : école + cursus.
// Indispensable côté client : `profils.ecole_id` est NULL pour un étudiant,
// donc useAuth().ecoleId vaut null — c'est cette RPC qui donne l'école.
export async function monDossier() {
  const { data, error } = await supabase.rpc("mon_dossier_etudiant");
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

// Demandes d'accès de mes parents (à approuver / refuser).
export async function mesDemandesAcces() {
  const { data, error } = await supabase.rpc("mes_demandes_acces");
  if (error) throw error;
  return data ?? [];
}

// L'étudiant décide : 'autorise' | 'refuse' | 'revoque'.
export async function deciderAcces(accesId, decision) {
  const { error } = await supabase.rpc("decider_acces", { p_acces: accesId, p_decision: decision });
  if (error) throw error;
}
