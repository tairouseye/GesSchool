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
