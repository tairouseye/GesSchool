import { supabase } from "@/lib/supabase.js";

// GesSchool — accès « espace parent » via RPC sécurisées (SECURITY DEFINER).

export async function mesEnfants() {
  const { data, error } = await supabase.rpc("mes_enfants");
  if (error) throw error;
  return data ?? [];
}

export async function enfantNotes(eleveId) {
  const { data, error } = await supabase.rpc("enfant_notes", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantFactures(eleveId) {
  const { data, error } = await supabase.rpc("enfant_factures", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantAbsences(eleveId) {
  const { data, error } = await supabase.rpc("enfant_absences", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantEmploi(eleveId) {
  const { data, error } = await supabase.rpc("enfant_emploi", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantFournitures(eleveId) {
  const { data, error } = await supabase.rpc("enfant_fournitures", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

// --- Paiement mobile déclaratif ---
export async function ecolePaiementInfos(eleveId) {
  const { data, error } = await supabase.rpc("ecole_paiement_infos", { p_eleve: eleveId });
  if (error) throw error;
  return data || {};
}

export async function declarerPaiement(factureId, montant, mode, reference) {
  const { error } = await supabase.rpc("declarer_paiement", {
    p_facture: factureId, p_montant: montant, p_mode: mode, p_reference: reference,
  });
  if (error) throw error;
}

export async function enfantDeclarations(eleveId) {
  const { data, error } = await supabase.rpc("enfant_declarations", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

// --- Notifications / alertes du parent (RLS « self ») ---
export async function mesNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function compterNonLues() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("lu", false);
  if (error) throw error;
  return count ?? 0;
}

export async function marquerLue(id) {
  const { error } = await supabase.from("notifications").update({ lu: true }).eq("id", id);
  if (error) throw error;
}

export async function marquerToutesLues() {
  const { error } = await supabase.from("notifications").update({ lu: true }).eq("lu", false);
  if (error) throw error;
}

// --- Messagerie parent ↔ école ---
export async function mesConversations() {
  const { data, error } = await supabase.rpc("mes_conversations");
  if (error) throw error;
  return data ?? [];
}

export async function mesMessagesNonLus() {
  const { data, error } = await supabase.rpc("mes_messages_non_lus");
  if (error) throw error;
  return data ?? 0;
}

export async function conversationMessages(tuteurId) {
  const { data, error } = await supabase.rpc("conversation_messages", { p_tuteur: tuteurId });
  if (error) throw error;
  return data ?? [];
}

export async function parentEnvoyer(tuteurId, contenu) {
  const { error } = await supabase.rpc("parent_envoyer", { p_tuteur: tuteurId, p_contenu: contenu });
  if (error) throw error;
}

export async function lierParent(code) {
  const { data, error } = await supabase.rpc("lier_parent", { p_code: code });
  if (error) throw error;
  return data;
}

// Côté admin : génère/renouvelle le code de liaison d'un tuteur.
export async function genererCodeTuteur(tuteurId) {
  const { data, error } = await supabase.rpc("generer_code_tuteur", { p_tuteur: tuteurId });
  if (error) throw error;
  return data;
}
