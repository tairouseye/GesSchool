// GesSchool — référentiel des cycles (aligné sur l'enum type_cycle SQL).
export const CYCLES = [
  { type: "prescolaire", libelle: "Préscolaire", desc: "Petite à grande section" },
  { type: "premier_cycle", libelle: "Élémentaire", desc: "CI / CP → CM2" },
  { type: "second_cycle", libelle: "Collège", desc: "6e → 3e" },
  { type: "lycee", libelle: "Lycée", desc: "Seconde → Terminale" },
  { type: "formation_pro", libelle: "Formation pro", desc: "CFP / lycée technique" },
  { type: "universite", libelle: "Université", desc: "Licence / Master" },
];

// Année scolaire par défaut selon la date courante (rentrée ≈ août).
export function anneeParDefaut(d = new Date()) {
  const annee = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    libelle: `${annee}-${annee + 1}`,
    debut: `${annee}-10-01`,
    fin: `${annee + 1}-07-31`,
  };
}
