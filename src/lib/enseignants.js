import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « enseignants & affectations ».
// Les affectations (classe ↔ matière + coefficient) alimentent les
// coefficients de matière dans le calcul des bulletins.

export async function getEnseignants(ecoleId) {
  const { data, error } = await supabase
    .from("enseignants")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function creerEnseignant(ecoleId, e) {
  const { data, error } = await supabase
    .from("enseignants")
    .insert({ ecole_id: ecoleId, ...e })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majEnseignant(id, e) {
  const { data, error } = await supabase.from("enseignants").update(e).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerEnseignant(id) {
  const { error } = await supabase.from("enseignants").delete().eq("id", id);
  if (error) throw error;
}

// --- Compte enseignant (liaison par code, comme l'espace parent) ---
// Côté admin : génère/renouvelle le code d'accès d'un enseignant.
export async function genererCodeEnseignant(enseignantId) {
  const { data, error } = await supabase.rpc("generer_code_enseignant", { p_enseignant: enseignantId });
  if (error) throw error;
  return data;
}

// Côté enseignant : relie son compte via le code reçu.
export async function lierEnseignant(code) {
  const { data, error } = await supabase.rpc("lier_enseignant", { p_code: code });
  if (error) throw error;
  return data;
}

// --- Affectations ---
export async function getAffectations(ecoleId, anneeId) {
  let q = supabase
    .from("affectations")
    .select("*, enseignants(prenom, nom), classes(libelle), matieres(libelle)")
    .eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ⚠️ INSERT, et non plus UPSERT — le sens de l'acte a changé (migration 161).
//
// L'upsert portait sur (classe, matière, année) : affecter un enseignant à une
// matière déjà pourvue REMPLAÇAIT silencieusement son collègue. C'était la
// conséquence d'une contrainte qui faisait de l'affectation une propriété de
// la matière. Maintenant que plusieurs enseignants peuvent partager une
// matière, affecter doit AJOUTER — remplacer quelqu'un sans le dire serait
// une perte de donnée déguisée en commodité.
//
// `matiere_id` à NULL = l'enseignant couvre toutes les matières de la classe.
export async function creerAffectation(ecoleId, { enseignant_id, classe_id, matiere_id, coefficient, annee_id }) {
  const { data, error } = await supabase
    .from("affectations")
    .insert({
      ecole_id: ecoleId,
      enseignant_id,
      classe_id,
      matiere_id: matiere_id || null,
      coefficient: Number(coefficient) || 1,
      annee_id,
    })
    .select()
    .single();
  // 23505 = doublon : le même enseignant est déjà sur cette classe/matière.
  if (error) {
    if (error.code === "23505") {
      throw new Error("Cet enseignant est déjà affecté à cette classe pour cette matière.");
    }
    throw error;
  }
  return data;
}

export async function supprimerAffectation(id) {
  const { error } = await supabase.from("affectations").delete().eq("id", id);
  if (error) throw error;
}
