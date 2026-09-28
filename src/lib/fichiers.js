import { supabase } from "@/lib/supabase.js";
import { urlSignee } from "@/lib/stockage.js";

// GesSchool — documentation de l'établissement (migration 150).
//
// Une seule table pour deux usages : les pièces jointes des annonces et les
// documents déposés directement dans Pilotage → Documentation. Les stocker
// deux fois garantirait qu'ils divergent ; une pièce jointe n'est qu'une
// ligne de la documentation, rattachée à une annonce.

export const CATEGORIES = [
  ["annonce", "Pièce jointe d'annonce"],
  ["reglement", "Règlement"],
  ["circulaire", "Circulaire"],
  ["formulaire", "Formulaire"],
  ["calendrier", "Calendrier"],
  ["autre", "Autre"],
];
export const libCategorie = (c) => (CATEGORIES.find((x) => x[0] === c) || [])[1] || "Autre";

const BUCKET = "documents";
// Le serveur plafonne à 20 Mo (migration 150). On refuse avant l'envoi pour
// ne pas faire patienter sur un téléversement voué à échouer.
export const TAILLE_MAX = 20 * 1024 * 1024;

export const poids = (o) => {
  const n = Number(o) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
};

// Extension conservée, nom d'origine gardé à part : le chemin reste un uuid,
// sans accent ni espace, donc sans surprise côté stockage.
function cheminPour(ecoleId, fichier) {
  const ext = (fichier.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2));
  return `${ecoleId}/${id}.${ext}`;
}

// Téléverse puis enregistre la ligne. Si l'enregistrement échoue, le fichier
// est retiré du stockage : un octet sans ligne serait invisible et pèserait
// pour rien.
export async function televerserFichier(ecoleId, fichier, { titre, categorie = "autre", annonceId = null, auteurId = null } = {}) {
  if (!fichier) throw new Error("Aucun fichier sélectionné.");
  if (fichier.size > TAILLE_MAX) {
    throw new Error(`Fichier trop volumineux (${poids(fichier.size)}). Maximum ${poids(TAILLE_MAX)}.`);
  }
  const chemin = cheminPour(ecoleId, fichier);
  const { error: eUp } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    contentType: fichier.type || "application/octet-stream",
    upsert: false,
  });
  if (eUp) throw eUp;

  const { data, error } = await supabase
    .from("fichiers_ecole")
    .insert({
      ecole_id: ecoleId,
      annonce_id: annonceId,
      titre: (titre || fichier.name).trim(),
      categorie: annonceId ? "annonce" : categorie,
      nom_fichier: fichier.name,
      chemin,
      mime: fichier.type || null,
      taille: fichier.size,
      depose_par: auteurId || null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([chemin]).catch(() => {});
    throw error;
  }
  return data;
}

// Toute la documentation de l'établissement, pièces jointes comprises.
export async function getFichiers(ecoleId, { categorie = "", q = "" } = {}) {
  let req = supabase
    .from("fichiers_ecole")
    .select("*, annonces(titre)")
    .eq("ecole_id", ecoleId);
  if (categorie) req = req.eq("categorie", categorie);
  if ((q || "").trim()) {
    const m = q.trim().replace(/[%,()]/g, "");
    req = req.or(`titre.ilike.*${m}*,nom_fichier.ilike.*${m}*`);
  }
  const { data, error } = await req.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFichiersAnnonce(annonceId) {
  const { data, error } = await supabase
    .from("fichiers_ecole")
    .select("*")
    .eq("annonce_id", annonceId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// Supprime la ligne ET l'octet. L'ordre compte : si le stockage refuse, la
// ligne reste et le fichier demeure consultable — l'inverse laisserait une
// ligne pointant dans le vide.
export async function supprimerFichier(fichier) {
  const { error: eSt } = await supabase.storage.from(BUCKET).remove([fichier.chemin]);
  if (eSt) throw eSt;
  const { error } = await supabase.from("fichiers_ecole").delete().eq("id", fichier.id);
  if (error) throw error;
}

// Lien de consultation, valable une heure. La policy Storage vérifie que
// l'appelant a le droit de lire la LIGNE avant de délivrer l'octet.
export const lienFichier = (chemin) => urlSignee(BUCKET, chemin);
