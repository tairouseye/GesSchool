import { supabase } from "@/lib/supabase.js";

// GesSchool — messagerie côté école (staff). Le parent passe par parent.js.

// Résumé des conversations (parents avec compte) de l'école courante.
export async function getConversations() {
  const { data, error } = await supabase.rpc("ecole_conversations");
  if (error) throw error;
  return data ?? [];
}

// Fil d'un parent (tuteur). Marque les messages du parent comme lus.
export async function getThread(tuteurId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, expediteur, contenu, created_at")
    .eq("tuteur_id", tuteurId)
    .order("created_at");
  if (error) throw error;
  await supabase.from("messages").update({ lu: true }).eq("tuteur_id", tuteurId).eq("expediteur", "parent").eq("lu", false);
  return data ?? [];
}

export async function envoyerEcole(ecoleId, tuteurId, contenu, auteurId) {
  if (!contenu?.trim()) return;
  const { error } = await supabase.from("messages").insert({
    ecole_id: ecoleId,
    tuteur_id: tuteurId,
    expediteur: "ecole",
    contenu: contenu.trim(),
    auteur_id: auteurId || null,
  });
  if (error) throw error;
}

// --- Fils ÉTUDIANTS (supérieur, migration 139) ------------------------------
// Même table, autre clé de fil : `eleve_id` au lieu de `tuteur_id`. Au
// supérieur l'étudiant est majeur et écrit lui-même à la scolarité.

// Ne liste que les étudiants ayant déjà échangé : on ouvre un nouveau fil par
// la recherche, pas en déroulant les 10 000 inscrits.
export async function getConversationsEtudiants() {
  const { data, error } = await supabase.rpc("ecole_conversations_etudiants");
  if (error) throw error;
  return data ?? [];
}

export async function getThreadEtudiant(eleveId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, expediteur, contenu, created_at")
    .eq("eleve_id", eleveId)
    .order("created_at");
  if (error) throw error;
  await supabase.from("messages").update({ lu: true })
    .eq("eleve_id", eleveId).eq("expediteur", "etudiant").eq("lu", false);
  return data ?? [];
}

export async function envoyerEcoleEtudiant(ecoleId, eleveId, contenu, auteurId) {
  if (!contenu?.trim()) return;
  const { error } = await supabase.from("messages").insert({
    ecole_id: ecoleId,
    eleve_id: eleveId,
    expediteur: "ecole",
    contenu: contenu.trim(),
    auteur_id: auteurId || null,
  });
  if (error) throw error;
}
