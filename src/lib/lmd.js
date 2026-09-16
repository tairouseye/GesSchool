// GesSchool Supérieur — logique LMD pure (sans Supabase, donc testable).
// Ce module hébergera le moteur de calcul (capitalisation/compensation) des
// phases suivantes. Pour l'instant : agrégats de crédits de la maquette.

export const CREDITS_SEMESTRE = 30; // norme LMD

export const TYPES_UE = [
  ["fondamentale", "Fondamentale"],
  ["transversale", "Transversale"],
  ["optionnelle", "Optionnelle"],
  ["libre", "Libre"],
];

export const DIPLOMES = [
  ["licence", "Licence"],
  ["master", "Master"],
  ["doctorat", "Doctorat"],
];

// Somme des crédits d'une liste (UE ou ECUE).
export function totalCredits(items) {
  return (items || []).reduce((s, x) => s + (Number(x?.credits) || 0), 0);
}

// Écart d'un semestre à la norme (négatif = manque, positif = excès, 0 = conforme).
export function ecartCreditsSemestre(ues, requis = CREDITS_SEMESTRE) {
  return totalCredits(ues) - (Number(requis) || CREDITS_SEMESTRE);
}

// Un semestre est-il conforme à sa cible de crédits ?
export function semestreConforme(ues, requis = CREDITS_SEMESTRE) {
  return ecartCreditsSemestre(ues, requis) === 0;
}

// Cohérence UE ↔ ECUE : si une UE a des ECUE, la somme de leurs crédits doit
// égaler les crédits de l'UE (tolérance 0,01 pour les arrondis). Sans ECUE, l'UE
// est cohérente par elle-même.
export function ueCoherente(ue, ecues) {
  const liste = ecues || [];
  if (liste.length === 0) return true;
  return Math.abs(totalCredits(liste) - (Number(ue?.credits) || 0)) < 0.01;
}

// =====================================================================
//  MOTEUR DE CALCUL LMD (capitalisation + compensation)
// =====================================================================

// Pondération contrôle continu / examen + seuils de validation (réglable/école).
export const LMD_CONFIG_DEFAUT = { cc: 0.4, examen: 0.6, seuil_ue: 10, seuil_semestre: 10 };

const num = (v) => (v == null || v === "" ? null : Number(v));

// Note finale d'un ECUE (ou d'une UE sans ECUE) à partir du CC et de l'examen.
// Si une seule composante est saisie, elle fait foi ; aucune → null (non noté).
export function noteFinale(note, cfg = LMD_CONFIG_DEFAUT) {
  const c = num(note?.cc), e = num(note?.examen);
  if (c == null && e == null) return null;
  if (c != null && e != null) return c * cfg.cc + e * cfg.examen;
  return c != null ? c : e;
}

// Moyenne d'une UE : moyenne des ECUE pondérée par leur coefficient (repli sur
// les crédits, puis 1). Sans ECUE : la note UE directe. `notes` = map indexée par
// id d'ECUE, plus la clé "ue" pour une note au niveau UE.
export function moyenneUE(ue, ecues, notes = {}, cfg = LMD_CONFIG_DEFAUT) {
  const liste = ecues || [];
  if (liste.length) {
    let sn = 0, sc = 0, complet = true;
    for (const ec of liste) {
      const nf = noteFinale(notes[ec.id] || {}, cfg);
      const coef = Number(ec.coefficient) || Number(ec.credits) || 1;
      if (nf == null) { complet = false; continue; }
      sn += nf * coef; sc += coef;
    }
    return { moyenne: sc > 0 ? sn / sc : null, complet };
  }
  const nf = noteFinale(notes.ue || {}, cfg);
  return { moyenne: nf, complet: nf != null };
}

// Résultat d'une UE : moyenne + crédits capitalisés si acquise (≥ seuil UE).
export function resultatUE(ue, ecues, notes = {}, cfg = LMD_CONFIG_DEFAUT) {
  const { moyenne, complet } = moyenneUE(ue, ecues, notes, cfg);
  const credits = Number(ue?.credits) || 0;
  const acquise = moyenne != null && moyenne >= cfg.seuil_ue;
  return { ue_id: ue?.id, intitule: ue?.intitule, moyenne, complet, credits, acquise, creditsAcquis: acquise ? credits : 0 };
}

// Moyenne du semestre : moyenne des UE pondérée par leurs crédits.
export function moyenneSemestre(resultatsUE) {
  let sn = 0, sc = 0;
  for (const r of resultatsUE || []) {
    if (r.moyenne == null) continue;
    const w = Number(r.credits) || 1;
    sn += r.moyenne * w; sc += w;
  }
  return sc > 0 ? sn / sc : null;
}

// Mention LMD à partir d'une moyenne /20.
export function mentionLMD(moyenne) {
  if (moyenne == null) return null;
  if (moyenne >= 16) return "Très Bien";
  if (moyenne >= 14) return "Bien";
  if (moyenne >= 12) return "Assez Bien";
  if (moyenne >= 10) return "Passable";
  return null;
}

// Résultat d'un semestre : applique capitalisation (UE ≥ seuil) et compensation
// (semestre validé si moyenne ≥ seuil → toutes les UE acquises).
export function resultatSemestre(resultatsUE, cfg = LMD_CONFIG_DEFAUT) {
  const liste = resultatsUE || [];
  const moyenne = moyenneSemestre(liste);
  const creditsTotal = liste.reduce((s, r) => s + (Number(r.credits) || 0), 0);
  const toutesAcquises = liste.length > 0 && liste.every((r) => r.acquise);
  const complet = liste.length > 0 && liste.every((r) => r.moyenne != null);

  let valide = false, parCompensation = false;
  if (moyenne != null && moyenne >= cfg.seuil_semestre) {
    valide = true;
    parCompensation = !toutesAcquises; // validé grâce à la moyenne, malgré une UE < seuil
  }
  const creditsAcquis = valide ? creditsTotal : liste.reduce((s, r) => s + r.creditsAcquis, 0);
  const uesEnDette = valide ? [] : liste.filter((r) => !r.acquise);

  let decision;
  if (valide) decision = parCompensation ? "Admis par compensation" : "Admis";
  else decision = "Ajourné";

  return { moyenne, creditsTotal, creditsAcquis, valide, parCompensation, complet, mention: mentionLMD(moyenne), uesEnDette, decision };
}
