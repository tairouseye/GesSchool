// GesSchool — moteur de paie « régime complet » (Sénégal, configurable).
// Génère les lignes STATUTAIRES d'un bulletin à partir du brut soumis :
//   cotisations salariales + IR + TRIMF (retenues) et parts patronales.
// Le net est recalculé en base (trigger) : Σ gains − Σ retenues ; les lignes
// 'patronal' sont informatives (charges employeur) et n'entrent pas dans le net.
import { chercherBareme } from "@/lib/bareme.js";

// Cotisations calculées pour un brut donné (part salariale + patronale).
export function calculerCotisations(brut, cotisations) {
  return (cotisations || [])
    .filter((c) => c.actif !== false)
    .map((c) => {
      const base = c.plafond ? Math.min(brut, Number(c.plafond)) : brut;
      const sal = Number(c.forfait_salarial) > 0 ? Number(c.forfait_salarial) : Math.round(base * Number(c.taux_salarial || 0));
      const patr = Number(c.forfait_patronal) > 0 ? Number(c.forfait_patronal) : Math.round(base * Number(c.taux_patronal || 0));
      return { libelle: c.libelle, base, sal, patr };
    });
}

// Lignes statutaires à insérer (hors « Salaire de base » et gains, déjà posés).
export function lignesStatutaires(brutSoumis, { partIr = 1, partTrimf = 1, cotisations = [], baremeMensuel = [] } = {}) {
  const cot = calculerCotisations(brutSoumis, cotisations);
  const { ir } = chercherBareme(baremeMensuel, brutSoumis, partIr);
  const { trimf } = chercherBareme(baremeMensuel, brutSoumis, partTrimf);
  const lignes = [];
  let ordre = 100;
  for (const c of cot) {
    if (c.sal > 0) lignes.push({ libelle: c.libelle, sens: "retenue", nature: "cotisation", montant: c.sal, ordre: ordre++ });
    if (c.patr > 0) lignes.push({ libelle: `${c.libelle} (patronal)`, sens: "patronal", nature: "patronal", montant: c.patr, ordre: ordre++ });
  }
  if (ir > 0) lignes.push({ libelle: "Impôt sur le revenu (IR)", sens: "retenue", nature: "impot", montant: ir, ordre: ordre++ });
  if (trimf > 0) lignes.push({ libelle: "TRIMF", sens: "retenue", nature: "impot", montant: trimf, ordre: ordre++ });
  return lignes;
}
