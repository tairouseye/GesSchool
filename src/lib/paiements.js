import { supabase } from "@/lib/supabase.js";
import { archiverDocument } from "@/lib/documents.js";
import { libellesReserves } from "@/lib/avance.js";

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

export async function modifierFrais(id, f) {
  const { data, error } = await supabase
    .from("frais")
    .update(f)
    .eq("id", id)
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
// Le numéro de facture est posé ATOMIQUEMENT par le trigger `set_numero_facture`
// (compteur par école/année). On n'en génère plus côté client (cf. migration 071).

// Liste PAGINÉE des factures (migration 136).
//
// Passe par une RPC et non par `.range()` : la recherche doit porter à la
// fois sur le numéro de facture et sur l'élève embarqué, ce que PostgREST
// refuse de combiner dans un même `or()`. Le OU est donc écrit en SQL.
//
// Renvoie { lignes, total } — le total vient d'un COUNT sur le même filtre,
// sans quoi le nombre de pages serait faux.
// ⚠️ CONTRAT : chaque ligne porte l'élève sous `eleves: { prenom, nom,
// matricule }`, comme `getFacture`, `getDeclarations` et `getTransactions`.
//
// La RPC `factures_paginees` (mig. 136) renvoie ces trois champs À PLAT, parce
// qu'elle fait `to_jsonb()` sur une jointure. En basculant la liste sur cette
// RPC, la colonne « Élève » de l'écran Paiements s'est vidée en silence : le
// composant lisait `f.eleves?.prenom`, qui n'existait plus. Rien ne plantait,
// la colonne était simplement blanche.
//
// On remet donc la forme attendue ici, à la frontière, plutôt que d'aller
// corriger chaque affichage — et tout futur appelant la retrouvera.
export async function getFactures(ecoleId, { anneeId = null, q = null, statut = null, page = 0, taille = 25 } = {}) {
  const { data, error } = await supabase.rpc("factures_paginees", {
    p_ecole: ecoleId, p_annee: anneeId, p_q: q || null,
    p_statut: statut || null, p_page: page, p_taille: taille,
  });
  if (error) throw error;
  const lignes = (data?.lignes ?? []).map(({ prenom, nom, matricule, ...f }) => ({
    ...f,
    eleves: (prenom || nom || matricule) ? { prenom, nom, matricule } : null,
  }));
  return { lignes, total: data?.total ?? 0 };
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
  const montant_total = lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0);
  const { data: facture, error } = await supabase
    .from("factures")
    .insert({
      ecole_id: ecoleId,
      eleve_id,
      annee_id: annee_id || null,
      date_echeance: date_echeance || null,
      montant_total,
      statut: "emise",
    })
    .select()
    .single();
  if (error) throw error;
  const numero = facture.numero; // posé par le trigger BEFORE INSERT (atomique)

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

  // Archivage GED (best-effort, non bloquant).
  archiverDocument(ecoleId, {
    type: "facture", famille: "finances", titre: `Facture ${numero}`,
    reference: numero, montant: montant_total,
    eleve_id, cible_type: "eleve", cible_id: eleve_id, annee_id: annee_id || null,
    donnees: {
      numero, montant_total, echeance: date_echeance || null,
      lignes: lignes.map((l) => ({ libelle: l.libelle, quantite: Number(l.quantite), montant: Number(l.quantite) * Number(l.prix_unitaire) })),
    },
  });
  return facture;
}

