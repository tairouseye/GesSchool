import { supabase } from "@/lib/supabase.js";
import { messageErreur } from "@/lib/erreurs.js";

// GesSchool — se connecter avec l'empreinte ou le visage (passkeys).
//
// Demandé par le promoteur (27/10/2026), maquette validée
// (docs/maquette-connexion-biometrique.html). Ce sont les « passkeys » de
// Supabase Auth (WebAuthn) : le TÉLÉPHONE reconnaît l'empreinte ou le
// visage et signe un défi ; GesSchool et Supabase ne reçoivent qu'une clé
// publique et une signature. Aucune donnée biométrique ne quitte l'appareil.
//
// ⚠️ API EXPÉRIMENTALE chez Supabase (option `auth.experimental.passkey`,
// src/lib/supabase.js). Le mot de passe reste TOUJOURS possible : la
// biométrie est un raccourci, jamais le seul accès.
//
// ⚠️ LIÉE AU DOMAINE gesschool.gesprosn.org (Relying Party ID réglé dans le
// tableau de bord Supabase). Changer de domaine rendrait inutilisables tous
// les appareils activés.

const CLE_INVITE = "gs_bio_invite"; // « non » (refusée) | « fait » (activée ici)

/** Le navigateur sait-il faire du WebAuthn ? (bouton de connexion) */
export function biometrieSupportee() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

/** Ce téléphone a-t-il un capteur (empreinte, visage, code) ? (invitation) */
export async function capteurDisponible() {
  try {
    return !!(await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch { return false; }
}

export async function connecterBiometrie() {
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) throw error;
  noterInvitation("fait");
  return data;
}

export async function activerBiometrie() {
  const { data, error } = await supabase.auth.registerPasskey();
  if (error) throw error;
  noterInvitation("fait");
  return data;
}

/** [{ id, friendly_name, created_at, last_used_at }] */
export async function appareilsBiometrie() {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw error;
  return data ?? [];
}

export async function retirerAppareil(id) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
  if (error) throw error;
}

// L'invitation après connexion : une seule fois par téléphone.
export function invitationVue() {
  try { return !!localStorage.getItem(CLE_INVITE); } catch { return true; }
}
export function noterInvitation(valeur) {
  try { localStorage.setItem(CLE_INVITE, valeur); } catch { /* navigation privée : tant pis */ }
}

/** Les refus du téléphone et de Supabase, dits simplement. */
export function messageBiometrie(e) {
  const code = String(e?.code || e?.error_code || "");
  const brut = String(e?.message || e || "");
  if (/NotAllowedError|ERROR_CEREMONY_ABORTED|abort|cancel|annul/i.test(code + " " + brut)) {
    return "Opération annulée.";
  }
  if (code === "webauthn_credential_not_found") {
    return "Cette empreinte n'est liée à aucun compte GesSchool. Connectez-vous avec votre mot de passe, puis activez-la.";
  }
  if (code === "webauthn_credential_exists") return "Ce téléphone est déjà activé.";
  if (code === "too_many_passkeys") return "Trop d'appareils activés : retirez-en un avant d'en ajouter un autre.";
  if (code === "passkey_disabled") return "La connexion par empreinte n'est pas disponible pour le moment.";
  if (/webauthn_challenge_expired/.test(code)) return "Le délai est dépassé. Réessayez.";
  return messageErreur(e);
}
