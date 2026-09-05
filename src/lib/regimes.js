// GesSchool — modèles de régime de paie par pays (cotisations pré-remplies).
// Appliqués à une école pour ne pas tout ressaisir. L'IR/IPR/ITS passe par le
// barème chargé par l'école. Chaque cotisation reste éditable ensuite.
//
// ⚠️ Fiabilité : « Sénégal » est validé sur bulletins réels. Les autres pays
// donnent la STRUCTURE (bonnes cotisations, part employé/employeur) avec des
// taux INDICATIFS à vérifier selon la législation en vigueur.

export const REGIMES_PAYS = {
  "Sénégal": {
    fiable: true,
    note: "IR + TRIMF via le barème à charger. Taux validés au franc sur bulletins réels.",
    cotisations: [
      { libelle: "IPRES - Régime général", taux_salarial: 0.056, taux_patronal: 0.084, plafond: 432000 },
      { libelle: "CSS - Accident du travail", taux_patronal: 0.05, plafond: 63000 },
      { libelle: "CSS - Allocations familiales", taux_patronal: 0.07, plafond: 63000 },
      { libelle: "IPM", forfait_salarial: 5000, forfait_patronal: 5000 },
      { libelle: "CFCE (charge employeur)", taux_patronal: 0.03 },
    ],
  },
  "RDC (Congo)": {
    fiable: false,
    note: "IPR via le barème à charger. ⚠️ Taux indicatifs — à vérifier (CNSS, INPP, ONEM).",
    cotisations: [
      { libelle: "CNSS - Pension", taux_salarial: 0.05, taux_patronal: 0.05 },
      { libelle: "CNSS - Risques professionnels", taux_patronal: 0.015 },
      { libelle: "CNSS - Allocations familiales", taux_patronal: 0.065 },
      { libelle: "INPP (formation)", taux_patronal: 0.03 },
      { libelle: "ONEM", taux_patronal: 0.002 },
    ],
  },
  "Mali": {
    fiable: false,
    note: "ITS via le barème à charger. ⚠️ Taux indicatifs — à vérifier (INPS, AMO).",
    cotisations: [
      { libelle: "INPS - Retraite", taux_salarial: 0.036, taux_patronal: 0.054 },
      { libelle: "INPS - Prestations familiales", taux_patronal: 0.08 },
      { libelle: "INPS - Accidents du travail", taux_patronal: 0.01 },
      { libelle: "AMO - Assurance maladie", taux_salarial: 0.0306, taux_patronal: 0.035 },
    ],
  },
  "Côte d'Ivoire": {
    fiable: false,
    note: "ITS via le barème à charger. ⚠️ Taux indicatifs — à vérifier (CNPS).",
    cotisations: [
      { libelle: "CNPS - Retraite", taux_salarial: 0.063, taux_patronal: 0.077, plafond: 3375000 },
      { libelle: "CNPS - Prestations familiales", taux_patronal: 0.0575, plafond: 70000 },
      { libelle: "CNPS - Accidents du travail", taux_patronal: 0.02, plafond: 70000 },
    ],
  },
  "Vide (repartir de zéro)": { fiable: true, note: "Aucune cotisation — à créer manuellement.", cotisations: [] },
};
