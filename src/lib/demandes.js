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
