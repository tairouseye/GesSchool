import { supabase } from "@/lib/supabase.js";

// GesSchool — statistiques du tableau de bord (calculées depuis la base).

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function getStats(ecoleId, anneeId) {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const debutStr = debut.toISOString().slice(0, 10);

  // Requêtes indépendantes exécutées EN PARALLÈLE (au lieu d'en série).
  const [effRes, facturesRes, paiementsRes, notesRes] = await Promise.all([
    anneeId
      ? supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ count: 0 }),
    anneeId
      ? supabase.from("factures").select("montant_total, montant_paye").eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ data: [] }),
    supabase.from("paiements").select("montant, date_paiement").eq("ecole_id", ecoleId).gte("date_paiement", debutStr),
    supabase.rpc("moyenne_notes_ecole", { p_ecole: ecoleId, p_annee: anneeId }),
  ]);

  // Effectif (inscriptions de l'année courante)
  const effectif = effRes.count ?? 0;

  // Facturé vs encaissé (année courante) → taux de recouvrement
  let totalFacture = 0, totalPaye = 0;
  for (const f of facturesRes.data ?? []) {
    totalFacture += Number(f.montant_total) || 0;
    totalPaye += Number(f.montant_paye) || 0;
  }
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  // Encaissements des 6 derniers mois (par mois) + mois courant
  const paiements = paiementsRes.data;
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    serie.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, mois: MOIS[d.getMonth()], montant: 0 });
  }
  const indexParCle = Object.fromEntries(serie.map((s, i) => [s.cle, i]));
  for (const p of paiements ?? []) {
    const cle = (p.date_paiement || "").slice(0, 7);
    if (cle in indexParCle) serie[indexParCle[cle]].montant += Number(p.montant) || 0;
  }
  const encaisseMois = serie[serie.length - 1].montant;

  // Moyenne des notes de l'établissement (calculée côté Postgres, cf. RPC
  // moyenne_notes_ecole) → seulement 1 ligne renvoyée au lieu de toutes les notes.
  const moyRow = (notesRes.data ?? [])[0] || {};
  const moyenne = moyRow.moyenne != null ? Number(moyRow.moyenne) : null;
  const nbNotes = moyRow.moyenne != null ? Number(moyRow.n) : 0;

  return {
    effectif,
    totalFacture,
    totalPaye,
    tauxRecouvrement,
    encaisseMois,
    serie,
    moyenne,
    nbNotes,
  };
}

// --- Tableau de bord GESTION / FINANCES (responsable : comptable) ---
// Met en avant ce qui demande une action (déclarations à valider, impayés,
// échéances proches) + la santé financière + la tendance.
export async function statsGestion(ecoleId, anneeId) {
  const now = new Date();
  const jour = now.toISOString().slice(0, 10);
  const dans7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const debutSemaine = lundi.toISOString().slice(0, 10);
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // Factures de l'année (avec élève) → recouvrement, impayés, échéances
  let totalFacture = 0, totalPaye = 0, retardMontant = 0, echeanceNb = 0, echeanceMontant = 0;
  const parDebiteur = {};
  const enRetard = new Set();
  if (anneeId) {
    const { data: factures } = await supabase
      .from("factures")
      .select("eleve_id, montant_total, montant_paye, date_echeance, eleves(prenom, nom)")
      .eq("ecole_id", ecoleId)
      .eq("annee_id", anneeId);
    for (const f of factures ?? []) {
      const total = Number(f.montant_total) || 0, paye = Number(f.montant_paye) || 0, reste = total - paye;
      totalFacture += total; totalPaye += paye;
      if (reste <= 0) continue;
      if (f.date_echeance && f.date_echeance < jour) {
        retardMontant += reste; enRetard.add(f.eleve_id);
        const d = (parDebiteur[f.eleve_id] ||= { nom: `${f.eleves?.prenom || ""} ${f.eleves?.nom || ""}`.trim() || "—", reste: 0 });
        d.reste += reste;
      } else if (f.date_echeance && f.date_echeance >= jour && f.date_echeance <= dans7) {
        echeanceNb += 1; echeanceMontant += reste;
      }
    }
  }
  const topDebiteurs = Object.values(parDebiteur).sort((a, b) => b.reste - a.reste).slice(0, 5);
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  // Déclarations de paiement en attente (à valider)
  const { count: declEnAttente } = await supabase
    .from("declarations_paiement")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecoleId)
    .eq("statut", "en_attente");

  // Encaissements : UN SEUL chargement (6 mois) sert la courbe ET les agrégats
  // jour / semaine / mois (au lieu de deux requêtes qui se recouvraient).
  const debut6 = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  const { data: paiements } = await supabase
    .from("paiements")
    .select("montant, date_paiement, mode")
    .eq("ecole_id", ecoleId)
    .gte("date_paiement", debut6);
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    serie.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, mois: MOIS[d.getMonth()], montant: 0 });
  }
  const idxSerie = Object.fromEntries(serie.map((s, i) => [s.cle, i]));
  let encJour = 0, encSemaine = 0, encMois = 0;
  const parMode = {};
  for (const p of paiements ?? []) {
    const m = Number(p.montant) || 0;
    const d = p.date_paiement || "";
    const c = d.slice(0, 7);
    if (c in idxSerie) serie[idxSerie[c]].montant += m;
    if (d >= debutMois) {
      encMois += m;
      if (d >= debutSemaine) encSemaine += m;
      if (d === jour) encJour += m;
      parMode[p.mode] = (parMode[p.mode] || 0) + m;
    }
  }

  // Effectif + nouveaux inscrits du mois
  let effectif = 0, nouveaux = 0;
  if (anneeId) {
    const [{ count: eff }, { count: nv }] = await Promise.all([
      supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId),
      supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId).gte("date_inscription", debutMois),
    ]);
    effectif = eff ?? 0; nouveaux = nv ?? 0;
  }

  return {
    effectif, nouveaux,
    totalFacture, totalPaye, tauxRecouvrement,
    retardMontant, nbEnRetard: enRetard.size, topDebiteurs,
    echeanceNb, echeanceMontant,
    declEnAttente: declEnAttente ?? 0,
    encJour, encSemaine, encMois, parMode,
    serie,
  };
}

