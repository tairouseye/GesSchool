import { supabase } from "@/lib/supabase.js";

// GesSchool — recouvrement : impayés, retards, contacts payeur.

// Impayés agrégés par élève (factures avec reste > 0, hors annulées).
export async function getImpayes(ecoleId, anneeId) {
  let q = supabase
    .from("factures")
    .select("id, eleve_id, montant_total, montant_paye, date_echeance, statut, eleves(prenom, nom, matricule)")
    .eq("ecole_id", ecoleId)
    .neq("statut", "annulee");
  if (anneeId) q = q.eq("annee_id", anneeId);
  const { data, error } = await q;
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const parEleve = {};
  for (const f of data ?? []) {
    const reste = (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0);
    if (reste <= 0) continue;
    const e = (parEleve[f.eleve_id] ||= {
      eleve_id: f.eleve_id,
      eleve: f.eleves,
      total: 0, paye: 0, reste: 0,
      nbFactures: 0, echeance: null, enRetard: false,
    });
    e.total += Number(f.montant_total) || 0;
    e.paye += Number(f.montant_paye) || 0;
    e.reste += reste;
    e.nbFactures += 1;
    if (f.date_echeance && (!e.echeance || f.date_echeance < e.echeance)) e.echeance = f.date_echeance;
    if (f.date_echeance && f.date_echeance < today) e.enRetard = true;
  }
  const liste = Object.values(parEleve);
  // jours de retard (depuis l'échéance la plus ancienne)
  for (const e of liste) {
    e.joursRetard = e.echeance && e.enRetard
      ? Math.floor((Date.now() - new Date(e.echeance).getTime()) / 86400000)
      : 0;
  }
  // en retard d'abord, puis reste décroissant
  liste.sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || b.reste - a.reste);
  return liste;
}

// Contact « responsable paiement » par élève (téléphone pour relance).
export async function getContactsPaiement(ecoleId) {
  const { data, error } = await supabase
    .from("eleve_tuteurs")
    .select("eleve_id, responsable_paiement, tuteurs(prenom, nom, telephone)")
    .eq("ecole_id", ecoleId);
  if (error) throw error;
  const map = {};
  for (const lt of data ?? []) {
    if (!lt.tuteurs) continue;
    // priorité au responsable de paiement, sinon premier tuteur trouvé
    if (!map[lt.eleve_id] || lt.responsable_paiement) map[lt.eleve_id] = lt.tuteurs;
  }
  return map;
}

// Construit un lien WhatsApp avec message pré-rempli (indicatif Sénégal par défaut).
export function lienWhatsApp(telephone, message, indicatif = "221") {
  if (!telephone) return null;
  let num = telephone.replace(/\D/g, "");
  if (num.length === 9) num = indicatif + num; // numéro local sénégalais
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
