// GesSchool — « Ma journée » de l'enseignant (lot 3 de l'audit du 31/10/2026).
//
// L'enseignant arrivait sur l'accueil Pédagogie de la direction : moyennes
// par niveau, absences de toute l'école… rien de ce qu'il a à faire
// aujourd'hui. Ce module répond à trois questions, dans l'ordre de la
// journée : quels cours, quelles classes à l'appel, quelles notes à saisir.
//
// ⚠️ MODULE PUR : les lectures sont dans dashboard.js (`donneesMaJournee`),
// toutes sous la RLS de l'enseignant.

const hm = (t) => String(t || "").slice(0, 5);
export const jourSemaine = (d) => ((d.getDay() + 6) % 7) + 1;
const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Les cours du jour, dans l'ordre, avec leur moment : passé, en cours, à venir.
 * Un créneau sans matière (accueil, récréation) n'est pas un cours.
 */
export function coursDuJourEnseignant(creneaux = [], now = new Date()) {
  const j = jourSemaine(now);
  const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (creneaux || [])
    .filter((c) => Number(c.jour) === j && (c.matiere_id || c.activite))
    .sort((a, b) => hm(a.heure_debut).localeCompare(hm(b.heure_debut)))
    .map((c) => ({
      id: c.id, classe_id: c.classe_id, classe: c.classes?.libelle || "",
      intitule: c.activite || c.matieres?.libelle || "",
      debut: hm(c.heure_debut), fin: hm(c.heure_fin), salle: c.salle || "",
      moment: hm(c.heure_fin) <= t ? "passe" : hm(c.heure_debut) <= t ? "en_cours" : "a_venir",
    }));
}

/**
 * Les classes à l'appel aujourd'hui : celles où l'enseignant a cours, ou à
 * défaut (pas d'emploi du temps saisi) toutes ses classes.
 *
 * ⚠️ « Appel fait » NE PEUT PAS SE SAVOIR : un appel où tout le monde est
 * présent n'écrit rien en base. On montre donc le nombre d'absences déjà
 * saisies aujourd'hui — un fait — et jamais « appel fait ».
 */
export function classesAppel({ cours = [], mesClasses = [], absencesJour = [] } = {}) {
  const parClasse = {};
  for (const a of absencesJour || []) parClasse[a.classe_id] = (parClasse[a.classe_id] || 0) + 1;
  const duJour = new Map();
  for (const c of cours) if (c.classe_id && !duJour.has(c.classe_id)) duJour.set(c.classe_id, { id: c.classe_id, libelle: c.classe, debut: c.debut });
  const liste = duJour.size > 0 ? [...duJour.values()] : (mesClasses || []).map((c) => ({ id: c.id, libelle: c.libelle, debut: null }));
  return liste.map((c) => ({ ...c, absences: parClasse[c.id] || 0 }));
}

/**
 * La classe du grand bouton « Faire l'appel » : celle du cours en cours, sinon
 * du prochain, sinon la première de la liste.
 */
export function appelEnTete(appel = [], cours = []) {
  const c = cours.find((x) => x.moment === "en_cours") || cours.find((x) => x.moment === "a_venir");
  return (c && appel.find((a) => a.id === c.classe_id)) || appel[0] || null;
}

/** « CE1/CE2 · 2 absences saisies aujourd'hui » : un fait, jamais « appel fait ». */
export function resumeAppel(c) {
  const n = Number(c?.absences) || 0;
  const absences = n === 0 ? "aucune absence saisie" : n > 1 ? `${n} absences saisies` : "1 absence saisie";
  return `${c?.libelle || ""} · ${absences}`;
}

/**
 * Les notes à saisir pour la période : les évaluations passées de MES
 * classes et matières qui n'ont encore aucune note, puis les couples
 * classe × matière qui n'ont aucune évaluation.
 *
 * Une affectation SANS matière (mig. 161) couvre toutes les matières de la
 * classe : ses évaluations comptent, mais on ne peut pas dire quelles
 * matières « manquent » — elle n'apparaît donc pas dans `sansEvaluation`.
 */
export function notesASaisir({ affectations = [], evaluations = [], notesParEval = {}, now = new Date() } = {}) {
  const jour = isoJour(now);
  const toute = new Set(affectations.filter((a) => !a.matiere_id).map((a) => a.classe_id));
  const couples = new Set(affectations.filter((a) => a.matiere_id).map((a) => `${a.classe_id}|${a.matiere_id}`));
  const miennes = (evaluations || []).filter((e) => e.actif !== false
    && (toute.has(e.classe_id) || couples.has(`${e.classe_id}|${e.matiere_id}`)));

  const sansNotes = miennes
    .filter((e) => e.date_eval && e.date_eval <= jour && !(notesParEval[e.id] > 0))
    .sort((a, b) => a.date_eval.localeCompare(b.date_eval))
    .map((e) => ({ id: e.id, classe_id: e.classe_id, matiere_id: e.matiere_id, date: e.date_eval, type: e.type, libelle: e.libelle || "",
      classe: e.classes?.libelle || "", matiere: e.matieres?.libelle || "" }));

  const evaluees = new Set(miennes.map((e) => `${e.classe_id}|${e.matiere_id}`));
  const sansEvaluation = affectations
    .filter((a) => a.matiere_id && !evaluees.has(`${a.classe_id}|${a.matiere_id}`))
    .map((a) => ({ classe_id: a.classe_id, matiere_id: a.matiere_id, classe: a.classes?.libelle || "", matiere: a.matieres?.libelle || "" }));

  return { sansNotes, sansEvaluation };
}
