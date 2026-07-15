import { supabase } from "@/lib/supabase.js";

// GesSchool — couche d'accès aux données « structure académique ».
// Toutes les écritures incluent ecole_id (exigé par les RLS = ecole_courante()).

// Année scolaire courante de l'école.
export async function getAnneeCourante(ecoleId) {
  const { data, error } = await supabase
    .from("annees_scolaires")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("courante", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// État du paramétrage initial de l'école (checklist de mise en route).
// Renvoie le nombre d'éléments pour chaque brique de configuration.
export async function etatMiseEnRoute(ecoleId, anneeId) {
  const nb = (q) => q.then(({ count }) => count ?? 0);
  const [niveaux, classes, matieres, enseignants, affectations, frais, inscriptions] = await Promise.all([
    nb(supabase.from("niveaux").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId)),
    nb(supabase.from("classes").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId || "00000000-0000-0000-0000-000000000000")),
    nb(supabase.from("matieres").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId)),
    nb(supabase.from("enseignants").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId)),
    nb(supabase.from("affectations").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId || "00000000-0000-0000-0000-000000000000")),
    nb(supabase.from("frais").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId)),
    nb(supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId || "00000000-0000-0000-0000-000000000000")),
  ]);
  return { niveaux, classes, matieres, enseignants, affectations, frais, inscriptions };
}

