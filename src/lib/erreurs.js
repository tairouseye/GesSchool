// GesSchool — traduction d'erreurs techniques en messages conviviaux (français).
// Accepte un objet Error, une string, ou un objet Supabase { message }.

const REGLES = [
  [/invalid login credentials/i, "E-mail ou mot de passe incorrect."],
  [/email not confirmed/i, "E-mail non confirmé. Vérifiez votre boîte de réception."],
  [/user already registered/i, "Un compte existe déjà avec cet e-mail."],
  [/password should be at least/i, "Le mot de passe doit faire au moins 6 caractères."],
  [/for security purposes|rate limit|too many requests/i, "Trop de tentatives. Patientez un instant avant de réessayer."],
  [/token|otp|expired/i, "Code invalide ou expiré."],
  [/duplicate key|already exists|unique constraint/i, "Cet enregistrement existe déjà."],
  [/foreign key|still referenced|violates.*constraint/i, "Action impossible : cet élément est utilisé ailleurs."],
  [/row-level security|permission denied|not authorized|insufficient/i, "Vous n'avez pas les droits pour cette action."],
  [/failed to fetch|network|networkerror|timeout|fetch/i, "Problème de connexion. Vérifiez votre réseau et réessayez."],
  [/jwt|session|not authenticated|auth session missing/i, "Session expirée. Reconnectez-vous."],
  [/value too long/i, "Une valeur saisie est trop longue."],
  [/invalid input syntax|invalid type|out of range/i, "Une valeur saisie n'est pas au bon format."],
];

export function messageErreur(e) {
  const brut =
    typeof e === "string" ? e : (e?.message || e?.error_description || e?.error || "");
  if (!brut) return "Une erreur est survenue. Réessayez.";
  for (const [re, txt] of REGLES) if (re.test(brut)) return txt;
  return brut; // repli : message d'origine (cas rares non couverts)
}
