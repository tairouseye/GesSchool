import { supabase } from "@/lib/supabase.js";

// GesSchool — statistiques du tableau de bord (calculées depuis la base).

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function getStats(ecoleId, anneeId) {
  // Effectif (inscriptions de l'année courante)
  let effectif = 0;
  if (anneeId) {
    const { count } = await supabase
      .from("inscriptions")
      .select("id", { count: "exact", head: true })
      .eq("ecole_id", ecoleId)
      .eq("annee_id", anneeId);
    effectif = count ?? 0;
  }

  // Facturé vs encaissé (année courante) → taux de recouvrement
  let totalFacture = 0, totalPaye = 0;
  if (anneeId) {
    const { data: factures } = await supabase
      .from("factures")
      .select("montant_total, montant_paye")
      .eq("ecole_id", ecoleId)
      .eq("annee_id", anneeId);
    for (const f of factures ?? []) {
      totalFacture += Number(f.montant_total) || 0;
      totalPaye += Number(f.montant_paye) || 0;
    }
  }
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  // Encaissements des 6 derniers mois (par mois) + mois courant
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const { data: paiements } = await supabase
    .from("paiements")
    .select("montant, date_paiement")
    .eq("ecole_id", ecoleId)
    .gte("date_paiement", debut.toISOString().slice(0, 10));

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

  // Moyenne des notes de l'établissement (note ramenée sur /20)
  const { data: notes } = await supabase
    .from("notes")
    .select("valeur, absent, evaluations(bareme)")
    .eq("ecole_id", ecoleId);
  let somme = 0, n = 0;
  for (const note of notes ?? []) {
    if (note.absent || note.valeur == null) continue;
    const bareme = Number(note.evaluations?.bareme) || 20;
    somme += (Number(note.valeur) / bareme) * 20;
    n++;
  }
  const moyenne = n > 0 ? somme / n : null;

  return {
    effectif,
    totalFacture,
    totalPaye,
    tauxRecouvrement,
    encaisseMois,
    serie,
    moyenne,
    nbNotes: n,
  };
}

// Série des encaissements des 6 derniers mois (réutilisée par les accueils).
async function serie6Mois(ecoleId) {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const { data } = await supabase
    .from("paiements")
    .select("montant, date_paiement")
    .eq("ecole_id", ecoleId)
    .gte("date_paiement", debut.toISOString().slice(0, 10));
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    serie.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, mois: MOIS[d.getMonth()], montant: 0 });
  }
  const idx = Object.fromEntries(serie.map((s, i) => [s.cle, i]));
  for (const p of data ?? []) {
    const cle = (p.date_paiement || "").slice(0, 7);
    if (cle in idx) serie[idx[cle]].montant += Number(p.montant) || 0;
  }
  return serie;
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

  // Encaissements du mois → jour / semaine / mois + répartition par mode
  const { data: paiements } = await supabase
    .from("paiements")
    .select("montant, date_paiement, mode")
    .eq("ecole_id", ecoleId)
    .gte("date_paiement", debutMois);
  let encJour = 0, encSemaine = 0, encMois = 0;
  const parMode = {};
  for (const p of paiements ?? []) {
    const m = Number(p.montant) || 0;
    encMois += m;
    if ((p.date_paiement || "") >= debutSemaine) encSemaine += m;
    if ((p.date_paiement || "") === jour) encJour += m;
    parMode[p.mode] = (parMode[p.mode] || 0) + m;
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
    serie: await serie6Mois(ecoleId),
  };
}

// --- Tableau de bord PÉDAGOGIE (responsable : direction) ---
// Vue « ma section » : répartition et niveau académique par niveau scolaire,
// absentéisme à traiter, composition de l'effectif.
export async function statsPedagogie(ecoleId, anneeId) {
  const now = new Date();
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const debutSemaine = lundi.toISOString().slice(0, 10);

  // Inscriptions de l'année → effectif, sexe, redoublants, répartition par niveau
  let effectif = 0, filles = 0, garcons = 0, redoublants = 0;
  const parNiveau = {};
  if (anneeId) {
    const { data } = await supabase
      .from("inscriptions")
      .select("redoublant, eleves(sexe), classes(niveau_id, niveaux(libelle, ordre))")
      .eq("ecole_id", ecoleId)
      .eq("annee_id", anneeId);
    for (const i of data ?? []) {
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
  }

  // Notes → moyenne générale + moyenne par niveau (sur /20)
  const { data: notes } = await supabase
    .from("notes")
    .select("valeur, absent, evaluations(bareme, classes(niveau_id))")
    .eq("ecole_id", ecoleId);
  let somme = 0, n = 0;
  const moyNiveau = {};
  for (const note of notes ?? []) {
    if (note.absent || note.valeur == null) continue;
    const bareme = Number(note.evaluations?.bareme) || 20;
    const v20 = (Number(note.valeur) / bareme) * 20;
    somme += v20; n += 1;
    const nid = note.evaluations?.classes?.niveau_id;
    if (nid) { const g = (moyNiveau[nid] ||= { somme: 0, n: 0 }); g.somme += v20; g.n += 1; }
  }
  const moyenne = n > 0 ? somme / n : null;

  const niveaux = Object.entries(parNiveau)
    .map(([id, nv]) => ({ ...nv, moyenne: moyNiveau[id]?.n ? moyNiveau[id].somme / moyNiveau[id].n : null }))
    .sort((a, b) => a.ordre - b.ordre);

  // Absentéisme : non justifiées (à traiter) + volume de la semaine
  const [{ count: nonJustif }, { count: absSemaine }] = await Promise.all([
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).eq("statut", "non_justifie"),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("ecole_id", ecoleId).gte("date_abs", debutSemaine),
  ]);

  return {
    effectif, filles, garcons, redoublants,
    niveaux, moyenne, nbNotes: n,
    absNonJustif: nonJustif ?? 0, absSemaine: absSemaine ?? 0,
  };
}
