// Règles de circulation de la bibliothèque (logique pure, sans BD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const B = await chargerLib("biblio", ['export * from "@/lib/biblio.regles.js";']);

const REGLE = { actif: true, max_emprunts: 3, duree_jours: 14, renouvellements_max: 1, penalite_jour: 100, penalites_actives: false };

test("calculerEcheance : emprunt + durée, sans dérive de fuseau", () => {
  assert.equal(B.calculerEcheance("2026-09-19", 14), "2026-10-03");
  assert.equal(B.calculerEcheance("2026-02-20", 14), "2026-03-06"); // franchit un mois
  assert.equal(B.calculerEcheance("2026-12-25", 10), "2027-01-04"); // franchit l'année
});

test("joursEntre / joursRetard : retard nul si dans les temps", () => {
  assert.equal(B.joursEntre("2026-09-01", "2026-09-11"), 10);
  assert.equal(B.joursRetard("2026-09-10", "2026-09-15"), 5);
  assert.equal(B.joursRetard("2026-09-10", "2026-09-10"), 0);
  assert.equal(B.joursRetard("2026-09-10", "2026-09-01"), 0); // rendu en avance
});

test("verifierEmprunt : refuse sans règle, sur quota atteint et sur retard", () => {
  assert.equal(B.verifierEmprunt({ regle: null }).ok, false);
  assert.equal(B.verifierEmprunt({ empruntsEnCours: 0, regle: { ...REGLE, actif: false } }).ok, false);

  const quota = B.verifierEmprunt({ empruntsEnCours: 3, regle: REGLE });
  assert.equal(quota.ok, false);
  assert.match(quota.motif, /Quota atteint/);

  const retard = B.verifierEmprunt({ empruntsEnCours: 1, retardsEnCours: 2, regle: REGLE });
  assert.equal(retard.ok, false);
  assert.match(retard.motif, /retard/i);

  assert.equal(B.verifierEmprunt({ empruntsEnCours: 2, retardsEnCours: 0, regle: REGLE }).ok, true);
});

test("verifierRenouvellement : max atteint, retard, puis cas nominal", () => {
  const base = { statut: "en_cours", date_echeance: "2026-09-30", renouvellements: 0 };

  assert.equal(B.verifierRenouvellement({ emprunt: { ...base, statut: "rendu" }, regle: REGLE, aujourdhui: "2026-09-20" }).ok, false);
  assert.equal(B.verifierRenouvellement({ emprunt: { ...base, renouvellements: 1 }, regle: REGLE, aujourdhui: "2026-09-20" }).ok, false);
  assert.equal(B.verifierRenouvellement({ emprunt: base, regle: REGLE, aujourdhui: "2026-10-05" }).ok, false); // en retard

  const ok = B.verifierRenouvellement({ emprunt: base, regle: REGLE, aujourdhui: "2026-09-20" });
  assert.equal(ok.ok, true);
  assert.equal(ok.nouvelleEcheance, "2026-10-04"); // 20/09 + 14 j
});

test("calculerPenalite : nulle si désactivée, sinon jours × tarif", () => {
  assert.equal(B.calculerPenalite({ dateEcheance: "2026-09-10", dateRetour: "2026-09-20", regle: REGLE }), 0);
  const actif = { ...REGLE, penalites_actives: true };
  assert.equal(B.calculerPenalite({ dateEcheance: "2026-09-10", dateRetour: "2026-09-20", regle: actif }), 1000);
  assert.equal(B.calculerPenalite({ dateEcheance: "2026-09-10", dateRetour: "2026-09-10", regle: actif }), 0);
});

test("rangSuivant : file d'attente incrémentale", () => {
  assert.equal(B.rangSuivant([]), 1);
  assert.equal(B.rangSuivant([{ statut: "active", rang: 1 }, { statut: "active", rang: 2 }]), 3);
  // les réservations closes ne comptent pas
  assert.equal(B.rangSuivant([{ statut: "annulee", rang: 7 }, { statut: "active", rang: 1 }]), 2);
});

test("bornesPagination : bornée en dur, jamais de requête illimitée", () => {
  assert.deepEqual(B.bornesPagination(0, 20), { debut: 0, fin: 19, taille: 20, page: 0 });
  assert.deepEqual(B.bornesPagination(2, 20), { debut: 40, fin: 59, taille: 20, page: 2 });
  assert.equal(B.bornesPagination(-5, 20).page, 0);       // page négative ramenée à 0
  assert.equal(B.bornesPagination(0, 10000).taille, 200); // plafond dur
  assert.equal(B.bornesPagination(0, 0).taille, 20);      // valeur invalide → défaut
});

test("nbPages : au moins une page", () => {
  assert.equal(B.nbPages(0, 20), 1);
  assert.equal(B.nbPages(20, 20), 1);
  assert.equal(B.nbPages(21, 20), 2);
  assert.equal(B.nbPages(100000, 20), 5000);
});
