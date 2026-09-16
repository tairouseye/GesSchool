// GesSchool — vocabulaire adapté au type d'établissement.
// À l'école on parle d'« élève », au supérieur d'« étudiant ». Ces helpers
// évitent de coder les termes en dur et gardent l'app cohérente selon le type.

export function motEleve(type, { pluriel = false, cap = false } = {}) {
  const sup = type === "superieur";
  const m = sup
    ? (pluriel ? "étudiants" : "étudiant")
    : (pluriel ? "élèves" : "élève");
  return cap ? m.charAt(0).toUpperCase() + m.slice(1) : m;
}

// Raccourcis pratiques (un objet de termes prêts à l'emploi).
export function lexiqueEleve(type) {
  return {
    s: motEleve(type),                          // élève / étudiant
    p: motEleve(type, { pluriel: true }),       // élèves / étudiants
    S: motEleve(type, { cap: true }),           // Élève / Étudiant
    P: motEleve(type, { pluriel: true, cap: true }), // Élèves / Étudiants
  };
}
