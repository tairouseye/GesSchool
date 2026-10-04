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

// =====================================================================
//  Le bulletin diffusé correspond-il encore aux notes ?
//
//  🔴 `bulletins` stocke un INSTANTANÉ (moyenne, rang, mention). L'espace
//  parent sert les NOTES vivantes et le BULLETIN figé : une note corrigée
//  après diffusion fait apparaître la correction dans « Notes » et laisse
//  l'ancienne moyenne dans « Bulletins ». Mesuré en base au moment d'écrire
//  ces lignes : 32 bulletins publiés, dont 6 déjà consultés par une famille.
// =====================================================================

const eleve = (id, prenom, nom) => ({ id, prenom, nom });

test("un bulletin publié dont la note a changé est signalé", async () => {
  const { bulletinsPerimes } = await C();
  const r = bulletinsPerimes({
    calculs: [{ eleve: eleve("e1", "Awa", "DIOP"), moyenne: 14.5, rang: 1 }],
    enregistres: [{ eleve_id: "e1", moyenne_generale: 12.25, rang: 1, statut: "publie", consulte_le: "2026-10-01" }],
  });
  assert.equal(r.nb, 1);
  assert.equal(r.publies, 1);
  //  Le nombre de familles qui ont DÉJÀ lu le mauvais chiffre : c'est lui qui
  //  doit décider d'agir tout de suite plutôt qu'au prochain conseil.
  assert.equal(r.consultes, 1);
  assert.deepEqual(r.detail[0].ecarts, [{ champ: "moyenne", stocke: 12.25, calcule: 14.5 }]);
  assert.equal(r.detail[0].nom, "Awa DIOP");
});

test("🔴 un BROUILLON périmé n'est pas signalé : rien n'a été diffusé", async () => {
  const { bulletinsPerimes } = await C();
  const r = bulletinsPerimes({
    calculs: [{ eleve: eleve("e1", "Awa", "DIOP"), moyenne: 14.5, rang: 1 }],
    enregistres: [{ eleve_id: "e1", moyenne_generale: 2, rang: 9, statut: "brouillon" }],
  });
  //  Le recalculer est le geste normal avant de valider : avertir ici
  //  reviendrait à crier à chaque saisie de note.
  assert.equal(r.nb, 0);
});

test("un bulletin conforme ne déclenche rien, malgré les arrondis", async () => {
  const { bulletinsPerimes } = await C();
  const r = bulletinsPerimes({
    calculs: [
      { eleve: eleve("e1", "Awa", "DIOP"), moyenne: 12.34, rang: 1 },
      { eleve: eleve("e2", "Moussa", "FALL"), moyenne: null, rang: null },
    ],
    enregistres: [
      //  `numeric(5,2)` revient parfois en chaîne : la comparaison doit tenir.
      { eleve_id: "e1", moyenne_generale: "12.34", rang: 1, statut: "publie" },
      { eleve_id: "e2", moyenne_generale: null, rang: null, statut: "publie" },
    ],
  });
  assert.equal(r.nb, 0, JSON.stringify(r.detail));
});

test("🔴 le RANG seul suffit : un camarade corrigé fausse le bulletin des autres", async () => {
  const { bulletinsPerimes } = await C();
  //  La moyenne d'Awa n'a pas bougé, mais Moussa l'a dépassée : son bulletin
  //  imprimé annonce « 1er » alors qu'elle est 2e. C'est faux de la même
  //  manière qu'une moyenne fausse.
  const r = bulletinsPerimes({
    calculs: [{ eleve: eleve("e1", "Awa", "DIOP"), moyenne: 14.5, rang: 2 }],
    enregistres: [{ eleve_id: "e1", moyenne_generale: 14.5, rang: 1, statut: "publie" }],
  });
  assert.equal(r.nb, 1);
  assert.deepEqual(r.detail[0].ecarts, [{ champ: "rang", stocke: 1, calcule: 2 }]);
});

test("une note AJOUTÉE après diffusion compte comme un écart", async () => {
  const { bulletinsPerimes } = await C();
  //  Bulletin publié sans moyenne (aucune évaluation à l'époque), puis les
  //  notes arrivent : la famille voit un bulletin vide et des notes remplies.
  const r = bulletinsPerimes({
    calculs: [{ eleve: eleve("e1", "Awa", "DIOP"), moyenne: 11, rang: 1 }],
    enregistres: [{ eleve_id: "e1", moyenne_generale: null, rang: null, statut: "publie" }],
  });
  assert.equal(r.nb, 1);
  assert.equal(r.detail[0].ecarts.length, 2); // moyenne ET rang
});

test("un élève sans bulletin est « jamais écrit », pas « périmé »", async () => {
  const { bulletinsPerimes } = await C();
  //  Un élève arrivé en cours de trimestre : ne pas le compter comme une
  //  incohérence, sinon l'avertissement perd son sens.
  const r = bulletinsPerimes({
    calculs: [
      { eleve: eleve("e1", "Awa", "DIOP"), moyenne: 14, rang: 1 },
      { eleve: eleve("e2", "Nouveau", "VENU"), moyenne: 13, rang: 2 },
    ],
    enregistres: [{ eleve_id: "e1", moyenne_generale: 14, rang: 1, statut: "publie" }],
  });
  assert.equal(r.nb, 0);
  assert.equal(r.manquants, 1);
});

test("entrées vides : aucune alerte, aucune exception", async () => {
  const { bulletinsPerimes } = await C();
  for (const arg of [undefined, {}, { calculs: [], enregistres: [] }, { calculs: [{}] }]) {
    const r = bulletinsPerimes(arg);
    assert.equal(r.nb, 0);
  }
});
