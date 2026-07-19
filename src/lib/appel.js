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

// Matières que le prof enseigne, par classe : { classe_id: [matiere_id, …] }.
// Une classe absente de la carte (cas du prof principal sans affectation de
// matière) n'est pas restreinte — cf. matieresAutorisees ci-dessous.
export async function getMesMatieresParClasse(ecoleId, anneeId, ensId) {
  if (!ensId || !anneeId) return {};
  const { data, error } = await supabase
    .from("affectations")
    .select("classe_id, matiere_id")
    .eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("enseignant_id", ensId);
  if (error) throw error;
  const map = {};
  for (const a of data ?? []) (map[a.classe_id] ||= []).push(a.matiere_id);
  return map;
}

// Matières proposables pour une classe donnée. Sans restriction (rôle qui voit
// tout, ou prof principal sans matière affectée), on renvoie toutes les matières.
export function matieresAutorisees(matieres, mapParClasse, classeId, sansRestriction) {
  if (sansRestriction) return matieres;
  const ids = mapParClasse?.[classeId];
  if (!ids || ids.length === 0) return matieres;
  return matieres.filter((m) => ids.includes(m.id));
}
