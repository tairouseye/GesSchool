import { prochaineEtape } from "@/lib/promotion.js";
import { supabase } from "@/lib/supabase.js";

// GesSchool — passage d'année scolaire : années, ouverture, promotion des élèves.

export async function getAnnees(ecoleId) {
  const { data, error } = await supabase
    .from("annees_scolaires")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Crée une nouvelle année (devient courante) + recopie le squelette choisi.
export async function ouvrirAnnee(libelle, debut, fin, opts = {}) {
  const { data, error } = await supabase.rpc("ouvrir_annee_scolaire", {
    p_libelle: libelle, p_debut: debut, p_fin: fin,
    p_classes: opts.classes ?? true,
    p_affectations: opts.affectations ?? true,
    p_frais: opts.frais ?? true,
    p_edt: opts.edt ?? true,
  });
  if (error) throw error;
  return data; // id de la nouvelle année
}

// Aperçu de ce qui serait recopié depuis l'année source (compteurs).
export async function resumeSource(ecoleId, sourceId) {
  const vide = { classes: 0, affectations: 0, frais: 0, creneaux: 0, inscriptions: 0 };
  if (!sourceId) return vide;
  const nb = (q) => q.then(({ count }) => count ?? 0);
  const [classes, affectations, frais, creneaux, inscriptions] = await Promise.all([
    nb(supabase.from("classes").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", sourceId)),
    nb(supabase.from("affectations").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", sourceId)),
    nb(supabase.from("frais").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", sourceId)),
    nb(supabase.from("emplois_du_temps").select("id, classes!inner(annee_id)", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("classes.annee_id", sourceId)),
    nb(supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", sourceId)),
  ]);
  return { classes, affectations, frais, creneaux, inscriptions };
}

// Nombre d'inscriptions par année (pour savoir si une année est supprimable).
export async function inscriptionsParAnnee(ecoleId, anneeIds) {
  const out = {};
  await Promise.all(anneeIds.map(async (id) => {
    const { count } = await supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", id);
    out[id] = count ?? 0;
  }));
  return out;
}

// Supprime une année (RPC : garde inscriptions + rebascule la courante).
export async function supprimerAnnee(anneeId) {
  const { error } = await supabase.rpc("supprimer_annee_scolaire", { p_annee: anneeId });
  if (error) throw error;
}

// Section « A » depuis « 6e A ».
function section(libelle) {
  const m = /([A-Za-z0-9]+)\s*$/.exec((libelle || "").trim());
  return m ? m[1].toUpperCase() : "";
}

// Propose la promotion de chaque élève de l'année source vers l'année cible :
// niveau supérieur (ordre +1), même section si une classe correspond ; les
// élèves du plus haut niveau (sans niveau au-dessus) sont proposés « sortants ».
export async function proposerPromotions(ecoleId, sourceId, cibleId) {
  //  ⚠️ `sous_niveau_id` EST LU ICI, et c'est tout l'objet du correctif : dans
  //  une classe « TPS/PS A », le TPS et le PS ne vont PAS au même endroit.
  //  Sans cette colonne, les deux recevaient la même proposition et l'enfant
  //  de TPS sautait une année (cf. `promotion.js`).
  const [niveaux, sousNiveaux, insc, classesCible] = await Promise.all([
    supabase.from("niveaux").select("id, libelle, ordre").eq("ecole_id", ecoleId),
    supabase.from("sous_niveaux").select("id, niveau_id, libelle, ordre, created_at").eq("ecole_id", ecoleId),
    supabase.from("inscriptions")
      .select("eleve_id, statut, sous_niveau_id, eleves(prenom, nom, matricule), classes(id, libelle, niveau_id, serie_id)")
      .eq("ecole_id", ecoleId).eq("annee_id", sourceId).in("statut", ["inscrit", "reinscrit"]),
    supabase.from("classes").select("id, libelle, niveau_id, serie_id").eq("ecole_id", ecoleId).eq("annee_id", cibleId),
  ]);
  if (niveaux.error) throw niveaux.error;
  if (sousNiveaux.error) throw sousNiveaux.error;
  if (insc.error) throw insc.error;
  if (classesCible.error) throw classesCible.error;

  const niv = niveaux.data ?? [];
  //  (`ordreDe` / `parOrdre` ont disparu : la progression par ordre vit
  //   désormais dans `prochaineEtape`, qui sait aussi gérer les sous-niveaux.)
  const cibles = classesCible.data ?? [];

  const trouverCible = (niveauId, sect, serieId) => {
    const pool = cibles.filter((c) => c.niveau_id === niveauId);
    if (pool.length === 0) return "";
    const choix =
      pool.find((c) => (serieId ? c.serie_id === serieId : true) && section(c.libelle) === sect) ||
      pool.find((c) => section(c.libelle) === sect) ||
      (serieId ? pool.find((c) => c.serie_id === serieId) : null) ||
      pool[0];
    return choix?.id || "";
  };

  const sousListe = sousNiveaux.data ?? [];
  const libSous = Object.fromEntries(sousListe.map((s) => [s.id, s.libelle]));
  const libNiv = Object.fromEntries(niv.map((n) => [n.id, n.libelle]));

  const props = [];
  for (const i of insc.data ?? []) {
    const c = i.classes;
    //  La règle de progression vit dans `promotion.js` : elle est pure, donc
    //  éprouvable sans base. Ici on ne fait que la nourrir.
    const etape = prochaineEtape({
      niveauId: c?.niveau_id,
      sousNiveauId: i.sous_niveau_id || null,
      niveaux: niv,
      sousNiveaux: sousListe,
    });
    const sortant = etape.sortant;
    props.push({
      eleve_id: i.eleve_id,
      nom: `${i.eleves?.prenom || ""} ${i.eleves?.nom || ""}`.trim() || "—",
      matricule: i.eleves?.matricule || "",
      classe_source: c?.libelle || "—",
      //  Son niveau RÉEL de départ, quand il est connu : c'est lui qui rend
      //  la proposition lisible (« TPS → PS » et non « TPS/PS → TPS/PS »).
      sous_niveau_source: libSous[i.sous_niveau_id] || "",
      //  Conservé tel quel pour le redoublant : il reste où il est.
      sous_niveau_source_id: i.sous_niveau_id || null,
      cible_classe_id: sortant ? "" : trouverCible(etape.niveau_id, section(c?.libelle), c?.serie_id),
      niveau_cible: sortant ? "" : (libNiv[etape.niveau_id] || ""),
      //  ⚠️ REPORTÉ SUR LA NOUVELLE INSCRIPTION (voir appliquerPromotions) :
      //  sans lui, le niveau réel saisi l'an passé était effacé chaque année.
      sous_niveau_cible_id: etape.sous_niveau_id || null,
      sous_niveau_cible: libSous[etape.sous_niveau_id] || "",
      meme_niveau: etape.memeNiveau,
      redoublant: false,
      sortant,
      inclure: !sortant,
    });
  }
  props.sort((a, b) => a.classe_source.localeCompare(b.classe_source) || a.nom.localeCompare(b.nom));
  return props;
}

// Applique les réinscriptions en UN SEUL upsert groupé (atomique, idempotent).
// Avant : un upsert par élève en série (N allers-retours) → lent à l'échelle.
export async function appliquerPromotions(ecoleId, cibleId, promotions) {
  const rows = (promotions || [])
    .filter((p) => p.inclure && p.cible_classe_id)
    .map((p) => ({
      ecole_id: ecoleId, eleve_id: p.eleve_id, classe_id: p.cible_classe_id,
      annee_id: cibleId, statut: "reinscrit", redoublant: !!p.redoublant,
      //  🔴 LA COLONNE QUI ÉTAIT OUBLIÉE. Un redoublant garde son niveau
      //  réel de départ ; les autres prennent celui que la règle a calculé.
      //  Sans cette ligne, « TPS/PS A » perdait la distinction TPS / PS à
      //  chaque passage d'année, et la fonction se vidait d'elle-même.
      sous_niveau_id: p.redoublant
        ? (p.sous_niveau_source_id ?? null)
        : (p.sous_niveau_cible_id ?? null),
    }));
  if (rows.length === 0) return { reinscrits: 0 };
  const { error } = await supabase
    .from("inscriptions")
    .upsert(rows, { onConflict: "eleve_id,annee_id" });
  if (error) throw error;
  return { reinscrits: rows.length };
}