// Résumé de paiement d'un élève sur une année (pour l'attestation de paiement).
export async function getResumePaiementEleve(ecoleId, eleveId, anneeId) {
  let q = supabase.from("factures").select("montant_total, montant_paye").eq("ecole_id", ecoleId).eq("eleve_id", eleveId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  const total = (data ?? []).reduce((s, f) => s + Number(f.montant_total || 0), 0);
  const paye = (data ?? []).reduce((s, f) => s + Number(f.montant_paye || 0), 0);
  return { total, paye, solde: total - paye, nb: (data ?? []).length };
}

// Suppression définitive — refusée par la base dès qu'un encaissement existe
// (mig. 143). Le journal (mig. 134) garde la ligne complète : l'acte est
// restaurable depuis Pilotage → Journal.
export async function supprimerFacture(id) {
  const { error } = await supabase.rpc("supprimer_facture", { p_facture: id });
  if (error) throw error;
}

// Annulation — la voie normale pour une facture déjà réglée, ou dont le
// numéro doit rester dans la série. Elle sort du recouvrement, des relances
// et du tableau de bord, mais reste visible et vérifiable.
export async function annulerFacture(id) {
  const { error } = await supabase.from("factures").update({ statut: "annulee" }).eq("id", id);
  if (error) throw error;
}

// Remet une facture annulée en circulation (erreur d'annulation). Le statut
// réel est recalculé par le déclencheur dès le prochain encaissement.
export async function retablirFacture(id, montantPaye = 0, montantTotal = 0) {
  const statut = Number(montantPaye) <= 0 ? "emise"
    : Number(montantPaye) >= Number(montantTotal) ? "payee" : "partiellement_payee";
  const { error } = await supabase.from("factures").update({ statut }).eq("id", id);
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
      compte_id: p.compte_id || null,
      encaisse_par: encaissePar || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Archivage GED du reçu (best-effort). On récupère l'élève + n° de facture.
  supabase.from("factures").select("eleve_id, numero").eq("id", factureId).single()
    .then(({ data: f }) => archiverDocument(ecoleId, {
      type: "recu", famille: "finances", titre: "Reçu de paiement",
      reference: data.reference || null, montant: data.montant,
      eleve_id: f?.eleve_id || null, cible_type: "eleve", cible_id: f?.eleve_id || null,
      cible_libelle: f?.numero ? `Facture ${f.numero}` : null,
      donnees: { montant: data.montant, mode: data.mode, date: data.date_paiement, facture: f?.numero || null },
    }))
    .then(undefined, () => {});
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

// Libellés déjà facturés cette année, indexés par élève (évite les doublons).
// On dédoublonne par LIBELLÉ : un frais mensuel porte le mois dans son libellé,
// donc on peut le facturer chaque mois sans doublon dans un même mois.
async function getLibellesDejaFactures(ecoleId, anneeId) {
  const { data, error } = await supabase
    .from("facture_lignes")
    .select("libelle, factures!inner(eleve_id, annee_id)")
    .eq("ecole_id", ecoleId)
    .eq("factures.annee_id", anneeId);
  if (error) throw error;
  const map = {};
  for (const d of data ?? []) {
    const eid = d.factures?.eleve_id;
    if (!eid || !d.libelle) continue;
    (map[eid] ||= new Set()).add(d.libelle);
  }
  //  Un mois payé d'avance mais pas encore validé par la caisse n'a pas
  //  encore de facture : sans cette réservation, le lot le facturerait, et
  //  la validation de l'avance serait ensuite refusée (mig. 202).
  const { data: avances, error: e2 } = await supabase
    .from("declarations_paiement")
    .select("eleve_id, statut, avance_lignes")
    .eq("ecole_id", ecoleId)
    .eq("statut", "en_attente")
    .is("facture_id", null);
  if (e2) throw e2;
  for (const [eid, libs] of Object.entries(libellesReserves(avances))) {
    for (const l of libs) (map[eid] ||= new Set()).add(l);
  }
  return map;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// "2026-10" -> "Octobre 2026" (null si format invalide).
export function libelleMois(mois) {
  const m = /^(\d{4})-(\d{2})$/.exec(mois || "");
  if (!m) return null;
  const nom = MOIS_FR[Number(m[2]) - 1];
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m[1]}` : null;
}

// Génère une facture par élève à partir d'une liste de frais.
// - Frais MENSUEL (recurrent) : facturé POUR LE MOIS choisi ; son libellé porte
//   le mois (« Scolarité — Octobre 2026 ») → facturable chaque mois, une seule
//   fois par mois.
// - Frais PONCTUEL : facturé une seule fois par an.
// Retourne { crees, ignores }.
//
// ⚠️ LE TARIF DE L'ÉLÈVE (mig. 210) : un élève exonéré n'est pas facturé, et
// la scolarité d'un élève à tarif propre ou réduit par la fratrie est
// facturée à SON montant — sinon la facturation en lot repartirait au plein
// tarif pour les 22 réductions de Tut'Tank.
export async function genererFacturesEnLot(ecoleId, anneeId, eleveIds, fraisList, echeance, mois) {
  const moisLbl = libelleMois(mois);
  const deja = await getLibellesDejaFactures(ecoleId, anneeId);
  const tarifs = await tarifsEleves(anneeId, eleveIds);
  let crees = 0;
  let ignores = 0;
  for (const eleveId of eleveIds) {
    const t = tarifs[eleveId];
    if (t?.exonere) { ignores++; continue; }
    const dejaEleve = deja[eleveId] || new Set();
    const lignes = [];
    for (const fr of fraisList) {
      const libelle = fr.recurrent && moisLbl ? `${fr.libelle} — ${moisLbl}` : fr.libelle;
      if (dejaEleve.has(libelle)) continue;
      //  Inscription pour les nouveaux, réinscription pour les anciens (mig. 211).
      if (t && fr.public === "nouveaux" && !t.nouveau) continue;
      if (t && fr.public === "anciens" && t.nouveau) continue;
      const prix = t?.frais_id && t.frais_id === fr.id && t.montant != null ? Number(t.montant) : Number(fr.montant);
      if (!(prix > 0)) continue;
      lignes.push({ frais_id: fr.id, libelle, quantite: 1, prix_unitaire: prix });
    }
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

// Facture des abonnements (cantine, transport…) : 1 facture par élève avec une
// ligne (libellé + tarif). Ignore un élève déjà facturé pour CE libellé cette
// année (évite les doublons d'un même mois). Retourne { crees, ignores }.
export async function facturerAbonnements(ecoleId, anneeId, items, echeance) {
  const { data, error } = await supabase
    .from("facture_lignes")
    .select("libelle, factures!inner(eleve_id, annee_id)")
    .eq("ecole_id", ecoleId)
    .eq("factures.annee_id", anneeId);
  if (error) throw error;
  const deja = new Set((data ?? []).map((d) => `${d.factures?.eleve_id}::${d.libelle}`));
  let crees = 0, ignores = 0;
  for (const it of items) {
    if (!it.montant || !it.eleve_id || deja.has(`${it.eleve_id}::${it.libelle}`)) { ignores++; continue; }
    await creerFacture(ecoleId, {
      eleve_id: it.eleve_id, annee_id: anneeId, date_echeance: echeance || null,
      lignes: [{ libelle: it.libelle, quantite: 1, prix_unitaire: Number(it.montant) }],
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

// Mentions légales du pied de page des documents de caisse : RCCM, NINEA,
// ordre des chèques, coordonnées bancaires. Absentes de la table `ecoles`,
// elles vivent dans `parametres` — `est_gestion()` peut déjà y écrire, aucune
// migration n'est nécessaire.
export const CLE_IDENTITE = "identite_legale";

export async function getIdentiteLegale(ecoleId) {
  const { data, error } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("ecole_id", ecoleId)
    .eq("cle", CLE_IDENTITE)
    .maybeSingle();
  if (error) throw error;
  return data?.valeur || {};
}

export async function setIdentiteLegale(ecoleId, infos) {
  const { error } = await supabase
    .from("parametres")
    .upsert({ ecole_id: ecoleId, cle: CLE_IDENTITE, valeur: infos }, { onConflict: "ecole_id,cle" });
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
  const lignes = data ?? [];

  //  QUEL parent a déclaré (mig. 202) : un élève a souvent deux parents qui
  //  paient chacun leur part. On résout le nom par la fiche tuteur de
  //  l'école — best-effort : sans elle, la ligne s'affiche sans nom.
  const ids = [...new Set(lignes.map((d) => d.declare_par).filter(Boolean))];
  if (ids.length) {
    const { data: tuteurs } = await supabase
      .from("tuteurs").select("profil_id, prenom, nom")
      .eq("ecole_id", ecoleId).in("profil_id", ids);
    const nom = {};
    for (const t of tuteurs ?? []) nom[t.profil_id] ||= `${t.prenom || ""} ${t.nom || ""}`.trim();
    for (const d of lignes) d.declarant = nom[d.declare_par] || null;
  }
  return lignes;
}

// --- Échéancier, tarif de l'élève, fratrie (mig. 210) ---

// Fonction absente : la migration 210 n'est pas encore appliquée. L'appli
// continue alors comme avant (plein tarif, pas d'échéancier).
const fonctionAbsente = (e) => e?.code === "PGRST202" || /could not find the function|does not exist/i.test(e?.message || "");

// Par élève : { exonere, frais_id, montant } — le montant de SA scolarité.
export async function tarifsEleves(anneeId, eleveIds) {
  if (!anneeId || !eleveIds?.length) return {};
  const { data, error } = await supabase.rpc("tarifs_eleves", { p_annee: anneeId, p_eleves: eleveIds });
  if (error) { if (fonctionAbsente(error)) return {}; throw error; }
  const map = {};
  for (const r of data || []) map[r.eleve_id] = r;
  return map;
}

// { statut, lignes: [{ mois, libelle, recurrent, montant, echeance, paye, etat }] }
// `null` si la migration 210 n'est pas appliquée.
export async function eleveEcheancier(eleveId) {
  const { data, error } = await supabase.rpc("eleve_echeancier", { p_eleve: eleveId });
  if (error) { if (fonctionAbsente(error)) return null; throw error; }
  return data;
}

// Frères et sœurs (parent commun), avec leur classe et — si on a le droit de
// le voir — leur état de paiement.
export async function fratrieEleve(eleveId) {
  const { data, error } = await supabase.rpc("fratrie_eleve", { p_eleve: eleveId });
  if (error) { if (fonctionAbsente(error)) return []; throw error; }
  return data ?? [];
}

// Mensualité propre (null = tarif du niveau), motif, exonération.
export async function definirTarifEleve(eleveId, { mensualite, motif, exonere }) {
  const { error } = await supabase.rpc("definir_tarif_eleve", {
    p_eleve: eleveId,
    p_mensualite: mensualite === "" || mensualite == null ? null : Number(mensualite),
    p_motif: motif || null,
    p_exonere: !!exonere,
  });
  if (error) throw error;
}

// « Nouvel élève » (paie l'inscription) ou ancien (la réinscription).
// `null` = déduit : aucune inscription antérieure dans l'école (mig. 211).
export async function definirNouveauEleve(eleveId, nouveau) {
  const { error } = await supabase.rpc("definir_nouveau_eleve", { p_eleve: eleveId, p_nouveau: nouveau });
  if (error) throw error;
}

// Dernier mois de mensualité de l'année ('AAAA-MM'), ou null = fin de l'année.
export async function definirFinFacturation(anneeId, mois) {
  const { error } = await supabase.rpc("definir_fin_facturation", { p_annee: anneeId, p_mois: mois || null });
  if (error) throw error;
}

// Règles de réduction de fratrie de l'école.
export async function getReglesFratrie(ecoleId) {
  const { data, error } = await supabase
    .from("regles_fratrie").select("id, nb_enfants, type, valeur, cycle_id, cycles(libelle)")
    .eq("ecole_id", ecoleId).order("nb_enfants");
  if (error) { if (error.code === "42P01" || /regles_fratrie/.test(error.message || "")) return null; throw error; }
  return data ?? [];
}
export async function creerRegleFratrie(ecoleId, r) {
  const { error } = await supabase.from("regles_fratrie").insert({
    ecole_id: ecoleId, nb_enfants: Number(r.nb_enfants), type: r.type,
    valeur: Number(r.valeur), cycle_id: r.cycle_id || null,
  });
  if (error) throw error;
}
export async function supprimerRegleFratrie(id) {
  const { error } = await supabase.from("regles_fratrie").delete().eq("id", id);
  if (error) throw error;
}

// --- Paiement anticipé (mig. 202) ---
// Les mois qu'un élève peut payer d'avance (même RPC que le parent).
export async function avanceOptions(eleveId) {
  const { data, error } = await supabase.rpc("avance_options", { p_eleve: eleveId });
  if (error) throw error;
  return data ?? [];
}

// Le parent paie au guichet pour les mois à venir : la facture est créée
// déjà réglée, dans la même transaction que l'encaissement. Renvoie son id.
export async function encaisserAvance(eleveId, mois, p) {
  const { data, error } = await supabase.rpc("encaisser_avance", {
    p_eleve: eleveId, p_mois: mois, p_mode: p.mode,
    p_reference: p.reference || null, p_compte: p.compte_id || null,
  });
  if (error) throw error;
  return data;
}

// URL signée (temporaire) pour consulter une preuve de paiement jointe.
export async function urlPreuve(chemin) {
  if (!chemin) return null;
  const { data, error } = await supabase.storage.from("preuves").createSignedUrl(chemin, 120);
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function validerDeclaration(id) {
  const { error } = await supabase.rpc("valider_declaration", { p_decl: id });
  if (error) throw error;
}

// ⚠️ LE MOTIF EST OBLIGATOIRE côté base (mig. 201), et il part au parent
// dans sa notification : un rejet muet le laissait deviner, ou recommencer
// à l’identique.
export async function rejeterDeclaration(id, motif) {
  const { error } = await supabase.rpc("rejeter_declaration", { p_decl: id, p_motif: motif });
  if (error) throw error;
}

// La situation de paiement de chaque élève de l'année, montants compris
// (mig. 203). Ouverte au pouvoir « Voir l'état de paiement des familles » :
// responsable pédagogique, comptable, secrétariat — dans leur périmètre.
// Lecture seule : ni numéro de facture, ni détail des paiements.
export async function situationPaiements(anneeId, { q = null, classeId = null } = {}) {
  if (!anneeId) return [];
  const { data, error } = await supabase.rpc("situation_paiements", {
    p_annee: anneeId, p_q: q || null, p_classe: classeId || null,
  });
  if (error) throw error;
  return data ?? [];
}

// La grille de suivi des mensualités (mig. 213), à l'image du fichier tenu à
// la main par l'école : une ligne par élève, ce qui est payé pour chaque mois.
// `mois` = { "2026-10": { montant, paye, etat }, … }. Mêmes droits et même
// périmètre que `situationPaiements`. Lecture seule.
export async function grilleMensualites(anneeId, classeId = null) {
  if (!anneeId) return [];
  const { data, error } = await supabase.rpc("grille_mensualites", {
    p_annee: anneeId, p_classe: classeId || null,
  });
  if (error) throw error;
  return data ?? [];
}

// Solde par élève (somme due - payé sur ses factures).
//
// N'utilise PLUS `getFactures`, devenue paginée : un solde calculé sur une
// page serait faux. Requête dédiée et allégée — trois colonnes au lieu des
// lignes complètes avec l'élève embarqué.
// À terme, cet agrégat a sa place en base ; il reste ici tant que la
// volumétrie des factures d'une année le permet.
export async function getSoldesEleves(ecoleId, anneeId) {
  let q = supabase.from("factures")
    .select("eleve_id, montant_total, montant_paye")
    .eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;
  const factures = data ?? [];
  const map = {};
  for (const f of factures) {
    const m = (map[f.eleve_id] ||= { total: 0, paye: 0 });
    m.total += Number(f.montant_total) || 0;
    m.paye += Number(f.montant_paye) || 0;
  }
  return map;
}
