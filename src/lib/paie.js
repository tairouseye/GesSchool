// GesSchool — moteur de paie « régime complet » (Sénégal, configurable).
// Modèle unifié : chaque ligne = base × taux (montant = round(base × taux)).
//   • Brut     : base = heures mensuelles, taux = taux horaire (salaire, sursalaire…).
//   • Cotisation: base = min(brut, plafond), taux = % (part salariale / patronale).
//   • IR / TRIMF: lus dans le barème (base = brut, pas de taux).
// Le net est recalculé en base (trigger) : Σ gains − Σ retenues ; les lignes
// 'patronal' sont informatives (charges employeur) et n'entrent pas dans le net.
import { chercherBareme } from "@/lib/bareme.js";

export const arr = (n) => Math.round(Number(n) || 0);

// Lignes de BRUT à partir des heures et des taux horaires de l'employé.
export function lignesBrut(heures, personnel) {
  const h = Number(heures) || 0;
  const lignes = [];
  const tb = Number(personnel?.taux_horaire) || 0;
  const ts = Number(personnel?.taux_sursalaire) || 0;
  lignes.push({ libelle: "Salaire de base", sens: "gain", nature: "base", base: h, taux: tb, montant: arr(h * tb), ordre: 0 });
  if (ts > 0) lignes.push({ libelle: "Sursalaire", sens: "gain", nature: "gain", base: h, taux: ts, montant: arr(h * ts), ordre: 1 });
  return lignes;
}

// Cotisations calculées pour un brut donné (part salariale + patronale).
export function calculerCotisations(brut, cotisations) {
  return (cotisations || [])
    .filter((c) => c.actif !== false)
    .map((c) => {
      const base = c.plafond ? Math.min(brut, Number(c.plafond)) : brut;
      const tSal = Number(c.taux_salarial || 0);
      const tPat = Number(c.taux_patronal || 0);
      const sal = Number(c.forfait_salarial) > 0 ? Number(c.forfait_salarial) : arr(base * tSal);
      const patr = Number(c.forfait_patronal) > 0 ? Number(c.forfait_patronal) : arr(base * tPat);
      return { libelle: c.libelle, base, tSal, tPat, sal, patr, forfaitSal: Number(c.forfait_salarial) > 0, forfaitPat: Number(c.forfait_patronal) > 0 };
    });
}

// Lignes statutaires (cotisations salariales + IR + TRIMF en retenues ; parts
// patronales en 'patronal'), à partir du brut soumis.
export function lignesStatutaires(brutSoumis, { partIr = 1, partTrimf = 1, cotisations = [], baremeMensuel = [] } = {}) {
  const cot = calculerCotisations(brutSoumis, cotisations);
  const { ir } = chercherBareme(baremeMensuel, brutSoumis, partIr);
  const { trimf } = chercherBareme(baremeMensuel, brutSoumis, partTrimf);
  const lignes = [];
  let ordre = 100;
  for (const c of cot) {
    if (c.sal > 0) lignes.push({ libelle: c.libelle, sens: "retenue", nature: "cotisation", base: c.forfaitSal ? null : c.base, taux: c.forfaitSal ? null : c.tSal, montant: c.sal, ordre: ordre++ });
    if (c.patr > 0) lignes.push({ libelle: `${c.libelle} (patronal)`, sens: "patronal", nature: "patronal", base: c.forfaitPat ? null : c.base, taux: c.forfaitPat ? null : c.tPat, montant: c.patr, ordre: ordre++ });
  }
  if (ir > 0) lignes.push({ libelle: "Impôt sur le revenu (IR)", sens: "retenue", nature: "impot", base: brutSoumis, taux: null, montant: ir, ordre: ordre++ });
  if (trimf > 0) lignes.push({ libelle: "TRIMF", sens: "retenue", nature: "impot", base: brutSoumis, taux: null, montant: trimf, ordre: ordre++ });
  return lignes;
}
