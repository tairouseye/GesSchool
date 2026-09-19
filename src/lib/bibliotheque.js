import { supabase } from "@/lib/supabase.js";
import { urlSignee } from "@/lib/stockage.js";
import {
  calculerEcheance, verifierEmprunt, verifierRenouvellement, bornesPagination, rangSuivant,
} from "@/lib/biblio.regles.js";

// GesSchool — Bibliothèque universitaire : accès aux données.
//
// Particularités assumées de ce module (vs le reste du projet) :
//  • PAGINATION SERVEUR (`.range()`) et RECHERCHE SERVEUR (plein texte via
//    l'index GIN `biblio_ressources.recherche`) : le catalogue peut atteindre
//    des centaines de milliers de notices, on ne charge JAMAIS tout.
//  • Les fichiers vivent dans un bucket PRIVÉ ; on ne manipule que des chemins,
//    la lecture passe par une URL signée (la policy Storage applique en plus
//    la règle d'accès propre à chaque document).

export const BUCKET = "bibliotheque";

// Types proposés par l'UI. `type_ressource` est un texte libre en base : on
// peut en ajouter sans migration.
export const TYPES = [
  ["livre", "Livre"], ["ebook", "E-book"], ["article", "Article scientifique"],
  ["revue", "Revue"], ["journal", "Journal"], ["memoire", "Mémoire"], ["these", "Thèse"],
  ["rapport", "Rapport"], ["communication", "Communication scientifique"],
  ["actes", "Actes de conférence"], ["manuel", "Manuel"], ["support", "Support pédagogique"],
  ["dictionnaire", "Dictionnaire"], ["encyclopedie", "Encyclopédie"],
  ["institutionnel", "Document institutionnel"], ["archive", "Archive"],
  ["multimedia", "Ressource multimédia"], ["externe", "Ressource externe"],
];

export const LICENCES = [
  ["inconnue", "Licence inconnue"], ["tous_droits", "Tous droits réservés"],
  ["institutionnelle", "Licence institutionnelle"], ["creative_commons", "Creative Commons"],
  ["open_access", "Open Access"], ["domaine_public", "Domaine public"],
];

export const NIVEAUX_ACCES = [
  ["institution", "Tout l'établissement"],
  ["cible", "Ciblé (faculté / filière / niveau / rôle)"],
  ["restreint", "Restreint (gestion uniquement)"],
];

export const ETATS = [["neuf", "Neuf"], ["bon", "Bon"], ["use", "Usagé"], ["abime", "Abîmé"], ["perdu", "Perdu"]];
export const STATUTS_EXEMPLAIRE = {
  disponible: "Disponible", emprunte: "Emprunté", reserve: "Réservé", retire: "Retiré", perdu: "Perdu",
};
export const CATEGORIES_FICHIER = ["ouvrages", "articles", "theses", "memoires", "publications", "couvertures", "multimedia"];

const auj = () => new Date().toISOString().slice(0, 10);

// =====================================================================
//  CATALOGUE — recherche + pagination SERVEUR
// =====================================================================

