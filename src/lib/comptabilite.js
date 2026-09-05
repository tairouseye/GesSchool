import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « comptabilité » : comptes de trésorerie, recettes,
// dépenses, soldes et synthèse. Modèle simple de livre de caisse.

export const TYPES_COMPTE = [
  ["caisse", "Caisse"],
  ["banque", "Banque"],
  ["mobile", "Mobile money"],
  ["autre", "Autre"],
];

export const CATEGORIES_DEPENSE = [
  "Salaires", "Fournitures", "Loyer", "Électricité / Eau", "Transport",
  "Maintenance", "Communication", "Restauration", "Divers",
];

// Listes par défaut — utilisées seulement en REPLI si l'école n'a pas encore
// de catégories en base (cf. table categories_finance, migration 076).
// NB : « Scolarité » et « Inscription » n'y figurent PAS volontairement — ces
// encaissements passent par le module Paiements et sont déjà agrégés dans la
// synthèse (les saisir ici les compterait deux fois).
export const CATEGORIES_RECETTE = [
  "Don", "Subvention", "Location", "Activité", "Divers",
];

// --- Catégories configurables (par école) ---
export async function getCategories(ecoleId, sens) {
  let q = supabase.from("categories_finance").select("*").eq("ecole_id", ecoleId);
  if (sens) q = q.eq("sens", sens);
  const { data, error } = await q.order("sens").order("ordre").order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerCategorie(ecoleId, { sens, libelle, ordre = 0 }) {
  const { data, error } = await supabase
    .from("categories_finance")
    .insert({ ecole_id: ecoleId, sens, libelle: (libelle || "").trim(), ordre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function modifierCategorie(id, patch) {
  const p = {};
  if (patch.libelle != null) p.libelle = patch.libelle.trim();
  if (patch.actif != null) p.actif = patch.actif;
  if (patch.ordre != null) p.ordre = patch.ordre;
  const { data, error } = await supabase.from("categories_finance").update(p).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// Suppression : les mouvements liés gardent leur libellé (categorie texte) ;
// seul le lien categorie_id passe à null (FK on delete set null).
export async function supprimerCategorie(id) {
  const { error } = await supabase.from("categories_finance").delete().eq("id", id);
  if (error) throw error;
}

// --- Comptes ---
export async function getComptes(ecoleId) {
  const { data, error } = await supabase
    .from("comptes")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerCompte(ecoleId, c) {
  const { data, error } = await supabase
    .from("comptes")
    .insert({
      ecole_id: ecoleId,
      libelle: c.libelle,
      type: c.type || "caisse",
      numero: c.numero || null,
      solde_initial: Number(c.solde_initial) || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerCompte(id) {
  const { error } = await supabase.from("comptes").delete().eq("id", id);
  if (error) throw error;
}

// Téléverse un justificatif (image/PDF) dans le bucket privé et renvoie son
// CHEMIN (l'ouverture se fait via une URL signée temporaire).
export async function televerserJustificatif(ecoleId, file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const chemin = `${ecoleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("justificatifs").upload(chemin, file, { upsert: true });
  if (error) throw error;
  return chemin;
}

// --- Recettes (entrées) ---
export async function getRecettes(ecoleId, { debut, fin } = {}) {
  let q = supabase.from("recettes").select("*, comptes(libelle)").eq("ecole_id", ecoleId);
  if (debut) q = q.gte("date_recette", debut);
  if (fin) q = q.lte("date_recette", fin);
  const { data, error } = await q.order("date_recette", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function creerRecette(ecoleId, r, saisiPar) {
  const { data, error } = await supabase
    .from("recettes")
    .insert({
      ecole_id: ecoleId,
      compte_id: r.compte_id || null,
      libelle: r.libelle,
      categorie: r.categorie || null,
      categorie_id: r.categorie_id || null,
      montant: Number(r.montant),
      mode: r.mode || null,
      date_recette: r.date_recette || new Date().toISOString().slice(0, 10),
      source: r.source || null,
      justificatif_url: r.justificatif_url || null,
      saisi_par: saisiPar || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerRecette(id) {
  const { error } = await supabase.from("recettes").delete().eq("id", id);
  if (error) throw error;
}

// --- Dépenses (sorties) ---
export async function getDepenses(ecoleId, { debut, fin } = {}) {
  let q = supabase.from("depenses").select("*, comptes(libelle)").eq("ecole_id", ecoleId);
  if (debut) q = q.gte("date_depense", debut);
  if (fin) q = q.lte("date_depense", fin);
  const { data, error } = await q.order("date_depense", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function creerDepense(ecoleId, d, saisiPar) {
  const { data, error } = await supabase
    .from("depenses")
    .insert({
      ecole_id: ecoleId,
      compte_id: d.compte_id || null,
      libelle: d.libelle,
      categorie: d.categorie || null,
      categorie_id: d.categorie_id || null,
      montant: Number(d.montant),
      mode: d.mode || null,
      date_depense: d.date_depense || new Date().toISOString().slice(0, 10),
      beneficiaire: d.beneficiaire || null,
      justificatif_url: d.justificatif_url || null,
      saisi_par: saisiPar || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerDepense(id) {
  const { error } = await supabase.from("depenses").delete().eq("id", id);
  if (error) throw error;
}

// --- Soldes par compte : solde_initial + recettes - dépenses ---
// Les totaux entrées/sorties sont agrégés côté Postgres (RPC soldes_comptes)
// → on ne charge plus toutes les recettes/dépenses dans le navigateur.
export async function getSoldes(ecoleId) {
  const [comptes, agg] = await Promise.all([
    getComptes(ecoleId),
    supabase.rpc("soldes_comptes", { p_ecole: ecoleId }),
  ]);
  const parCompte = {};
  for (const row of agg.data ?? []) parCompte[row.compte_id] = row;
  return comptes.map((c) => {
    const a = parCompte[c.id] || {};
    const entrees = Number(a.entrees) || 0;
    const sorties = Number(a.sorties) || 0;
    return { ...c, entrees, sorties, solde: Number(c.solde_initial || 0) + entrees - sorties };
  });
}

// Créances : total dû par les familles (factures non annulées, reste à payer).
export async function getCreancesScolarite(ecoleId, anneeId) {
  let q = supabase.from("factures").select("montant_total, montant_paye, statut").eq("ecole_id", ecoleId).neq("statut", "annulee");
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce((s, f) => s + Math.max(0, Number(f.montant_total || 0) - Number(f.montant_paye || 0)), 0);
}

// Dettes envers le personnel : salaires validés mais pas encore payés.
// Via RPC SECURITY DEFINER → accessible aussi au comptable (la RLS de `salaires`
// est réservée à la RH), pour le tableau de bord comptable.
export async function getDettesPersonnel(ecoleId) {
  const { data, error } = await supabase.rpc("dettes_personnel", { p_ecole: ecoleId });
  if (error) throw error;
  return Number(data) || 0;
}

// Scolarité encaissée sur une période (depuis les paiements parents).
export async function getScolaritePeriode(ecoleId, debut, fin) {
  let q = supabase.from("paiements").select("montant").eq("ecole_id", ecoleId);
  if (debut) q = q.gte("date_paiement", debut);
  if (fin) q = q.lte("date_paiement", fin);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce((s, p) => s + Number(p.montant || 0), 0);
}
