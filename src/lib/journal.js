import { supabase } from "@/lib/supabase.js";

// GesSchool — journal des actes sensibles (`journal_audit`, migrations 134-135).
//
// Pagination SERVEUR : ce journal grossit à chaque modification de note ou de
// paiement. Le charger entièrement serait la faute que l'audit reproche
// justement au reste de l'application.
//
// NB : `bornesPagination` vit encore dans `biblio.regles.js` alors qu'elle
// n'a rien de bibliothécaire. Elle mériterait un module partagé — noté pour
// la phase « pagination », on ne déplace pas un utilitaire en passant.

// ⚠️ CETTE LISTE DOIT SUIVRE CE QUE LES DÉCLENCHEURS ÉCRIVENT VRAIMENT.
// Relevé en base le 28/09/2026 : sur 137 actes, 101 portaient l'entité
// `salaire_ligne` — absente d'ici, donc affichée brute et surtout impossible à
// filtrer. La paie (mig. 079, 098) journalise depuis longtemps ; seul le volet
// pédagogique (134-135) avait été déclaré.
export const ENTITES = [
  ["notes", "Notes"], ["notes_lmd", "Notes (LMD)"], ["releves", "Relevés"],
  ["bulletins", "Bulletins"], ["factures", "Factures"], ["paiements", "Paiements"],
  ["eleves", "Élèves"], ["inscriptions_sup", "Inscriptions"], ["profil_roles", "Rôles"],
  // Volet RH & Paie
  ["salaire", "Bulletin de paie"], ["salaire_ligne", "Ligne de bulletin"],
  ["contrat", "Contrat"],
];

export const OPERATIONS = {
  UPDATE: { label: "Modification", ton: "warning" },
  DELETE: { label: "Suppression", ton: "danger" },
  RESTORE: { label: "Restauration", ton: "success" },
  // Cycle de vie d'un bulletin de paie (mig. 079). `suppr_ligne` est
  // l'opération la PLUS fréquente du journal : la laisser hors de cette table
  // rendait illisible la majorité des lignes.
  suppr_ligne: { label: "Ligne supprimée", ton: "danger" },
  validation: { label: "Validation", ton: "success" },
  devalidation: { label: "Dévalidation", ton: "warning" },
  modif_salaire_base: { label: "Salaire de base modifié", ton: "warning" },
};

export function nbPages(total, taille) {
  return Math.max(1, Math.ceil((Number(total) || 0) / Math.max(1, taille)));
}

// ⚠️ PAS D'EMBED SUR L'AUTEUR, ET C'EST VOULU.
// `journal_audit.utilisateur` est un uuid SANS clé étrangère vers `profils`
// (mig. 079). Un embed PostgREST exige une relation déclarée : la page
// échouait donc à chaque ouverture sur « Could not find a relationship
// between 'journal_audit' and 'utilisateur' ».
//
// La tentation était d'ajouter la clé étrangère. On s'en garde : en
// `on delete set null`, supprimer un compte effacerait l'auteur de tous ses
// actes — la seule chose qu'un journal d'audit ne doit jamais perdre ; en
// `restrict`, plus aucun compte ne serait supprimable. L'uuid nu survit à la
// disparition du profil, et c'est la bonne propriété. On résout donc les noms
// en une seconde requête, bornée aux auteurs de la page affichée.
export async function getJournal(ecoleId, { entite, operation, page = 0, taille = 25 } = {}) {
  const debut = Math.max(0, page) * taille;
  let req = supabase
    .from("journal_audit")
    .select("id, entite, entite_id, operation, details, created_at, utilisateur", { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (entite) req = req.eq("entite", entite);
  if (operation) req = req.eq("operation", operation);
  const { data, error, count } = await req
    .order("created_at", { ascending: false })
    .range(debut, debut + taille - 1);
  if (error) throw error;

  const lignes = data ?? [];
  return { lignes: await avecAuteurs(lignes), total: count ?? 0 };
}

// Attache `profils: {prenom, nom}` à chaque ligne, comme le faisait l'embed —
// la page n'a donc rien à savoir de ce détour. Un auteur non résolu reste
// `null` : l'écran affiche « auteur non identifié » plutôt que d'inventer.
export async function avecAuteurs(lignes = []) {
  const ids = auteursARésoudre(lignes);
  if (ids.length === 0) return attacherAuteurs(lignes, []);
  const { data, error } = await supabase.from("profils").select("id, prenom, nom").in("id", ids);
  // Une résolution de noms qui échoue ne doit pas emporter le journal : mieux
  // vaut un journal sans auteurs qu'une page d'erreur.
  if (error) return attacherAuteurs(lignes, []);
  return attacherAuteurs(lignes, data ?? []);
}

// Les uuid à résoudre : distincts et non nuls. Un acte fait hors session
// utilisateur (éditeur SQL, clé de service) porte `utilisateur = null` —
// fréquent en pratique, et il ne faut pas le demander au serveur.
export function auteursARésoudre(lignes = []) {
  return [...new Set(lignes.map((l) => l?.utilisateur).filter(Boolean))];
}

// Rebranche les noms sur les lignes, exactement comme le faisait l'embed :
// la page continue de lire `l.profils`. Un auteur non résolu reste `null`
// plutôt que de devenir un nom vide — « auteur non identifié » est une
// information, « · par   » est un défaut d'affichage.
export function attacherAuteurs(lignes = [], profils = []) {
  const par = new Map((profils || []).map((p) => [p.id, { prenom: p.prenom, nom: p.nom }]));
  return (lignes || []).map((l) => ({ ...l, profils: par.get(l?.utilisateur) || null }));
}

// Rejoue une suppression. Réservée au promoteur (contrôle en base) ; ne
// restaure qu'UNE ligne, pas les enregistrements partis en cascade.
export async function restaurer(journalId) {
  const { data, error } = await supabase.rpc("restaurer_depuis_journal", { p_journal: journalId });
  if (error) throw error;
  return data;
}

// Met un diff `{champ: {avant, apres}}` sous une forme lisible.
export function lireDetails(details) {
  if (!details || typeof details !== "object") return [];
  if (details.ligne_supprimee) {
    return Object.entries(details.ligne_supprimee)
      .filter(([, v]) => v !== null && v !== "")
      .map(([champ, v]) => ({ champ, avant: v, apres: null }));
  }
  if (details.depuis_journal) return [{ champ: "restauré depuis", avant: null, apres: details.depuis_journal }];
  return Object.entries(details).map(([champ, v]) => ({
    champ,
    avant: v && typeof v === "object" ? v.avant : null,
    apres: v && typeof v === "object" ? v.apres : v,
  }));
}
