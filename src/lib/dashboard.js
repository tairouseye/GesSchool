import { supabase } from "@/lib/supabase.js";

// GesSchool — statistiques du tableau de bord (calculées depuis la base).

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function getStats(ecoleId, anneeId) {
  const now = new Date();

  // Requêtes indépendantes exécutées EN PARALLÈLE.
  // Les trois premières ne rapatrient AUCUNE ligne : un `count` sans corps,
  // et deux agrégats calculés en base (migration 137 pour les finances).
  // Auparavant, toutes les factures de l'année et tous les paiements de six
  // mois traversaient le réseau pour produire trois nombres.
  const [effRes, finRes, notesRes] = await Promise.all([
    anneeId
      ? supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ count: 0 }),
    supabase.rpc("tableau_bord_finances", { p_ecole: ecoleId, p_annee: anneeId ?? null, p_mois: 6 }),
    supabase.rpc("moyenne_notes_ecole", { p_ecole: ecoleId, p_annee: anneeId }),
  ]);

  const effectif = effRes.count ?? 0;

  const fin = finRes.data || {};
  const totalFacture = Number(fin.facture) || 0;
  const totalPaye = Number(fin.paye) || 0;
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  // La base renvoie { cle: "AAAA-MM", montant }, mois vides compris ; il ne
  // reste qu'à poser le libellé lisible.
  const serie = (fin.serie || []).map((p) => {
    const mois = Number(String(p.cle).slice(5, 7)) - 1;
    return { cle: p.cle, mois: MOIS[mois] || "", montant: Number(p.montant) || 0 };
  });
  const encaisseMois = serie.length ? serie[serie.length - 1].montant : 0;

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
// échéances proches), la santé financière, et l'année comparée à la
// précédente (refonte « Classter » du 31/10/2026).
export async function statsGestion(ecoleId, annee) {
  const anneeId = annee?.id || null;
  const now = new Date();
  const jour = isoJour(now);
  const dans7 = isoJour(new Date(now.getTime() + 7 * 86400000));
  const dans45 = isoJour(new Date(now.getTime() + 45 * 86400000));
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const debutSemaine = isoJour(lundi);
  const debutMois = isoJour(new Date(now.getFullYear(), now.getMonth(), 1));

  const [facRes, declRes, payRes, finRes, effRes, nvRes, precRes, actPay, actIns] = await Promise.all([
    anneeId
      ? supabase.from("factures")
          .select("eleve_id, montant_total, montant_paye, date_echeance, statut, eleves(prenom, nom, inscriptions(annee_id, classes(libelle)))")
          .eq("ecole_id", ecoleId).eq("annee_id", anneeId).neq("statut", "annulee")
      : Promise.resolve({ data: [] }),
    supabase.from("declarations_paiement").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("statut", "en_attente"),
    // Le mois en cours seulement : le jour, la semaine et les modes.
    supabase.from("paiements").select("montant, date_paiement, mode").eq("ecole_id", ecoleId).gte("date_paiement", debutMois),
    // 24 mois agrégés EN BASE (mig. 137/143) : l'année en cours et la précédente.
    supabase.rpc("tableau_bord_finances", { p_ecole: ecoleId, p_annee: anneeId, p_mois: 24 }),
    anneeId ? compterInscriptions(ecoleId, anneeId) : Promise.resolve({ count: 0 }),
    anneeId ? compterInscriptions(ecoleId, anneeId, debutMois) : Promise.resolve({ count: 0 }),
    anneePrecedente(ecoleId, annee),
    supabase.from("paiements").select("montant, mode, created_at, factures(eleves(prenom, nom))")
      .eq("ecole_id", ecoleId).order("created_at", { ascending: false }).limit(5),
    anneeId
      ? supabase.from("inscriptions").select("created_at, eleves(prenom, nom), classes(libelle)")
          .eq("ecole_id", ecoleId).eq("annee_id", anneeId).order("created_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  // Factures de l'année → recouvrement, impayés, échéances, classes.
  let totalFacture = 0, totalPaye = 0, retardMontant = 0, echeanceNb = 0, echeanceMontant = 0;
  const parDebiteur = {}, parClasse = {}, parEcheance = {};
  const enRetard = new Set();
  for (const f of facRes.data ?? []) {
    const total = Number(f.montant_total) || 0, paye = Math.min(Number(f.montant_paye) || 0, total), reste = total - paye;
    totalFacture += total; totalPaye += paye;
    const insc = (f.eleves?.inscriptions || []).find((i) => i.annee_id === anneeId);
    const classe = insc?.classes?.libelle || "Sans classe";
    const c = (parClasse[classe] ||= { facture: 0, paye: 0 });
    c.facture += total; c.paye += paye;
    if (reste <= 0) continue;
    if (f.date_echeance && f.date_echeance < jour) {
      retardMontant += reste; enRetard.add(f.eleve_id);
      const d = (parDebiteur[f.eleve_id] ||= { nom: `${f.eleves?.prenom || ""} ${f.eleves?.nom || ""}`.trim() || "—", reste: 0 });
      d.reste += reste;
    } else if (f.date_echeance && f.date_echeance >= jour) {
      if (f.date_echeance <= dans7) { echeanceNb += 1; echeanceMontant += reste; }
      if (f.date_echeance <= dans45) {
        const e = (parEcheance[f.date_echeance] ||= { familles: new Set(), montant: 0 });
        e.familles.add(f.eleve_id); e.montant += reste;
      }
    }
  }
  const topDebiteurs = Object.values(parDebiteur).sort((a, b) => b.reste - a.reste).slice(0, 5);
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;
  // Les classes qui paient le moins, en premier.
  const classes = Object.entries(parClasse)
    .map(([libelle, c]) => ({ libelle, reste: c.facture - c.paye, taux: c.facture > 0 ? (c.paye / c.facture) * 100 : 100 }))
    .filter((c) => c.reste > 0)
    .sort((a, b) => a.taux - b.taux);
  const echeances = Object.entries(parEcheance)
    .map(([date, e]) => ({ date, familles: e.familles.size, montant: e.montant }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Encaissements du mois : jour, semaine, modes.
  let encJour = 0, encSemaine = 0, encMois = 0;
  const parMode = {};
  for (const p of payRes.data ?? []) {
    const m = Number(p.montant) || 0, d = p.date_paiement || "";
    encMois += m;
    if (d >= debutSemaine) encSemaine += m;
    if (d === jour) encJour += m;
    parMode[p.mode] = (parMode[p.mode] || 0) + m;
  }

  // Série mensuelle sur 24 mois (clé AAAA-MM → montant).
  const parMois = {};
  for (const pt of finRes.data?.serie || []) parMois[pt.cle] = Number(pt.montant) || 0;
  const encMoisN1 = parMois[cleMois(new Date(now.getFullYear() - 1, now.getMonth(), 1))] ?? null;

  // L'année scolaire mois par mois, face au même mois de l'année précédente.
  const annuel = moisDeLAnnee(annee).map((d) => ({
    lib: MOIS[d.getMonth()],
    val: d > now ? null : parMois[cleMois(d)] ?? 0,
    ref: parMois[cleMois(new Date(d.getFullYear() - 1, d.getMonth(), 1))] ?? null,
  }));
  // Six derniers mois : la tendance de la tuile « Encaissé ».
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    serie.push({ cle: cleMois(d), mois: MOIS[d.getMonth()], montant: parMois[cleMois(d)] ?? 0 });
  }

  // Activité récente : encaissements et inscriptions, du plus récent au plus ancien.
  const activite = [
    ...(actPay.data ?? []).map((p) => ({
      type: "paiement", date: p.created_at, montant: Number(p.montant) || 0, mode: p.mode,
      eleve: `${p.factures?.eleves?.prenom || ""} ${p.factures?.eleves?.nom || ""}`.trim(),
    })),
    ...(actIns.data ?? []).map((i) => ({
      type: "inscription", date: i.created_at, classe: i.classes?.libelle || "",
      eleve: `${i.eleves?.prenom || ""} ${i.eleves?.nom || ""}`.trim(),
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);

  return {
    effectif: effRes.count ?? 0, nouveaux: nvRes.count ?? 0, effectifN1: precRes?.effectif ?? null,
    totalFacture, totalPaye, tauxRecouvrement,
    retardMontant, nbEnRetard: enRetard.size, topDebiteurs,
    echeanceNb, echeanceMontant, echeances, classes,
    declEnAttente: declRes.count ?? 0,
    encJour, encSemaine, encMois, encMoisN1, parMode,
    serie, annuel, activite,
  };
}

// --- PILOTAGE : encaissements et dépenses des 12 derniers mois ----------
// Encaissements agrégés en base (tableau_bord_finances) ; dépenses lues sur
// 12 mois (une ligne par dépense, volume modeste). Un échec rend une série
// vide : le reste du Pilotage s'affiche quand même.
export async function fluxPilotage(ecoleId) {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [finRes, depRes] = await Promise.all([
    supabase.rpc("tableau_bord_finances", { p_ecole: ecoleId, p_annee: null, p_mois: 12 }),
    supabase.from("depenses").select("montant, date_depense").eq("ecole_id", ecoleId).gte("date_depense", isoJour(debut)),
  ]);
  const enc = {}, dep = {};
  for (const pt of finRes.data?.serie || []) enc[pt.cle] = Number(pt.montant) || 0;
  for (const d of depRes.data ?? []) {
    const k = String(d.date_depense).slice(0, 7);
    dep[k] = (dep[k] || 0) + (Number(d.montant) || 0);
  }
  const points = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ lib: MOIS[d.getMonth()], val: enc[cleMois(d)] ?? 0, ref: dep[cleMois(d)] ?? 0 });
  }
  return points;
}

// --- Aides communes aux tableaux de bord ---------------------------------
const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function compterInscriptions(ecoleId, anneeId, depuis = null) {
  let q = supabase.from("inscriptions").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("annee_id", anneeId);
  if (depuis) q = q.gte("date_inscription", depuis);
  return q;
}

// L'année qui précède l'année courante (par date de début), et son effectif.
// Sans année précédente (école nouvelle) : null, et aucune évolution affichée.
async function anneePrecedente(ecoleId, annee) {
  if (!annee?.date_debut) return null;
  const { data } = await supabase.from("annees_scolaires").select("id, libelle")
    .eq("ecole_id", ecoleId).lt("date_debut", annee.date_debut).order("date_debut", { ascending: false }).limit(1);
  const prec = data?.[0];
  if (!prec) return null;
  const { count } = await compterInscriptions(ecoleId, prec.id);
  return { ...prec, effectif: count ?? 0 };
}

// Les mois de l'année scolaire (au plus 12), du mois de rentrée au dernier.
// Sans dates : de septembre à juin, rentrée la plus récente.
export function moisDeLAnnee(annee, now = new Date()) {
  const debut = annee?.date_debut ? new Date(`${annee.date_debut}T12:00:00`)
    : new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  const fin = annee?.date_fin ? new Date(`${annee.date_fin}T12:00:00`) : new Date(debut.getFullYear() + 1, 5, 30);
  const mois = [];
  for (let d = new Date(debut.getFullYear(), debut.getMonth(), 1); d <= fin && mois.length < 12; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    mois.push(d);
  }
  return mois;
}

// Périodes de l'année (trimestres…).
//  - `courante` : celle qui CONTIENT aujourd'hui, ou null (vacances, dates
//    mal saisies) — l'écran ne doit jamais annoncer une période qui n'est pas
//    en cours ;
//  - `reference` : celle sur laquelle mesurer la saisie des notes (la
//    courante, sinon la dernière commencée, sinon la première).
export async function periodesAnnee(ecoleId, anneeId) {
  if (!anneeId) return { courante: null, reference: null, liste: [] };
  const { data } = await supabase.from("periodes").select("id, libelle, ordre, date_debut, date_fin")
    .eq("ecole_id", ecoleId).eq("annee_id", anneeId).order("ordre");
  const liste = data ?? [];
  return { ...periodeDeReference(liste, isoJour(new Date())), liste };
}

//  Règle pure, partagée avec l'écran Notes : il ouvrait toujours sur la
//  PREMIÈRE période, même au 3e trimestre que le tableau de bord annonçait.
//  `jour` au format AAAA-MM-JJ (comparaison de chaînes, comme les dates SQL).
export function periodeDeReference(liste = [], jour) {
  const courante = liste.find((p) => p.date_debut && p.date_fin && p.date_debut <= jour && jour <= p.date_fin) || null;
  const reference = courante
    || [...liste].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).reverse().find((p) => p.date_debut && p.date_debut <= jour)
    || liste[0] || null;
  return { courante, reference };
}

// Bulletins d'un état pour l'année en cours : un brouillon oublié l'an passé
// ne doit pas rester « à faire » pour toujours.
function bulletinsAnnee(ecoleId, anneeId, statut) {
  if (!anneeId) return Promise.resolve({ count: 0 });
  return supabase.from("bulletins").select("id, periodes!inner(annee_id)", { count: "exact", head: true })
    .eq("ecole_id", ecoleId).eq("statut", statut).eq("periodes.annee_id", anneeId);
}

// --- Tableau de bord PÉDAGOGIE (responsable : direction) ---
// Vue « ma section » : répartition et niveau académique par niveau scolaire,
// absentéisme à traiter, composition de l'effectif.
export async function statsPedagogie(ecoleId, anneeId) {
  const now = new Date();
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const debutSemaine = lundi.toISOString().slice(0, 10);
  const jour = now.toISOString().slice(0, 10);
  const compter = (table, filtre) => filtre(supabase.from(table).select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId));

  // Tout en parallèle : inscriptions, moyennes (agrégées côté Postgres),
  // absences, et ce qui attend une décision (justificatifs déposés par les
  // parents, bulletins en relecture ou arrêtés mais pas encore diffusés).
  const [inscRes, moyEcoleRes, moyNivRes, njRes, asRes, ajRes, eaRes, brRes, vaRes] = await Promise.all([
    anneeId
      ? supabase.from("inscriptions")
          .select("redoublant, eleves(sexe), classes(niveau_id, niveaux(libelle, ordre))")
          .eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ data: [] }),
    supabase.rpc("moyenne_notes_ecole", { p_ecole: ecoleId, p_annee: anneeId }),
    supabase.rpc("moyenne_notes_par_niveau", { p_ecole: ecoleId, p_annee: anneeId }),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("statut", "non_justifie"),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).gte("date_abs", debutSemaine),
    compter("absences", (q) => q.eq("date_abs", jour)),
    compter("absences", (q) => q.eq("statut", "en_attente")),
    bulletinsAnnee(ecoleId, anneeId, "brouillon"),
    bulletinsAnnee(ecoleId, anneeId, "valide"),
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
    absJour: ajRes.count ?? 0, justifEnAttente: eaRes.count ?? 0,
    bulletinsBrouillon: brRes.count ?? 0, bulletinsValides: vaRes.count ?? 0,
  };
}

