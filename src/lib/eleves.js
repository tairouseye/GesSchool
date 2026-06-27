import { supabase } from "@/lib/supabase.js";

// GesSchool — couche d'accès « élèves & inscriptions ».
// Écritures avec ecole_id (RLS = ecole_courante()).

// Génère le prochain matricule.
// Priorité : format configuré par l'école (RPC serveur, séquence atomique).
// Repli (config/migration absente) : SIGLE-ANNÉE-NNNN basé sur le comptage.
export async function genererMatricule(ecoleId, sigle) {
  const { data, error } = await supabase.rpc("prochain_matricule");
  if (!error && data) return data;

  const { count } = await supabase
    .from("eleves")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecoleId);
  const code = (sigle || "ELV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "ELV";
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `${code}-${new Date().getFullYear()}-${seq}`;
}

// Normalise le sexe importé.
function normSexe(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (["m", "masculin", "garçon", "garcon", "homme"].includes(s)) return "M";
  if (["f", "féminin", "feminin", "fille", "femme"].includes(s)) return "F";
  return null;
}

// Normalise une date importée (Date Excel, "jj/mm/aaaa" ou "aaaa-mm-jj") → ISO.
function normDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = v.toString().trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

// Import en masse : crée les élèves (+ inscriptions si la classe correspond).
// lignes: [{ prenom, nom, sexe, date_naissance, lieu_naissance, matricule, classe }]
export async function importerEleves(ecoleId, anneeId, lignes, classes, sigle) {
  const parClasse = {};
  for (const c of classes) parClasse[(c.libelle || "").trim().toLowerCase()] = c.id;
  let crees = 0, ignores = 0, inscrits = 0;
  for (const r of lignes) {
    const prenom = (r.prenom || "").toString().trim();
    const nom = (r.nom || "").toString().trim();
    if (!prenom || !nom) { ignores++; continue; }
    let matricule = (r.matricule || "").toString().trim();
    if (!matricule) { try { matricule = await genererMatricule(ecoleId, sigle); } catch { matricule = null; } }
    const eleve = await creerEleve(ecoleId, {
      matricule: matricule || null,
      prenom, nom,
      sexe: normSexe(r.sexe),
      date_naissance: normDate(r.date_naissance),
      lieu_naissance: (r.lieu_naissance || "").toString().trim() || null,
    });
    crees++;
    const cid = r.classe ? parClasse[r.classe.toString().trim().toLowerCase()] : null;
    if (cid && anneeId) { try { await inscrire(ecoleId, eleve.id, cid, anneeId); inscrits++; } catch { /* ignore */ } }
  }
  return { crees, ignores, inscrits };
}

export async function getEleves(ecoleId) {
  const { data, error } = await supabase
    .from("eleves")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function getEleve(id) {
  const { data, error } = await supabase.from("eleves").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function creerEleve(ecoleId, e) {
  const { data, error } = await supabase
    .from("eleves")
    .insert({ ecole_id: ecoleId, ...e })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majEleve(id, e) {
  const { data, error } = await supabase.from("eleves").update(e).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerEleve(id) {
  const { error } = await supabase.from("eleves").delete().eq("id", id);
  if (error) throw error;
}

// Téléverse une photo dans le bucket privé 'eleves' et renvoie son CHEMIN
// (l'affichage se fait via une URL signée, cf. composant Photo).
export async function televerserPhoto(ecoleId, eleveId, file) {
  const ext = file.name.split(".").pop();
  const chemin = `${ecoleId}/${eleveId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("eleves").upload(chemin, file, { upsert: true });
  if (error) throw error;
  return chemin;
}

// --- Inscriptions ---
// Inscriptions de l'année courante, indexées par eleve_id (avec libellé de classe).
export async function getInscriptionsParEleve(ecoleId, anneeId) {
  if (!anneeId) return {};
  const { data, error } = await supabase
    .from("inscriptions")
    .select("id, eleve_id, statut, classe_id, classes(libelle)")
    .eq("ecole_id", ecoleId)
    .eq("annee_id", anneeId);
  if (error) throw error;
  const map = {};
  for (const i of data ?? []) map[i.eleve_id] = i;
  return map;
}

export async function getInscriptionsEleve(eleveId) {
  const { data, error } = await supabase
    .from("inscriptions")
    .select("id, statut, date_inscription, redoublant, classe_id, classes(libelle), annee_id, annees_scolaires(libelle)")
    .eq("eleve_id", eleveId)
    .order("date_inscription", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function inscrire(ecoleId, eleveId, classeId, anneeId, statut = "inscrit", redoublant = false) {
  const { data, error } = await supabase
    .from("inscriptions")
    .upsert(
      { ecole_id: ecoleId, eleve_id: eleveId, classe_id: classeId, annee_id: anneeId, statut, redoublant },
      { onConflict: "eleve_id,annee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Tuteurs ---
export async function getTuteursEleve(eleveId) {
  const { data, error } = await supabase
    .from("eleve_tuteurs")
    .select("id, lien_parente, responsable_legal, responsable_paiement, tuteurs(id, prenom, nom, telephone, email, profession)")
    .eq("eleve_id", eleveId);
  if (error) throw error;
  return data ?? [];
}

export async function ajouterTuteur(ecoleId, eleveId, t, lien) {
  const { data: tuteur, error: e1 } = await supabase
    .from("tuteurs")
    .insert({
      ecole_id: ecoleId,
      prenom: t.prenom,
      nom: t.nom,
      telephone: t.telephone || null,
      email: t.email || null,
      profession: t.profession || null,
    })
    .select()
    .single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("eleve_tuteurs").insert({
    ecole_id: ecoleId,
    eleve_id: eleveId,
    tuteur_id: tuteur.id,
    lien_parente: lien?.lien_parente || null,
    responsable_legal: lien?.responsable_legal ?? true,
    responsable_paiement: lien?.responsable_paiement ?? true,
  });
  if (e2) throw e2;
  return tuteur;
}

export async function retirerLienTuteur(lienId) {
  const { error } = await supabase.from("eleve_tuteurs").delete().eq("id", lienId);
  if (error) throw error;
}
