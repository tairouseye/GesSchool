import { supabase } from "@/lib/supabase.js";
import { LMD_CONFIG_DEFAUT } from "@/lib/lmd.js";

// GesSchool Supérieur — accès données de la structure académique LMD
// (Faculté → Département → Filière → Semestre) et de la maquette (UE → ECUE).
// Réservé aux établissements dont type_etablissement = 'superieur'.

export { TYPES_UE, DIPLOMES, CREDITS_SEMESTRE, LMD_CONFIG_DEFAUT } from "@/lib/lmd.js";

// --- Facultés / UFR / Instituts ---
export async function getFacultes(ecoleId) {
  const { data, error } = await supabase
    .from("facultes").select("*").eq("ecole_id", ecoleId)
    .order("ordre").order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function creerFaculte(ecoleId, f) {
  const { data, error } = await supabase.from("facultes")
    .insert({ ecole_id: ecoleId, nom: f.nom, sigle: f.sigle || null, ordre: f.ordre ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierFaculte(id, f) {
  const { error } = await supabase.from("facultes").update(f).eq("id", id);
  if (error) throw error;
}
export async function supprimerFaculte(id) {
  const { error } = await supabase.from("facultes").delete().eq("id", id);
  if (error) throw error;
}

// --- Départements ---
export async function getDepartements(ecoleId, faculteId) {
  let q = supabase.from("departements").select("*").eq("ecole_id", ecoleId);
  if (faculteId) q = q.eq("faculte_id", faculteId);
  const { data, error } = await q.order("ordre").order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function creerDepartement(ecoleId, faculteId, d) {
  const { data, error } = await supabase.from("departements")
    .insert({ ecole_id: ecoleId, faculte_id: faculteId, nom: d.nom, ordre: d.ordre ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierDepartement(id, d) {
  const { error } = await supabase.from("departements").update(d).eq("id", id);
  if (error) throw error;
}
export async function supprimerDepartement(id) {
  const { error } = await supabase.from("departements").delete().eq("id", id);
  if (error) throw error;
}

// --- Filières / Mentions ---
export async function getFilieres(ecoleId, departementId) {
  let q = supabase.from("filieres").select("*").eq("ecole_id", ecoleId);
  if (departementId) q = q.eq("departement_id", departementId);
  const { data, error } = await q.order("ordre").order("nom");
  if (error) throw error;
  return data ?? [];
}
export async function creerFiliere(ecoleId, departementId, f) {
  const { data, error } = await supabase.from("filieres")
    .insert({ ecole_id: ecoleId, departement_id: departementId, nom: f.nom, sigle: f.sigle || null, diplome: f.diplome || "licence", ordre: f.ordre ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierFiliere(id, f) {
  const { error } = await supabase.from("filieres").update(f).eq("id", id);
  if (error) throw error;
}
export async function supprimerFiliere(id) {
  const { error } = await supabase.from("filieres").delete().eq("id", id);
  if (error) throw error;
}

// --- Semestres (d'une filière) ---
export async function getSemestres(ecoleId, filiereId) {
  const { data, error } = await supabase.from("semestres")
    .select("*").eq("ecole_id", ecoleId).eq("filiere_id", filiereId)
    .order("ordre").order("numero");
  if (error) throw error;
  return data ?? [];
}
export async function creerSemestre(ecoleId, filiereId, s) {
  const { data, error } = await supabase.from("semestres")
    .insert({
      ecole_id: ecoleId, filiere_id: filiereId,
      niveau: s.niveau || null, numero: s.numero ?? null,
      libelle: s.libelle, credits_requis: s.credits_requis ?? 30, ordre: s.ordre ?? 0,
    })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierSemestre(id, s) {
  const { error } = await supabase.from("semestres").update(s).eq("id", id);
  if (error) throw error;
}
export async function supprimerSemestre(id) {
  const { error } = await supabase.from("semestres").delete().eq("id", id);
  if (error) throw error;
}

// --- UE + ECUE (maquette du semestre) ---
// Renvoie les UE d'un semestre avec leurs ECUE imbriqués.
export async function getMaquette(ecoleId, semestreId) {
  const { data: ues, error } = await supabase.from("ue")
    .select("*").eq("ecole_id", ecoleId).eq("semestre_id", semestreId)
    .order("ordre").order("intitule");
  if (error) throw error;
  const ids = (ues ?? []).map((u) => u.id);
  let ecues = [];
  if (ids.length) {
    const { data, error: e2 } = await supabase.from("ecue")
      .select("*").in("ue_id", ids).order("ordre").order("intitule");
    if (e2) throw e2;
    ecues = data ?? [];
  }
  const parUe = {};
  for (const ec of ecues) (parUe[ec.ue_id] ||= []).push(ec);
  return (ues ?? []).map((u) => ({ ...u, ecues: parUe[u.id] || [] }));
}

export async function creerUE(ecoleId, filiereId, semestreId, u) {
  const { data, error } = await supabase.from("ue")
    .insert({
      ecole_id: ecoleId, filiere_id: filiereId, semestre_id: semestreId,
      code: u.code || null, intitule: u.intitule,
      credits: Number(u.credits) || 0, coefficient: Number(u.coefficient) || 1,
      type_ue: u.type_ue || "fondamentale", ordre: u.ordre ?? 0,
    })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierUE(id, u) {
  const { error } = await supabase.from("ue").update(u).eq("id", id);
  if (error) throw error;
}
export async function supprimerUE(id) {
  const { error } = await supabase.from("ue").delete().eq("id", id);
  if (error) throw error;
}

export async function creerECUE(ecoleId, ueId, e) {
  const { data, error } = await supabase.from("ecue")
    .insert({
      ecole_id: ecoleId, ue_id: ueId, code: e.code || null, intitule: e.intitule,
      credits: Number(e.credits) || 0, coefficient: Number(e.coefficient) || 1, ordre: e.ordre ?? 0,
    })
    .select().single();
  if (error) throw error;
  return data;
}
export async function modifierECUE(id, e) {
  const { error } = await supabase.from("ecue").update(e).eq("id", id);
  if (error) throw error;
}
export async function supprimerECUE(id) {
  const { error } = await supabase.from("ecue").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
//  Inscriptions administrative (IA) & pédagogique (IP)
// =====================================================================

export const STATUTS_INSCRIPTION = {
  active: "Active", suspendue: "Suspendue", annulee: "Annulée",
};

// Inscriptions administratives (avec l'étudiant, la filière et le nb d'UE choisies).
export async function getInscriptions(ecoleId, { anneeId, filiereId, niveau } = {}) {
  let q = supabase
    .from("inscriptions_sup")
    .select("*, eleves(prenom, nom, matricule), filieres(nom, sigle, diplome), inscriptions_ue(id, ue_id)")
    .eq("ecole_id", ecoleId);
  if (anneeId) q = q.eq("annee_id", anneeId);
  if (filiereId) q = q.eq("filiere_id", filiereId);
  if (niveau) q = q.eq("niveau", niveau);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function creerInscription(ecoleId, i) {
  const { data, error } = await supabase.from("inscriptions_sup")
    .insert({
      ecole_id: ecoleId, eleve_id: i.eleve_id, filiere_id: i.filiere_id,
      niveau: i.niveau || null, annee_id: i.annee_id || null,
      date_inscription: i.date_inscription || new Date().toISOString().slice(0, 10),
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function modifierInscription(id, i) {
  const { error } = await supabase.from("inscriptions_sup").update(i).eq("id", id);
  if (error) throw error;
}

export async function supprimerInscription(id) {
  const { error } = await supabase.from("inscriptions_sup").delete().eq("id", id);
  if (error) throw error;
}

// UE proposables d'une filière (toutes les UE de ses semestres), avec le semestre
// imbriqué pour le regroupement. Filtre optionnel par niveau (porté par le semestre).
export async function getUEFiliere(ecoleId, filiereId, niveau) {
  const { data, error } = await supabase.from("ue")
    .select("*, semestres!inner(id, libelle, niveau, ordre, numero)")
    .eq("ecole_id", ecoleId).eq("filiere_id", filiereId)
    .order("ordre");
  if (error) throw error;
  let liste = data ?? [];
  if (niveau) liste = liste.filter((u) => (u.semestres?.niveau || null) === niveau);
  return liste;
}

export async function getInscriptionUE(inscriptionId) {
  const { data, error } = await supabase.from("inscriptions_ue")
    .select("id, ue_id, statut").eq("inscription_id", inscriptionId);
  if (error) throw error;
  return data ?? [];
}

// Remplace la liste des UE d'une inscription (IP) par la sélection donnée.
export async function definirInscriptionUE(ecoleId, inscriptionId, ueIds) {
  const { error: eDel } = await supabase.from("inscriptions_ue")
    .delete().eq("inscription_id", inscriptionId);
  if (eDel) throw eDel;
  const rows = (ueIds || []).map((ue_id) => ({ ecole_id: ecoleId, inscription_id: inscriptionId, ue_id }));
  if (rows.length) {
    const { error } = await supabase.from("inscriptions_ue").insert(rows);
    if (error) throw error;
  }
}

// =====================================================================
//  Notes LMD (saisie CC/examen) & configuration de calcul
// =====================================================================

export const SESSIONS = [["normale", "Session normale"], ["rattrapage", "Rattrapage"]];

// Pondération CC/examen + seuils (par école, dans `parametres`).
export async function getLmdConfig(ecoleId) {
  const { data, error } = await supabase.from("parametres").select("valeur")
    .eq("ecole_id", ecoleId).eq("cle", "lmd_config").maybeSingle();
  if (error) throw error;
  return { ...LMD_CONFIG_DEFAUT, ...(data?.valeur || {}) };
}
export async function setLmdConfig(ecoleId, cfg) {
  const { error } = await supabase.from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "lmd_config", valeur: cfg }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Notes d'une session pour un ensemble d'UE (typiquement celles d'un semestre).
export async function getNotesLMD(ecoleId, ueIds, session = "normale") {
  if (!ueIds || ueIds.length === 0) return [];
  const { data, error } = await supabase.from("notes_lmd")
    .select("*").eq("ecole_id", ecoleId).eq("session", session).in("ue_id", ueIds);
  if (error) throw error;
  return data ?? [];
}

// Remplace les notes d'une UE (une composante ECUE ou l'UE) pour un lot
// d'étudiants et une session. `rows` = [{ inscription_id, ecue_id|null, cc, examen }].
export async function enregistrerNotesUE(ecoleId, ueId, ecueId, session, rows) {
  const ids = [...new Set((rows || []).map((r) => r.inscription_id))];
  if (ids.length === 0) return;
  let del = supabase.from("notes_lmd").delete()
    .eq("ecole_id", ecoleId).eq("ue_id", ueId).eq("session", session).in("inscription_id", ids);
  del = ecueId ? del.eq("ecue_id", ecueId) : del.is("ecue_id", null);
  const { error: eDel } = await del;
  if (eDel) throw eDel;

  const aInserer = (rows || [])
    .filter((r) => r.cc != null && r.cc !== "" || r.examen != null && r.examen !== "")
    .map((r) => ({
      ecole_id: ecoleId, inscription_id: r.inscription_id, ue_id: ueId,
      ecue_id: ecueId || null, session,
      cc: r.cc === "" || r.cc == null ? null : Number(r.cc),
      examen: r.examen === "" || r.examen == null ? null : Number(r.examen),
    }));
  if (aInserer.length) {
    const { error } = await supabase.from("notes_lmd").insert(aInserer);
    if (error) throw error;
  }
}

// =====================================================================
//  Délibérations & relevés de notes
// =====================================================================

export async function getDeliberations(ecoleId, { filiereId, niveau, semestreId, session, anneeId } = {}) {
  let q = supabase.from("deliberations").select("*").eq("ecole_id", ecoleId);
  if (filiereId) q = q.eq("filiere_id", filiereId);
  if (semestreId) q = q.eq("semestre_id", semestreId);
  if (session) q = q.eq("session", session);
  if (niveau) q = q.eq("niveau", niveau);
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getReleves(deliberationId) {
  const { data, error } = await supabase.from("releves")
    .select("*, eleves(prenom, nom, matricule)")
    .eq("deliberation_id", deliberationId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// Arrête les résultats d'une cohorte : fige une délibération + un relevé par
// étudiant. Remplace une délibération NON verrouillée existante pour le même
// contexte. `rows` = résultats déjà calculés par le moteur (lib/lmd.js).
export async function arreterResultats(ecoleId, combo, rows) {
  let del = supabase.from("deliberations").delete()
    .eq("ecole_id", ecoleId).eq("filiere_id", combo.filiereId)
    .eq("semestre_id", combo.semestreId).eq("session", combo.session)
    .eq("verrouillee", false);
  del = combo.niveau ? del.eq("niveau", combo.niveau) : del.is("niveau", null);
  del = combo.anneeId ? del.eq("annee_id", combo.anneeId) : del.is("annee_id", null);
  const { error: eDel } = await del;
  if (eDel) throw eDel;

  const { data: delib, error } = await supabase.from("deliberations").insert({
    ecole_id: ecoleId, filiere_id: combo.filiereId, niveau: combo.niveau || null,
    semestre_id: combo.semestreId, session: combo.session, annee_id: combo.anneeId || null,
  }).select().single();
  if (error) throw error;

  const releveRows = (rows || []).map((r) => ({
    ecole_id: ecoleId, deliberation_id: delib.id, inscription_id: r.inscription_id,
    eleve_id: r.eleve_id, moyenne: r.moyenne, credits_acquis: r.credits_acquis,
    credits_total: r.credits_total, decision: r.decision, mention: r.mention || null,
    valide: !!r.valide, details: r.details || null,
  }));
  if (releveRows.length) {
    const { error: e2 } = await supabase.from("releves").insert(releveRows);
    if (e2) throw e2;
  }
  return delib;
}

export async function verrouillerDeliberation(id, verrouillee = true) {
  const { error } = await supabase.from("deliberations").update({ verrouillee }).eq("id", id);
  if (error) throw error;
}

export async function supprimerDeliberation(id) {
  const { error } = await supabase.from("deliberations").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
//  Codes étudiants (comptes) — côté établissement
// =====================================================================

// Liste des étudiants (fiches eleves) avec l'état de leur code/compte.
export async function getEtudiantsCodes(ecoleId) {
  const { data, error } = await supabase
    .from("eleves")
    .select("id, prenom, nom, matricule, telephone, code_acces, profil_id")
    .eq("ecole_id", ecoleId)
    .order("nom").order("prenom");
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule,
    telephone: e.telephone || "", code: e.code_acces || null, connecte: !!e.profil_id,
  }));
}

export async function genererCodeEtudiant(eleveId) {
  const { data, error } = await supabase.rpc("generer_code_etudiant", { p_eleve: eleveId });
  if (error) throw error;
  return data;
}

// Renseigne / corrige le téléphone d'un étudiant (pour l'envoi WhatsApp du code).
export async function setTelephoneEtudiant(eleveId, telephone) {
  const { error } = await supabase.from("eleves").update({ telephone: telephone || null }).eq("id", eleveId);
  if (error) throw error;
}