// --- Blocs PÉDAGOGIE « Classter » (31/10/2026) ----------------------------
// Assiduité sur 8 semaines, agenda (périodes, évaluations prévues), et
// avancement de la saisie des notes par enseignant pour la période en cours.
//
// ⚠️ LE TAUX DE PRÉSENCE EST UNE ESTIMATION : la base n'enregistre que les
// ABSENCES, pas les présences. On rapporte les absences de la semaine à
// « effectif × jours de classe » (lundi à vendredi). L'écran le dit.
const TYPES_EVAL = { devoir: "Devoir", composition: "Composition", examen: "Examen", interro: "Interrogation", tp: "TP", oral: "Oral", projet: "Projet" };

export async function blocsPedagogie(ecoleId, annee, effectif) {
  const anneeId = annee?.id || null;
  const now = new Date();
  const jour = isoJour(now);
  const lundi = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const debut8 = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() - 7 * 7);

  const [absRes, per, affRes] = await Promise.all([
    supabase.from("absences").select("date_abs").eq("ecole_id", ecoleId).eq("type", "absence")
      .gte("date_abs", isoJour(debut8)).limit(10000),
    periodesAnnee(ecoleId, anneeId),
    anneeId
      ? supabase.from("affectations").select("enseignant_id, classe_id, matiere_id, enseignants(prenom, nom), classes(libelle)")
          .eq("ecole_id", ecoleId).eq("annee_id", anneeId)
      : Promise.resolve({ data: [] }),
  ]);
  const periode = per.reference;
  //  Des périodes hors des dates de l'année (année ouverte sans décaler les
  //  trimestres) faussent tout : période en cours, agenda, saisie. On le signale.
  const horsAnnee = Boolean(annee?.date_debut && annee?.date_fin) && per.liste.some((p) =>
    (p.date_debut && p.date_debut < annee.date_debut) || (p.date_fin && p.date_fin > annee.date_fin));
  const [evRes, aVenirRes] = await Promise.all([
    periode
      ? supabase.from("evaluations").select("classe_id, matiere_id").eq("ecole_id", ecoleId).eq("periode_id", periode.id)
      : Promise.resolve({ data: [] }),
    supabase.from("evaluations").select("date_eval, type, classe_id").eq("ecole_id", ecoleId)
      .gte("date_eval", jour).order("date_eval").limit(200),
  ]);

  // Assiduité : absences par semaine (S-7 … semaine en cours).
  const semaines = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() - 7 * i);
    semaines.push({ debut: isoJour(d), absences: 0 });
  }
  for (const a of absRes.data ?? []) {
    for (let i = semaines.length - 1; i >= 0; i--) {
      if (a.date_abs >= semaines[i].debut) { semaines[i].absences += 1; break; }
    }
  }
  //  Jours de classe écoulés : 5 pour une semaine passée, de 1 à 5 cette semaine.
  const joursCetteSemaine = Math.min(5, Math.max(1, ((now.getDay() + 6) % 7) + 1));
  const taux = (abs, jours) => (effectif > 0 ? Math.max(0, 100 - (abs / (effectif * jours)) * 100) : null);
  const assiduite = semaines.map((s, i) => ({
    lib: i === 7 ? "Cette sem." : `${s.debut.slice(8, 10)}/${s.debut.slice(5, 7)}`,
    absences: s.absences,
    presence: taux(s.absences, i === semaines.length - 1 ? joursCetteSemaine : 5),
  }));
  const presence = assiduite[assiduite.length - 1].presence;
  const presenceAvant = assiduite[assiduite.length - 2].presence;

  // Saisie des notes : une affectation (classe × matière) est « commencée »
  // dès qu'au moins une évaluation existe pour la période en cours.
  const evaluees = new Set((evRes.data ?? []).map((e) => `${e.classe_id}|${e.matiere_id}`));
  const parEns = {};
  for (const a of affRes.data ?? []) {
    const nom = `${a.enseignants?.prenom || ""} ${a.enseignants?.nom || ""}`.trim() || "Sans enseignant";
    const e = (parEns[a.enseignant_id || nom] ||= { nom, classes: new Set(), total: 0, faites: 0 });
    e.total += 1;
    if (a.classes?.libelle) e.classes.add(a.classes.libelle);
    if (evaluees.has(`${a.classe_id}|${a.matiere_id}`)) e.faites += 1;
  }
  const saisie = Object.values(parEns)
    .map((e) => ({ nom: e.nom, classes: [...e.classes].join(", "), total: e.total, faites: e.faites, pct: e.total ? (e.faites / e.total) * 100 : 0 }))
    .sort((a, b) => a.pct - b.pct);
  const saisieTotal = saisie.reduce((s, e) => s + e.total, 0);
  const saisieFaites = saisie.reduce((s, e) => s + e.faites, 0);

  // Agenda : évaluations prévues (groupées par jour et par type), fins et
  // débuts de période à venir. Les 5 premières dates.
  const parJour = {};
  for (const e of aVenirRes.data ?? []) {
    const k = `${e.date_eval}|${e.type}`;
    (parJour[k] ||= { date: e.date_eval, type: e.type, classes: new Set() }).classes.add(e.classe_id);
  }
  const agenda = [
    ...Object.values(parJour).map((g) => ({
      date: g.date, ton: g.type === "composition" || g.type === "examen" ? "violet" : "bleu",
      titre: TYPES_EVAL[g.type] || "Évaluation",
      detail: `${g.classes.size} classe${g.classes.size > 1 ? "s" : ""}`,
    })),
    ...per.liste.flatMap((p) => [
      p.date_debut && p.date_debut > jour && { date: p.date_debut, ton: "or", titre: `Début : ${p.libelle}`, detail: "Nouvelle période de notes" },
      p.date_fin && p.date_fin >= jour && { date: p.date_fin, ton: "rouge", titre: `Fin : ${p.libelle}`, detail: "Notes à compléter avant les bulletins" },
    ].filter(Boolean)),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return { periode, periodeEnCours: per.courante, horsAnnee, assiduite, presence, presenceAvant, saisie, saisieTotal, saisieFaites, agenda };
}

