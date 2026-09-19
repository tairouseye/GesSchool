import { supabase } from "@/lib/supabase.js";
import { bornesPagination, PLAFOND_LOT } from "@/lib/pagination.js";

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

// Convertit une valeur importée selon le type du champ personnalisé.
function coercerChampPerso(type, v) {
  const s = (v ?? "").toString().trim();
  if (s === "") return undefined;
  if (type === "nombre") { const n = Number(s.replace(/\s/g, "").replace(",", ".")); return isNaN(n) ? undefined : n; }
  if (type === "date") return normDate(v) || undefined;
  return s; // texte / liste
}

// Import en masse : crée les élèves (+ inscriptions si la classe correspond).
// lignes: [{ prenom, nom, sexe, date_naissance, lieu_naissance, matricule, classe, champs_perso }]
// champs : définitions des champs personnalisés de l'école (pour typer champs_perso).
export async function importerEleves(ecoleId, anneeId, lignes, classes, sigle, champs = []) {
  const parClasse = {};
  for (const c of classes) parClasse[(c.libelle || "").trim().toLowerCase()] = c.id;
  const typeParCle = {};
  for (const c of champs) typeParCle[c.cle] = c.type;
  let crees = 0, ignores = 0, inscrits = 0, tuteurs = 0;
  for (const r of lignes) {
    const prenom = (r.prenom || "").toString().trim();
    const nom = (r.nom || "").toString().trim();
    if (!prenom || !nom) { ignores++; continue; }
    let matricule = (r.matricule || "").toString().trim();
    if (!matricule) { try { matricule = await genererMatricule(ecoleId, sigle); } catch { matricule = null; } }
    // Construit champs_perso typé à partir des colonnes mappées.
    const champsPerso = {};
    for (const [cle, brut] of Object.entries(r.champs_perso || {})) {
      const val = coercerChampPerso(typeParCle[cle], brut);
      if (val !== undefined) champsPerso[cle] = val;
    }
    const eleve = await creerEleve(ecoleId, {
      matricule: matricule || null,
      prenom, nom,
      sexe: normSexe(r.sexe),
      date_naissance: normDate(r.date_naissance),
      lieu_naissance: (r.lieu_naissance || "").toString().trim() || null,
      ...(Object.keys(champsPerso).length ? { champs_perso: champsPerso } : {}),
    });
    crees++;
    const cid = r.classe ? parClasse[r.classe.toString().trim().toLowerCase()] : null;
    if (cid && anneeId) { try { await inscrire(ecoleId, eleve.id, cid, anneeId); inscrits++; } catch { /* ignore */ } }
    // Parent / tuteur (optionnel) : crée le tuteur et le lie à l'élève.
    const pNom = (r.parent_nom || "").toString().trim();
    if (pNom) {
      const mots = pNom.split(/\s+/);
      const prenomT = mots.length > 1 ? mots[0] : "";
      const nomT = mots.length > 1 ? mots.slice(1).join(" ") : mots[0];
      try {
        await ajouterTuteur(
          ecoleId, eleve.id,
          { prenom: prenomT, nom: nomT, telephone: (r.parent_tel || "").toString().trim() || null },
          { lien_parente: "Parent", responsable_legal: true, responsable_paiement: true }
        );
        tuteurs++;
      } catch { /* ignore */ }
    }
  }
  return { crees, ignores, inscrits, tuteurs };
}

// Liste des élèves — PAGINÉE ET FILTRÉE CÔTÉ SERVEUR.
//
// L'inscription de l'année est embarquée dans la même requête (`!left`),
// ce qui supprime au passage un second chargement complet de la table
// `inscriptions`. Les filtres classe et statut portent sur cette inscription :
// ils DOIVENT donc s'exécuter en base, sinon filtrer sur une page ne
// filtrerait que 25 lignes sur 10 000.
//
// `statut = "non_inscrit"` est le cas retors : il faut une jointure GAUCHE
// bornée à l'année, puis tester l'absence. Vérifié sur la base réelle —
// avec une année sans inscription, les 96 élèves ressortent bien.
const SEL_ELEVE = "*, inscriptions!{J}(id, classe_id, statut)";

function requeteEleves(ecoleId, { anneeId, q, classeId, statut, classesAutorisees } = {}) {
  const nonInscrit = statut === "non_inscrit";
  // Jointure interne dès qu'un critère porte sur l'inscription : sans elle,
  // les élèves sans inscription remonteraient malgré le filtre.
  const interne = !nonInscrit && (classeId || (statut && statut !== "non_inscrit") || classesAutorisees);
  let req = supabase
    .from("eleves")
    .select(SEL_ELEVE.replace("{J}", interne ? "inner" : "left"), { count: "exact" })
    .eq("ecole_id", ecoleId);

  if (anneeId) req = req.eq("inscriptions.annee_id", anneeId);
  if (nonInscrit) req = req.is("inscriptions", null);
  if (classeId) req = req.eq("inscriptions.classe_id", classeId);
  if (statut && !nonInscrit) req = req.eq("inscriptions.statut", statut);
  if (classesAutorisees) req = req.in("inscriptions.classe_id", classesAutorisees);
  if ((q || "").trim()) {
    const m = q.trim().replace(/[%,()]/g, "");   // caractères réservés du filtre PostgREST
    req = req.or(`prenom.ilike.*${m}*,nom.ilike.*${m}*,matricule.ilike.*${m}*`);
  }
  return req.order("nom").order("prenom");
}

export async function getEleves(ecoleId, options = {}) {
  const { page = 0, taille = 25 } = options;
  const { debut, fin } = bornesPagination(page, taille);
  const { data, error, count } = await requeteEleves(ecoleId, options).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0 };
}

// Lot complet pour la feuille de présence imprimable et les envois en masse.
// Borné : on ne charge pas tout, mais assez pour une classe ou un niveau.
// `complet` dit à l'appelant si le plafond a tronqué le résultat, afin qu'il
// puisse le signaler au lieu d'imprimer une liste incomplète en silence.
export async function getElevesLot(ecoleId, options = {}) {
  const { data, error, count } = await requeteEleves(ecoleId, options).range(0, PLAFOND_LOT - 1);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, complet: (count ?? 0) <= PLAFOND_LOT };
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
    .select("id, lien_parente, responsable_legal, responsable_paiement, tuteurs(id, prenom, nom, telephone, email, profession, profil_id)")
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
