import { supabase } from "@/lib/supabase.js";

// GesSchool — le suivi des acquis du préscolaire (mig. 172).
//
// ⚠️ L'ÉCHELLE ET LE REGROUPEMENT VIVENT DANS `acquisEchelle.js`, module
// PUR et éprouvé. Ce fichier ne fait que parler à la base.

export async function getItems(ecoleId, cycleId) {
  if (!ecoleId || !cycleId) return [];
  const { data, error } = await supabase
    .from("acquis_items")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("cycle_id", cycleId)
    .eq("actif", true)
    .order("domaine")
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

export async function creerItem(ecoleId, item) {
  const { data, error } = await supabase
    .from("acquis_items")
    .insert({
      ecole_id: ecoleId, cycle_id: item.cycle_id, niveau_id: item.niveau_id || null,
      domaine: item.domaine, libelle: item.libelle, ordre: item.ordre ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerItem(id) {
  const { error } = await supabase.from("acquis_items").delete().eq("id", id);
  if (error) throw error;
}

/** Charge un référentiel de départ. Refuse si l'école en a déjà un. */
export async function chargerModele(cycleId) {
  const { data, error } = await supabase.rpc("charger_modele_acquis", { p_cycle: cycleId });
  if (error) throw error;
  return Number(data) || 0;
}

/**
 * Les observations d'une classe pour une période, indexées
 * `eleve_id → item_id → { valeur, observation }`.
 *
 * ⚠️ UN SEUL ALLER-RETOUR pour toute la classe : une requête par enfant
 * serait le patron N+1 déjà corrigé ailleurs dans ce projet.
 */
export async function getObservations(ecoleId, eleveIds, periodeId) {
  if (!periodeId || !eleveIds?.length) return {};
  const { data, error } = await supabase
    .from("acquis_observations")
    .select("eleve_id, item_id, valeur, observation")
    .eq("ecole_id", ecoleId)
    .eq("periode_id", periodeId)
    .in("eleve_id", eleveIds);
  if (error) throw error;
  const par = {};
  for (const o of data ?? []) {
    (par[o.eleve_id] ||= {})[o.item_id] = { valeur: o.valeur, observation: o.observation };
  }
  return par;
}

/**
 * Enregistre (ou corrige) une observation.
 *
 * ⚠️ `onConflict` sur (eleve, item, periode) : une enseignante qui revient
 * sur son appréciation la CORRIGE, elle ne crée pas une seconde ligne
 * contradictoire. Et retirer une observation la SUPPRIME, au lieu de poser
 * une quatrième valeur « non évalué » — l'absence de ligne dit déjà cela.
 */
export async function observer(ecoleId, { eleveId, itemId, periodeId, valeur, observation, saisiPar }) {
  if (!valeur) {
    const { error } = await supabase
      .from("acquis_observations").delete()
      .eq("eleve_id", eleveId).eq("item_id", itemId).eq("periode_id", periodeId);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase
    .from("acquis_observations")
    .upsert({
      ecole_id: ecoleId, eleve_id: eleveId, item_id: itemId, periode_id: periodeId,
      valeur, observation: observation || null, saisi_par: saisiPar || null,
      maj_le: new Date().toISOString(),
    }, { onConflict: "eleve_id,item_id,periode_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Côté famille : le suivi de SON enfant (RPC, consentement mig. 114). */
export async function enfantAcquis(eleveId, periodeId) {
  const { data, error } = await supabase.rpc("enfant_acquis", {
    p_eleve: eleveId, p_periode: periodeId || null,
  });
  if (error) throw error;
  return data ?? [];
}
