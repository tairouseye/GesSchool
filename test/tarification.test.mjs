// Tests du moteur de tarification (fonctions pures — pas de Supabase).
// Couvre : coûts fixes, calcul par palier, dilution à l'échelle, grille d'offres.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerTarif } from "./bundle.helper.mjs";

const T = await chargerTarif();
const H = T.HYPOTHESES_DEFAUT;

test("coutsFixesTotal = infra + salaire fondateur", () => {
  assert.equal(T.coutsFixesTotal(H), T.totalFixes(H) + H.salaireFondateur);
  assert.ok(T.totalFixes(H) > 0);
});

test("calculerPalier : prix = coût de revient / (1 − marge), marge ≥ 0", () => {
  const p = T.calculerPalier(H, H.paliers[1]);
  assert.ok(p.coutRevient > 0);
  assert.ok(Math.abs(p.prixMensuel - p.coutRevient / (1 - H.margeVisee)) < 1e-6);
  assert.ok(p.margeMensuelle >= 0);
  assert.ok(Math.abs(p.prixAnnuel - p.prixMensuel * 12) < 1e-6);
});

test("marge 0 → prix = coût de revient", () => {
  const p = T.calculerPalier({ ...H, margeVisee: 0 }, H.paliers[0]);
  assert.ok(Math.abs(p.prixMensuel - p.coutRevient) < 1e-6);
});

test("simulerEchelle : le plancher/école DÉCROÎT quand N augmente (dilution)", () => {
  const sim = T.simulerEchelle(H, "p400", [5, 10, 20, 50, 100]);
  assert.equal(sim.length, 5);
  for (let i = 1; i < sim.length; i++) {
    assert.ok(sim[i].plancherAnnuel < sim[i - 1].plancherAnnuel, `plancher doit baisser de N=${sim[i - 1].N} à N=${sim[i].N}`);
  }
  // Le coût variable est un plancher : le coût/école reste strictement positif.
  assert.ok(sim[sim.length - 1].coutParEcoleMois > 0);
});

test("calculerGrilleOffres : formules × paliers, prix positifs, montée en gamme plus chère", () => {
  const offres = T.calculerGrilleOffres(H);
  assert.equal(offres.length, 3 * H.paliers.length); // essentiel/confort/tout × paliers
  for (const o of offres) {
    assert.ok(o.prixMensuel > 0 && o.prixAnnuel > 0);
    assert.ok(Math.abs(o.margeAnnuelle - (o.prixAnnuel - o.coutRevientAnnuel)) < 1e-6);
  }
  // Pour un même palier, Confort > Essentiel (multiplicateur de valeur).
  const ess = offres.find((o) => o.formule === "essentiel" && o.palier === "p400");
  const conf = offres.find((o) => o.formule === "confort" && o.palier === "p400");
  assert.ok(conf.prixMensuel > ess.prixMensuel);
});
