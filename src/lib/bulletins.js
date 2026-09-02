import { supabase } from "@/lib/supabase.js";
import { archiverDocument } from "@/lib/documents.js";

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

// Dernier bulletin (période la plus avancée) d'un élève sur une année.
// Sert à l'attestation de résultats.
export async function getDernierBulletin(eleveId, anneeId) {
  const { data, error } = await supabase
    .from("bulletins")
    .select("moyenne_generale, mention, decision, rang, effectif, periodes(libelle, ordre, annee_id)")
    .eq("eleve_id", eleveId);
  if (error) throw error;
  const list = (data ?? []).filter((b) => !anneeId || b.periodes?.annee_id === anneeId);
  list.sort((a, b) => (b.periodes?.ordre || 0) - (a.periodes?.ordre || 0));
  return list[0] || null;
}

// Publie (persiste) les bulletins calculés → visibles par les parents.
export async function publierBulletins(ecoleId, classeId, periodeId, resultats) {
  const eleves = resultats.eleves || [];
  if (!eleves.length) return 0;
  const genere_le = new Date().toISOString();

  // 1) Upsert de TOUS les bulletins en un seul appel (au lieu d'un par élève).
  const { data: bulletins, error } = await supabase
    .from("bulletins")
    .upsert(
      eleves.map((r) => ({
        ecole_id: ecoleId,
        eleve_id: r.eleve.id,
        classe_id: classeId,
        periode_id: periodeId,
        moyenne_generale: r.moyenne,
        rang: r.rang,
        effectif: resultats.effectif,
        mention: r.mention,
        genere_le,
      })),
      { onConflict: "eleve_id,periode_id" }
    )
    .select("id, eleve_id");
  if (error) throw error;

  const idParEleve = Object.fromEntries((bulletins ?? []).map((b) => [b.eleve_id, b.id]));
  const bulletinIds = Object.values(idParEleve);

  // 2) Remplace toutes les lignes en masse (un delete + un insert groupés).
  if (bulletinIds.length) {
    const { error: eDel } = await supabase.from("bulletin_lignes").delete().in("bulletin_id", bulletinIds);
    if (eDel) throw eDel;
  }
  const lignes = [];
  for (const r of eleves) {
    const bid = idParEleve[r.eleve.id];
    if (!bid) continue;
    for (const l of r.lignes) {
      lignes.push({ ecole_id: ecoleId, bulletin_id: bid, matiere_id: l.matiere_id, moyenne: l.moyenne, coefficient: l.coef });
    }
  }
  if (lignes.length) {
    const { error: eIns } = await supabase.from("bulletin_lignes").insert(lignes);
    if (eIns) throw eIns;
  }

  // 3) Archivage GED (best-effort, non bloquant).
  for (const r of eleves) {
    archiverDocument(ecoleId, {
      type: "bulletin", famille: "pedagogie", titre: "Bulletin de notes",
      eleve_id: r.eleve.id, cible_type: "eleve", cible_id: r.eleve.id,
      cible_libelle: `${r.eleve?.nom || ""} ${r.eleve?.prenom || ""}`.trim(),
      periode_id: periodeId,
      donnees: { moyenne: r.moyenne, rang: r.rang, effectif: resultats.effectif, mention: r.mention },
    });
  }
  return eleves.length;
}

// Publie UN bulletin avec ses appréciations (par matière + générale + décision).
export async function publierUnBulletin(ecoleId, classeId, periodeId, r, extra = {}) {
  const { data: b, error } = await supabase
    .from("bulletins")
    .upsert({
      ecole_id: ecoleId,
      eleve_id: r.eleve.id,
      classe_id: classeId,
      periode_id: periodeId,
      moyenne_generale: r.moyenne,
      rang: r.rang,
      effectif: extra.effectif ?? null,
      mention: r.mention,
      appreciation_generale: extra.appreciation_generale || null,
      decision: extra.decision || null,
      genere_le: new Date().toISOString(),
    }, { onConflict: "eleve_id,periode_id" })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("bulletin_lignes").delete().eq("bulletin_id", b.id);
  const apps = extra.appreciations || {};
  const lignes = r.lignes.map((l) => ({
    ecole_id: ecoleId, bulletin_id: b.id, matiere_id: l.matiere_id,
    moyenne: l.moyenne, coefficient: l.coef, appreciation: apps[l.matiere_id] || null,
  }));
  if (lignes.length) {
    const { error: e2 } = await supabase.from("bulletin_lignes").insert(lignes);
    if (e2) throw e2;
  }
  // Archivage GED (best-effort, non bloquant).
  archiverDocument(ecoleId, {
    type: "bulletin", famille: "pedagogie", titre: "Bulletin de notes",
    eleve_id: r.eleve.id, cible_type: "eleve", cible_id: r.eleve.id,
    cible_libelle: `${r.eleve?.nom || ""} ${r.eleve?.prenom || ""}`.trim(),
    periode_id: periodeId,
    donnees: { moyenne: r.moyenne, rang: r.rang, effectif: extra.effectif ?? null, mention: r.mention, decision: extra.decision || null },
  });
  return b.id;
}

