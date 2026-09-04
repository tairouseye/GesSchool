import { supabase } from "@/lib/supabase.js";
import { archiverDocument } from "@/lib/documents.js";
import { getEnseignants } from "@/lib/enseignants.js";
import { lignesStatutaires, lignesBrut, arr } from "@/lib/paie.js";

// GesSchool — couche « RH & paie » : personnels, contrats, salaires.

export const FONCTIONS = [
  "Enseignant", "Directeur", "Surveillant", "Comptable", "Secrétaire",
  "Gardien", "Cuisinier", "Chauffeur", "Agent d'entretien", "Autre",
];

export const TYPES_CONTRAT = ["CDI", "CDD", "Vacation", "Stage"];

// --- Personnels ---
export async function getPersonnels(ecoleId) {
  const { data, error } = await supabase
    .from("personnels")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

// Champs fiscaux/paie optionnels (part IR/TRIMF, matricule, catégorie…).
function champsFiscaux(p) {
  const f = {};
  if (p.matricule !== undefined) f.matricule = p.matricule || null;
  if (p.categorie !== undefined) f.categorie = p.categorie || null;
  if (p.n_ipres !== undefined) f.n_ipres = p.n_ipres || null;
  if (p.situation_familiale !== undefined) f.situation_familiale = p.situation_familiale || null;
  if (p.part_ir !== undefined && p.part_ir !== "") f.part_ir = Number(p.part_ir) || 1;
  if (p.part_trimf !== undefined && p.part_trimf !== "") f.part_trimf = Number(p.part_trimf) || 1;
  if (p.taux_horaire !== undefined) f.taux_horaire = Number(p.taux_horaire) || 0;
  if (p.taux_sursalaire !== undefined) f.taux_sursalaire = Number(p.taux_sursalaire) || 0;
  return f;
}

export async function creerPersonnel(ecoleId, p) {
  const { data, error } = await supabase
    .from("personnels")
    .insert({
      ecole_id: ecoleId,
      prenom: p.prenom,
      nom: p.nom,
      fonction: p.fonction || null,
      telephone: p.telephone || null,
      email: p.email || null,
      date_embauche: p.date_embauche || null,
      profil_id: p.profil_id || null,
      ...champsFiscaux(p),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Édite les informations d'un membre du personnel (dont champs fiscaux).
export async function modifierPersonnel(id, p) {
  const { data, error } = await supabase
    .from("personnels")
    .update({
      prenom: p.prenom,
      nom: p.nom,
      fonction: p.fonction || null,
      telephone: p.telephone || null,
      email: p.email || null,
      date_embauche: p.date_embauche || null,
      ...champsFiscaux(p),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerPersonnel(id) {
  const { error } = await supabase.from("personnels").delete().eq("id", id);
  if (error) throw error;
}

// Pont pédagogie → RH : crée un membre du personnel (fonction « Enseignant »)
// pour chaque enseignant qui n'en a pas encore, afin qu'il apparaisse dans la
// paie sans double saisie. Dédoublonnage par profil lié, sinon par nom+prénom.
export async function importerEnseignantsCommePersonnel(ecoleId) {
  const [enseignants, personnels] = await Promise.all([
    getEnseignants(ecoleId),
    getPersonnels(ecoleId),
  ]);
  const norm = (s) => (s || "").trim().toLowerCase();
  const parProfil = new Set(personnels.filter((p) => p.profil_id).map((p) => p.profil_id));
  const parNom = new Set(personnels.map((p) => `${norm(p.prenom)}|${norm(p.nom)}`));
  const aCreer = enseignants.filter((e) =>
    !(e.profil_id && parProfil.has(e.profil_id)) && !parNom.has(`${norm(e.prenom)}|${norm(e.nom)}`)
  );
  if (aCreer.length === 0) return { crees: 0 };
  const lignes = aCreer.map((e) => ({
    ecole_id: ecoleId, prenom: e.prenom, nom: e.nom, fonction: "Enseignant",
    telephone: e.telephone || null, email: e.email || null, profil_id: e.profil_id || null,
  }));
  const { error } = await supabase.from("personnels").insert(lignes);
  if (error) throw error;
  return { crees: lignes.length };
}

// Nombre d'enseignants pas encore présents dans le personnel (pour l'invite).
export async function compterEnseignantsNonImportes(ecoleId) {
  const [enseignants, personnels] = await Promise.all([
    getEnseignants(ecoleId),
    getPersonnels(ecoleId),
  ]);
  const norm = (s) => (s || "").trim().toLowerCase();
  const parProfil = new Set(personnels.filter((p) => p.profil_id).map((p) => p.profil_id));
  const parNom = new Set(personnels.map((p) => `${norm(p.prenom)}|${norm(p.nom)}`));
  return enseignants.filter((e) =>
    !(e.profil_id && parProfil.has(e.profil_id)) && !parNom.has(`${norm(e.prenom)}|${norm(e.nom)}`)
  ).length;
}

// --- Contrats ---
export async function getContrats(ecoleId) {
  const { data, error } = await supabase
    .from("contrats")
    .select("*")
    .eq("ecole_id", ecoleId)
    .order("debut", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Contrat le plus récent par personnel (indexé personnel_id).
export async function getContratsActifs(ecoleId) {
  const contrats = await getContrats(ecoleId);
  const map = {};
  for (const c of contrats) {
    const cur = map[c.personnel_id];
    if (!cur || (c.debut || "") > (cur.debut || "")) map[c.personnel_id] = c;
  }
  return map;
}

// Dernier jour d'une période 'YYYY-MM' → 'YYYY-MM-DD' (calcul en UTC pour
// éviter tout décalage de fuseau lors des comparaisons de dates).
export function finDeMois(periode) {
  const [a, m] = (periode || "").split("-").map(Number);
  if (!a || !m) return periode;
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

// Le contrat est-il actif pendant la période 'YYYY-MM' ?
// (commencé au plus tard le dernier jour du mois ET pas terminé avant le 1er).
export function contratActifPour(contrat, periode) {
  if (!contrat) return false;
  const debutMois = `${periode}-01`;
  const finMois = finDeMois(periode);
  if (contrat.debut && contrat.debut > finMois) return false; // pas encore commencé
  if (contrat.fin && contrat.fin < debutMois) return false;   // déjà terminé
  return true;
}

export async function creerContrat(ecoleId, c) {
  const { data, error } = await supabase
    .from("contrats")
    .insert({
      ecole_id: ecoleId,
      personnel_id: c.personnel_id,
      type: c.type || null,
      salaire_base: Number(c.salaire_base) || 0,
      debut: c.debut || null,
      fin: c.fin || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function modifierContrat(id, c) {
  const { data, error } = await supabase
    .from("contrats")
    .update({
      type: c.type || null,
      salaire_base: Number(c.salaire_base) || 0,
      debut: c.debut || null,
      fin: c.fin || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Définit le salaire de base courant : met à jour le contrat existant s'il y en
// a un, sinon en crée un. Simplifie l'édition du salaire depuis la fiche RH.
export async function definirSalaireBase(ecoleId, personnelId, c, contratId) {
  if (contratId) return modifierContrat(contratId, c);
  return creerContrat(ecoleId, { ...c, personnel_id: personnelId });
}

export async function supprimerContrat(id) {
  const { error } = await supabase.from("contrats").delete().eq("id", id);
  if (error) throw error;
}

// --- Paie (salaires) ---
export async function getSalaires(ecoleId, periode) {
  const { data, error } = await supabase
    .from("salaires")
    .select("*, personnels(prenom, nom, fonction)")
    .eq("ecole_id", ecoleId)
    .eq("periode", periode)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).sort((a, b) =>
    `${a.personnels?.nom || ""}`.localeCompare(`${b.personnels?.nom || ""}`)
  );
}

// Éléments récurrents d'une école, groupés par personnel (Phase D).
async function affectationsParPersonnel(ecoleId) {
  const { data, error } = await supabase
    .from("personnel_elements_paie")
    .select("personnel_id, element_id, montant, elements_paie(libelle, sens, soumis)")
    .eq("ecole_id", ecoleId)
    .eq("actif", true);
  if (error) throw error;
  const map = {};
  for (const a of data ?? []) (map[a.personnel_id] ||= []).push(a);
  return map;
}

// Heures mensuelles de référence (fixes pour tous, définies par le comptable).
export async function getHeuresMensuelles(ecoleId) {
  const { data, error } = await supabase
    .from("parametres").select("valeur").eq("ecole_id", ecoleId).eq("cle", "heures_mensuelles").maybeSingle();
  if (error) throw error;
  const h = Number(data?.valeur?.heures);
  return Number.isFinite(h) && h > 0 ? h : 173.33;
}

export async function setHeuresMensuelles(ecoleId, heures) {
  const { error } = await supabase.from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "heures_mensuelles", valeur: { heures: Number(heures) || 0 } }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Construit les lignes GAINS d'un bulletin. En mode complet : Salaire de base
// (+ sursalaire) = heures × taux horaire de l'employé ; sinon salaire de base
// plat (contrat). Les éléments récurrents sont ajoutés à plat.
function lignesInitiales(ecoleId, salaireId, personnel, base, affectations, ctx, heures) {
  const lignes = [];
  if (ctx && Number(personnel?.taux_horaire) > 0) {
    const h = heures != null ? Number(heures) : ctx.heures;
    for (const l of lignesBrut(h, personnel)) {
      lignes.push({ ecole_id: ecoleId, salaire_id: salaireId, libelle: l.libelle, sens: l.sens, nature: l.nature, base: l.base, taux: l.taux, montant: l.montant, ordre: l.ordre });
    }
  } else {
    lignes.push({ ecole_id: ecoleId, salaire_id: salaireId, libelle: "Salaire de base", sens: "gain", nature: "base", montant: Number(base) || 0, ordre: 0 });
  }
  (affectations || []).forEach((a, i) => {
    const sens = a.elements_paie?.sens || "gain";
    const nonSoumis = sens === "gain" && a.elements_paie?.soumis === false;
    lignes.push({
      ecole_id: ecoleId, salaire_id: salaireId, element_id: a.element_id,
      libelle: a.elements_paie?.libelle || "Élément", sens, nature: nonSoumis ? "non_soumis" : (sens === "gain" ? "gain" : "retenue"),
      montant: Number(a.montant) || 0, ordre: 10 + i,
    });
  });
  return lignes;
}

// Brut SOUMIS (assiette cotisations/IR) = gains hors indemnités « non soumis ».
function brutSoumis(lignes, salaireId) {
  return lignes
    .filter((l) => (salaireId ? l.salaire_id === salaireId : true) && l.sens === "gain" && l.nature !== "non_soumis")
    .reduce((s, l) => s + Number(l.montant || 0), 0);
}

// Contexte « régime complet » (mode + cotisations + barème + heures) si activé.
async function contexteComplet(ecoleId) {
  const mode = await getModePaie(ecoleId);
  if (mode !== "complet") return null;
  const [cotisations, baremeMensuel, heures] = await Promise.all([getCotisations(ecoleId), getBareme(ecoleId, "mensuel"), getHeuresMensuelles(ecoleId)]);
  return { cotisations, baremeMensuel, heures };
}

// Ajoute (en mode complet) les lignes statutaires calculées sur le brut soumis.
function ajouterStatutaire(lignes, ecoleId, salaireId, personnel, ctx) {
  if (!ctx) return;
  const brut = brutSoumis(lignes, salaireId);
  const stat = lignesStatutaires(brut, {
    partIr: personnel?.part_ir || 1, partTrimf: personnel?.part_trimf || 1,
    cotisations: ctx.cotisations, baremeMensuel: ctx.baremeMensuel,
  });
  stat.forEach((l) => lignes.push({ ecole_id: ecoleId, salaire_id: salaireId, libelle: l.libelle, sens: l.sens, nature: l.nature, montant: l.montant, ordre: l.ordre }));
}

// Personnel à générer pour une période : contrat actif + pas de fiche existante.
// Sert à l'étape « Préparer la paie » (heures/absences validées par le comptable).
export async function personnelAgenerer(ecoleId, periode) {
  const [pers, contrats, existant] = await Promise.all([
    getPersonnels(ecoleId),
    getContratsActifs(ecoleId),
    supabase.from("salaires").select("personnel_id").eq("ecole_id", ecoleId).eq("periode", periode),
  ]);
  const deja = new Set((existant.data ?? []).map((s) => s.personnel_id));
  return pers.filter((p) => !deja.has(p.id) && contratActifPour(contrats[p.id], periode));
}

// Génère les fiches de paie d'une période pour le personnel au contrat ACTIF.
// `heuresParEmploye` (optionnel) : { personnel_id: heures } — heures validées par
// le comptable (absences). À défaut, les heures mensuelles de référence.
// Composition : Salaire de base + éléments récurrents (+ cotisations/IR/TRIMF
// en mode complet). Net calculé par trigger.
export async function genererPaie(ecoleId, periode, heuresParEmploye = null) {
  const [pers, contrats, existant, aff, ctx] = await Promise.all([
    getPersonnels(ecoleId),
    getContratsActifs(ecoleId),
    supabase.from("salaires").select("personnel_id").eq("ecole_id", ecoleId).eq("periode", periode),
    affectationsParPersonnel(ecoleId),
    contexteComplet(ecoleId),
  ]);
  const deja = new Set((existant.data ?? []).map((s) => s.personnel_id));
  const aCreer = pers.filter((p) => !deja.has(p.id) && contratActifPour(contrats[p.id], periode));
  if (aCreer.length === 0) return { crees: 0 };
  const { data: crees, error } = await supabase
    .from("salaires")
    .insert(aCreer.map((p) => ({ ecole_id: ecoleId, personnel_id: p.id, periode, montant_brut: 0, prime: 0, retenue: 0, montant_net: 0, paye: false })))
    .select("id, personnel_id");
  if (error) throw error;
  const parId = new Map(pers.map((p) => [p.id, p]));
  const lignes = [];
  for (const s of crees) {
    const p = parId.get(s.personnel_id);
    const heures = heuresParEmploye ? heuresParEmploye[s.personnel_id] : undefined;
    lignes.push(...lignesInitiales(ecoleId, s.id, p, contrats[s.personnel_id]?.salaire_base || 0, aff[s.personnel_id], ctx, heures));
    ajouterStatutaire(lignes, ecoleId, s.id, p, ctx);
  }
  if (lignes.length) {
    const { error: e2 } = await supabase.from("salaire_lignes").insert(lignes);
    if (e2) throw e2;
  }
  return { crees: crees.length };
}

// Crée à la demande une fiche pour UN personnel. Renvoie la fiche.
export async function ajouterFichePaie(ecoleId, personnelId, periode, elements = {}) {
  const { data, error } = await supabase
    .from("salaires")
    .insert({ ecole_id: ecoleId, personnel_id: personnelId, periode, montant_brut: 0, prime: 0, retenue: 0, montant_net: 0, paye: false })
    .select("*, personnels(prenom, nom, fonction, part_ir, part_trimf, taux_horaire, taux_sursalaire)")
    .single();
  if (error) throw error;
  const [aff, ctx] = await Promise.all([affectationsParPersonnel(ecoleId), contexteComplet(ecoleId)]);
  const lignes = lignesInitiales(ecoleId, data.id, data.personnels, elements.montant_brut || 0, aff[personnelId], ctx);
  ajouterStatutaire(lignes, ecoleId, data.id, data.personnels, ctx);
  const { error: e2 } = await supabase.from("salaire_lignes").insert(lignes);
  if (e2) throw e2;
  return data;
}

// Recalcule les lignes statutaires d'un bulletin (mode complet) depuis ses gains
// actuels : remplace cotisations/IR/TRIMF/patronal. Utile après édition des gains.
export async function recalculerStatutaire(ecoleId, salaireId) {
  const [{ data: sal }, lignes, cotisations, baremeMensuel] = await Promise.all([
    supabase.from("salaires").select("personnels(part_ir, part_trimf)").eq("id", salaireId).single(),
    getLignesSalaire(salaireId), getCotisations(ecoleId), getBareme(ecoleId, "mensuel"),
  ]);
  const brut = brutSoumis(lignes);
  const aSuppr = lignes.filter((l) => ["cotisation", "impot", "patronal"].includes(l.nature));
  for (const l of aSuppr) await supabase.from("salaire_lignes").delete().eq("id", l.id);
  const p = sal?.personnels || {};
  const stat = lignesStatutaires(brut, { partIr: p.part_ir || 1, partTrimf: p.part_trimf || 1, cotisations, baremeMensuel });
  const ins = stat.map((l) => ({ ecole_id: ecoleId, salaire_id: salaireId, libelle: l.libelle, sens: l.sens, nature: l.nature, montant: l.montant, ordre: l.ordre }));
  if (ins.length) { const { error } = await supabase.from("salaire_lignes").insert(ins); if (error) throw error; }
}

// --- Lignes de bulletin (composition dynamique) — Phase D ---
export async function getLignesSalaire(salaireId) {
  const { data, error } = await supabase
    .from("salaire_lignes").select("*").eq("salaire_id", salaireId)
    .order("sens").order("ordre");
  if (error) throw error;
  return data ?? [];
}

export async function ajouterLigneSalaire(ecoleId, salaireId, l) {
  const { data, error } = await supabase
    .from("salaire_lignes")
    .insert({ ecole_id: ecoleId, salaire_id: salaireId, element_id: l.element_id || null, libelle: l.libelle, sens: l.sens, nature: l.nature || null, montant: Number(l.montant) || 0, ordre: l.ordre || 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function majLigneSalaire(id, montant) {
  const { error } = await supabase.from("salaire_lignes").update({ montant: Number(montant) || 0 }).eq("id", id);
  if (error) throw error;
}

// Édite base (heures/assiette) et/ou taux d'une ligne ; montant = round(base × taux).
export async function majLigneBaseTaux(id, base, taux) {
  const b = Number(base) || 0, t = Number(taux) || 0;
  const { error } = await supabase.from("salaire_lignes").update({ base: b, taux: t, montant: arr(b * t) }).eq("id", id);
  if (error) throw error;
}

export async function supprimerLigneSalaire(id) {
  const { error } = await supabase.from("salaire_lignes").delete().eq("id", id);
  if (error) throw error;
}

// Met à jour les éléments de salaire ; recalcule le net (base + prime − retenue)
// et resynchronise la dépense comptable liée si le salaire est déjà payé.
// Passe par une RPC SECURITY DEFINER pour permettre l'édition même après
// paiement sans exiger le rôle comptable (cf. migration 074).
export async function majSalaire(id, { montant_brut, prime, retenue }) {
  const { error } = await supabase.rpc("maj_salaire", {
    p_salaire: id,
    p_brut: Number(montant_brut) || 0,
    p_prime: Number(prime) || 0,
    p_retenue: Number(retenue) || 0,
  });
  if (error) throw error;
}

// Workflow (Phase E) : brouillon → validé → payé.
export async function validerSalaire(id) {
  const { error } = await supabase.rpc("valider_salaire", { p_salaire: id });
  if (error) throw error;
}

export async function devaliderSalaire(id, motif) {
  const { error } = await supabase.rpc("devalider_salaire", { p_salaire: id, p_motif: motif || null });
  if (error) throw error;
}

// Marque payé ET crée la dépense comptable correspondante (RPC sécurisée).
export async function marquerPaye(id, { date_paiement, mode, compte_id } = {}) {
  const { error } = await supabase.rpc("payer_salaire", {
    p_salaire: id,
    p_date: date_paiement || new Date().toISOString().slice(0, 10),
    p_mode: mode || null,
    p_compte: compte_id || null,
  });
  if (error) throw error;

  // Archivage GED de la fiche de paie (best-effort). On récupère le salaire payé.
  supabase.from("salaires")
    .select("ecole_id, montant_net, periode, personnel_id, personnels(prenom, nom)")
    .eq("id", id).single()
    .then(({ data: s }) => {
      if (!s) return;
      return archiverDocument(s.ecole_id, {
        type: "paie", famille: "rh", titre: "Fiche de paie",
        cible_type: "personnel", cible_id: s.personnel_id,
        cible_libelle: `${s.personnels?.nom || ""} ${s.personnels?.prenom || ""}`.trim(),
        montant: s.montant_net, reference: s.periode || null,
        donnees: { net: s.montant_net, periode: s.periode, mode: mode || null, date: date_paiement || null },
      });
    })
    .then(undefined, () => {});
}

// Annule le paiement ET supprime la dépense comptable liée.
export async function annulerPaiement(id) {
  const { error } = await supabase.rpc("annuler_salaire", { p_salaire: id });
  if (error) throw error;
}

export async function supprimerSalaire(id) {
  const { error } = await supabase.from("salaires").delete().eq("id", id);
  if (error) throw error;
}

// --- Éléments de paie (catalogue configurable) — Phase C ---
export async function getElementsPaie(ecoleId, sens) {
  let q = supabase.from("elements_paie").select("*").eq("ecole_id", ecoleId);
  if (sens) q = q.eq("sens", sens);
  const { data, error } = await q.order("sens").order("ordre").order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerElementPaie(ecoleId, e) {
  const { data, error } = await supabase
    .from("elements_paie")
    .insert({
      ecole_id: ecoleId,
      libelle: (e.libelle || "").trim(),
      sens: e.sens,
      mode: e.mode || "fixe",
      recurrent: !!e.recurrent,
      imposable: !!e.imposable,
      soumis: e.soumis === false ? false : true,
      ordre: e.ordre || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function modifierElementPaie(id, patch) {
  const p = {};
  for (const k of ["libelle", "sens", "mode", "recurrent", "imposable", "soumis", "ordre", "actif"]) {
    if (patch[k] != null) p[k] = k === "libelle" ? patch[k].trim() : patch[k];
  }
  const { data, error } = await supabase.from("elements_paie").update(p).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerElementPaie(id) {
  const { error } = await supabase.from("elements_paie").delete().eq("id", id);
  if (error) throw error;
}

// --- Éléments récurrents affectés à un employé (utilisé en Phase D) ---
export async function getElementsPersonnel(ecoleId, personnelId) {
  const { data, error } = await supabase
    .from("personnel_elements_paie")
    .select("*, elements_paie(libelle, sens, mode, recurrent)")
    .eq("ecole_id", ecoleId)
    .eq("personnel_id", personnelId);
  if (error) throw error;
  return data ?? [];
}

export async function definirElementPersonnel(ecoleId, personnelId, elementId, montant) {
  const { data, error } = await supabase
    .from("personnel_elements_paie")
    .upsert(
      { ecole_id: ecoleId, personnel_id: personnelId, element_id: elementId, montant: Number(montant) || 0, actif: true },
      { onConflict: "personnel_id,element_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function retirerElementPersonnel(id) {
  const { error } = await supabase.from("personnel_elements_paie").delete().eq("id", id);
  if (error) throw error;
}

// --- PHASE D-bis : régime de paie (cotisations, mode, barème IR) ---

// Cotisations configurables (définies par le comptable / RH).
export async function getCotisations(ecoleId) {
  const { data, error } = await supabase
    .from("cotisations_paie").select("*").eq("ecole_id", ecoleId).order("ordre").order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function creerCotisation(ecoleId, c) {
  const { data, error } = await supabase.from("cotisations_paie").insert({
    ecole_id: ecoleId, libelle: (c.libelle || "").trim(), assiette: c.assiette || "brut",
    taux_salarial: Number(c.taux_salarial) || 0, taux_patronal: Number(c.taux_patronal) || 0,
    plafond: c.plafond === "" || c.plafond == null ? null : Number(c.plafond),
    forfait_salarial: Number(c.forfait_salarial) || 0, forfait_patronal: Number(c.forfait_patronal) || 0,
    ordre: c.ordre || 0,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function modifierCotisation(id, patch) {
  const p = {};
  for (const k of ["libelle", "assiette", "actif", "ordre"]) if (patch[k] != null) p[k] = k === "libelle" ? patch[k].trim() : patch[k];
  for (const k of ["taux_salarial", "taux_patronal", "forfait_salarial", "forfait_patronal"]) if (patch[k] != null) p[k] = Number(patch[k]) || 0;
  if (patch.plafond !== undefined) p.plafond = patch.plafond === "" || patch.plafond == null ? null : Number(patch.plafond);
  const { data, error } = await supabase.from("cotisations_paie").update(p).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function supprimerCotisation(id) {
  const { error } = await supabase.from("cotisations_paie").delete().eq("id", id);
  if (error) throw error;
}

// Mode de paie de l'école : 'simplifie' (défaut) ou 'complet' (moteur statutaire).
export async function getModePaie(ecoleId) {
  const { data, error } = await supabase
    .from("parametres").select("valeur").eq("ecole_id", ecoleId).eq("cle", "mode_paie").maybeSingle();
  if (error) throw error;
  return data?.valeur?.mode || "simplifie";
}

export async function setModePaie(ecoleId, mode) {
  const { error } = await supabase.from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "mode_paie", valeur: { mode } }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Barème IR chargé par l'école (mensuel + annuel). Comptage pour l'état.
export async function compterBareme(ecoleId) {
  const { data, error } = await supabase.from("bareme_ir").select("periodicite").eq("ecole_id", ecoleId);
  if (error) throw error;
  const r = { mensuel: 0, annuel: 0 };
  for (const x of data ?? []) r[x.periodicite] = (r[x.periodicite] || 0) + 1;
  return r;
}

// Remplace le barème d'une périodicité ('mensuel'|'annuel') par les lignes fournies.
// rows: [{ revenu:Number, trimf:Number, ir:{ "1":x, "1.5":y, ... } }]
export async function importerBareme(ecoleId, periodicite, rows) {
  await supabase.from("bareme_ir").delete().eq("ecole_id", ecoleId).eq("periodicite", periodicite);
  const lignes = (rows || [])
    .filter((r) => r && Number.isFinite(Number(r.revenu)))
    .map((r) => ({ ecole_id: ecoleId, periodicite, revenu: Number(r.revenu), trimf: Number(r.trimf) || 0, ir: r.ir || {} }));
  if (lignes.length === 0) return { importes: 0 };
  // Insertion par lots (barèmes volumineux : ~5000 lignes).
  const taille = 1000;
  for (let i = 0; i < lignes.length; i += taille) {
    const { error } = await supabase.from("bareme_ir").insert(lignes.slice(i, i + taille));
    if (error) throw error;
  }
  return { importes: lignes.length };
}

// Barème complet d'une périodicité (pour lecture/moteur côté client).
export async function getBareme(ecoleId, periodicite) {
  const { data, error } = await supabase
    .from("bareme_ir").select("revenu, trimf, ir").eq("ecole_id", ecoleId).eq("periodicite", periodicite)
    .order("revenu");
  if (error) throw error;
  return data ?? [];
}
