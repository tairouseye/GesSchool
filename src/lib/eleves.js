import { supabase } from "@/lib/supabase.js";

// GesSchool — couche d'accès « élèves & inscriptions ».
// Écritures avec ecole_id (RLS = ecole_courante()).

// Génère un matricule SIGLE-ANNÉE-NNNN (séquence par école).
export async function genererMatricule(ecoleId, sigle) {
  const { count, error } = await supabase
    .from("eleves")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecoleId);
  if (error) throw error;
  const code = (sigle || "ELV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "ELV";
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `${code}-${new Date().getFullYear()}-${seq}`;
}

export async function getEleves(ecoleId) {
  const { data, error } = await supabase
    .from("eleves")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function getEleve(id) {
  const { data, error } = await supabase.from("eleves").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function creerEleve(ecoleId, e) {
  const { data, error } = await supabase
    .from("eleves")
    .insert({ ecole_id: ecoleId, ...e })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majEleve(id, e) {
  const { data, error } = await supabase.from("eleves").update(e).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerEleve(id) {
  const { error } = await supabase.from("eleves").delete().eq("id", id);
  if (error) throw error;
}

// --- Inscriptions ---
// Inscriptions de l'année courante, indexées par eleve_id (avec libellé de classe).
export async function getInscriptionsParEleve(ecoleId, anneeId) {
  if (!anneeId) return {};
  const { data, error } = await supabase
    .from("inscriptions")
    .select("id, eleve_id, statut, classe_id, classes(libelle)")
    .eq("ecole_id", ecoleId)
    .eq("annee_id", anneeId);
  if (error) throw error;
  const map = {};
  for (const i of data ?? []) map[i.eleve_id] = i;
  return map;
}

export async function getInscriptionsEleve(eleveId) {
  const { data, error } = await supabase
    .from("inscriptions")
    .select("id, statut, date_inscription, redoublant, classe_id, classes(libelle), annee_id, annees_scolaires(libelle)")
    .eq("eleve_id", eleveId)
    .order("date_inscription", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function inscrire(ecoleId, eleveId, classeId, anneeId, statut = "inscrit", redoublant = false) {
  const { data, error } = await supabase
    .from("inscriptions")
    .upsert(
      { ecole_id: ecoleId, eleve_id: eleveId, classe_id: classeId, annee_id: anneeId, statut, redoublant },
      { onConflict: "eleve_id,annee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Tuteurs ---
export async function getTuteursEleve(eleveId) {
  const { data, error } = await supabase
    .from("eleve_tuteurs")
    .select("id, lien_parente, responsable_legal, responsable_paiement, tuteurs(id, prenom, nom, telephone, email, profession)")
    .eq("eleve_id", eleveId);
  if (error) throw error;
  return data ?? [];
}

export async function ajouterTuteur(ecoleId, eleveId, t, lien) {
  const { data: tuteur, error: e1 } = await supabase
    .from("tuteurs")
    .insert({
      ecole_id: ecoleId,
      prenom: t.prenom,
      nom: t.nom,
      telephone: t.telephone || null,
      email: t.email || null,
      profession: t.profession || null,
    })
    .select()
    .single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("eleve_tuteurs").insert({
    ecole_id: ecoleId,
    eleve_id: eleveId,
    tuteur_id: tuteur.id,
    lien_parente: lien?.lien_parente || null,
    responsable_legal: lien?.responsable_legal ?? true,
    responsable_paiement: lien?.responsable_paiement ?? true,
  });
  if (e2) throw e2;
  return tuteur;
}

export async function retirerLienTuteur(lienId) {
  const { error } = await supabase.from("eleve_tuteurs").delete().eq("id", lienId);
  if (error) throw error;
}