// --- Configuration de notation par école (barème, mentions, options) ---
export const DEFAUT_NOTATION = {
  bareme: 20,               // échelle d'affichage (20, 10, 100…)
  moyenne_passage: 10,      // seuil d'admission (sur le barème)
  mentions: [               // seuils décroissants sur le barème
    { min: 16, libelle: "Très Bien" },
    { min: 14, libelle: "Bien" },
    { min: 12, libelle: "Assez Bien" },
    { min: 10, libelle: "Passable" },
  ],
  insuffisant: "Insuffisant",
  afficher_rang: true,
  afficher_appreciations: true,
  afficher_decision: true,
};

export async function getNotationConfig(ecoleId) {
  const { data, error } = await supabase.from("parametres").select("valeur")
    .eq("ecole_id", ecoleId).eq("cle", "notation").maybeSingle();
  if (error) throw error;
  return { ...DEFAUT_NOTATION, ...(data?.valeur || {}) };
}

export async function setNotationConfig(ecoleId, cfg) {
  const { error } = await supabase.from("parametres")
    .upsert({ ecole_id: ecoleId, cle: "notation", valeur: cfg }, { onConflict: "ecole_id,cle" });
  if (error) throw error;
}

// Mention à partir de la moyenne (sur le barème) et de la config.
export function mention(moy, cfg = DEFAUT_NOTATION) {
  if (moy == null) return "—";
  const ms = [...(cfg.mentions || DEFAUT_NOTATION.mentions)].sort((a, b) => Number(b.min) - Number(a.min));
  for (const m of ms) if (moy >= Number(m.min)) return m.libelle;
  return cfg.insuffisant || "Insuffisant";
}

// Calcule les bulletins de toute une classe pour une période.
// Retourne : { eleves:[{eleve, moyenne, rang, mention, lignes:[{matiere, moyenne, coef}]}], effectif }
export async function calculerBulletins(ecoleId, classeId, anneeId, periodeId, matieres, cfg = DEFAUT_NOTATION) {
  const eleves = await getElevesClasse(ecoleId, classeId, anneeId);
  const evals = await getEvaluations(ecoleId, classeId, periodeId);
  const coefsMatiere = await getCoefsMatiere(ecoleId, classeId, anneeId);
  // Conversion /20 (interne) → échelle d'affichage de l'école.
  const facteur = (Number(cfg.bareme) || 20) / 20;
  const r2 = (x) => (x == null ? null : Math.round(x * facteur * 100) / 100);

  // Notes de toutes les évaluations de la période
  const evalIds = evals.map((e) => e.id);
  let notes = [];
  if (evalIds.length) {
    const { data, error } = await supabase.from("notes").select("*").in("evaluation_id", evalIds);
    if (error) throw error;
    notes = data ?? [];
  }
  const matiereById = Object.fromEntries((matieres ?? []).map((m) => [m.id, m]));

  // Index O(1) : note par (évaluation, élève) + évaluations groupées par matière.
  // (Évite un scan linéaire du tableau `notes` pour chaque cellule du bulletin.)
  const noteByKey = new Map(notes.map((n) => [`${n.evaluation_id}:${n.eleve_id}`, n]));
  const evalsByMatiere = new Map();
  for (const e of evals) {
    const arr = evalsByMatiere.get(e.matiere_id);
    if (arr) arr.push(e); else evalsByMatiere.set(e.matiere_id, [e]);
  }
  const matieresEvaluees = [...evalsByMatiere.keys()];

  const resultats = eleves.map((eleve) => {
    const lignes = [];
    for (const mId of matieresEvaluees) {
      const evalsM = evalsByMatiere.get(mId) || [];
      let sommeNotes = 0, sommeCoefs = 0;
      for (const ev of evalsM) {
        const note = noteByKey.get(`${ev.id}:${eleve.id}`);
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
    // Conversion à l'échelle d'affichage de l'école (barème).
    return { eleve, moyenne: r2(moyenne), lignes: lignes.map((l) => ({ ...l, moyenne: r2(l.moyenne) })) };
  });

  // Rang (par moyenne décroissante ; les sans-moyenne en fin)
  const classes = [...resultats].sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
  classes.forEach((r, i) => {
    r.rang = r.moyenne == null ? null : i + 1;
    r.mention = mention(r.moyenne, cfg);
  });

  return { eleves: classes, effectif: eleves.length, evaluations: evals };
}
