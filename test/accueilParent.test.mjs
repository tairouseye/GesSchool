import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Le module importe apercuEnfant.js, qui passe par l'alias « @/ » : on le lie.
const { pastillePaiement, derniereAnnonce, ageEnfant, couleurEnfant } = await chargerLib("accueilParent", ['export * from "@/lib/accueilParent.js";']);

const ligne = (etat, montant = 65000, paye = 0) => ({ etat, montant, paye });

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
