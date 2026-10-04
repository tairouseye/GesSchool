// GesSchool — traduction d'erreurs techniques en messages conviviaux (français).
// Accepte un objet Error, une string, ou un objet Supabase { message }.
//
// ⚠️ CE FICHIER EST DÉSORMAIS SUR LE CHEMIN DE TOUS LES MESSAGES D'ERREUR, pas
// seulement des toasts : `Alerte ton="erreur"` y passe aussi ses enfants
// (cf. ui.jsx). Il voit donc arriver DEUX sortes de textes :
//   1. des messages techniques anglais (Postgres, PostgREST, Supabase Auth) ;
//   2. des phrases françaises que l'application a écrites elle-même
//      (« Choisissez une classe. », « Session de rattrapage introuvable. »).
// Les secondes doivent traverser SANS ÊTRE TOUCHÉES.
//
// 🔴 D'où une règle de prudence : aucun motif ne doit pouvoir correspondre à un
// mot français courant. La règle `/session/` violait cela — le module
// Supérieur parle de « session normale » et de « session de rattrapage », et
// une violation de contrainte CHECK porte le nom de la colonne (donc le mot
// « session »). Toute phrase la contenant devenait « Session expirée.
// Reconnectez-vous. » : on envoyait l'utilisateur se reconnecter pour rien.
// Les motifs exigent maintenant le contexte anglais qui les rend univoques.

const REGLES = [
  // --- Authentification ---------------------------------------------------
  [/invalid login credentials/i, "E-mail ou mot de passe incorrect."],
  [/email not confirmed/i, "E-mail non confirmé. Vérifiez votre boîte de réception."],
  [/user already registered/i, "Un compte existe déjà avec cet e-mail."],
  [/password should be at least/i, "Le mot de passe doit faire au moins 6 caractères."],
  [/for security purposes|rate limit|too many requests/i, "Trop de tentatives. Patientez un instant avant de réessayer."],
  [/invalid.*(token|otp)|(token|otp).*expired|email link is invalid/i, "Code invalide ou expiré."],
  //  « session » seul était trop large (cf. en-tête) : on exige le vocabulaire
  //  d'authentification qui ne peut pas apparaître dans une phrase française.
  [/jwt|auth session missing|session_not_found|refresh token|not authenticated/i, "Session expirée. Reconnectez-vous."],

  // --- Droits -------------------------------------------------------------
  [/row-level security|permission denied|not authorized|insufficient privilege/i, "Vous n'avez pas les droits pour cette action."],

  // --- Contraintes de base -----------------------------------------------
  //  Ces trois-là étaient confondues sous « cet élément est utilisé ailleurs »,
  //  qui ne vaut que pour la clé étrangère. Un champ obligatoire vide et une
  //  valeur refusée demandent à l'utilisateur deux gestes différents.
  [/duplicate key|already exists|unique constraint/i, "Cet enregistrement existe déjà."],
  [/violates not-null constraint|null value in column/i, "Un champ obligatoire n'est pas renseigné."],
  [/violates check constraint/i, "Une valeur saisie n'est pas acceptée ici."],
  //  🔴 DEUX SITUATIONS OPPOSÉES, ET ELLES ÉTAIENT CONFONDUES. Relevé sur
  //  l'API de production : un INSERT dont le parent n'existe pas renvoie
  //  « insert or update on table "x" violates foreign key constraint » — là,
  //  « cet élément est utilisé ailleurs » est un contresens : c'est l'inverse,
  //  l'élément choisi n'existe pas. L'autre sens (« update or delete on
  //  table … », « still referenced ») est bien celui du verrou.
  [/insert or update on table .* violates foreign key/i, "L'élément sélectionné n'existe plus. Rechargez la page, puis réessayez."],
  [/update or delete on table .* violates foreign key|still referenced|foreign key/i, "Action impossible : cet élément est utilisé ailleurs."],
  [/violates.*constraint/i, "Cette donnée ne respecte pas une règle de l'établissement."],
  [/value too long/i, "Une valeur saisie est trop longue."],
  [/invalid input syntax|invalid type|out of range/i, "Une valeur saisie n'est pas au bon format."],

  // --- Réseau -------------------------------------------------------------
  [/failed to fetch|networkerror|network ?error|network request|fetch failed|timeout/i, "Problème de connexion. Vérifiez votre réseau et réessayez."],
];

export function messageErreur(e) {
  const brut =
    typeof e === "string" ? e : (e?.message || e?.error_description || e?.error || "");
  if (!brut) return "Une erreur est survenue. Réessayez.";
  for (const [re, txt] of REGLES) if (re.test(brut)) return txt;
  return brut; // repli : message d'origine (cas rares non couverts)
}
