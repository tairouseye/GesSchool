// =====================================================================
//  Lot 3 de l'audit du 31/10/2026 — gestes rapides du guichet et de la
//  direction.
//
//  Ce que l'épreuve verrouille :
//   • la publication groupée n'envoie aux familles QUE des classes
//     entièrement validées dont la vérification des notes a abouti sans
//     écart — une vérification impossible exclut, elle n'autorise pas ;
//   • le PV non signé avertit sans exclure (même règle qu'une classe seule) ;
//   • la fenêtre « Encaisser » propose la plus ancienne facture due d'abord,
//     jamais une facture annulée ou soldée, et refuse un trop-perçu ;
//   • la publication groupée passe par `avancer_bulletins` (droits mig. 166),
//     sans nouvelle RPC d'écriture en masse.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const C = () => chargerLib("circuitlot3", ['export * from "@/lib/circuitBulletin.js";']);
const E = () => chargerLib("encaisser", ['export * from "@/lib/encaisser.js";']);

const cl = (libelle) => ({ id: libelle, libelle });
const etat = (o) => ({ brouillon: 0, valide: 0, publie: 0, consultes: 0, conseilComplet: true, signatures: [], ...o });

test("publication groupée : seules les classes prêtes partent", async () => {
  const { planPeriode } = await C();
  const p = planPeriode([
    { classe: cl("CP"), etat: etat({ valide: 20 }), perimes: { nb: 0 } },
    { classe: cl("CE1"), etat: etat({ valide: 18 }), perimes: { nb: 2 } },
    { classe: cl("CE2"), etat: etat({ valide: 22 }), perimes: null },
    { classe: cl("CM1"), etat: etat({ brouillon: 25 }) },
    { classe: cl("CM2"), etat: etat({ brouillon: 3, valide: 20 }) },
    { classe: cl("6e"), etat: etat({ publie: 30 }), perimes: { nb: 0 } },
    { classe: cl("5e"), etat: etat({}) },
    { classe: cl("4e"), etat: null },
  ]);
  assert.deepEqual(p.aPublier.map((c) => c.id), ["CP"]);
  assert.deepEqual(p.aValider.map((c) => c.id), ["CM1"]);
  assert.deepEqual(p.exclues.map((x) => x.classe.id), ["CE1", "CE2", "CM2"]);
  //  Une vérification qui n'a pas eu lieu n'est pas une vérification réussie.
  assert.match(p.exclues.find((x) => x.classe.id === "CE2").raison, /impossible/);
});

test("PV non signé : averti, pas exclu", async () => {
  const { planPeriode } = await C();
  const p = planPeriode([{ classe: cl("CP"), etat: etat({ valide: 20, conseilComplet: false }), perimes: { nb: 0 } }]);
  assert.deepEqual(p.aPublier.map((c) => c.id), ["CP"]);
  assert.deepEqual(p.sansPV.map((c) => c.id), ["CP"]);
});

