import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Le module importe apercuEnfant.js, qui passe par l'alias « @/ » : on le lie.
const { pastillePaiement, aPayerAccueil, libelleDus, prochainCours, derniereAnnonce, ageEnfant, couleurEnfant } = await chargerLib("accueilParent", ['export * from "@/lib/accueilParent.js";']);

const ligne = (etat, montant = 65000, paye = 0) => ({ etat, montant, paye, mois: "2026-10" });

test("la carte compte les mois à payer, comme un parent", () => {
  const ech = { statut: "en_retard", lignes: [ligne("paye", 65000, 65000), ligne("en_retard"), ligne("en_retard"), ligne("a_venir")] };
  assert.deepEqual(pastillePaiement(ech), { ton: "rouge", texte: "2 mois à payer" });
  assert.equal(pastillePaiement({ statut: "en_retard", lignes: [ligne("partiel", 65000, 30000)] }).texte, "1 mois à payer");
});

test("à jour, en avance, exonéré", () => {
  assert.deepEqual(pastillePaiement({ statut: "a_jour", lignes: [ligne("paye", 1, 1)] }), { ton: "vert", texte: "À jour" });
  assert.equal(pastillePaiement({ statut: "en_avance", lignes: [] }).ton, "bleu");
  assert.equal(pastillePaiement({ statut: "exonere", lignes: [] }).texte, "Exonéré");
});

test("sans échéancier : les factures ; sans rien : aucune pastille plutôt qu'un faux « À jour »", () => {
  assert.equal(pastillePaiement(null, undefined), null);
  assert.equal(pastillePaiement(null, []), null);
  assert.equal(pastillePaiement({ statut: "non_facture", lignes: [] }, []), null);
  const f = [{ montant_total: 1000, montant_paye: 1000, statut: "payee", date_echeance: "2026-10-05" }];
  assert.equal(pastillePaiement(null, f).texte, "À jour");
});

test("la dernière annonce, une seule fois même si elle vise deux enfants", () => {
  const a1 = { id: "a", titre: "Réunion", publie_le: "2026-11-03T10:00:00Z" };
  const a2 = { id: "b", titre: "Rappel", publie_le: "2026-10-20T10:00:00Z" };
  assert.equal(derniereAnnonce([{ annonces: [a2, a1] }, { annonces: [a1] }]).id, "a");
  assert.equal(derniereAnnonce([]), null);
  assert.equal(derniereAnnonce([{ annonces: undefined }]), null);
});

test("l'âge : années révolues, sans se tromper la veille de l'anniversaire", () => {
  const le = (j, m) => new Date(2026, m - 1, j);
  assert.equal(ageEnfant("2018-05-14", le(13, 5)), 7);
  assert.equal(ageEnfant("2018-05-14", le(14, 5)), 8);
  assert.equal(ageEnfant("2018-05-14", le(5, 11)), 8);
  assert.equal(ageEnfant(null), null);
  assert.equal(ageEnfant("bientôt"), null);
});

test("un enfant garde sa couleur, de la carte à la fiche", () => {
  assert.deepEqual(couleurEnfant("abc"), couleurEnfant("abc"));
  assert.ok(couleurEnfant("abc").fonce.startsWith("bg-"));
});

test("🔴 l'accueil annonce le montant de la rubrique Paiements, mois entamé compris", () => {
  const echeancier = { statut: "en_retard", lignes: [ligne("paye", 65000, 65000), ligne("en_retard"), ligne("partiel", 65000, 30000), ligne("a_venir")] };
  assert.deepEqual(aPayerAccueil({ echeancier, factures: [] }), { montant: 100000, texte: "2 mois à payer", declaree: false });
});

test("rien à faire : pas de priorité, même avec une facture ouverte à côté de l'échéancier", () => {
  const facture = { montant_total: 65000, montant_paye: 0, statut: "emise", date_echeance: "2020-01-05" };
  assert.equal(aPayerAccueil({ echeancier: { statut: "a_jour", lignes: [ligne("paye", 1, 1)] }, factures: [facture] }), null);
  assert.equal(aPayerAccueil({ echeancier: { statut: "exonere", lignes: [] }, factures: [facture] }), null);
});

test("🔴 échéancier illisible : aucun montant plutôt qu'un montant faux", () => {
  const facture = { montant_total: 65000, montant_paye: 0, statut: "emise", date_echeance: "2020-01-05" };
  assert.equal(aPayerAccueil({ factures: [facture] }), null);
  assert.equal(aPayerAccueil(undefined), null);
});

test("sans échéancier, seule une facture en retard est une priorité", () => {
  const due = (date_echeance) => ({ montant_total: 65000, montant_paye: 15000, statut: "emise", date_echeance });
  assert.deepEqual(aPayerAccueil({ echeancier: null, factures: [due("2020-01-05")] }), { montant: 50000, texte: "Paiement en retard", declaree: false });
  assert.equal(aPayerAccueil({ echeancier: null, factures: [due("2999-01-05")] }), null);
  assert.equal(aPayerAccueil({ echeancier: null }), null);
});

test("🔴 un paiement déclaré est signalé : le parent ne paie pas deux fois", () => {
  const echeancier = { statut: "en_retard", lignes: [ligne("en_retard")] };
  assert.equal(aPayerAccueil({ echeancier, declarations: [{ statut: "en_attente" }] }).declaree, true);
  assert.equal(aPayerAccueil({ echeancier, declarations: [{ statut: "rejete" }] }).declaree, false);
});

// Mardi 3 novembre 2026, 9 h 30.
const MARDI = new Date(2026, 10, 3, 9, 30);
const creneau = (debut, fin, matiere, autres = {}) => ({ jour: 2, heure_debut: `${debut}:00`, heure_fin: `${fin}:00`, matiere, ...autres });

test("le prochain cours : en cours, sinon à venir, et jamais une récréation", () => {
  assert.equal(prochainCours([creneau("09:00", "10:00", "Lecture")], MARDI), "En cours : Lecture");
  assert.equal(prochainCours([creneau("09:15", "10:00", null, { activite: "Récréation" }), creneau("10:00", "11:00", "Sciences")], MARDI), "Prochain cours : Sciences à 10 h");
  assert.equal(prochainCours([creneau("10:30", "11:00", "Éveil", { activite: "Conjugaison" })], MARDI), "Prochain cours : Conjugaison à 10 h 30");
});

test("le prochain cours nomme le groupe, et se tait quand la journée est finie", () => {
  assert.equal(prochainCours([creneau("10:00", "11:00", "Anglais", { salle: "g2" })], MARDI), "Prochain cours : G2 · Anglais à 10 h");
  assert.equal(prochainCours([creneau("08:00", "09:00", "Lecture")], MARDI), null);
  assert.equal(prochainCours(undefined, MARDI), null);
});

test("🔴 l'inscription n'est pas un mois", () => {
  const inscription = { etat: "en_retard", montant: 100000, paye: 0, mois: null, libelle: "Frais d'inscription" };
  const echeancier = { statut: "en_retard", lignes: [inscription, ligne("en_retard"), ligne("en_retard")] };
  assert.equal(pastillePaiement(echeancier).texte, "Frais d'inscription et 2 mois à payer");
  assert.deepEqual(aPayerAccueil({ echeancier }), { montant: 230000, texte: "Frais d'inscription et 2 mois à payer", declaree: false });
  assert.equal(libelleDus([inscription]), "Frais d'inscription à payer");
  assert.equal(libelleDus([inscription, inscription, ligne("partiel")]), "2 frais et 1 mois à payer");
});
