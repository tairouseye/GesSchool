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
    //  `niveau_id` sert à retrouver la programmation officielle du niveau
    //  (mig. 165) : elle est partagée par toutes les classes d'un même
    //  niveau. Purement additif — les appelants ne lisent que id/libelle.
    supabase.from("classes").select("id, libelle, niveau_id")
      .eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("prof_principal_id", ensId),
    supabase.from("affectations").select("classes(id, libelle, niveau_id)")
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
  // ⚠️ Une affectation SANS matière signifie « toutes les matières de cette
  // classe » (migration 161). Pousser `null` dans la liste ferait exactement
  // l'inverse : `matieresAutorisees` ne trouverait aucune correspondance et
  // la maîtresse n'aurait PLUS AUCUNE matière. On retire donc la classe de
  // la carte — une classe absente n'est pas restreinte, cf. ci-dessous.
  const map = {};
  const toutesMatieres = new Set();
  for (const a of data ?? []) {
    if (!a.matiere_id) { toutesMatieres.add(a.classe_id); continue; }
    (map[a.classe_id] ||= []).push(a.matiere_id);
  }
  for (const cid of toutesMatieres) delete map[cid];
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
