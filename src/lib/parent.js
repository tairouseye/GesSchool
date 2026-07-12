import { supabase } from "@/lib/supabase.js";

// GesSchool — accès « espace parent » via RPC sécurisées (SECURITY DEFINER).

export async function mesEnfants() {
  const { data, error } = await supabase.rpc("mes_enfants");
  if (error) throw error;
  return data ?? [];
}

// Cantine & transport de l'enfant (0 ou 1 abonnement).
export async function enfantCantine(eleveId) {
  const { data, error } = await supabase.rpc("enfant_cantine", { p_eleve: eleveId });
  if (error) throw error;
  return (data ?? [])[0] || null;
}
export async function enfantMenuCantine(eleveId) {
  const { data, error } = await supabase.rpc("enfant_cantine_menu", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}
export async function enfantTransport(eleveId) {
  const { data, error } = await supabase.rpc("enfant_transport", { p_eleve: eleveId });
  if (error) throw error;
  return (data ?? [])[0] || null;
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

export async function justifierAbsenceParent(absenceId, texte) {
  const { error } = await supabase.rpc("justifier_absence_parent", { p_absence: absenceId, p_texte: texte });
  if (error) throw error;
}

// --- Demandes de documents ---
export const TYPES_DOCUMENT = [
  ["scolarite", "Certificat de scolarité"],
  ["inscription", "Attestation d'inscription"],
  ["frequentation", "Attestation de fréquentation"],
  ["bulletin", "Bulletin"],
  ["autre", "Autre"],
];

export async function demanderDocument(eleveId, type, message) {
  const { error } = await supabase.rpc("demander_document", { p_eleve: eleveId, p_type: type, p_message: message || null });
  if (error) throw error;
}

export async function mesDemandes() {
  const { data, error } = await supabase.rpc("mes_demandes");
  if (error) throw error;
  return data ?? [];
}

export async function enfantBulletins(eleveId) {
  const { data, error } = await supabase.rpc("enfant_bulletins", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

export async function enfantBulletinLignes(bulletinId) {
  const { data, error } = await supabase.rpc("enfant_bulletin_lignes", { p_bulletin: bulletinId });
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

// Téléverse une preuve de paiement (image) dans le bucket privé 'preuves'.
// Renvoie le CHEMIN (consulté ensuite par la caisse via URL signée).
export async function televerserPreuve(eleveId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const chemin = `${eleveId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("preuves").upload(chemin, file, { upsert: true });
  if (error) throw error;
  return chemin;
}

export async function declarerPaiement(factureId, montant, mode, reference, preuve) {
  const { error } = await supabase.rpc("declarer_paiement", {
    p_facture: factureId, p_montant: montant, p_mode: mode, p_reference: reference,
    p_preuve: preuve || null,
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
