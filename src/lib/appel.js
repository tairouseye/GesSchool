import { supabase } from "@/lib/supabase.js";

// GesSchool — « appel en classe » : rattache le prof connecté à ses classes.

// Fiche enseignant correspondant au compte connecté (par profil_id ou email).
export async function getMonEnseignant(ecoleId, profilId, email) {
  const ors = [];
  if (profilId) ors.push(`profil_id.eq.${profilId}`);
  if (email) ors.push(`email.eq.${email}`);
  if (ors.length === 0) return null;
  const { data, error } = await supabase
    .from("enseignants")
    .select("id, prenom, nom")
    .eq("ecole_id", ecoleId)
    .or(ors.join(","))
    .limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

// Classes du prof (année courante) : prof principal + matières affectées.
export async function getMesClasses(ecoleId, anneeId, ensId) {
  if (!ensId || !anneeId) return [];
  const [pp, aff] = await Promise.all([
    supabase.from("classes").select("id, libelle")
      .eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("prof_principal_id", ensId),
    supabase.from("affectations").select("classes(id, libelle)")
      .eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("enseignant_id", ensId),
  ]);
  const map = {};
  for (const c of pp.data ?? []) map[c.id] = c;
  for (const a of aff.data ?? []) if (a.classes) map[a.classes.id] = a.classes;
  return Object.values(map).sort((x, y) => (x.libelle || "").localeCompare(y.libelle || ""));
}
