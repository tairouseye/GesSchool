import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « notes & bulletins » : évaluations, notes, calculs.

export async function getPeriodes(ecoleId, anneeId) {
  if (!anneeId) return [];
  const { data, error } = await supabase
    .from("periodes")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("annee_id", anneeId)
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

// Élèves inscrits dans une classe (année courante).
export async function getElevesClasse(ecoleId, classeId, anneeId) {
  const { data, error } = await supabase
    .from("inscriptions")
    .select("eleve_id, eleves(id, prenom, nom, matricule)")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("annee_id", anneeId);
  if (error) throw error;
  return (data ?? [])
    .map((i) => i.eleves)
    .filter(Boolean)
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
}

// --- Évaluations ---
export async function getEvaluations(ecoleId, classeId, periodeId, matiereId) {
  let q = supabase
    .from("evaluations")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("periode_id", periodeId);
  if (matiereId) q = q.eq("matiere_id", matiereId);
  const { data, error } = await q.order("date_eval", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function creerEvaluation(ecoleId, ev) {
  const { data, error } = await supabase
    .from("evaluations")
    .insert({ ecole_id: ecoleId, ...ev })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerEvaluation(id) {
  const { error } = await supabase.from("evaluations").delete().eq("id", id);
  if (error) throw error;
}

// --- Notes ---
export async function getNotesEvaluation(evaluationId) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("evaluation_id", evaluationId);
  if (error) throw error;
  return data ?? [];
}

// Enregistre (upsert) un lot de notes pour une évaluation.
export async function enregistrerNotes(ecoleId, evaluationId, notes) {
  const lignes = notes.map((n) => ({
    ecole_id: ecoleId,
    evaluation_id: evaluationId,
    eleve_id: n.eleve_id,
    valeur: n.absent ? null : n.valeur,
    absent: !!n.absent,
    appreciation: n.appreciation || null,
  }));
  const { error } = await supabase
    .from("notes")
    .upsert(lignes, { onConflict: "evaluation_id,eleve_id" });
  if (error) throw error;
}

// Coefficients de matière pour une classe.
// Priorité : grille par série (si la classe a une série) ou par niveau ;
// repli sur l'ancien coefficient d'affectation ; défaut 1.
async function getCoefsMatiere(ecoleId, classeId, anneeId) {
  const map = {};

  // 1) Portée de la classe (niveau / série) → grille de coefficients
  const { data: classe } = await supabase
    .from("classes")
    .select("niveau_id, serie_id")
    .eq("id", classeId)
    .maybeSingle();
  if (classe) {
    let q = supabase
      .from("coefficients_matieres")
      .select("matiere_id, coefficient")
      .eq("ecole_id", ecoleId);
    q = classe.serie_id ? q.eq("serie_id", classe.serie_id) : q.eq("niveau_id", classe.niveau_id);
    const { data: grille } = await q;
    for (const c of grille ?? []) map[c.matiere_id] = Number(c.coefficient) || 1;
  }

  // 2) Repli : coefficients portés par les affectations (compat ascendante)
  const { data: aff } = await supabase
    .from("affectations")
    .select("matiere_id, coefficient")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("annee_id", anneeId);
  for (const a of aff ?? []) {
    if (map[a.matiere_id] == null) map[a.matiere_id] = Number(a.coefficient) || 1;
  }
  return map;
}

export function mention(moy) {
  if (moy == null) return "—";
  if (moy >= 16) return "Très Bien";
  if (moy >= 14) return "Bien";
  if (moy >= 12) return "Assez Bien";
  if (moy >= 10) return "Passable";
  return "Insuffisant";
}

// Calcule les bulletins de toute une classe pour une période.
// Retourne : { eleves:[{eleve, moyenne, rang, mention, lignes:[{matiere, moyenne, coef}]}], effectif }
export async function calculerBulletins(ecoleId, classeId, anneeId, periodeId, matieres) {
  const eleves = await getElevesClasse(ecoleId, classeId, anneeId);
  const evals = await getEvaluations(ecoleId, classeId, periodeId);
  const coefsMatiere = await getCoefsMatiere(ecoleId, classeId, anneeId);

  // Notes de toutes les évaluations de la période
  const evalIds = evals.map((e) => e.id);
  let notes = [];
  if (evalIds.length) {
    const { data, error } = await supabase.from("notes").select("*").in("evaluation_id", evalIds);
    if (error) throw error;
    notes = data ?? [];
  }
  const evalById = Object.fromEntries(evals.map((e) => [e.id, e]));
  const matiereById = Object.fromEntries((matieres ?? []).map((m) => [m.id, m]));

  // Matières évaluées dans cette classe/période
  const matieresEvaluees = [...new Set(evals.map((e) => e.matiere_id))];

  const resultats = eleves.map((eleve) => {
    const lignes = [];
    for (const mId of matieresEvaluees) {
      const evalsM = evals.filter((e) => e.matiere_id === mId);
      let sommeNotes = 0, sommeCoefs = 0;
      for (const ev of evalsM) {
        const note = notes.find((n) => n.evaluation_id === ev.id && n.eleve_id === eleve.id);
        if (!note || note.absent || note.valeur == null) continue;
        const bareme = Number(ev.bareme) || 20;
        const note20 = (Number(note.valeur) / bareme) * 20;
        const c = Number(ev.coefficient) || 1;
        sommeNotes += note20 * c;
        sommeCoefs += c;
      }
      const moyM = sommeCoefs > 0 ? sommeNotes / sommeCoefs : null;
      lignes.push({
        matiere_id: mId,
        matiere: matiereById[mId]?.libelle || "Matière",
        moyenne: moyM,
        coef: coefsMatiere[mId] ?? 1,
      });
    }
    // Moyenne générale pondérée par les coefs matière
    let sN = 0, sC = 0;
    for (const l of lignes) {
      if (l.moyenne == null) continue;
      sN += l.moyenne * l.coef;
      sC += l.coef;
    }
    const moyenne = sC > 0 ? sN / sC : null;
    return { eleve, lignes, moyenne };
  });

  // Rang (par moyenne décroissante ; les sans-moyenne en fin)
  const classes = [...resultats].sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
  classes.forEach((r, i) => {
    r.rang = r.moyenne == null ? null : i + 1;
    r.mention = mention(r.moyenne);
  });

  return { eleves: classes, effectif: eleves.length, evaluations: evals };
}