// Renvoie { lignes, total, page, taille }. `q` utilise l'index plein texte.
export async function getRessources(ecoleId, { q, type, discipline, visibleSeulement = false, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase
    .from("biblio_ressources")
    .select(
      "id, titre, sous_titre, type_ressource, annee_pub, editeur, discipline, mots_cles, couverture_chemin, visible, created_at," +
      " biblio_ressource_auteurs(role, ordre, biblio_auteurs(id, nom, prenom))",
      { count: "exact" },
    )
    .eq("ecole_id", ecoleId);

  if (type) req = req.eq("type_ressource", type);
  if (discipline) req = req.eq("discipline", discipline);
  if (visibleSeulement) req = req.eq("visible", true);
  const terme = (q || "").trim();
  if (terme) req = req.textSearch("recherche", terme, { type: "websearch", config: "french" });

  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}

// Disponibilité par notice (une seule requête pour toute la page affichée).
export async function statsExemplaires(ecoleId, ressourceIds) {
  if (!ressourceIds?.length) return {};
  const { data, error } = await supabase
    .from("biblio_exemplaires")
    .select("ressource_id, statut")
    .eq("ecole_id", ecoleId)
    .in("ressource_id", ressourceIds);
  if (error) throw error;
  const out = {};
  for (const e of data ?? []) {
    const s = (out[e.ressource_id] ||= { total: 0, disponibles: 0 });
    s.total += 1;
    if (e.statut === "disponible") s.disponibles += 1;
  }
  return out;
}

export async function getRessource(id) {
  const { data, error } = await supabase
    .from("biblio_ressources")
    .select("*, biblio_ressource_auteurs(id, role, ordre, auteur_id, biblio_auteurs(id, nom, prenom, affiliation))," +
            " biblio_exemplaires(*), biblio_numeriques(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function creerRessource(ecoleId, r) {
  const { data, error } = await supabase.from("biblio_ressources")
    .insert({ ecole_id: ecoleId, ...r }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierRessource(id, r) {
  const { error } = await supabase.from("biblio_ressources").update(r).eq("id", id);
  if (error) throw error;
}
export async function supprimerRessource(id) {
  const { error } = await supabase.from("biblio_ressources").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
//  AUTEURS
// =====================================================================
export async function getAuteurs(ecoleId, { q, page = 0, taille = 50 } = {}) {
  const { debut, fin } = bornesPagination(page, taille);
  let req = supabase.from("biblio_auteurs").select("*", { count: "exact" }).eq("ecole_id", ecoleId);
  if ((q || "").trim()) req = req.or(`nom.ilike.%${q.trim()}%,prenom.ilike.%${q.trim()}%`);
  const { data, error, count } = await req.order("nom").order("prenom").range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0 };
}
export async function creerAuteur(ecoleId, a) {
  const { data, error } = await supabase.from("biblio_auteurs").insert({ ecole_id: ecoleId, ...a }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierAuteur(id, a) {
  const { error } = await supabase.from("biblio_auteurs").update(a).eq("id", id);
  if (error) throw error;
}
export async function supprimerAuteur(id) {
  const { error } = await supabase.from("biblio_auteurs").delete().eq("id", id);
  if (error) throw error;
}
export async function lierAuteur(ecoleId, ressourceId, auteurId, role = "auteur", ordre = 0) {
  const { error } = await supabase.from("biblio_ressource_auteurs")
    .insert({ ecole_id: ecoleId, ressource_id: ressourceId, auteur_id: auteurId, role, ordre });
  if (error) throw error;
}
export async function delierAuteur(liaisonId) {
  const { error } = await supabase.from("biblio_ressource_auteurs").delete().eq("id", liaisonId);
  if (error) throw error;
}

// =====================================================================
//  BIBLIOTHÈQUES & LOCALISATIONS
// =====================================================================
export async function getBibliotheques(ecoleId) {
  const { data, error } = await supabase.from("biblio_bibliotheques").select("*")
    .eq("ecole_id", ecoleId).order("ordre").order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function creerBibliotheque(ecoleId, b) {
  const { data, error } = await supabase.from("biblio_bibliotheques").insert({ ecole_id: ecoleId, ...b }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierBibliotheque(id, b) {
  const { error } = await supabase.from("biblio_bibliotheques").update(b).eq("id", id);
  if (error) throw error;
}
export async function supprimerBibliotheque(id) {
  const { error } = await supabase.from("biblio_bibliotheques").delete().eq("id", id);
  if (error) throw error;
}
export async function getLocalisations(ecoleId, bibliothequeId) {
  let req = supabase.from("biblio_localisations").select("*").eq("ecole_id", ecoleId);
  if (bibliothequeId) req = req.eq("bibliotheque_id", bibliothequeId);
  const { data, error } = await req.order("type").order("libelle");
  if (error) throw error;
  return data ?? [];
}
export async function creerLocalisation(ecoleId, l) {
  const { data, error } = await supabase.from("biblio_localisations").insert({ ecole_id: ecoleId, ...l }).select().single();
  if (error) throw error;
  return data;
}
export async function supprimerLocalisation(id) {
  const { error } = await supabase.from("biblio_localisations").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
//  EXEMPLAIRES
// =====================================================================
export async function creerExemplaire(ecoleId, ressourceId, e) {
  const { data, error } = await supabase.from("biblio_exemplaires")
    .insert({ ecole_id: ecoleId, ressource_id: ressourceId, ...e }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierExemplaire(id, e) {
  const { error } = await supabase.from("biblio_exemplaires").update(e).eq("id", id);
  if (error) throw error;
}
export async function supprimerExemplaire(id) {
  const { error } = await supabase.from("biblio_exemplaires").delete().eq("id", id);
  if (error) throw error;
}
// Recherche d'un exemplaire par code-barres (poste de circulation / scan).
export async function exemplaireParCode(ecoleId, code) {
  const { data, error } = await supabase.from("biblio_exemplaires")
    .select("*, biblio_ressources(id, titre, type_ressource)")
    .eq("ecole_id", ecoleId).eq("code_barres", code).maybeSingle();
  if (error) throw error;
  return data;
}

// =====================================================================
//  RÈGLES DE PRÊT
// =====================================================================
export async function getRegles(ecoleId) {
  const { data, error } = await supabase.from("biblio_regles_pret").select("*")
    .eq("ecole_id", ecoleId).order("role");
  if (error) throw error;
  return data ?? [];
}
export async function enregistrerRegle(ecoleId, r) {
  const { error } = await supabase.from("biblio_regles_pret")
    .upsert({ ecole_id: ecoleId, ...r }, { onConflict: "ecole_id,role" });
  if (error) throw error;
}
export async function supprimerRegle(id) {
  const { error } = await supabase.from("biblio_regles_pret").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
//  CIRCULATION
// =====================================================================

// Emprunts en cours d'un usager (+ combien sont en retard).
export async function situationEmprunteur(ecoleId, { profilId, eleveId }) {
  let req = supabase.from("biblio_emprunts")
    .select("id, date_echeance, statut").eq("ecole_id", ecoleId).eq("statut", "en_cours");
  req = profilId ? req.eq("emprunteur_profil_id", profilId) : req.eq("emprunteur_eleve_id", eleveId);
  const { data, error } = await req;
  if (error) throw error;
  const today = auj();
  const enCours = (data ?? []).length;
  const retards = (data ?? []).filter((e) => e.date_echeance < today).length;
  return { enCours, retards };
}

// Enregistre un prêt après contrôle des règles. Lève une erreur explicite si refusé.
export async function emprunter(ecoleId, { exemplaireId, profilId = null, eleveId = null, role, agentId = null }) {
  const regles = await getRegles(ecoleId);
  const regle = regles.find((r) => r.role === role && r.actif !== false) || null;
  const { enCours, retards } = await situationEmprunteur(ecoleId, { profilId, eleveId });
  const controle = verifierEmprunt({ empruntsEnCours: enCours, retardsEnCours: retards, regle });
  if (!controle.ok) throw new Error(controle.motif);

  const date_emprunt = auj();
  const { data, error } = await supabase.from("biblio_emprunts").insert({
    ecole_id: ecoleId, exemplaire_id: exemplaireId,
    emprunteur_profil_id: profilId, emprunteur_eleve_id: eleveId,
    date_emprunt, date_echeance: calculerEcheance(date_emprunt, regle.duree_jours),
    agent_profil_id: agentId,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function rendre(empruntId) {
  const { error } = await supabase.from("biblio_emprunts")
    .update({ statut: "rendu", date_retour: auj() }).eq("id", empruntId);
  if (error) throw error;
}

export async function renouveler(ecoleId, emprunt, role) {
  const regles = await getRegles(ecoleId);
  const regle = regles.find((r) => r.role === role && r.actif !== false) || null;
  const c = verifierRenouvellement({ emprunt, regle, aujourdhui: auj() });
  if (!c.ok) throw new Error(c.motif);
  const { error } = await supabase.from("biblio_emprunts")
    .update({ date_echeance: c.nouvelleEcheance, renouvellements: (Number(emprunt.renouvellements) || 0) + 1 })
    .eq("id", emprunt.id);
  if (error) throw error;
  return c.nouvelleEcheance;
}

// Liste paginée des emprunts (gestion). `statut` : en_cours | rendu | retard…
export async function getEmprunts(ecoleId, { statut = "en_cours", enRetard = false, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase.from("biblio_emprunts")
    .select("*, biblio_exemplaires(code_barres, cote, biblio_ressources(titre))," +
            " profils:emprunteur_profil_id(prenom, nom), eleves:emprunteur_eleve_id(prenom, nom, matricule)",
            { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (statut) req = req.eq("statut", statut);
  if (enRetard) req = req.lt("date_echeance", auj());
  const { data, error, count } = await req.order("date_echeance").range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}

// Recherche d'un emprunteur — bornée côté serveur (jamais toute la table).
export async function chercherEtudiants(ecoleId, q, limite = 15) {
  const t = (q || "").trim();
  if (t.length < 2) return [];
  const { data, error } = await supabase.from("eleves")
    .select("id, prenom, nom, matricule, profil_id")
    .eq("ecole_id", ecoleId)
    .or(`nom.ilike.%${t}%,prenom.ilike.%${t}%,matricule.ilike.%${t}%`)
    .order("nom").limit(limite);
  if (error) throw error;
  return data ?? [];
}
export async function chercherPersonnels(ecoleId, q, limite = 15) {
  const t = (q || "").trim();
  if (t.length < 2) return [];
  const { data, error } = await supabase.from("personnels")
    .select("id, prenom, nom, fonction, profil_id")
    .eq("ecole_id", ecoleId)
    .or(`nom.ilike.%${t}%,prenom.ilike.%${t}%`)
    .order("nom").limit(limite);
  if (error) throw error;
  return data ?? [];
}

// Emprunt en cours portant sur un exemplaire donné (pour le retour).
export async function empruntActifParExemplaire(ecoleId, exemplaireId) {
  const { data, error } = await supabase.from("biblio_emprunts")
    .select("*, profils:emprunteur_profil_id(prenom, nom), eleves:emprunteur_eleve_id(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId).eq("exemplaire_id", exemplaireId).eq("statut", "en_cours")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Emprunts de l'utilisateur connecté (espace étudiant / enseignant).
export async function mesEmprunts() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase.from("biblio_emprunts")
    .select("*, biblio_exemplaires(code_barres, cote, biblio_ressources(id, titre, type_ressource))")
    .order("date_echeance");
  if (error) throw error;
  return data ?? [];   // la RLS ne renvoie que les siens
}

// =====================================================================
//  RÉSERVATIONS
// =====================================================================
export async function reserver(ecoleId, ressourceId, profilId) {
  const { data: actives, error: eA } = await supabase.from("biblio_reservations")
    .select("rang, statut").eq("ressource_id", ressourceId).in("statut", ["active", "disponible"]);
  if (eA) throw eA;
  const { data, error } = await supabase.from("biblio_reservations").insert({
    ecole_id: ecoleId, ressource_id: ressourceId, profil_id: profilId, rang: rangSuivant(actives ?? []),
  }).select().single();
  if (error) throw error;
  return data;
}
export async function annulerReservation(id) {
  const { error } = await supabase.from("biblio_reservations").update({ statut: "annulee" }).eq("id", id);
  if (error) throw error;
}
export async function mesReservations() {
  const { data, error } = await supabase.from("biblio_reservations")
    .select("*, biblio_ressources(id, titre)")
    .in("statut", ["active", "disponible"]).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];   // RLS : les siennes uniquement
}

// =====================================================================
//  FAVORIS
// =====================================================================
export async function mesFavoris() {
  const { data, error } = await supabase.from("biblio_favoris")
    .select("id, ressource_id, biblio_ressources(id, titre, type_ressource, annee_pub)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function basculerFavori(ecoleId, ressourceId, profilId, actuelId = null) {
  if (actuelId) {
    const { error } = await supabase.from("biblio_favoris").delete().eq("id", actuelId);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase.from("biblio_favoris")
    .insert({ ecole_id: ecoleId, ressource_id: ressourceId, profil_id: profilId }).select().single();
  if (error) throw error;
  return data;
}

// =====================================================================
//  NUMÉRIQUE (bucket privé + URL signée)
// =====================================================================

// Téléverse un document dans le bucket PRIVÉ. Renvoie les métadonnées du
// fichier (le chemin, jamais une URL publique).
export async function televerserDocument(ecoleId, file, categorie = "ouvrages") {
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  const cat = CATEGORIES_FICHIER.includes(categorie) ? categorie : "ouvrages";
  const chemin = `${ecoleId}/${cat}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, file, { upsert: false });
  if (error) throw error;
  return { chemin, nom: file.name, taille: file.size, mime: file.type || null, format: ext };
}

// URL signée (1 h). La policy Storage applique EN PLUS la règle d'accès du document.
export const lienDocument = (chemin) => urlSignee(BUCKET, chemin, 3600);

export async function creerNumerique(ecoleId, ressourceId, n) {
  const { data, error } = await supabase.from("biblio_numeriques")
    .insert({ ecole_id: ecoleId, ressource_id: ressourceId, ...n }).select().single();
  if (error) throw error;
  return data;
}
export async function modifierNumerique(id, n) {
  const { error } = await supabase.from("biblio_numeriques").update(n).eq("id", id);
  if (error) throw error;
}
export async function supprimerNumerique(id, chemin) {
  const { error } = await supabase.from("biblio_numeriques").delete().eq("id", id);
  if (error) throw error;
  if (chemin) await supabase.storage.from(BUCKET).remove([chemin]).catch(() => {});
}

// Règles d'accès ciblé d'un document.
export async function getReglesAcces(numeriqueId) {
  const { data, error } = await supabase.from("biblio_acces_regles").select("*").eq("numerique_id", numeriqueId);
  if (error) throw error;
  return data ?? [];
}
export async function ajouterRegleAcces(ecoleId, numeriqueId, r) {
  const { error } = await supabase.from("biblio_acces_regles").insert({ ecole_id: ecoleId, numerique_id: numeriqueId, ...r });
  if (error) throw error;
}
export async function retirerRegleAcces(id) {
  const { error } = await supabase.from("biblio_acces_regles").delete().eq("id", id);
  if (error) throw error;
}

// Journal (best-effort : ne bloque jamais l'action principale).
export async function journaliser(ecoleId, profilId, action, cible_type, cible_id, details = null) {
  try {
    await supabase.from("biblio_journal").insert({ ecole_id: ecoleId, profil_id: profilId, action, cible_type, cible_id, details });
  } catch { /* ignoré */ }
}
