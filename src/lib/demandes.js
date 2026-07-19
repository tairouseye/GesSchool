import { supabase } from "@/lib/supabase.js";

// GesSchool — demandes de documents (côté administration).

export const TYPES = {
  scolarite: "Certificat de scolarité",
  inscription: "Attestation d'inscription",
  frequentation: "Attestation de fréquentation",
  bulletin: "Bulletin",
  autre: "Autre",
};

export const STATUTS = {
  en_attente: { label: "En attente", ton: "or" },
  en_cours: { label: "En cours", ton: "navy" },
  pret: { label: "Prêt", ton: "vert" },
  rejete: { label: "Rejeté", ton: "rouge" },
};

// Nombre de demandes non traitées (badge du menu). Silencieux en cas d'erreur :
// un compteur ne doit jamais empêcher la navigation.
export async function compterDemandesEnAttente(ecoleId) {
  if (!ecoleId) return 0;
  const { count, error } = await supabase
    .from("demandes_documents")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecoleId)
    .in("statut", ["en_attente", "en_cours"]);
  if (error) return 0;
  return count ?? 0;
}

export async function getDemandes(ecoleId) {
  const { data, error } = await supabase
    .from("demandes_documents")
    .select("*, eleves(prenom, nom, matricule), tuteurs(prenom, nom, telephone)")
    .eq("ecole_id", ecoleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function traiterDemande(id, statut, reponse) {
  const { error } = await supabase.rpc("traiter_demande", { p_demande: id, p_statut: statut, p_reponse: reponse || null });
  if (error) throw error;
}
