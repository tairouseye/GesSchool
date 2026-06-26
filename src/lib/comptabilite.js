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

export const CATEGORIES_RECETTE = [
  "Scolarité", "Inscription", "Don", "Subvention", "Location", "Activité", "Divers",
];

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
export async function getSoldes(ecoleId) {
  const [comptes, rec, dep] = await Promise.all([
    getComptes(ecoleId),
    supabase.from("recettes").select("compte_id, montant").eq("ecole_id", ecoleId),
    supabase.from("depenses").select("compte_id, montant").eq("ecole_id", ecoleId),
  ]);
  const entrees = {};
  const sorties = {};
  for (const r of rec.data ?? []) entrees[r.compte_id] = (entrees[r.compte_id] || 0) + Number(r.montant || 0);
  for (const d of dep.data ?? []) sorties[d.compte_id] = (sorties[d.compte_id] || 0) + Number(d.montant || 0);
  return comptes.map((c) => ({
    ...c,
    entrees: entrees[c.id] || 0,
    sorties: sorties[c.id] || 0,
    solde: Number(c.solde_initial || 0) + (entrees[c.id] || 0) - (sorties[c.id] || 0),
  }));
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
