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
