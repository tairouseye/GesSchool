// =====================================================================
//  Le circuit du bulletin et les deux signatures du PV — migration 166
//
//  Points 6 et 7 de la visite. Ces épreuves portent sur ce que l'ÉCRAN
//  propose. Les droits réels sont tenus par la migration 166 (policies,
//  déclencheur sur `statut`, RPC) et vérifiés avec de vraies sessions —
//  un test ici ne prouve donc jamais une sécurité, seulement une
//  cohérence d'affichage.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const C = () => chargerLib("circuitb", ['export * from "@/lib/circuitBulletin.js";']);

test("un état d'ensemble n'est affirmé que si la classe est homogène", async () => {
  const { etatGlobal } = await C();
  assert.deepEqual(etatGlobal({ brouillon: 24 }), { etat: "brouillon", total: 24, melange: false });
  assert.deepEqual(etatGlobal({ publie: 24 }), { etat: "publie", total: 24, melange: false });
  // 🔴 Une classe à cheval sur deux états n'est NI l'un NI l'autre. Afficher
  // « publié » parce que la majorité l'est ferait croire à l'école que tous
  // les parents voient le bulletin de leur enfant — c'est faux pour
  // certains, et c'est le genre d'erreur qu'on ne découvre qu'au reproche
  // d'un parent.
  assert.deepEqual(etatGlobal({ brouillon: 2, publie: 22 }), { etat: null, total: 24, melange: true });
  assert.deepEqual(etatGlobal({}), { etat: null, total: 0, melange: false });
  assert.deepEqual(etatGlobal(), { etat: null, total: 0, melange: false });
});

test("aucun bulletin enregistré : on ne propose rien", async () => {
  const { actions } = await C();
  // Proposer « Publier » sur une classe vide ne mènerait qu'au refus de
  // `avancer_bulletins` (« Aucun bulletin à faire avancer »).
  assert.deepEqual(actions({ compte: {}, peutAvancer: true }), []);
  assert.deepEqual(actions(), []);
});

test("🔴 un enseignant ne se voit proposer aucune action", async () => {
  const { actions } = await C();
  // Il établit les bulletins de ses classes, mais ne les arrête ni ne les
  // diffuse. La migration 166 le refuse de toute façon — y compris par un
  // PATCH direct sur l'API, grâce au déclencheur sur `statut`.
  assert.deepEqual(actions({ compte: { brouillon: 24 }, peutAvancer: false }), []);
});

test("le circuit propose l'étape suivante, pas toutes les étapes", async () => {
  const { actions } = await C();
  const cles = (o) => actions(o).map((a) => a.cle);
  assert.deepEqual(cles({ compte: { brouillon: 24 }, peutAvancer: true }), ["valider", "publier"]);
  assert.deepEqual(cles({ compte: { valide: 24 }, peutAvancer: true }), ["publier"]);
  assert.deepEqual(cles({ compte: { publie: 24 }, peutAvancer: true }), ["retirer"]);
});

test("une classe mélangée peut être remise d'aplomb", async () => {
  const { actions } = await C();
  const cles = actions({ compte: { brouillon: 2, publie: 22 }, peutAvancer: true }).map((a) => a.cle);
  assert.ok(cles.includes("valider") && cles.includes("publier"),
    `il faut pouvoir rattraper les 2 restants : ${cles}`);
});

test("🔴 publier sans PV signé AVERTIT, mais n'enferme pas", async () => {
  const { actions } = await C();
  const sans = actions({ compte: { valide: 24 }, peutAvancer: true }).find((a) => a.cle === "publier");
  assert.ok(sans.bloque, "l'absence de signature est signalée");
  assert.match(sans.bloque, /procès-verbal/i);
  // ⚠️ On AVERTIT sans INTERDIRE : un conseil reporté, un rattrapage, et
  // l'école se retrouverait dans une impasse — d'autant que la base
  // n'exige pas le PV pour publier. Mieux vaut un avertissement tenu qu'un
  // blocage qu'on finirait par contourner.
  const avec = actions({ compte: { valide: 24 }, peutAvancer: true, conseilComplet: true }).find((a) => a.cle === "publier");
  assert.equal(avec.bloque, null, "PV signé : plus d'avertissement");
});

test("retirer un bulletin publié prévient des conséquences", async () => {
  const { actions } = await C();
  const r = actions({ compte: { publie: 24 }, peutAvancer: true }).find((a) => a.cle === "retirer");
  assert.ok(r.bloque && /consult/i.test(r.bloque), "le retrait annonce ce qu'il fait aux familles");
});

