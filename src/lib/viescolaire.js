import { supabase } from "@/lib/supabase.js";

// GesSchool — couche « vie scolaire » : absences/retards + incidents.

export const STATUTS_JUSTIF = {
  non_justifie: { label: "Non justifié", ton: "rouge" },
  en_attente: { label: "En attente", ton: "or" },
  justifie: { label: "Justifié", ton: "vert" },
};

// Absences/retards d'une classe pour une date donnée.
export async function getAbsencesJour(ecoleId, classeId, date) {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("date_abs", date);
  if (error) throw error;
  return data ?? [];
}

// Enregistre la feuille de présence du jour pour une classe.
// entries: [{ eleve_id, etat: 'present'|'absence'|'retard', motif }]
//
// 🔴 CETTE FONCTION EFFAÇAIT LES JUSTIFICATIONS DÉJÀ SAISIES.
// Elle faisait un DELETE de toutes les absences de la classe pour la journée,
// puis un INSERT avec `statut: 'non_justifie'`. Conséquence : refaire la
// feuille de présence — un second passage, une correction, deux personnes qui
// la saisissent — remettait à zéro le travail du secrétariat. Le `statut`
// repassait à « non justifié » et la `justification` déposée par le parent
// (mig. 024) disparaissait. Perte silencieuse, irréversible.
//
// On procède désormais par DIFFÉRENCE, ce qui rend l'opération IDEMPOTENTE :
// rejouer la même feuille ne change rien, et une erreur réseau en cours de
// route se répare en recommençant. C'est cette propriété qui remplace
// l'atomicité (on reste sur plusieurs appels, sans migration).
// La différence est une fonction PURE, donc éprouvable sans base : c'est elle
// qui garantit qu'une justification n'est jamais écrasée.
// Rend { aSupprimer: [id], aMettreAJour: [{id, type, motif}], aInserer: [ligne] }.
export function diffAppel({ ecoleId, classeId, date, entries = [], existantes = [], saisiPar = null }) {
  const parEleve = new Map();
  for (const a of existantes) {
    if (!parEleve.has(a.eleve_id)) parEleve.set(a.eleve_id, []);
    parEleve.get(a.eleve_id).push(a);
  }

  const aSupprimer = [];
  const aInserer = [];
  const aMettreAJour = [];

  for (const e of entries) {
    const lignes = parEleve.get(e.eleve_id) || [];
    const absent = e.etat === "absence" || e.etat === "retard";

    if (!absent) {
      // Marqué présent : on retire ses lignes du jour (saisie corrigée).
      aSupprimer.push(...lignes.map((x) => x.id));
      continue;
    }
    if (lignes.length === 0) {
      aInserer.push({
        ecole_id: ecoleId, eleve_id: e.eleve_id, classe_id: classeId,
        type: e.etat, date_abs: date, motif: e.motif || null,
        statut: "non_justifie", saisi_par: saisiPar || null,
      });
      continue;
    }
    // Une ligne existe : on ne touche QUE le type et le motif. `statut` et
    // `justification` appartiennent au circuit de justification, pas à l'appel.
    const [garder, ...surplus] = lignes;
    if (garder.type !== e.etat || (garder.motif || null) !== (e.motif || null)) {
      aMettreAJour.push({ id: garder.id, type: e.etat, motif: e.motif || null });
    }
    aSupprimer.push(...surplus.map((x) => x.id));   // doublons éventuels
  }
  return { aSupprimer, aMettreAJour, aInserer };
}

export async function enregistrerAppel(ecoleId, classeId, date, entries, saisiPar) {
  // 1) L'existant du jour. La table n'a pas de contrainte d'unicité sur
  //    (eleve, date) : un élève peut porter plusieurs lignes.
  const { data: existantes, error: eLire } = await supabase
    .from("absences")
    .select("id, eleve_id, type, motif")
    .eq("ecole_id", ecoleId)
    .eq("classe_id", classeId)
    .eq("date_abs", date);
  if (eLire) throw eLire;

  const { aSupprimer, aMettreAJour, aInserer } =
    diffAppel({ ecoleId, classeId, date, entries, existantes: existantes ?? [], saisiPar });

  // Les élèves absents de `entries` (hors classe, désinscrits) ne sont pas
  // touchés : on ne supprime que ce qu'on a explicitement remis à « présent ».
  if (aSupprimer.length) {
    const { error } = await supabase.from("absences").delete().in("id", aSupprimer);
    if (error) throw error;
  }
  for (const m of aMettreAJour) {
    const { error } = await supabase.from("absences")
      .update({ type: m.type, motif: m.motif }).eq("id", m.id);
    if (error) throw error;
  }
  if (aInserer.length) {
    const { error } = await supabase.from("absences").insert(aInserer);
    if (error) throw error;
  }
}

export async function justifierAbsence(id, statut) {
  const { error } = await supabase.from("absences").update({ statut }).eq("id", id);
  if (error) throw error;
}

// Liste récente des absences (avec élève + classe) pour le suivi.
export async function getAbsencesRecentes(ecoleId, limit = 100) {
  const { data, error } = await supabase
    .from("absences")
    .select("*, eleves(prenom, nom), classes(libelle)")
    .eq("ecole_id", ecoleId)
    .order("date_abs", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Absences/retards d'une classe sur une période (pour les statistiques).
export async function getAbsencesPeriode(ecoleId, classeId, debut, fin) {
  let q = supabase.from("absences").select("eleve_id, type").eq("ecole_id", ecoleId).eq("classe_id", classeId);
  if (debut) q = q.gte("date_abs", debut);
  if (fin) q = q.lte("date_abs", fin);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// --- Incidents (sanctions / observations / félicitations) ---
export async function getIncidents(ecoleId, limit = 100) {
  const { data, error } = await supabase
    .from("incidents")
    .select("*, eleves(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .order("date_incident", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function creerIncident(ecoleId, inc, saisiPar) {
  const { data, error } = await supabase
    .from("incidents")
    .insert({ ecole_id: ecoleId, saisi_par: saisiPar || null, ...inc })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerIncident(id) {
  const { error } = await supabase.from("incidents").delete().eq("id", id);
  if (error) throw error;
}