test("publication groupée : l'écriture reste avancer_bulletins, classe par classe", () => {
  const lib = readFileSync("src/lib/bulletins.js", "utf8");
  const page = readFileSync("src/pages/Bulletins.jsx", "utf8");
  assert.doesNotMatch(lib, /rpc\("(publier|avancer)_[a-z_]*periode/);
  assert.match(page, /api\.avancerBulletins\(c\.id, periodeId, statut\)/);
  //  La vue n'est montée que pour qui fait déjà avancer une classe seule.
  assert.match(page, /vue === "toutes" && toutVoir/);
});

test("encaisser : la plus ancienne échéance d'abord, rien d'annulé ni de soldé", async () => {
  const { facturesAEncaisser } = await E();
  const l = facturesAEncaisser([
    { id: "a", numero: "F3", statut: "emise", montant_total: 10000, montant_paye: 0, date_echeance: "2026-12-05" },
    { id: "b", numero: "F1", statut: "en_retard", montant_total: 10000, montant_paye: 4000, date_echeance: "2026-10-05" },
    { id: "c", numero: "F0", statut: "annulee", montant_total: 10000, montant_paye: 0, date_echeance: "2026-09-05" },
    { id: "d", numero: "F2", statut: "partiellement_payee", montant_total: 10000, montant_paye: 10000, date_echeance: "2026-11-05" },
    { id: "e", numero: "F4", statut: "emise", montant_total: 5000, montant_paye: 0, date_echeance: null, date_emission: "2026-11-01" },
  ]);
  assert.deepEqual(l.map((f) => f.id), ["b", "e", "a"]);
});

test("encaisser : montant vide, nul ou supérieur au reste refusé", async () => {
  const { verifierMontant } = await E();
  const f = { montant_total: 10000, montant_paye: 4000 };
  assert.equal(verifierMontant("6000", f), null);
  assert.equal(verifierMontant("2500", f), null);
  assert.match(verifierMontant("6001", f), /dépasse/);
  assert.match(verifierMontant("", f), /montant/);
  assert.match(verifierMontant("0", f), /montant/);
  assert.match(verifierMontant("100", null), /facture/);
});

test("la fenêtre « Encaisser » n'est offerte qu'aux rôles qui ouvrent Paiements", () => {
  const layout = readFileSync("src/composants/Layout.jsx", "utf8");
  assert.match(layout, /peutEncaisser = peutVoir\(roles, "paiements"\) && moduleActif\(modulesActifs, "paiements"\)/);
  assert.match(layout, /if \(!peutEncaisser\) return undefined;/);
  const rech = readFileSync("src/composants/RechercheGlobale.jsx", "utf8");
  assert.match(rech, /encaisser: voir\.factures \?/);
});

const J = () => chargerLib("majournee", ['export * from "@/lib/maJournee.js";']);

test("ma journée : les cours du jour, dans l'ordre, sans les pauses", async () => {
  const { coursDuJourEnseignant } = await J();
  const lundi10h = new Date(2026, 10, 2, 10, 0); // lundi 2 novembre 2026
  const c = coursDuJourEnseignant([
    { id: 2, jour: 1, heure_debut: "10:30:00", heure_fin: "11:30:00", matiere_id: "m", classe_id: "A", classes: { libelle: "6e A" }, matieres: { libelle: "Maths" } },
    { id: 1, jour: 1, heure_debut: "08:00:00", heure_fin: "09:00:00", matiere_id: "m", classe_id: "B" },
    { id: 3, jour: 1, heure_debut: "09:45:00", heure_fin: "10:15:00", matiere_id: "m", classe_id: "A" },
    { id: 4, jour: 1, heure_debut: "09:30:00", heure_fin: "09:45:00", matiere_id: null },
    { id: 5, jour: 2, heure_debut: "08:00:00", heure_fin: "09:00:00", matiere_id: "m", classe_id: "C" },
  ], lundi10h);
  assert.deepEqual(c.map((x) => [x.id, x.moment]), [[1, "passe"], [3, "en_cours"], [2, "a_venir"]]);
});

test("ma journée : l'appel dit les absences saisies, jamais « appel fait »", async () => {
  const { classesAppel } = await J();
  const r = classesAppel({
    cours: [{ classe_id: "A", classe: "6e A", debut: "08:00" }, { classe_id: "A", classe: "6e A", debut: "10:00" }],
    mesClasses: [{ id: "A", libelle: "6e A" }, { id: "B", libelle: "5e B" }],
    absencesJour: [{ classe_id: "A" }, { classe_id: "A" }, { classe_id: "B" }],
  });
  assert.deepEqual(r, [{ id: "A", libelle: "6e A", debut: "08:00", absences: 2 }]);
  //  Sans emploi du temps : toutes ses classes.
  assert.equal(classesAppel({ mesClasses: [{ id: "A", libelle: "6e A" }, { id: "B", libelle: "5e B" }] }).length, 2);
  assert.doesNotMatch(readFileSync("src/composants/MaJournee.jsx", "utf8"), /appel fait/i);
});

test("ma journée : notes à saisir sur SES classes et matières seulement", async () => {
  const { notesASaisir } = await J();
  const now = new Date(2026, 10, 2, 10, 0);
  const r = notesASaisir({
    affectations: [
      { classe_id: "A", matiere_id: "maths", classes: { libelle: "6e A" }, matieres: { libelle: "Maths" } },
      { classe_id: "A", matiere_id: "svt", classes: { libelle: "6e A" }, matieres: { libelle: "SVT" } },
      { classe_id: "B", matiere_id: null }, // toutes les matières de B (mig. 161)
    ],
    evaluations: [
      { id: "e1", classe_id: "A", matiere_id: "maths", date_eval: "2026-10-20" },
      { id: "e2", classe_id: "A", matiere_id: "maths", date_eval: "2026-10-27" },
      { id: "e3", classe_id: "A", matiere_id: "francais", date_eval: "2026-10-20" }, // pas la sienne
      { id: "e4", classe_id: "B", matiere_id: "anglais", date_eval: "2026-10-21" },
      { id: "e5", classe_id: "A", matiere_id: "maths", date_eval: "2026-11-10" }, // à venir
      { id: "e6", classe_id: "A", matiere_id: "maths", date_eval: "2026-10-01", actif: false }, // archivée
    ],
    notesParEval: { e1: 25 },
    now,
  });
  assert.deepEqual(r.sansNotes.map((e) => e.id), ["e4", "e2"]);
  assert.deepEqual(r.sansEvaluation.map((a) => a.matiere_id), ["svt"]);
});