// --- Les deux signatures du PV ------------------------------------------
test("le PV attend DEUX signatures nommées", async () => {
  const { etatSignatures } = await C();
  const vide = etatSignatures([]);
  assert.equal(vide.complet, false);
  assert.equal(vide.manquantes, 2);
  assert.deepEqual(vide.detail.map((d) => d.qualite), ["pedagogique", "gestion"]);

  const une = etatSignatures([{ qualite: "pedagogique", nom: "Mme Ndiaye" }]);
  assert.equal(une.complet, false);
  assert.equal(une.manquantes, 1);

  const deux = etatSignatures([
    { qualite: "gestion", nom: "Mme Sarr" },
    { qualite: "pedagogique", nom: "Mme Ndiaye" },
  ]);
  assert.equal(deux.complet, true);
  assert.equal(deux.manquantes, 0);
  // L'ordre d'affichage ne dépend pas de l'ordre de signature.
  assert.deepEqual(deux.detail.map((d) => d.qualite), ["pedagogique", "gestion"]);
});

test("🔴 la signature pédagogique suit le CYCLE, jamais le rôle", async () => {
  const { qualitesSignables } = await C();
  // Tut'Tank a DEUX responsables pédagogiques, un par cycle, et tout compte
  // `direction` couvre l'école entière : déduire le droit de signer du rôle
  // aurait laissé le responsable du préscolaire signer le PV d'un CM1.
  assert.deepEqual(
    qualitesSignables({ roles: ["direction"], estResponsableDuCycle: true }), ["pedagogique"]);
  assert.deepEqual(
    qualitesSignables({ roles: ["direction"], estResponsableDuCycle: false }), [],
    "responsable d'un AUTRE cycle : aucune signature");
});

test("🔴 la direction ne peut pas signer au titre de la gestion", async () => {
  const { qualitesSignables } = await C();
  // Le helper serveur `est_gestion()` (mig. 011) vaut vrai pour `direction`.
  // S'en servir aurait permis à un seul responsable pédagogique de fournir
  // les DEUX signatures — et « il faut 2 signatures » n'en aurait exigé
  // qu'une. On nomme donc les rôles de l'espace Gestion.
  assert.ok(!qualitesSignables({ roles: ["direction"], estResponsableDuCycle: true }).includes("gestion"));
  assert.ok(qualitesSignables({ roles: ["admin_ecole"] }).includes("gestion"));
  assert.ok(qualitesSignables({ roles: ["comptable"] }).includes("gestion"));
  assert.ok(qualitesSignables({ roles: ["secretaire"] }).includes("gestion"));
  assert.deepEqual(qualitesSignables({ roles: ["enseignant"] }), []);
  assert.deepEqual(qualitesSignables({ roles: ["rh"] }), []);
  assert.deepEqual(qualitesSignables({ roles: [] }), []);
  assert.deepEqual(qualitesSignables(), []);
});

test("🔴 une même personne ne signe pas deux fois", async () => {
  const { qualitesSignables } = await C();
  // Le promoteur qui serait aussi responsable d'un cycle cumulerait les deux
  // qualités. La base l'interdit par une contrainte d'unicité
  // (conseil_id, profil_id) ; l'écran ne doit donc pas le proposer.
  const cumul = { roles: ["admin_ecole"], estResponsableDuCycle: true };
  assert.deepEqual(qualitesSignables(cumul).sort(), ["gestion", "pedagogique"]);
  assert.deepEqual(qualitesSignables({ ...cumul, dejaSignePar: ["pedagogique"] }), [],
    "ayant signé, il ne lui reste rien à signer");
});

test("les libellés disent au parent ce qu'il voit, ou non", async () => {
  const { LIBELLES, EXPLICATIONS, ETATS, TON } = await C();
  for (const e of ETATS) {
    assert.ok(LIBELLES[e], `libellé manquant pour ${e}`);
    assert.ok(EXPLICATIONS[e], `explication manquante pour ${e}`);
    assert.ok(TON[e], `ton manquant pour ${e}`);
  }
  // La seule question que se pose l'école : le parent le voit-il ?
  assert.match(EXPLICATIONS.brouillon, /ne le voit pas/);
  assert.match(EXPLICATIONS.valide, /pas encore/);
  assert.match(EXPLICATIONS.publie, /espace parent/);
});
