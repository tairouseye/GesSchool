import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « finances » : frais, factures, encaissements.
// Le statut de facture + montant_paye sont recalculés par un trigger en base.

export const MODES = [
  ["especes", "Espèces"],
  ["wave", "Wave"],
  ["orange_money", "Orange Money"],
  ["free_money", "Free Money"],
  ["virement", "Virement"],
  ["cheque", "Chèque"],
  ["carte", "Carte"],
];

export const STATUTS = {
  brouillon: { label: "Brouillon", ton: "navy" },
  emise: { label: "Émise", ton: "navy" },
  partiellement_payee: { label: "Partielle", ton: "or" },
  payee: { label: "Payée", ton: "vert" },
  en_retard: { label: "En retard", ton: "rouge" },
  annulee: { label: "Annulée", ton: "navy" },
};

// --- Frais (grille tarifaire) ---
export async function getFrais(ecoleId, anneeId) {
  let q = supabase.from("frais").select("*, niveaux(libelle), cycles(libelle)").eq("ecole_id", ecoleId);
  if (anneeId) q = q.or(`annee_id.eq.${anneeId},annee_id.is.null`);
  const { data, error } = await q.order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerFrais(ecoleId, f) {
  const { data, error } = await supabase
    .from("frais")
    .insert({ ecole_id: ecoleId, ...f })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerFrais(id) {
  const { error } = await supabase.from("frais").delete().eq("id", id);
  if (error) throw error;
}

// --- Factures ---
async function genererNumero(ecoleId) {
  const { count } = await supabase
    .from("factures")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecoleId);
  return `F-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function getFactures(ecoleId, anneeId) {
  let q = supabase
    .from("factures")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q.order("date_emission", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFacture(id) {
  const { data, error } = await supabase
    .from("factures")
    .select("*, eleves(prenom, nom, matricule), facture_lignes(*), paiements(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function creerFacture(ecoleId, { eleve_id, annee_id, date_echeance, lignes }) {
  const numero = await genererNumero(ecoleId);
  const montant_total = lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0);
  const { data: facture, error } = await supabase
    .from("factures")
    .insert({
      ecole_id: ecoleId,
      numero,
      eleve_id,
      annee_id: annee_id || null,
      date_echeance: date_echeance || null,
      montant_total,
      statut: "emise",
    })
    .select()
    .single();
  if (error) throw error;

  const lignesInsert = lignes.map((l) => ({
    ecole_id: ecoleId,
    facture_id: facture.id,
    frais_id: l.frais_id || null,
    libelle: l.libelle,
    quantite: Number(l.quantite),
    prix_unitaire: Number(l.prix_unitaire),
    montant: Number(l.quantite) * Number(l.prix_unitaire),
  }));
  const { error: e2 } = await supabase.from("facture_lignes").insert(lignesInsert);
  if (e2) throw e2;
  return facture;
}

export async function supprimerFacture(id) {
  const { error } = await supabase.from("factures").delete().eq("id", id);
  if (error) throw error;
}

// --- Encaissements ---
export async function encaisser(ecoleId, factureId, p, encaissePar) {
  const { data, error } = await supabase
    .from("paiements")
    .insert({
      ecole_id: ecoleId,
      facture_id: factureId,
      montant: Number(p.montant),
      mode: p.mode,
      reference: p.reference || null,
      date_paiement: p.date_paiement || new Date().toISOString().slice(0, 10),
      encaisse_par: encaissePar || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerPaiement(id) {
  const { error } = await supabase.from("paiements").delete().eq("id", id);
  if (error) throw error;
}

// --- Facturation en lot (depuis la grille tarifaire) ---

// Élèves inscrits pour l'année, avec leur niveau (via la classe).
export async function getInscritsAvecNiveau(ecoleId, anneeId) {
  if (!anneeId) return [];
  const { data, error } = await supabase
    .from("inscriptions")
    .select("eleve_id, statut, eleves(prenom, nom, matricule), classes(niveau_id, libelle)")
    .eq("ecole_id", ecoleId)
    .eq("annee_id", anneeId);
  if (error) throw error;
  return (data ?? [])
    .filter((i) => i.eleves && i.statut !== "radie" && i.statut !== "parti")
    .map((i) => ({
      eleve_id: i.eleve_id,
      prenom: i.eleves.prenom,
      nom: i.eleves.nom,
      matricule: i.eleves.matricule,
      niveau_id: i.classes?.niveau_id || null,
      classe: i.classes?.libelle || "",
    }));
}

// frais_id déjà facturés cette année, indexés par élève (évite les doublons).
async function getFraisDejaFactures(ecoleId, anneeId) {
  const { data, error } = await supabase
    .from("facture_lignes")
    .select("frais_id, factures!inner(eleve_id, annee_id)")
    .eq("ecole_id", ecoleId)
    .eq("factures.annee_id", anneeId);
  if (error) throw error;
  const map = {};
  for (const d of data ?? []) {
    const eid = d.factures?.eleve_id;
    if (!eid || !d.frais_id) continue;
    (map[eid] ||= new Set()).add(d.frais_id);
  }
  return map;
}

// Génère une facture par élève à partir d'une liste de frais.
// Saute les frais déjà facturés à l'élève cette année.
// Retourne { crees, ignores }.
export async function genererFacturesEnLot(ecoleId, anneeId, eleveIds, fraisList, echeance) {
  const deja = await getFraisDejaFactures(ecoleId, anneeId);
  let crees = 0;
  let ignores = 0;
  for (const eleveId of eleveIds) {
    const dejaEleve = deja[eleveId] || new Set();
    const lignes = fraisList
      .filter((fr) => !dejaEleve.has(fr.id))
      .map((fr) => ({
        frais_id: fr.id,
        libelle: fr.libelle,
        quantite: 1,
        prix_unitaire: Number(fr.montant),
      }));
    if (lignes.length === 0) {
      ignores++;
      continue;
    }
    await creerFacture(ecoleId, {
      eleve_id: eleveId,
      annee_id: anneeId,
      date_echeance: echeance || null,
      lignes,
    });
    crees++;
  }
  return { crees, ignores };
}

// --- Paiement mobile (déclaratif) ---
export const MODES_MOBILE = [
  ["wave", "Wave"],
  ["orange_money", "Orange Money"],
  ["free_money", "Free Money"],
];

// Coordonnées mobile money de l'école (stockées dans `parametres`).
export async function getPaiementMobile(ecoleId) {
  const { data, error } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("ecole_id", ecoleId)
    .eq("cle", "paiement_mobile")
    .maybeSingle();
  if (error) throw error;
  return data?.valeur || {};
}

export async function setPaiementMobile(ecoleId, infos) {
  const { error } = await supabase
    .from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "paiement_mobile", valeur: infos }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Déclarations de paiement (staff).
export async function getDeclarations(ecoleId, statut = "en_attente") {
  let q = supabase
    .from("declarations_paiement")
    .select("*, eleves(prenom, nom), factures(numero)")
    .eq("ecole_id", ecoleId);
  if (statut) q = q.eq("statut", statut);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function validerDeclaration(id) {
  const { error } = await supabase.rpc("valider_declaration", { p_decl: id });
  if (error) throw error;
}

export async function rejeterDeclaration(id) {
  const { error } = await supabase.rpc("rejeter_declaration", { p_decl: id });
  if (error) throw error;
}

// Solde par élève (somme due - payé sur ses factures).
export async function getSoldesEleves(ecoleId, anneeId) {
  const factures = await getFactures(ecoleId, anneeId);
  const map = {};
  for (const f of factures) {
    const m = (map[f.eleve_id] ||= { total: 0, paye: 0 });
    m.total += Number(f.montant_total) || 0;
    m.paye += Number(f.montant_paye) || 0;
  }
  return map;
}
