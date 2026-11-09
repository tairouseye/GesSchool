// =====================================================================
//  Un seul calcul des impayés — migration 232
//
//  Test côté école du 09/11/2026 : l'accueil disait 19 élèves en retard,
//  la Situation des paiements 50 sur 50. L'accueil et le Recouvrement lisent
//  désormais `impayes_annee`, comme la Situation : ces fonctions mettent ses
//  lignes en forme. Et « + Nouvelle facture » écrit le mois dans le libellé,
//  sinon l'échéancier ne reconnaît pas le mois payé.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const { listeImpayes, syntheseImpayes, moisFacturables, libelleMensuel } = await chargerLib("impayes", [
  'export { listeImpayes } from "@/lib/recouvrement.js";',
  'export { syntheseImpayes } from "@/lib/dashboard.js";',
  'export { moisFacturables, libelleMensuel } from "@/lib/paiements.js";',
]);

const ligne = (autres = {}) => ({
  eleve_id: "e1", prenom: "Aminata", nom: "Diagne", matricule: "KCA-1", classe: "CM1",
  du: 0, hors: 0, reste: 0, depuis: null, prochaine: null, prochaine_montant: 0, paye: 0, ...autres,
});
const DATES = { jour: "2026-11-09", dans7: "2026-11-16", dans45: "2026-12-24" };

test("le retard additionne l'échéancier et les factures hors échéancier", () => {
  const [i] = listeImpayes([ligne({ du: 65000, hors: 15000, reste: 600000, depuis: "2026-11-05" })], new Date("2026-11-09T12:00:00"));
  assert.equal(i.retard, 80000);
  assert.equal(i.reste, 600000);
  assert.equal(i.enRetard, true);
  assert.equal(i.echeance, "2026-11-05");
  assert.equal(i.joursRetard, 4);
});

test("un élève à jour mais avec des mois à venir n'est pas « en retard »", () => {
  const [i] = listeImpayes([ligne({ reste: 520000, prochaine: "2026-12-05" })]);
  assert.equal(i.enRetard, false);
  assert.equal(i.retard, 0);
  assert.equal(i.echeance, "2026-12-05");
});

test("un élève qui ne doit plus rien n'apparaît pas", () => {
  assert.deepEqual(listeImpayes([ligne({ paye: 360000 })]), []);
});

test("les retards passent avant, le plus gros d'abord", () => {
  const l = listeImpayes([
    ligne({ eleve_id: "a", reste: 900000 }),
    ligne({ eleve_id: "b", du: 65000, reste: 65000, depuis: "2026-11-05" }),
    ligne({ eleve_id: "c", du: 130000, reste: 130000, depuis: "2026-10-05" }),
  ]);
  assert.deepEqual(l.map((x) => x.eleve_id), ["c", "b", "a"]);
});

test("accueil : le même nombre d'élèves en retard que la Situation", () => {
  const s = syntheseImpayes([
    ligne({ eleve_id: "a", classe: "CM1", du: 65000, paye: 295000, reste: 455000 }),
    ligne({ eleve_id: "b", classe: "CM1", paye: 360000 }),
    ligne({ eleve_id: "c", classe: "CE1", hors: 10000, paye: 100000, reste: 10000 }),
  ], DATES);
  assert.equal(s.nbEnRetard, 2);
  assert.equal(s.retardMontant, 75000);
  assert.equal(s.totalPaye, 755000);
  assert.equal(s.totalFacture, 830000);
  assert.equal(Math.round(s.tauxRecouvrement), 91);
  assert.equal(s.resteAnnee, 465000);
  assert.deepEqual(s.topDebiteurs.map((d) => d.nom), ["Aminata Diagne", "Aminata Diagne"]);
  assert.deepEqual(s.classes.map((c) => c.libelle), ["CE1", "CM1"]);
});

test("accueil : les prochaines échéances, par date", () => {
  const s = syntheseImpayes([
    ligne({ eleve_id: "a", prochaine: "2026-12-05", prochaine_montant: 65000 }),
    ligne({ eleve_id: "b", prochaine: "2026-12-05", prochaine_montant: 55000 }),
    ligne({ eleve_id: "c", prochaine: "2026-11-12", prochaine_montant: 15000 }),
    ligne({ eleve_id: "d", prochaine: "2027-02-05", prochaine_montant: 65000 }),
  ], DATES);
  assert.deepEqual(s.echeances, [
    { date: "2026-11-12", familles: 1, montant: 15000 },
    { date: "2026-12-05", familles: 2, montant: 120000 },
  ]);
  assert.equal(s.echeanceNb, 1);
  assert.equal(s.echeanceMontant, 15000);
});

test("une école sans impayé affiche 100 %", () => {
  assert.equal(syntheseImpayes([], DATES).tauxRecouvrement, 100);
});

test("Nouvelle facture : les mois de l'année, jusqu'au dernier mois facturé", () => {
  assert.deepEqual(moisFacturables({ date_debut: "2026-10-01", date_fin: "2027-07-31", fin_facturation: "2027-06-30" }),
    ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"]);
  assert.equal(moisFacturables({ date_debut: "2026-10-01", date_fin: "2027-07-31" }).at(-1), "2027-07");
  assert.deepEqual(moisFacturables(null), []);
});

test("Nouvelle facture : le libellé du mois est celui de l'échéancier", () => {
  //  `fr.libelle || ' — ' || _libelle_mois('2026-10')` en SQL (mig. 210).
  assert.equal(libelleMensuel("Frais de scolarité", "2026-10"), "Frais de scolarité — Octobre 2026");
});