// --- Tableau de bord PÉDAGOGIE (responsable : direction) ---
// Vue « ma section » : répartition et niveau académique par niveau scolaire,
// absentéisme à traiter, composition de l'effectif.
export async function statsPedagogie(ecoleId, anneeId) {
  const now = new Date();
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const debutSemaine = lundi.toISOString().slice(0, 10);

  // Tout en parallèle : inscriptions, moyennes (agrégées côté Postgres), absences.
  const [inscRes, moyEcoleRes, moyNivRes, njRes, asRes] = await Promise.all([
    anneeId
      ? supabase.from("inscriptions")
          .select("redoublant, eleves(sexe), classes(niveau_id, niveaux(libelle, ordre))")
          .eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ data: [] }),
    supabase.rpc("moyenne_notes_ecole", { p_ecole: ecoleId, p_annee: anneeId }),
    supabase.rpc("moyenne_notes_par_niveau", { p_ecole: ecoleId, p_annee: anneeId }),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("statut", "non_justifie"),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).gte("date_abs", debutSemaine),
  ]);

  // Inscriptions → effectif, sexe, redoublants, répartition par niveau
  let effectif = 0, filles = 0, garcons = 0, redoublants = 0;
  const parNiveau = {};
  for (const i of inscRes.data ?? []) {
    effectif += 1;
    const s = (i.eleves?.sexe || "").toUpperCase();
    if (s === "F") filles += 1; else if (s === "M") garcons += 1;
    if (i.redoublant) redoublants += 1;
    const nid = i.classes?.niveau_id;
    if (nid) {
      const nv = (parNiveau[nid] ||= { libelle: i.classes?.niveaux?.libelle || "—", ordre: i.classes?.niveaux?.ordre ?? 99, effectif: 0 });
      nv.effectif += 1;
    }
  }

  // Moyennes calculées côté Postgres (générale + par niveau, /20)
  const gRow = (moyEcoleRes.data ?? [])[0] || {};
  const moyenne = gRow.moyenne != null ? Number(gRow.moyenne) : null;
  const nbNotes = gRow.moyenne != null ? Number(gRow.n) : 0;
  const moyParNiveau = {};
  for (const row of moyNivRes.data ?? []) {
    if (row.niveau_id != null && row.moyenne != null) moyParNiveau[row.niveau_id] = Number(row.moyenne);
  }

  const niveaux = Object.entries(parNiveau)
    .map(([id, nv]) => ({ ...nv, moyenne: moyParNiveau[id] ?? null }))
    .sort((a, b) => a.ordre - b.ordre);

  return {
    effectif, filles, garcons, redoublants,
    niveaux, moyenne, nbNotes,
    absNonJustif: njRes.count ?? 0, absSemaine: asRes.count ?? 0,
  };
}
