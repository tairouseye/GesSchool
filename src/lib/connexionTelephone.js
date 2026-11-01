import { supabase } from "@/lib/supabase.js";

// GesSchool — connexion des parents par numéro de téléphone (mig. 221).
//
// Le numéro IDENTIFIE le parent, le mot de passe l'AUTHENTIFIE. La première
// fois (et après un oubli), c'est le code parent remis par l'école qui fait
// preuve : la fonction Edge vérifie le couple numéro + code, crée le compte
// (ou change le mot de passe) et relie toutes les fiches de ce parent.
// Derrière, le compte Supabase porte une adresse technique
// « 221XXXXXXXXX@tel.gesprosn.org » : aucun courriel n'y part.

//  Nom donné par le tableau de bord au déploiement (voir supabase/functions/parent-telephone).
const FONCTION = "parent-telephone";
export const DOMAINE_TELEPHONE = "tel.gesprosn.org";
const CLE_MEMO = "gs_connexion_parent";

/** « 77 123 45 67 », « +221 77… », « 00221… » → « 771234567 » ; null si ce n'est pas un numéro. */
export function normaliserTelephone(t) {
  const d = String(t || "").replace(/\D/g, "");
  const n = /^00221\d{9}$/.test(d) ? d.slice(5) : /^221\d{9}$/.test(d) ? d.slice(3) : d;
  return /^\d{9}$/.test(n) ? n : null;
}

export const emailTelephone = (tel) => `221${tel}@${DOMAINE_TELEPHONE}`;

/** Le numéro d'un compte téléphone (« 77 123 45 67 »), ou null pour un compte e-mail. */
export function telephoneDuCompte(email) {
  const m = String(email || "").match(new RegExp(`^221(\\d{9})@${DOMAINE_TELEPHONE.replace(/\./g, "\\.")}$`));
  return m ? m[1].replace(/^(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4") : null;
}

export async function connexionTelephone(telephone, motDePasse) {
  const tel = normaliserTelephone(telephone);
  if (!tel) throw new Error("Numéro invalide : 9 chiffres, par exemple 77 123 45 67.");
  const { error } = await supabase.auth.signInWithPassword({ email: emailTelephone(tel), password: motDePasse });
  if (error) {
    if (/invalid login credentials/i.test(error.message || "")) {
      throw new Error("Numéro ou mot de passe incorrect. Première connexion ou mot de passe oublié ? Utilisez « J'ai un code parent ».");
    }
    throw error;
  }
  memoriser(true);
}

/** Première connexion ou mot de passe oublié : numéro + code parent + nouveau mot de passe. */
export async function activerTelephone(telephone, code, motDePasse) {
  const tel = normaliserTelephone(telephone);
  if (!tel) throw new Error("Numéro invalide : 9 chiffres, par exemple 77 123 45 67.");
  const { data, error } = await supabase.functions.invoke(FONCTION, {
    body: { telephone: tel, code: String(code || "").replace(/\s/g, "").toUpperCase(), mot_de_passe: motDePasse },
  });
  if (error || !data) throw new Error("Service momentanément indisponible. Réessayez dans un instant.");
  if (!data.ok) throw new Error(data.erreur || "Activation impossible.");
  await connexionTelephone(tel, motDePasse);
}

//  Ce téléphone a déjà servi à un parent : l'écran propose d'office le numéro.
export function connexionParentMemorisee() {
  try { return localStorage.getItem(CLE_MEMO) === "1"; } catch { return false; }
}
function memoriser(v) {
  try { if (v) localStorage.setItem(CLE_MEMO, "1"); } catch { /* sans mémoire */ }
}
