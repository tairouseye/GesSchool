import { supabase } from "@/lib/supabase.js";

// GesSchool — recouvrement : impayés, retards, contacts payeur.

// Impayés par élève, d'après l'échéancier ET les factures hors échéancier
// (mig. 232, `impayes_annee`) : le même chiffre que l'accueil Gestion, la
// Situation des paiements, la fiche et l'espace parent. Avant, on lisait les
// seules factures : un mois dû sans facture n'était jamais « en retard ».
//   retard : ce qui est échu et non payé ; reste : tout ce qui reste sur l'année.
export async function getImpayes(ecoleId, anneeId) {
  if (!anneeId) return [];
  const { data, error } = await supabase.rpc("impayes_annee", { p_annee: anneeId });
  if (error) throw error;
  return listeImpayes(data ?? []);
}

// La forme attendue par le Recouvrement, à partir des lignes d'`impayes_annee`.
// Module pur, testé (test/impayes.test.mjs).
export function listeImpayes(lignes, aujourdhui = new Date()) {
  const liste = [];
  for (const l of lignes) {
    const retard = (Number(l.du) || 0) + (Number(l.hors) || 0);
    const reste = Math.max(Number(l.reste) || 0, retard);
    if (reste <= 0) continue;
    const enRetard = retard > 0;
    const echeance = enRetard ? l.depuis || null : l.prochaine || null;
    liste.push({
      eleve_id: l.eleve_id,
      eleve: { prenom: l.prenom, nom: l.nom, matricule: l.matricule },
      classe: l.classe || "",
      paye: Number(l.paye) || 0,
      retard, reste, enRetard, echeance,
      joursRetard: enRetard && echeance
        ? Math.max(0, Math.floor((aujourdhui.getTime() - new Date(echeance).getTime()) / 86400000))
        : 0,
    });
  }
  // en retard d'abord, puis le plus gros retard
  liste.sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || b.retard - a.retard || b.reste - a.reste);
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
