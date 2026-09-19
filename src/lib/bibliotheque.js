import { supabase } from "@/lib/supabase.js";
import { urlSignee } from "@/lib/stockage.js";
import {
  calculerEcheance, verifierEmprunt, verifierRenouvellement, bornesPagination,
  calculerPenalite, joursRetard,
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
// Supprimer la notice efface ses documents en base par cascade, mais PAS les
// fichiers du bucket : on relève les chemins AVANT de supprimer, sinon ils
// deviennent introuvables et occupent le stockage indéfiniment.
export async function supprimerRessource(id) {
  const { data: n } = await supabase.from("biblio_numeriques")
    .select("fichier_chemin").eq("ressource_id", id);
  const { data: r } = await supabase.from("biblio_ressources")
    .select("couverture_chemin").eq("id", id).maybeSingle();

  const { error } = await supabase.from("biblio_ressources").delete().eq("id", id);
  if (error) throw error;

  const chemins = [...(n ?? []).map((x) => x.fichier_chemin), r?.couverture_chemin].filter(Boolean);
  // Le nettoyage ne doit jamais faire échouer une suppression déjà effectuée.
  if (chemins.length) await supabase.storage.from(BUCKET).remove(chemins);
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
  journaliser(ecoleId, "pret", "emprunt", data.id, { exemplaire_id: exemplaireId, role });
  return data;
}

// Retour d'un exemplaire. Renvoie la pénalité de retard SUGGÉRÉE — jamais
// créée d'office : le bibliothécaire tranche (geste commercial, cas de force
// majeure…), et une école peut désactiver les pénalités par rôle.
export async function rendre(empruntId, { ecoleId, emprunt, role } = {}) {
  const dateRetour = auj();
  const { error } = await supabase.from("biblio_emprunts")
    .update({ statut: "rendu", date_retour: dateRetour }).eq("id", empruntId);
  if (error) throw error;

  if (!ecoleId) return null;
  journaliser(ecoleId, "retour", "emprunt", empruntId, { date_retour: dateRetour });

  if (!emprunt?.date_echeance) return null;
  const jours = joursRetard(emprunt.date_echeance, dateRetour);
  if (jours <= 0) return null;
  const regles = await getRegles(ecoleId);
  const regle = regles.find((r) => r.role === role && r.actif !== false) || null;
  const montant = calculerPenalite({ dateEcheance: emprunt.date_echeance, dateRetour, regle });
  return montant > 0 ? { jours, montant } : null;
}

// --- Import en masse de notices --------------------------------------------
// L'analyse et la normalisation vivent dans `biblio.import.js` (pur, testé).
// Ici : uniquement les écritures, PAR LOTS — on n'envoie jamais un fichier
// entier en une requête.
//
// `ignorerExistants` compare les ISBN à ceux déjà au catalogue : sans ce
// garde-fou, réimporter le même fichier duplique tout le fonds.
export async function importerNotices(ecoleId, notices, {
  ignorerExistants = true, taille = 200, onProgres = null,
} = {}) {
  const { enLots } = await import("@/lib/biblio.import.js");
  let aInserer = notices;
  let ignores = 0;

  if (ignorerExistants) {
    const isbns = [...new Set(notices.map((n) => n.isbn).filter(Boolean))];
    const connus = new Set();
    for (const lot of enLots(isbns, 200)) {
      const { data, error } = await supabase.from("biblio_ressources")
        .select("isbn").eq("ecole_id", ecoleId).in("isbn", lot);
      if (error) throw error;
      for (const r of data ?? []) if (r.isbn) connus.add(r.isbn);
    }
    if (connus.size > 0) {
      aInserer = notices.filter((n) => !(n.isbn && connus.has(n.isbn)));
      ignores = notices.length - aInserer.length;
    }
  }

  // Les auteurs vivent dans une table à part : on les résout AVANT, une seule
  // fois pour tout le fichier, sinon le même auteur serait recréé à chaque ligne.
  const { cleAuteur } = await import("@/lib/biblio.import.js");
  const parCle = await resoudreAuteurs(ecoleId, aInserer.flatMap((n) => n.auteurs || []));

  let crees = 0, exemplaires = 0, liens = 0, faits = 0;
  for (const lot of enLots(aInserer, taille)) {
    // `quantite`, `cote` et `auteurs` ne sont pas des colonnes de la notice :
    // ils servent à fabriquer les exemplaires et les liaisons juste après.
    const payload = lot.map(({ quantite, cote, auteurs, ...n }) => ({ ecole_id: ecoleId, ...n, visible: true }));
    const { data, error } = await supabase.from("biblio_ressources")
      .insert(payload).select("id, titre, isbn");
    if (error) throw error;
    crees += data?.length ?? 0;

    // On rattache exemplaires et auteurs à la notice qui vient d'être créée.
    // PostgreSQL rend les lignes dans l'ordre envoyé pour un INSERT multi-lignes,
    // mais ce n'est pas une garantie formelle — et s'y fier en aveugle
    // attacherait les exemplaires aux MAUVAISES notices sur un fichier de
    // plusieurs milliers de lignes, sans le moindre signal d'erreur.
    // On vérifie donc l'alignement, et on retombe sur un appariement par
    // (titre, ISBN) au moindre écart.
    const retour = data ?? [];
    const aligne = retour.length === lot.length
      && retour.every((r, i) => r.titre === lot[i].titre && (r.isbn ?? null) === (lot[i].isbn ?? null));
    let sourceDe;
    if (aligne) {
      sourceDe = (_r, i) => lot[i];
    } else {
      const restants = new Map();
      lot.forEach((n) => {
        const k = `${n.titre} ${n.isbn ?? ""}`;
        (restants.get(k) || restants.set(k, []).get(k)).push(n);
      });
      sourceDe = (r) => (restants.get(`${r.titre} ${r.isbn ?? ""}`) || []).shift() || null;
    }

    const exs = [];
    const rel = [];
    retour.forEach((r, i) => {
      const src = sourceDe(r, i);
      if (!src) return;
      for (let k = 0; k < (src.quantite || 0); k++) {
        exs.push({ ecole_id: ecoleId, ressource_id: r.id, cote: src.cote || null, statut: "disponible", etat: "bon" });
      }
      (src.auteurs || []).forEach((a, ordre) => {
        const id = parCle.get(cleAuteur(a));
        if (id) rel.push({ ecole_id: ecoleId, ressource_id: r.id, auteur_id: id, role: "auteur", ordre });
      });
    });

    for (const sousLot of enLots(exs, 500)) {
      const { error: e2 } = await supabase.from("biblio_exemplaires").insert(sousLot);
      if (e2) throw e2;
      exemplaires += sousLot.length;
    }
    for (const sousLot of enLots(rel, 500)) {
      const { error: e3 } = await supabase.from("biblio_ressource_auteurs").insert(sousLot);
      if (e3) throw e3;
      liens += sousLot.length;
    }

    faits += lot.length;
    onProgres?.(faits, aInserer.length);
  }

  return { crees, ignores, exemplaires, auteurs: liens };
}

// Rattache une liste [{nom, prenom}] à une notice, en réutilisant les auteurs
// déjà connus de l'établissement. Utilisé après un enrichissement ISBN/DOI.
export async function rattacherAuteurs(ecoleId, ressourceId, auteurs = []) {
  const liste = (auteurs || []).filter((a) => a?.nom);
  if (liste.length === 0) return 0;
  const { cleAuteur } = await import("@/lib/biblio.import.js");
  const parCle = await resoudreAuteurs(ecoleId, liste);
  const rel = liste.map((a, ordre) => ({
    ecole_id: ecoleId, ressource_id: ressourceId,
    auteur_id: parCle.get(cleAuteur(a)), role: "auteur", ordre,
  })).filter((r) => r.auteur_id);
  if (rel.length === 0) return 0;
  const { error } = await supabase.from("biblio_ressource_auteurs").insert(rel);
  if (error) throw error;
  return rel.length;
}

// Renvoie une Map clé → auteur_id, en réutilisant les auteurs déjà connus de
// l'école et en créant uniquement les manquants.
async function resoudreAuteurs(ecoleId, auteurs) {
  const { cleAuteur, enLots } = await import("@/lib/biblio.import.js");
  const parCle = new Map();
  const uniques = new Map();
  for (const a of auteurs) if (a?.nom) uniques.set(cleAuteur(a), a);
  if (uniques.size === 0) return parCle;

  // Auteurs déjà en base : on compare sur le nom (l'index utile), puis on
  // affine sur la clé complète côté client.
  const noms = [...new Set([...uniques.values()].map((a) => a.nom))];
  for (const lot of enLots(noms, 200)) {
    const { data, error } = await supabase.from("biblio_auteurs")
      .select("id, nom, prenom").eq("ecole_id", ecoleId).in("nom", lot);
    if (error) throw error;
    for (const a of data ?? []) parCle.set(cleAuteur(a), a.id);
  }

  const manquants = [...uniques.entries()].filter(([c]) => !parCle.has(c)).map(([, a]) => a);
  for (const lot of enLots(manquants, 200)) {
    const { data, error } = await supabase.from("biblio_auteurs")
      .insert(lot.map((a) => ({ ecole_id: ecoleId, nom: a.nom, prenom: a.prenom })))
      .select("id, nom, prenom");
    if (error) throw error;
    for (const a of data ?? []) parCle.set(cleAuteur(a), a.id);
  }
  return parCle;
}

// Tableau de bord : TOUT est agrégé en base (migration 122) et revient en un
// seul aller-retour. Compter côté client imposerait de télécharger les emprunts.
export async function statistiques(ecoleId, depuis = null) {
  const { data, error } = await supabase.rpc("biblio_statistiques",
    depuis ? { p_ecole: ecoleId, p_depuis: depuis } : { p_ecole: ecoleId });
  if (error) throw error;
  return data || {};
}

// --- Pénalités --------------------------------------------------------------
export async function getPenalites(ecoleId, { statut, page = 0, taille = 20 } = {}) {
  const { debut, fin, taille: t, page: p } = bornesPagination(page, taille);
  let req = supabase.from("biblio_penalites")
    .select("*, biblio_emprunts(id, date_echeance, date_retour," +
            " profils:emprunteur_profil_id(prenom, nom), eleves:emprunteur_eleve_id(prenom, nom, matricule))",
            { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (statut) req = req.eq("statut", statut);
  const { data, error, count } = await req.order("created_at", { ascending: false }).range(debut, fin);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0, page: p, taille: t };
}
export async function creerPenalite(ecoleId, p) {
  const { error } = await supabase.from("biblio_penalites").insert({ ecole_id: ecoleId, ...p });
  if (error) throw error;
}
export async function changerStatutPenalite(id, statut) {
  const { error } = await supabase.from("biblio_penalites").update({ statut }).eq("id", id);
  if (error) throw error;
}
// Total encore dû, pour l'afficher au guichet avant un nouveau prêt.
export async function penalitesDues(ecoleId, { profilId, eleveId }) {
  let req = supabase.from("biblio_penalites")
    .select("montant, biblio_emprunts!inner(emprunteur_profil_id, emprunteur_eleve_id)")
    .eq("ecole_id", ecoleId).eq("statut", "due");
  req = profilId
    ? req.eq("biblio_emprunts.emprunteur_profil_id", profilId)
    : req.eq("biblio_emprunts.emprunteur_eleve_id", eleveId);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
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
// Le RANG est attribué EN BASE (trigger, migration 126). Il ne peut pas
// l'être ici : la RLS ne montre à l'usager que ses propres réservations, il
// lisait donc toujours une file vide et repartait premier.
export async function reserver(ecoleId, ressourceId, profilId) {
  const { data, error } = await supabase.from("biblio_reservations").insert({
    ecole_id: ecoleId, ressource_id: ressourceId, profil_id: profilId,
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

// Journal (best-effort : ne bloque JAMAIS l'action principale — perdre une
// ligne de traçabilité est moins grave que refuser un prêt au guichet).
// L'auteur est résolu ici : les appelants n'ont pas tous l'identité sous la main.
export async function journaliser(ecoleId, action, cible_type, cible_id, details = null) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("biblio_journal").insert({
      ecole_id: ecoleId, profil_id: u?.user?.id || null, action, cible_type, cible_id, details,
    });
  } catch { /* ignoré */ }
}
