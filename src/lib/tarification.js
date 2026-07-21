import { supabase } from "@/lib/supabase.js";

// GesSchool — modèle de tarification (réservé au super-admin).
//
// Principe : on ne facture PAS « par élève ». Le coût dominant d'un SaaS de
// cette taille n'est pas l'infrastructure — une école de plus ne coûte presque
// rien en serveur — c'est le TEMPS HUMAIN (onboarding + support). Le palier
// d'effectif sert d'approximation de cette charge de support.
//
//   Prix_mensuel = ( F/N + Cv + O/12 ) / (1 − marge)
//   Seuil de rentabilité :  N_min = F / (Prix_mensuel − Cv − O/12)
//
// F  = coûts fixes mensuels      N = nombre d'écoles clientes
// Cv = coût variable mensuel/école        O = coût d'onboarding (amorti 12 mois)

// ⚠️ HYPOTHÈSES TYPES — à remplacer par les chiffres réels.
export const HYPOTHESES_DEFAUT = {
  fixes: {
    supabase: 15000,   // offre Pro (production + sauvegardes)
    domaine: 1000,     // nom de domaine + DNS, ramené au mois
    email: 6000,       // e-mail transactionnel
    outils: 20000,     // IA, design, supervision
  },
  tauxHoraire: 10000,  // XOF / heure — ton coût de référence
  margeVisee: 0.65,    // 65 % — finance l'évolution du produit
  nbEcoles: 10,        // nombre d'écoles clientes visé
  paliers: [
    { code: "socle",    libelle: "Socle",    maxEleves: 150,  supportHeures: 0.5, infra: 500,  onboardingHeures: 4 },
    { code: "standard", libelle: "Standard", maxEleves: 400,  supportHeures: 1.5, infra: 1500, onboardingHeures: 8 },
    { code: "premium",  libelle: "Premium",  maxEleves: 800,  supportHeures: 3,   infra: 3000, onboardingHeures: 16 },
  ],
};

export function totalFixes(h) {
  return Object.values(h?.fixes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

// Détail du calcul pour un palier. Tous les montants sont mensuels, en XOF.
export function calculerPalier(h, palier) {
  const F = totalFixes(h);
  const N = Math.max(1, Number(h.nbEcoles) || 1);
  const taux = Number(h.tauxHoraire) || 0;
  const marge = Math.min(0.95, Math.max(0, Number(h.margeVisee) || 0));

  const partFixe = F / N;                                        // quote-part des frais fixes
  const support = (Number(palier.supportHeures) || 0) * taux;
  const infra = Number(palier.infra) || 0;
  const onboarding = ((Number(palier.onboardingHeures) || 0) * taux) / 12;

  const coutVariable = support + infra + onboarding;             // ne dépend pas de N
  const coutRevient = partFixe + coutVariable;
  const prixMensuel = coutRevient / (1 - marge);
  const margeMensuelle = prixMensuel - coutRevient;

  // Combien d'écoles à ce prix pour couvrir les frais fixes ?
  const contribution = prixMensuel - coutVariable;
  const seuilEcoles = contribution > 0 ? Math.ceil(F / contribution) : null;

  return {
    ...palier,
    partFixe, support, infra, onboarding,
    coutVariable, coutRevient,
    prixMensuel, prixAnnuel: prixMensuel * 12,
    margeMensuelle, seuilEcoles,
  };
}

export function calculerGrille(h) {
  return (h.paliers || []).map((p) => calculerPalier(h, p));
}

// --- Persistance (table config_saas, RLS super-admin) ---
export async function getHypotheses() {
  const { data, error } = await supabase
    .from("config_saas").select("valeur").eq("cle", "tarification").maybeSingle();
  if (error) throw error;
  return data?.valeur || HYPOTHESES_DEFAUT;
}

export async function setHypotheses(valeur) {
  const { error } = await supabase
    .from("config_saas").upsert({ cle: "tarification", valeur }, { onConflict: "cle" });
  if (error) throw error;
}

// Applique les prix calculés aux plans d'abonnement (arrondis au millier).
export async function appliquerTarifs(lignes) {
  for (const l of lignes) {
    const { error } = await supabase.rpc("admin_set_plan_tarif", {
      p_code: l.code,
      p_prix_mensuel: Math.round(l.prixMensuel / 1000) * 1000,
      p_prix_annuel: Math.round(l.prixAnnuel / 1000) * 1000,
      p_max_eleves: Number(l.maxEleves) || null,
    });
    if (error) throw error;
  }
}
