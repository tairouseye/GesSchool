import { supabase } from "@/lib/supabase.js";
import { bornesPagination } from "@/lib/biblio.regles.js";

// GesSchool — Bibliothèque : acquisitions (fournisseurs, commandes, suggestions).
//
// Le montant d'une commande n'est jamais stocké : il se recalcule depuis ses
// lignes (`totalCommande`), pour qu'aucune valeur dénormalisée ne diverge.

export const STATUTS_COMMANDE = {
  brouillon: { label: "Brouillon", ton: "neutre" },
  commandee: { label: "Commandée", ton: "info" },
  partielle: { label: "Reçue en partie", ton: "warning" },
  recue:     { label: "Reçue", ton: "success" },
  annulee:   { label: "Annulée", ton: "danger" },
};

export const STATUTS_SUGGESTION = {
  soumise:   { label: "En attente", ton: "info" },
  acceptee:  { label: "Acceptée", ton: "success" },
  refusee:   { label: "Refusée", ton: "danger" },
  commandee: { label: "Commandée", ton: "or" },
};

export const totalCommande = (lignes = []) =>
  lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);

export const resteARecevoir = (l) => Math.max(0, (Number(l.quantite) || 0) - (Number(l.quantite_recue) || 0));

// --- Fournisseurs -----------------------------------------------------------
export async function getFournisseurs(ecoleId, { actifsSeuls = false } = {}) {
  let req = supabase.from("biblio_fournisseurs").select("*").eq("ecole_id", ecoleId);
  if (actifsSeuls) req = req.eq("actif", true);
  const { data, error } = await req.order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function enregistrerFournisseur(ecoleId, f) {
  const { id, ...reste } = f;
  const req = id
    ? supabase.from("biblio_fournisseurs").update(reste).eq("id", id)
    : supabase.from("biblio_fournisseurs").insert({ ecole_id: ecoleId, ...reste });
  const { error } = await req;
  if (error) throw error;
}
export async function supprimerFournisseur(id) {
  const { error } = await supabase.from("biblio_fournisseurs").delete().eq("id", id);
  if (error) throw error;
}

// --- Commandes --------------------------------------------------------------
export async function getCommandes(ecoleId, { statut, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase.from("biblio_acquisitions")
    .select("*, biblio_fournisseurs(nom), biblio_acquisitions_lignes(quantite, quantite_recue, prix_unitaire)",
            { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (statut) req = req.eq("statut", statut);
  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}

export async function getCommande(id) {
  const { data, error } = await supabase.from("biblio_acquisitions")
    .select("*, biblio_fournisseurs(id, nom), biblio_acquisitions_lignes(*, biblio_ressources(id, titre))")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function creerCommande(ecoleId, c) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("biblio_acquisitions")
    .insert({ ecole_id: ecoleId, cree_par: u?.user?.id || null, ...c }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierCommande(id, c) {
  const { error } = await supabase.from("biblio_acquisitions").update(c).eq("id", id);
  if (error) throw error;
}
export async function supprimerCommande(id) {
  const { error } = await supabase.from("biblio_acquisitions").delete().eq("id", id);
  if (error) throw error;
}

export async function ajouterLigne(ecoleId, acquisitionId, l) {
  const { error } = await supabase.from("biblio_acquisitions_lignes")
    .insert({ ecole_id: ecoleId, acquisition_id: acquisitionId, ...l });
  if (error) throw error;
}
export async function modifierLigne(id, l) {
  const { error } = await supabase.from("biblio_acquisitions_lignes").update(l).eq("id", id);
  if (error) throw error;
}
export async function supprimerLigne(id) {
  const { error } = await supabase.from("biblio_acquisitions_lignes").delete().eq("id", id);
  if (error) throw error;
}

// Réception : crée les exemplaires et recalcule le statut de la commande,
// le tout côté serveur (RPC de la migration 123).
export async function receptionner(ligneId, quantite = null) {
  const { data, error } = await supabase.rpc("receptionner_ligne",
    { p_ligne: ligneId, p_quantite: quantite });
  if (error) throw error;
  return data; // nombre d'exemplaires créés
}

// --- Suggestions d'achat ----------------------------------------------------
export async function getSuggestions(ecoleId, { statut, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase.from("biblio_suggestions")
    .select("*, profils:demandeur_profil_id(prenom, nom)", { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (statut) req = req.eq("statut", statut);
  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}

// Mes suggestions (usager) — la RLS ne renvoie que les siennes.
export async function mesSuggestions() {
  const { data, error } = await supabase.from("biblio_suggestions")
    .select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function suggerer(ecoleId, s) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("biblio_suggestions").insert({
    ecole_id: ecoleId, demandeur_profil_id: u?.user?.id || null, statut: "soumise", ...s,
  });
  if (error) throw error;
}
export async function repondreSuggestion(id, statut, reponse = null) {
  const { error } = await supabase.from("biblio_suggestions")
    .update({ statut, reponse: reponse || null }).eq("id", id);
  if (error) throw error;
}
export async function supprimerSuggestion(id) {
  const { error } = await supabase.from("biblio_suggestions").delete().eq("id", id);
  if (error) throw error;
}
