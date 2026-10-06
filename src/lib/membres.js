import { supabase } from "@/lib/supabase.js";

// GesSchool — gestion des membres & délégation (voir migration 029).

// Invite un membre pour un rôle donné → renvoie le code d'invitation.
export async function inviterMembre(role, email = null) {
  const { data, error } = await supabase.rpc("inviter_membre", { p_role: role, p_email: email || null });
  if (error) throw error;
  return data; // code
}

// Rejoindre un établissement via un code → crée le profil + le rôle. Renvoie le rôle.
export async function rejoindre(code) {
  const { data, error } = await supabase.rpc("rejoindre", { p_code: code });
  if (error) throw error;
  return data; // role
}

// Liste des membres de l'école courante (managers uniquement).
export async function getMembres() {
  const { data, error } = await supabase.rpc("membres_ecole");
  if (error) throw error;
  return data ?? [];
}

// Retire un rôle à un membre.
export async function revoquerRole(profilId, role) {
  const { error } = await supabase.rpc("revoquer_role", { p_profil: profilId, p_role: role });
  if (error) throw error;
}

// Suspend (true) ou réactive (false) un membre.
export async function suspendreMembre(profilId, suspendu) {
  const { error } = await supabase.rpc("suspendre_membre", { p_profil: profilId, p_suspendu: suspendu });
  if (error) throw error;
}

/**
 * Accorde un accès à quelqu'un qui est DÉJÀ membre de l'établissement.
 *
 * 🔴 POURQUOI CETTE FONCTION EXISTE. La page savait retirer un accès mais
 * pas en accorder un : le seul chemin était d'émettre un code d'invitation
 * et de demander à la personne de le saisir. Or les responsables de
 * l'école sont dans l'application depuis des mois — leur renvoyer un code
 * pour « rejoindre » l'établissement où elles travaillent n'avait aucun
 * sens. Le promoteur accorde maintenant l'accès directement.
 *
 * La RPC (mig. 176) écrit les DEUX représentations — le rôle, qui tient les
 * droits aujourd'hui, et les cases, qui les tiendront après la bascule —
 * pour qu'aucun accès ne se perde en route. Rend le nombre de cases.
 */
export async function accorderModele(profilId, modele) {
  const { data, error } = await supabase.rpc("accorder_modele", {
    p_profil: profilId, p_modele: modele,
  });
  if (error) throw error;
  return data;
}

/**
 * Périmètre de chaque membre : « toute l'école », « certains cycles », ou
 * « ses classes ». Rendu par profil_id, pour que la page Membres l'affiche
 * sur la ligne de chacun.
 */
export async function getPerimetres() {
  const { data, error } = await supabase.rpc("perimetres_ecole");
  if (error) throw error;
  const par = {};
  for (const r of data ?? []) par[r.profil_id] = r;
  return par;
}

/**
 * Pose le périmètre d'un membre. Réservé au promoteur — et la base le refuse
 * aux autres, pas seulement l'écran (mig. 190).
 *
 * ⚠️ `cycles` est REMPLACÉ, pas cumulé : choisir « Élémentaire » après
 * « Préscolaire » donne l'élémentaire seul. C'est ce qu'on attend d'un
 * sélecteur, et la RPC s'en charge.
 */
export async function definirPerimetre(profilId, mode, cycles = []) {
  const { data, error } = await supabase.rpc("definir_perimetre", {
    p_profil: profilId, p_mode: mode, p_cycles: cycles,
  });
  if (error) throw error;
  return data;
}

// Liste des invitations en attente (codes générés non utilisés).
export async function getInvitations() {
  const { data, error } = await supabase.rpc("invitations_ecole");
  if (error) throw error;
  return data ?? [];
}

// Annule une invitation en attente.
export async function annulerInvitation(id) {
  const { error } = await supabase.rpc("annuler_invitation", { p_id: id });
  if (error) throw error;
}

// Construit le lien d'invitation partageable (compatible HashRouter).
export function lienInvitation(code) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/rejoindre?code=${code}`;
}
