import { supabase } from "@/lib/supabase.js";

// GesSchool — espace ÉTUDIANT (supérieur). L'étudiant majeur a son compte
// (lié à sa fiche via un code), et gère notamment le consentement d'accès
// de ses parents à ses notes.

// Lie le compte connecté à sa fiche étudiant via le code de l'établissement.
export async function lierEtudiant(code) {
  const { data, error } = await supabase.rpc("lier_etudiant", { p_code: (code || "").trim() });
  if (error) throw error;
  return data;
}

// Dossier de l'étudiant connecté : école + cursus.
// Indispensable côté client : `profils.ecole_id` est NULL pour un étudiant,
// donc useAuth().ecoleId vaut null — c'est cette RPC qui donne l'école.
export async function monDossier() {
  const { data, error } = await supabase.rpc("mon_dossier_etudiant");
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

// Demandes d'accès de mes parents (à approuver / refuser).
export async function mesDemandesAcces() {
  const { data, error } = await supabase.rpc("mes_demandes_acces");
  if (error) throw error;
  return data ?? [];
}

// L'étudiant décide : 'autorise' | 'refuse' | 'revoque'.
export async function deciderAcces(accesId, decision) {
  const { error } = await supabase.rpc("decider_acces", { p_acces: accesId, p_decision: decision });
  if (error) throw error;
}

// --- Résultats de l'étudiant ------------------------------------------------
// Passent par des RPC (migration 129) : `notes_lmd`, `releves`, `ue`…
// se lisent avec `ecole_courante()`, qui est NULL pour un étudiant.

// Notes brutes, regroupées par semestre puis par UE pour l'affichage.
export async function mesNotes() {
  const { data, error } = await supabase.rpc("mes_notes_lmd");
  if (error) throw error;
  return data ?? [];
}

// Relevés officiels — la RPC ne renvoie que les relevés VALIDÉS.
export async function mesReleves() {
  const { data, error } = await supabase.rpc("mes_releves");
  if (error) throw error;
  return data ?? [];
}

// Regroupe le plat renvoyé par la RPC en semestres → UE → ECUE.
export function grouperNotes(lignes = []) {
  const semestres = new Map();
  for (const l of lignes) {
    let s = semestres.get(l.semestre_id);
    if (!s) {
      s = { id: l.semestre_id, libelle: l.semestre, ordre: l.semestre_ordre ?? 0,
            creditsRequis: l.credits_requis ?? 30, filiere: l.filiere, niveau: l.niveau,
            annee: l.annee, ues: new Map() };
      semestres.set(l.semestre_id, s);
    }
    let u = s.ues.get(l.ue_id);
    if (!u) {
      u = { id: l.ue_id, code: l.ue_code, intitule: l.ue_intitule,
            credits: Number(l.ue_credits) || 0, coefficient: Number(l.ue_coefficient) || 1,
            lignes: [] };
      s.ues.set(l.ue_id, u);
    }
    u.lignes.push({
      ecueId: l.ecue_id, code: l.ecue_code, intitule: l.ecue_intitule,
      credits: Number(l.ecue_credits) || 0, coefficient: Number(l.ecue_coefficient) || 1,
      session: l.session, cc: l.cc, examen: l.examen,
    });
  }
  return [...semestres.values()]
    .sort((a, b) => a.ordre - b.ordre)
    .map((s) => ({ ...s, ues: [...s.ues.values()] }));
}
