import { supabase } from "@/lib/supabase.js";
import { urlSignee } from "@/lib/stockage.js";
import { bornesPagination } from "@/lib/biblio.regles.js";
import { BUCKET } from "@/lib/bibliotheque.js";

// GesSchool — Dépôt institutionnel : mémoires, thèses, rapports, PFE et
// publications scientifiques, avec workflow de validation.
//
// Les fichiers déposés vont dans `<ecole_id>/depots/…` : c'est le SEUL préfixe
// du bucket où un membre (étudiant, enseignant) peut téléverser — la policy
// Storage (migration 121) l'impose. La gestion, elle, écrit partout.

export const TYPES_DEPOT = [
  ["memoire", "Mémoire"],
  ["these", "Thèse"],
  ["pfe", "Projet de fin d'études"],
  ["rapport", "Rapport de stage"],
  ["publication", "Publication scientifique"],
];

export const STATUTS_DEPOT = {
  brouillon:    { label: "Brouillon", ton: "neutre" },
  soumis:       { label: "Soumis", ton: "info" },
  verification: { label: "En vérification", ton: "warning" },
  a_corriger:   { label: "À corriger", ton: "warning" },
  valide:       { label: "Validé", ton: "success" },
  publie:       { label: "Publié", ton: "success" },
  rejete:       { label: "Rejeté", ton: "danger" },
  archive:      { label: "Archivé", ton: "neutre" },
};

// Étapes proposées à la gestion depuis un statut donné.
export function transitions(statut) {
  switch (statut) {
    case "soumis":       return [["verification", "Mettre en vérification"], ["a_corriger", "Demander des corrections"], ["rejete", "Rejeter"]];
    case "verification": return [["valide", "Valider"], ["a_corriger", "Demander des corrections"], ["rejete", "Rejeter"]];
    case "a_corriger":   return [["rejete", "Rejeter"]];
    case "valide":       return [["archive", "Archiver"]];
    case "publie":       return [["archive", "Archiver"]];
    default:             return [];
  }
}

// --- Lecture ---------------------------------------------------------------

// Liste paginée (gestion). La RLS restreint déjà à l'école.
export async function getDepots(ecoleId, { statut, type, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase.from("biblio_depots")
    .select("*, profils:deposant_profil_id(prenom, nom), eleves:deposant_eleve_id(prenom, nom, matricule)", { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (statut) req = req.eq("statut", statut);
  if (type) req = req.eq("type", type);
  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}

// Mes dépôts (déposant) — la RLS ne renvoie que les siens.
export async function mesDepots() {
  const { data, error } = await supabase.from("biblio_depots")
    .select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDepot(id) {
  const { data, error } = await supabase.from("biblio_depots")
    .select("*, profils:deposant_profil_id(prenom, nom), biblio_theses(*), biblio_publications(*)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// --- Écriture ---------------------------------------------------------------
export async function creerDepot(ecoleId, d) {
  const { data, error } = await supabase.from("biblio_depots")
    .insert({ ecole_id: ecoleId, ...d }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierDepot(id, d) {
  const { error } = await supabase.from("biblio_depots").update(d).eq("id", id);
  if (error) throw error;
}
export async function supprimerDepot(id) {
  const { error } = await supabase.from("biblio_depots").delete().eq("id", id);
  if (error) throw error;
}

// Le déposant soumet son dossier (il ne pourra plus le modifier ensuite).
export async function soumettreDepot(id) {
  const { error } = await supabase.from("biblio_depots")
    .update({ statut: "soumis", soumis_le: new Date().toISOString(), commentaire: null }).eq("id", id);
  if (error) throw error;
}

// Décision de la gestion (vérification / correction / validation / rejet…).
export async function deciderDepot(id, statut, commentaire = null) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("biblio_depots").update({
    statut, commentaire: commentaire || null,
    decide_le: new Date().toISOString(), validateur_profil_id: u?.user?.id || null,
  }).eq("id", id);
  if (error) throw error;
}

// Publication : crée la notice + le document numérique de façon ATOMIQUE.
export async function publierDepot(id, acces = "institution") {
  const { data, error } = await supabase.rpc("publier_depot", { p_depot: id, p_acces: acces });
  if (error) throw error;
  return data; // id de la notice créée
}

// --- Fichier ----------------------------------------------------------------
export async function televerserDepot(ecoleId, file) {
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  // Préfixe `depots` OBLIGATOIRE : seul endroit où un membre peut écrire.
  const chemin = `${ecoleId}/depots/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, file, { upsert: false });
  if (error) throw error;
  return { chemin, nom: file.name, taille: file.size };
}
export const lienDepot = (chemin) => urlSignee(BUCKET, chemin, 3600);

// --- Métadonnées académiques ------------------------------------------------
export async function enregistrerThese(ecoleId, depotId, t) {
  const { error } = await supabase.from("biblio_theses")
    .upsert({ ecole_id: ecoleId, depot_id: depotId, ...t }, { onConflict: "depot_id" });
  if (error) throw error;
}
export async function enregistrerPublication(ecoleId, depotId, p) {
  const { error } = await supabase.from("biblio_publications")
    .upsert({ ecole_id: ecoleId, depot_id: depotId, ...p }, { onConflict: "depot_id" });
  if (error) throw error;
}
