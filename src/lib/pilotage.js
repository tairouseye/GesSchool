import { supabase } from "@/lib/supabase.js";

// GesSchool — espace Pilotage (promoteur multi-écoles).

// Synthèse consolidée de toutes les écoles possédées.
export async function getSynthese() {
  const { data, error } = await supabase.rpc("pilotage_synthese");
  if (error) throw error;
  return data ?? [];
}

// Résultat de l'année civile d'une école : tout ce qui est entré (recettes du
// livre de caisse + scolarité encaissée) moins ce qui est sorti.
export const resultatAnnee = (l) =>
  Number(l?.recettes_annee || 0) + Number(l?.scolarite_annee || 0) - Number(l?.depenses_annee || 0);

// Quelles écoles entrent dans les totaux (migration 156).
//
// Une école de démonstration contient des montants fictifs : les cumuler avec
// les vraies ne donne pas un total approximatif, mais un total inexploitable
// — chez le promoteur de Tut'Tank, 9 732 500 des 9 357 500 cumulés venaient
// de la démo.
//
// ⚠️ MAIS CERTAINS COMPTES N'ONT QUE DES DÉMOS : la démarcheuse ne possède
// que TutTank_Demo, le compte de présentation RDC que son école test. Les
// écarter sans filet donnerait une page vide, donc une page cassée. D'où le
// repli : s'il ne reste aucune école réelle, on consolide tout — et l'écran
// le dit, au lieu de faire passer des chiffres de démonstration pour des vrais.
export function lignesConsolidables(lignes = []) {
  const reelles = lignes.filter((l) => !l.demonstration);
  return reelles.length > 0
    ? { lignes: reelles, demoIncluse: false, exclues: lignes.length - reelles.length }
    : { lignes, demoIncluse: lignes.length > 0, exclues: 0 };
}

// Consolide les montants PAR DEVISE. Additionner des dollars et des francs CFA
// en un seul nombre ne donne pas un total approximatif : cela donne un nombre
// qui ne veut rien dire. Tant qu'il n'y a qu'une monnaie, la carte se lit comme
// avant ; sinon chaque monnaie garde sa ligne.
export function consoliderParDevise(lignes = [], deviseParDefaut = "XOF") {
  const par = new Map();
  for (const l of lignes) {
    const d = l.devise || deviseParDefaut;
    const a = par.get(d) || { tresorerie: 0, masse: 0, resultat: 0, masseBrouillon: 0, bulletinsBrouillon: 0 };
    a.tresorerie += Number(l.tresorerie || 0);
    a.masse += Number(l.masse_salariale || 0);
    a.resultat += resultatAnnee(l);
    // Ce qui se prépare, suivi à part : un brouillon n'est pas une charge,
    // mais l'ignorer laisserait le promoteur aveugle (migration 155).
    a.masseBrouillon += Number(l.masse_brouillon || 0);
    a.bulletinsBrouillon += Number(l.bulletins_brouillon || 0);
    par.set(d, a);
  }
  return [...par.entries()];
}

// Bascule l'école active du promoteur (pour gérer une école précise).
export async function entrerEcole(ecoleId) {
  const { error } = await supabase.rpc("entrer_ecole", { p_ecole: ecoleId });
  if (error) throw error;
}
