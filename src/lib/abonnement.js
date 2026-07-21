import { supabase } from "@/lib/supabase.js";

// GesSchool — abonnement de l'établissement, vu côté promoteur.
// Le modèle est un FORFAIT PAR PALIER D'EFFECTIF (et non « par élève ») :
// `max_eleves` borne le palier et sert d'indicateur, jamais de verrou.

export const SEUIL_ALERTE = 0.9; // on prévient à 90 % du palier

export async function monAbonnement() {
  const { data, error } = await supabase.rpc("mon_abonnement");
  if (error) throw error;
  return (data && data[0]) || null;
}

// Où en est l'école dans son palier ? `null` si le plan est illimité.
export function occupation(abo) {
  const max = Number(abo?.max_eleves) || 0;
  if (!max) return null;
  const effectif = Number(abo?.effectif) || 0;
  return { effectif, max, ratio: effectif / max, depasse: effectif > max, proche: effectif >= max * SEUIL_ALERTE };
}

// Jours restants avant l'échéance (négatif = déjà expiré ; null si pas de fin).
export function joursRestants(abo) {
  if (!abo?.fin) return null;
  return Math.ceil((new Date(abo.fin).getTime() - Date.now()) / 86400000);
}

export const LIBELLES_STATUT = {
  essai: "Période d'essai",
  actif: "Actif",
  suspendu: "Suspendu",
  expire: "Expiré",
  annule: "Annulé",
};
