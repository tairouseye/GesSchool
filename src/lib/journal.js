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

export const ENTITES = [
  ["notes", "Notes"], ["notes_lmd", "Notes (LMD)"], ["releves", "Relevés"],
  ["bulletins", "Bulletins"], ["factures", "Factures"], ["paiements", "Paiements"],
  ["eleves", "Élèves"], ["inscriptions_sup", "Inscriptions"], ["profil_roles", "Rôles"],
];

export const OPERATIONS = {
  UPDATE: { label: "Modification", ton: "warning" },
  DELETE: { label: "Suppression", ton: "danger" },
  RESTORE: { label: "Restauration", ton: "success" },
};

export function nbPages(total, taille) {
  return Math.max(1, Math.ceil((Number(total) || 0) / Math.max(1, taille)));
}

export async function getJournal(ecoleId, { entite, operation, page = 0, taille = 25 } = {}) {
  const debut = Math.max(0, page) * taille;
  let req = supabase
    .from("journal_audit")
    .select("id, entite, entite_id, operation, details, created_at, utilisateur," +
            " profils:utilisateur(prenom, nom)", { count: "exact" })
    .eq("ecole_id", ecoleId);
  if (entite) req = req.eq("entite", entite);
  if (operation) req = req.eq("operation", operation);
  const { data, error, count } = await req
    .order("created_at", { ascending: false })
    .range(debut, debut + taille - 1);
  if (error) throw error;
  return { lignes: data ?? [], total: count ?? 0 };
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