/**
 * Les lectures de « Ma journée » (lot 3) : l'emploi du temps de
 * l'enseignant, ses affectations, les évaluations de la période et leurs
 * notes, les absences du jour dans ses classes. Tout passe par la RLS de
 * l'enseignant ; les calculs sont dans maJournee.js.
 */
// Les cours du jour et les appels validés, pour « classes sans appel » (direction).
// `null` si l'un manque : on ne signale rien plutôt qu'à tort.
export async function donneesAppelsDuJour(ecoleId, anneeId) {
  const maintenant = new Date();
  const [edt, val] = await Promise.all([
    supabase.from("emplois_du_temps").select("jour, heure_debut, classe_id, matiere_id, activite, classes!inner(libelle, annee_id)")
      .eq("ecole_id", ecoleId).eq("jour", ((maintenant.getDay() + 6) % 7) + 1).eq("classes.annee_id", anneeId),
    supabase.from("appels_valides").select("classe_id").eq("ecole_id", ecoleId).eq("date_appel", isoJour(maintenant)),
  ]);
  if (edt.error || val.error) return null;
  return { creneaux: edt.data ?? [], valides: (val.data ?? []).map((v) => v.classe_id), now: maintenant };
}

export async function donneesMaJournee(ecoleId, anneeId, ensId) {
  if (!ensId || !anneeId) return null;
  const jour = isoJour(new Date());
  const [edt, aff, per, pp] = await Promise.all([
    supabase.from("emplois_du_temps").select("id, jour, heure_debut, heure_fin, salle, activite, classe_id, matiere_id, matieres(libelle), classes(libelle)")
      .eq("ecole_id", ecoleId).eq("enseignant_id", ensId),
    supabase.from("affectations").select("classe_id, matiere_id, classes(libelle), matieres(libelle)")
      .eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("enseignant_id", ensId),
    periodesAnnee(ecoleId, anneeId),
    supabase.from("classes").select("id, libelle").eq("ecole_id", ecoleId).eq("annee_id", anneeId).eq("prof_principal_id", ensId),
  ]);
  const affectations = aff.data ?? [];
  const classes = {};
  for (const a of affectations) if (a.classe_id) classes[a.classe_id] = { id: a.classe_id, libelle: a.classes?.libelle || "" };
  for (const c of pp.data ?? []) classes[c.id] = c;
  const ids = Object.keys(classes);
  const periode = per.reference;

  const [ev, abs, val] = await Promise.all([
    periode && ids.length
      ? supabase.from("evaluations").select("id, classe_id, matiere_id, date_eval, type, libelle, actif, classes(libelle), matieres(libelle)")
          .eq("ecole_id", ecoleId).eq("periode_id", periode.id).in("classe_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("absences").select("classe_id").eq("ecole_id", ecoleId).eq("date_abs", jour).in("classe_id", ids).limit(2000)
      : Promise.resolve({ data: [] }),
    supabase.from("appels_valides").select("classe_id").eq("ecole_id", ecoleId).eq("date_appel", jour),
  ]);
  const evaluations = ev.data ?? [];
  //  Une évaluation « a des notes » dès la première : on ne lit que la clé.
  const notesParEval = {};
  const evIds = evaluations.filter((e) => e.date_eval && e.date_eval <= jour).map((e) => e.id);
  if (evIds.length) {
    const { data } = await supabase.from("notes").select("evaluation_id").in("evaluation_id", evIds).limit(20000);
    for (const n of data ?? []) notesParEval[n.evaluation_id] = (notesParEval[n.evaluation_id] || 0) + 1;
  }
  return {
    creneaux: edt.data ?? [], affectations, evaluations, notesParEval,
    absencesJour: abs.data ?? [], appelsValides: val.error ? null : (val.data ?? []).map((v) => v.classe_id), mesClasses: Object.values(classes).sort((a, b) => a.libelle.localeCompare(b.libelle)),
    periode, periodeEnCours: per.courante,
  };
}
