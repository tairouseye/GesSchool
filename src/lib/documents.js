import { supabase } from "@/lib/supabase.js";

// GesSchool — documents officiels + validation par le signataire.

async function monId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function creerDocument(ecoleId, d) {
  const { error } = await supabase.from("documents").insert({
    ecole_id: ecoleId,
    eleve_id: d.eleve_id || null,
    type: d.type,
    titre: d.titre,
    corps: d.corps || null,
    ville: d.ville || null,
    date_doc: d.date_doc || null,
    reference: d.reference || null,
    signataire_fonction: d.signataire_fonction || null,
    signataire_nom: d.signataire_nom || null,
    signataire_profil: d.signataire_profil || null,
    signature_url: d.signature_url || null,
    cree_par: await monId(),
  });
  if (error) throw error;
}

// Liste des documents de l'école (côté Gestion).
export async function getDocuments(ecoleId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Documents en attente de MA signature.
export async function mesDocumentsASigner() {
  const uid = await monId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("signataire_profil", uid)
    .eq("statut", "en_attente")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// Nombre de documents en attente de MA signature (badge).
export async function compterASigner() {
  const uid = await monId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("signataire_profil", uid)
    .eq("statut", "en_attente");
  if (error) return 0;
  return count ?? 0;
}

export async function validerDocument(id) {
  const { error } = await supabase
    .from("documents")
    .update({ statut: "valide", valide_le: new Date().toISOString(), motif_rejet: null })
    .eq("id", id);
  if (error) throw error;
}

export async function rejeterDocument(id, motif) {
  const { error } = await supabase
    .from("documents")
    .update({ statut: "rejete", motif_rejet: motif || null })
    .eq("id", id);
  if (error) throw error;
}

export async function supprimerDocument(id) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}
