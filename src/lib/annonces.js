import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « annonces & communication ».
// Staff : accès tenant classique (ecole_id). Parent : via RPC SECURITY DEFINER.

export const CIBLES = [
  ["tous", "Toute l'école"],
  ["parents", "Parents"],
  ["etudiants", "Étudiants"],
  ["enseignants", "Enseignants"],
  // Mailles intermédiaires : une sortie concerne « le préscolaire », une
  // réunion « les CM ». Sans elles, ces messages partaient à tout le monde
  // — et ce qui s'adresse à tous n'est lu par personne (migration 152).
  ["cycle", "Un cycle (préscolaire, élémentaire…)"],
  ["niveau", "Un niveau"],
  ["classe", "Une classe"],
];

// Cibles exigeant de désigner une entité, et le champ correspondant.
export const CHAMP_CIBLE = { classe: "classe_id", niveau: "niveau_id", cycle: "cycle_id" };
export const cibleExigeChoix = (c) => Boolean(CHAMP_CIBLE[c]);

export function libelleCible(cible) {
  return (CIBLES.find((c) => c[0] === cible) || [])[1] || "Toute l'école";
}

// --- Côté staff ---
export async function getAnnonces(ecoleId) {
  const { data, error } = await supabase
    .from("annonces")
    .select("*, classes(libelle), niveaux(libelle), cycles(libelle), profils(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .order("publie_le", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function creerAnnonce(ecoleId, a, auteurId) {
  const { data, error } = await supabase
    .from("annonces")
    .insert({
      ecole_id: ecoleId,
      titre: a.titre,
      contenu: a.contenu || null,
      cible: a.cible || "tous",
      // Une seule entité est renseignée : celle que la cible désigne. Les
      // autres restent nulles, sinon un changement de cible laisserait
      // derrière lui un ciblage fantôme.
      classe_id: a.cible === "classe" ? a.classe_id || null : null,
      niveau_id: a.cible === "niveau" ? a.niveau_id || null : null,
      cycle_id: a.cible === "cycle" ? a.cycle_id || null : null,
      auteur_id: auteurId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerAnnonce(id) {
  const { error } = await supabase.from("annonces").delete().eq("id", id);
  if (error) throw error;
}

// --- Côté parent (RPC sécurisée) ---
//
// ⚠️ `annoncesParent()` et `annoncesParEcole()` ont été retirés en 2.218.0 :
// l'accueil parent n'affiche plus la liste des annonces, elle appartient à la
// page de l'enfant (migration 157). La RPC `annonces_parent()` reste en base,
// dormante — on ne la supprime pas ici, car elle porte l'une des quatre
// écritures de la règle de visibilité (cf. en-tête de la migration 152) et son
// retrait mérite sa propre migration, pas un effet de bord.

// Les annonces d'UN enfant : celles de SON établissement et de SA classe.
// La vue globale mélange les écoles quand un parent a des enfants dans
// plusieurs — ici, c'est cadré sur l'enfant ouvert (migration 145).
export async function annoncesEnfant(eleveId) {
  const { data, error } = await supabase.rpc("annonces_enfant", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

// Intitulé de l'audience d'une annonce, côté personnel : « CM1 »,
// « Élémentaire »… plutôt que le seul mot « classe ».
export function libelleAudience(a) {
  if (a?.cible === "classe") return a.classes?.libelle || "Une classe";
  if (a?.cible === "niveau") return a.niveaux?.libelle || "Un niveau";
  if (a?.cible === "cycle") return a.cycles?.libelle || "Un cycle";
  return libelleCible(a?.cible);
}
