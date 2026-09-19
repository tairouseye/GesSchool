import { supabase } from "@/lib/supabase.js";
import { bornesPagination } from "@/lib/pagination.js";

// GesSchool — admissions du supérieur (migration 140).
//
// Le candidat n'a pas de compte : tout ce qui le concerne passe par des RPC
// accordées à `anon`. Le personnel, lui, lit et écrit les tables sous RLS.

export const STATUTS = [
  ["soumise", "Soumise", "neutre"],
  ["en_examen", "En examen", "info"],
  ["complement", "Complément demandé", "warning"],
  ["admise", "Admise", "success"],
  ["liste_attente", "Liste d'attente", "or"],
  ["refusee", "Refusée", "danger"],
  ["inscrite", "Inscrite", "navy"],
];
export const libStatut = (s) => STATUTS.find(([v]) => v === s)?.[1] || s;
export const tonStatut = (s) => STATUTS.find(([v]) => v === s)?.[2] || "neutre";

// Décisions proposables depuis la liste. « inscrite » n'en est pas une :
// elle s'obtient en transformant le dossier, pas en cochant une case.
export const DECISIONS = ["en_examen", "complement", "admise", "liste_attente", "refusee"];

// --- Campagnes --------------------------------------------------------------
export async function getCampagnes(ecoleId) {
  const { data, error } = await supabase
    .from("admissions_campagnes")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enregistrerCampagne(ecoleId, c) {
  const { id, ...reste } = c;
  const req = id
    ? supabase.from("admissions_campagnes").update(reste).eq("id", id)
    : supabase.from("admissions_campagnes").insert({ ecole_id: ecoleId, ...reste });
  const { error } = await req;
  if (error) throw error;
}

export async function supprimerCampagne(id) {
  const { error } = await supabase.from("admissions_campagnes").delete().eq("id", id);
  if (error) throw error;
}

// --- Candidatures (personnel) -----------------------------------------------
// Paginée dès le départ : une campagne d'université se compte en milliers de
// dossiers, pas en dizaines.
export async function getCandidatures(ecoleId, { campagneId = null, statut = "", q = "", page = 0, taille = 25 } = {}) {
  const { debut, fin } = bornesPagination(page, taille);
  let req = supabase
    .from("candidatures")
    .select("*, filieres!candidatures_filiere_id_fkey(nom, sigle)", { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (campagneId) req = req.eq("campagne_id", campagneId);
  if (statut) req = req.eq("statut", statut);
  if ((q || "").trim()) {
    const m = q.trim().replace(/[%,()]/g, "");
    req = req.or(`prenom.ilike.*${m}*,nom.ilike.*${m}*,numero.ilike.*${m}*,email.ilike.*${m}*`);
  }
  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0 };
}

// Le déclencheur en base horodate la décision et retient son auteur : on
// n'envoie que le statut et le motif.
export async function decider(id, statut, motif = null) {
  const { error } = await supabase
    .from("candidatures")
    .update({ statut, motif: motif || null })
    .eq("id", id);
  if (error) throw error;
}

// Transforme un dossier ADMIS en étudiant inscrit, sans ressaisie.
export async function convertir(id, anneeId = null) {
  const { data, error } = await supabase.rpc("convertir_candidature", { p_id: id, p_annee: anneeId });
  if (error) throw error;
  return data;
}

// Compte par statut, pour les compteurs d'en-tête. `head: true` : on veut le
// nombre, pas les lignes.
export async function compterParStatut(ecoleId, campagneId = null) {
  const res = {};
  await Promise.all(STATUTS.map(async ([s]) => {
    let req = supabase.from("candidatures")
      .select("id", { count: "exact", head: true })
      .eq("ecole_id", ecoleId).eq("statut", s);
    if (campagneId) req = req.eq("campagne_id", campagneId);
    const { count } = await req;
    res[s] = count ?? 0;
  }));
  return res;
}

// --- Côté candidat (public, sans compte) ------------------------------------
export async function campagnePublique(ecoleId) {
  const { data, error } = await supabase.rpc("campagne_publique", { p_ecole: ecoleId });
  if (error) throw error;
  return data || null;
}

export async function deposerCandidature(campagneId, candidat) {
  const { data, error } = await supabase.rpc("deposer_candidature", {
    p_campagne: campagneId, p_candidat: candidat,
  });
  if (error) throw error;
  return data;
}

export async function suivreCandidature(code) {
  const { data, error } = await supabase.rpc("suivre_candidature", { p_code: code });
  if (error) throw error;
  return data || null;
}