// --- Cycles (créés à l'onboarding ; lecture seule ici) ---
export async function getCycles(ecoleId) {
  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

// --- Niveaux ---
export async function getNiveaux(ecoleId) {
  const { data, error } = await supabase
    .from("niveaux")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

export async function creerNiveau(ecoleId, cycleId, libelle, ordre) {
  const { data, error } = await supabase
    .from("niveaux")
    .insert({ ecole_id: ecoleId, cycle_id: cycleId, libelle, ordre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerNiveau(id) {
  const { error } = await supabase.from("niveaux").delete().eq("id", id);
  if (error) throw error;
}

// --- Classes (rattachées à un niveau et à l'année courante) ---
export async function getClasses(ecoleId, anneeId) {
  let q = supabase.from("classes").select("*").eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q.order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerClasse(ecoleId, niveauId, anneeId, libelle, effectifMax, serieId = null) {
  const { data, error } = await supabase
    .from("classes")
    .insert({
      ecole_id: ecoleId,
      niveau_id: niveauId,
      annee_id: anneeId,
      libelle,
      effectif_max: effectifMax || null,
      serie_id: serieId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerClasse(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

// Crée plusieurs classes d'un coup (génération en lot).
export async function creerClassesEnLot(ecoleId, niveauId, anneeId, libelles, effectifMax, serieId = null) {
  const lignes = libelles.map((libelle) => ({
    ecole_id: ecoleId,
    niveau_id: niveauId,
    annee_id: anneeId,
    libelle,
    effectif_max: effectifMax || null,
    serie_id: serieId || null,
  }));
  if (lignes.length === 0) return [];
  const { data, error } = await supabase.from("classes").insert(lignes).select();
  if (error) throw error;
  return data ?? [];
}

// --- Matières ---
export async function getMatieres(ecoleId) {
  const { data, error } = await supabase
    .from("matieres")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerMatiere(ecoleId, libelle, code, cycleId) {
  const { data, error } = await supabase
    .from("matieres")
    .insert({ ecole_id: ecoleId, libelle, code: code || null, cycle_id: cycleId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerMatiere(id) {
  const { error } = await supabase.from("matieres").delete().eq("id", id);
  if (error) throw error;
}

// --- Séries (lycée : L, S2, G…) ---
export async function getSeries(ecoleId) {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("ordre")
    .order("code");
  if (error) throw error;
  return data ?? [];
}

export async function creerSerie(ecoleId, code, libelle, ordre) {
  const { data, error } = await supabase
    .from("series")
    .insert({ ecole_id: ecoleId, code, libelle, ordre: ordre ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerSerie(id) {
  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) throw error;
}

// Séries standard du Sénégal (pré-remplissage modifiable).
export const SERIES_STANDARD = [
  ["L", "Littéraire"],
  ["L1", "Littéraire 1"],
  ["L2", "Littéraire 2"],
  ["S1", "Scientifique 1"],
  ["S2", "Scientifique 2"],
  ["S3", "Scientifique 3"],
  ["G", "Gestion (STEG)"],
  ["STIDD", "Sciences & Techniques Industrielles"],
];

// Insère les séries standard absentes (ne touche pas aux existantes).
export async function semerSeriesStandard(ecoleId, existantes = []) {
  const codes = new Set(existantes.map((s) => s.code));
  const lignes = SERIES_STANDARD.filter(([code]) => !codes.has(code)).map(([code, libelle], i) => ({
    ecole_id: ecoleId,
    code,
    libelle,
    ordre: i + 1,
  }));
  if (lignes.length === 0) return [];
  const { data, error } = await supabase.from("series").insert(lignes).select();
  if (error) throw error;
  return data ?? [];
}

// --- Grille de coefficients (matière × série OU matière × niveau) ---
export async function getCoefficients(ecoleId) {
  const { data, error } = await supabase
    .from("coefficients_matieres")
    .select("*")
    .eq("ecole_id", ecoleId);
  if (error) throw error;
  return data ?? [];
}

// Définit (upsert) le coefficient d'une matière pour une portée (niveau OU série).
// coefficient null/0 → supprime la ligne.
export async function definirCoefficient(ecoleId, { matiereId, niveauId = null, serieId = null, coefficient }) {
  let q = supabase
    .from("coefficients_matieres")
    .select("id")
    .eq("ecole_id", ecoleId)
    .eq("matiere_id", matiereId);
  q = niveauId ? q.eq("niveau_id", niveauId) : q.eq("serie_id", serieId);
  const { data: existant, error: e1 } = await q.maybeSingle();
  if (e1) throw e1;

  const coef = Number(coefficient);
  if (!coef || coef <= 0) {
    if (existant) {
      const { error } = await supabase.from("coefficients_matieres").delete().eq("id", existant.id);
      if (error) throw error;
    }
    return;
  }
  if (existant) {
    const { error } = await supabase
      .from("coefficients_matieres")
      .update({ coefficient: coef })
      .eq("id", existant.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("coefficients_matieres").insert({
      ecole_id: ecoleId,
      matiere_id: matiereId,
      niveau_id: niveauId,
      serie_id: serieId,
      coefficient: coef,
    });
    if (error) throw error;
  }
}

// --- Configuration du matricule (par école) ---
export async function getConfigEcole(ecoleId) {
  const { data, error } = await supabase
    .from("ecoles")
    .select("id, nom, sigle, matricule_prefixe, matricule_separateur, matricule_longueur")
    .eq("id", ecoleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Met à jour le profil de l'école (réservé admin_ecole par la RLS).
export async function majEcole(ecoleId, champs) {
  const { error } = await supabase.from("ecoles").update(champs).eq("id", ecoleId);
  if (error) throw error;
}

// Téléverse un visuel de l'école (logo, cachet, signature) → bucket public 'ecoles'.
export async function televerserAsset(ecoleId, file, prefixe = "asset") {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const chemin = `${ecoleId}/${prefixe}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("ecoles").upload(chemin, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from("ecoles").getPublicUrl(chemin).data.publicUrl;
}

// Signataires de l'école (responsables + signature), stockés dans parametres.
export async function getSignataires(ecoleId) {
  const { data, error } = await supabase
    .from("parametres").select("valeur")
    .eq("ecole_id", ecoleId).eq("cle", "signataires").maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.valeur) ? data.valeur : [];
}

export async function setSignataires(ecoleId, liste) {
  const { error } = await supabase
    .from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "signataires", valeur: liste }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Champs personnalisés de la fiche élève (définis par l'école).
// Chaque champ : { cle, libelle, type: 'texte'|'nombre'|'date'|'liste', options?: [] }
export async function getChampsEleve(ecoleId) {
  const { data, error } = await supabase
    .from("parametres").select("valeur")
    .eq("ecole_id", ecoleId).eq("cle", "champs_eleve").maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.valeur) ? data.valeur : [];
}

export async function setChampsEleve(ecoleId, liste) {
  const { error } = await supabase
    .from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "champs_eleve", valeur: liste }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

export async function majConfigMatricule(ecoleId, { prefixe, separateur, longueur, annee }) {
  const an = String(annee ?? "").replace(/\D/g, "");
  const { error } = await supabase
    .from("ecoles")
    .update({
      matricule_prefixe: prefixe || null,
      matricule_separateur: separateur || "-",
      matricule_longueur: Math.max(1, Number(longueur) || 4),
      matricule_annee: an ? Number(an) : null, // vide = année civile automatique
    })
    .eq("id", ecoleId);
  if (error) throw error;
}

// Génère le prochain matricule (séquence atomique côté serveur).
export async function genererMatricule() {
  const { data, error } = await supabase.rpc("prochain_matricule");
  if (error) throw error;
  return data;
}

// --- Fournitures scolaires (par niveau) ---
export async function getFournitures(ecoleId) {
  const { data, error } = await supabase
    .from("fournitures")
    .select("*, niveaux(libelle)")
    .eq("ecole_id", ecoleId)
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerFourniture(ecoleId, f) {
  const { data, error } = await supabase
    .from("fournitures")
    .insert({
      ecole_id: ecoleId,
      niveau_id: f.niveau_id || null,
      libelle: f.libelle,
      quantite: Number(f.quantite) || 1,
      obligatoire: f.obligatoire ?? true,
      note: f.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerFourniture(id) {
  const { error } = await supabase.from("fournitures").delete().eq("id", id);
  if (error) throw error;
}
