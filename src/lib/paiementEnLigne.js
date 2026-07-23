import { supabase } from "@/lib/supabase.js";

// GesSchool — paiement en ligne (CinetPay / PayDunya).
// La logique sensible vit dans l'Edge Function « paiement » ; ici on ne fait
// qu'invoquer et lire (les secrets ne transitent jamais côté client).

export const PRESTATAIRES = [
  ["cinetpay", "CinetPay"],
  ["paydunya", "PayDunya"],
];

// --- Côté parent : démarrer un paiement, récupérer l'URL du prestataire ---
export async function initierPaiement(factureId, montant) {
  const { data, error } = await supabase.functions.invoke("paiement/initier", {
    body: { facture_id: factureId, montant },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { payment_url, montant, frais }
}

// État affiché au parent (sans secrets) : peut-il payer en ligne ?
export async function pspEtatEleve(eleveId) {
  const { data, error } = await supabase.rpc("psp_etat_eleve", { p_eleve: eleveId });
  if (error) throw error;
  return data || { actif: false };
}

// --- Côté école : configuration (promoteur) ---
export async function pspEtat() {
  const { data, error } = await supabase.rpc("psp_etat");
  if (error) throw error;
  return data || { actif: false };
}

export async function setPspConfig(cfg) {
  const { error } = await supabase.rpc("set_psp_config", {
    p_prestataire: cfg.prestataire || "cinetpay",
    p_api_key: cfg.api_key ?? null,
    p_site_id: cfg.site_id ?? null,
    p_secret_webhook: cfg.secret_webhook ?? null,
    p_actif: cfg.actif ?? null,
    p_commission_a_charge: cfg.commission_a_charge ?? null,
    p_commission_taux: cfg.commission_taux ?? null,
    p_mode: cfg.mode ?? null,
  });
  if (error) throw error;
}

// --- Côté gestion : suivi des transactions ---
export async function getTransactions(ecoleId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from("transactions_paiement")
    .select("id, montant, frais, prestataire, statut, reference_psp, created_at, reglee_le, eleves(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export const LIBELLE_STATUT_TX = {
  initiee: { label: "En attente", ton: "or" },
  reussie: { label: "Réussie", ton: "vert" },
  echouee: { label: "Échouée", ton: "rouge" },
  expiree: { label: "Expirée", ton: "navy" },
};
