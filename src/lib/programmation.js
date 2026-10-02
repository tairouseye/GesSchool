import { supabase } from "@/lib/supabase.js";

// GesSchool — la programmation officielle (IEF) : accès aux données.
//
// Point 15 de la visite : « l'enseignant devrait pouvoir réutiliser les
// éléments de programmation plutôt que les ressaisir ». La planification
// mensuelle de l'IEF est importée une fois par la direction, puis chaque
// enseignante y puise le contenu de ses séances.
//
// ⚠️ RATTACHÉE AU NIVEAU, PAS À LA CLASSE. Une planification CM1 vaut pour
// CM1 A comme pour CM1 B. La saisir deux fois serait exactement la ressaisie
// qu'on cherche à supprimer.
//
// ⚠️ LA LECTURE DU DOCUMENT N'EST PAS ICI. Elle vit dans deux modules PURS,
// `docxTableaux.js` et `programmationIEF.js`, éprouvés sur le vrai document
// de l'école. Ce fichier ne fait que parler à la base.

export async function getProgrammations(ecoleId, { niveauId, anneeId, mois } = {}) {
  let q = supabase
    .from("programmations")
    .select("*, niveaux(libelle)")
    .eq("ecole_id", ecoleId);
  if (niveauId) q = q.eq("niveau_id", niveauId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  if (mois) q = q.eq("mois", mois);
  const { data, error } = await q.order("mois").order("domaine");
  if (error) throw error;
  return data ?? [];
}

export async function getLignes(programmationId) {
  const { data, error } = await supabase
    .from("programmation_lignes")
    .select("*")
    .eq("programmation_id", programmationId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

/**
 * Les lignes dont l'enseignante a besoin pour remplir son cahier : tout ce
 * qui a été importé pour SON niveau, au mois demandé, tous domaines confondus.
 *
 * ⚠️ Un seul aller-retour, avec la programmation jointe : le sélecteur doit
 * s'ouvrir sans attendre, sinon l'enseignante ressaisira à la main — et le
 * point 15 serait manqué pour une raison d'ergonomie.
 */
export async function lignesDuMois(ecoleId, { niveauId, anneeId, mois }) {
  if (!niveauId || !anneeId || !mois) return [];
  const { data, error } = await supabase
    .from("programmation_lignes")
    .select("*, programmations!inner(id, domaine, mois, niveau_id, annee_id)")
    .eq("ecole_id", ecoleId)
    .eq("programmations.niveau_id", niveauId)
    .eq("programmations.annee_id", anneeId)
    .eq("programmations.mois", mois)
    .order("ordre");
  if (error) throw error;
  return (data ?? []).map((l) => ({ ...l, domaine: l.programmations?.domaine ?? null }));
}

/** Les mois déjà importés pour un niveau — pour n'ouvrir que ce qui existe. */
export async function moisImportes(ecoleId, { niveauId, anneeId }) {
  if (!niveauId || !anneeId) return [];
  const { data, error } = await supabase
    .from("programmations")
    .select("mois")
    .eq("ecole_id", ecoleId)
    .eq("niveau_id", niveauId)
    .eq("annee_id", anneeId);
  if (error) throw error;
  return [...new Set((data ?? []).map((p) => p.mois))].sort((a, b) => a - b);
}

/**
 * Enregistre un mois entier. `domaines` vient de `grouperParDomaine()`.
 *
 * ⚠️ UN SEUL APPEL POUR TOUT LE MOIS. La fonction SQL écrit les quatre
 * domaines dans la même transaction : un échec sur le troisième ne doit pas
 * laisser un mois à moitié importé, que personne ne remarquerait.
 */
export async function importerProgrammation({ niveauId, anneeId, mois, source, domaines }) {
  const { data, error } = await supabase.rpc("importer_programmation", {
    p_niveau: niveauId,
    p_annee: anneeId,
    p_mois: mois,
    p_source: source || null,
    // On n'envoie que ce que la base stocke : inutile de lui faire porter
    // les champs de travail de l'analyseur.
    p_domaines: (domaines ?? []).map((g) => ({
      domaine: g.domaine,
      lignes: (g.lignes ?? []).map((l) => ({
        sous_domaine: l.sous_domaine ?? null,
        theme: l.theme ?? null,
        rubrique: l.rubrique ?? null,
        activite: l.activite ?? null,
        palier: l.palier ?? null,
        semaine: l.semaine ?? null,
        contenu: l.contenu,
        ordre: l.ordre ?? 0,
      })),
    })),
  });
  if (error) throw error;
  return data ?? { programmations: 0, lignes: 0 };
}

export async function supprimerProgrammation(id) {
  const { error } = await supabase.rpc("supprimer_programmation", { p_id: id });
  if (error) throw error;
}
