// =====================================================================
//  Lecture de la planification mensuelle officielle (IEF) — migration 165
//
//  Point 15 de la visite : l'enseignante doit RÉUTILISER la programmation
//  au lieu de la ressaisir. L'école a fourni le document source ; l'école a
//  confirmé qu'il s'agit du modèle officiel, de forme stable.
//
//  🔴 CES TESTS TOURNENT SUR LE VRAI DOCUMENT, pas sur un cas inventé :
//  `fixtures-ief.json` contient les 81 lignes réellement extraites du .docx
//  de l'IEF de Sangalkam. Un analyseur validé sur un exemple idéalisé ne
//  prouverait rien — le document enchaîne quatre domaines dans un seul
//  tableau, écrit son marqueur de sous-domaine de quatre façons, fusionne
//  des cellules et laisse des paliers sans énoncé. Chaque épreuve marquée
//  🔴 correspond à un défaut RÉEL que cette lecture a révélé.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const P = () => chargerLib("progief", ['export * from "@/lib/programmationIEF.js";']);
const REEL = JSON.parse(fs.readFileSync(new URL("./fixtures-ief.json", import.meta.url), "utf8"));
const lignesDu = (r, domaine) => r.lignes.filter((l) => l.domaine === domaine);

// --- L'en-tête -----------------------------------------------------------
test("🔴 l'en-tête fait foi, jamais le nom du fichier", async () => {
  const { lireEntete } = await P();
  // Le fichier fourni s'appelait « CE1 juin » et contenait du CM1 d'avril.
  // S'y fier aurait rangé le programme dans la mauvaise classe ET le mauvais
  // mois — une erreur recopiée toute l'année.
  const e = lireEntete(REEL.entete);
  assert.equal(e.cours, "CM1", "le document dit COURS CM1");
  assert.equal(e.mois, 4, "le document dit MOIS DE AVRIL");
});

test("🔴 le cours est collé au mot suivant, sans séparateur", async () => {
  const { lireEntete } = await P();
  // Forme réelle : « COURS………………………… CM1PLANIFICATION DU MOIS ».
  // Aucune limite de mot entre « CM1 » et « PLANIFICATION » : une expression
  // qui en exige une ne trouve rien.
  assert.equal(lireEntete("COURS………………… CM1PLANIFICATION DU MOIS DE AVRIL").cours, "CM1");
  assert.equal(lireEntete("COURS...CE2PLANIFICATION").cours, "CE2");
  assert.equal(lireEntete("COURS : GS").cours, "GS");
});

test("🔴 un cours inconnu reste null — on n'attrape pas trois lettres au hasard", async () => {
  const { lireEntete } = await P();
  // Le piège : « COURS…………… PLANIFICATION » sans cours renseigné. Une
  // expression générique y lirait « PLA » et rangerait la planification
  // sous un niveau inexistant.
  assert.equal(lireEntete("COURS………………………… PLANIFICATION DU MOIS DE AVRIL").cours, null);
  assert.equal(lireEntete("COURS……………… TERMINALE S2").cours, null);
});

test("ce qu'on ne sait pas lire reste null — on ne devine pas", async () => {
  const { lireEntete } = await P();
  assert.deepEqual(lireEntete("IEF DE SANGALKAM. ECOLE ELEMENTAIRE"), { mois: null, cours: null });
  assert.deepEqual(lireEntete(""), { mois: null, cours: null });
  assert.deepEqual(lireEntete(null), { mois: null, cours: null });
});

// --- Les domaines --------------------------------------------------------
test("🔴 un seul tableau porte QUATRE domaines, dans l'ordre du document", async () => {
  const { analyserTableau } = await P();
  // La première version supposait un domaine par tableau : les 52 lignes
  // de mathématiques, d'ESVS et d'EPSA étaient rangées sous « Langue et
  // communication ». L'enseignante de CM1 aurait vu son programme de
  // français contenir « Dramatiser une scène burlesque ».
  const r = analyserTableau(REEL.rows);
  assert.deepEqual(r.domaines, ["Langue et communication", "MATHEMATIQUES", "ESVS", "EPSA"]);
});

test("🔴 chaque domaine rend ce que le document y a écrit — aucun muet", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  // 🔴 Garde-fou contre une PERTE SILENCIEUSE. La règle « une seule cellule
  // remplie = un titre » avalait les contenus isolés posés dans une colonne
  // de semaine : mathématiques et ESVS ne rendaient rien du tout, sans la
  // moindre erreur. Un domaine muet doit donc faire échouer cette épreuve.
  for (const d of r.domaines) {
    assert.ok(lignesDu(r, d).length > 0, `le domaine « ${d} » ne rend aucune ligne`);
  }
  assert.ok(lignesDu(r, "MATHEMATIQUES").some((l) => /divisibilité par 5/.test(l.contenu)),
    "le contenu de mathématiques est retrouvé");
});

test("🔴 le changement de domaine se lit dans ses DEUX écritures", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  // « DOMAINE | MATHEMATIQUES » d'un côté…
  assert.ok(r.domaines.includes("MATHEMATIQUES"));
  // …et le code posé à gauche du marqueur de l'autre : « ESVS | SOUS-DOMMAINE
  // 1 : … », « EPSA | SOUS DOMAINE 2 Education artistique ». Sans cette
  // seconde lecture, ESVS et EPSA restaient attachés au français.
  assert.ok(r.domaines.includes("ESVS"));
  assert.ok(r.domaines.includes("EPSA"));
  assert.ok(lignesDu(r, "EPSA").every((l) => l.sous_domaine === "Education artistique"),
    "le sous-domaine d'EPSA est lu malgré l'absence de deux-points");
});

test("🔴 le marqueur de sous-domaine est reconnu dans ses quatre graphies", async () => {
  const { analyserTableau } = await P();
  const sd = (rows) => analyserTableau(rows).lignes.map((l) => l.sous_domaine);
  const avecSemaines = ["D", "Semaine 1", "Semaine 2"];
  // Les quatre graphies relevées DANS LE MÊME DOCUMENT.
  for (const [marqueur, attendu] of [
    ["Sous-domaine 1COMMUNICATION ORALE", "COMMUNICATION ORALE"],
    ["SOUS-DOMMAINE 1 : DECOUVERTE DU MONDE", "DECOUVERTE DU MONDE"],
    ["SOUS-DOMAINE2 : EDUCATION AU DEVELOPPEMENT DURABLE", "EDUCATION AU DEVELOPPEMENT DURABLE"],
    ["SOUS DOMAINE 2 Education artistique", "Education artistique"],
  ]) {
    const r = sd([avecSemaines, [marqueur], ["a", "contenu lu", "autre contenu"]]);
    assert.equal(r[0], attendu, `graphie « ${marqueur} »`);
  }
});

// --- Sous-domaines, rubriques, thème ------------------------------------
test("🔴 seules les lignes MARQUÉES nomment un sous-domaine", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  const sd = [...new Set(lignesDu(r, "Langue et communication").map((l) => l.sous_domaine))];
  // Prendre tout titre en capitales pour un sous-domaine faisait disparaître
  // « COMMUNICATION ECRITE » : « LECTURE », posé juste après, l'écrasait.
  assert.deepEqual(sd.sort(), ["COMMUNICATION ECRITE", "COMMUNICATION ORALE"]);
});

test("les rubriques internes ne sont pas promues sous-domaines", async () => {
  const { analyserTableau, resumer } = await P();
  const s = resumer(analyserTableau(REEL.rows).lignes);
  for (const r of ["LECTURE", "PRODUCTION DE TEXTES"]) {
    assert.ok(s.rubriques.includes(r), `rubrique « ${r} » attendue, trouvé : ${s.rubriques}`);
    assert.ok(!s.sousDomaines.includes(r), `« ${r} » n'est pas un sous-domaine`);
  }
});

test("le thème du bloc est conservé, pas confondu avec son nom", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  // « Sous -domaine 2 » | « LECTURE DE TEXTES INJONCTIFS » : la seconde
  // cellule est le THÈME du mois ; le nom du sous-domaine vient après.
  const ecrite = r.lignes.filter((l) => l.sous_domaine === "COMMUNICATION ECRITE");
  assert.ok(ecrite.length > 0, "des lignes relèvent de COMMUNICATION ECRITE");
  assert.ok(ecrite.every((l) => l.theme === "LECTURE DE TEXTES INJONCTIFS"),
    `thème attendu, trouvé : ${[...new Set(ecrite.map((l) => l.theme))]}`);
});

// --- Activités, paliers, étiquettes -------------------------------------
test("les activités réelles sont retrouvées, pas les étiquettes de colonne", async () => {
  const { analyserTableau, resumer } = await P();
  const s = resumer(analyserTableau(REEL.rows).lignes);
  for (const a of ["Récitation", "Vocabulaire", "Grammaire", "Conjugaison", "Orthographe",
    "Calcul mental", "Arts scéniques"]) {
    assert.ok(s.activites.includes(a), `activité « ${a} » attendue`);
  }
  // 🔴 « OA » et « OS » employés seuls sont des en-têtes de colonne. Les
  // prendre pour des activités remplirait la liste de choix de bruit.
  assert.ok(!s.activites.some((a) => /^(oa|os)\s*\d*\s*:?\s*$/i.test(a)),
    `aucune étiquette parmi les activités : ${s.activites}`);
  // 🔴 Et « Palier » sans énoncé n'est pas une activité : le document le
  // laisse nu quatre fois (lignes 43, 61, 70, 74).
  assert.ok(!s.activites.some((a) => /^palier\s*\d*\s*:?\s*$/i.test(a)),
    "« Palier » nu n'est pas une activité");
});

test("aucun contenu n'est une étiquette, un en-tête de semaine ou un palier nu", async () => {
  const { analyserTableau } = await P();
  for (const l of analyserTableau(REEL.rows).lignes) {
    assert.ok(l.contenu.trim().length > 2, `contenu trop court : « ${l.contenu} »`);
    assert.ok(!/^semaine\s*\d/i.test(l.contenu), `en-tête de semaine pris pour un contenu : « ${l.contenu} »`);
    assert.ok(!/^(oa|os)\s*\d*\s*:?\s*$/i.test(l.contenu), `étiquette prise pour un contenu : « ${l.contenu} »`);
    assert.ok(!/^palier\s*\d*\s*:?\s*$/i.test(l.contenu), `palier nu pris pour un contenu : « ${l.contenu} »`);
  }
});

test("🔴 le palier accompagne l'activité sans la remplacer ni devenir un contenu", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  assert.ok(r.lignes.some((l) => l.palier), "au moins une ligne porte son palier");
  // Un palier n'est pas une activité : il décrit l'intention, pas la séance.
  assert.ok(!r.lignes.some((l) => /^palier\s*\d/i.test(l.activite || "")),
    "aucun palier rangé comme activité");
  // 🔴 Et surtout : le palier de 183 caractères de la ligne fusionnée ne
  // doit PAS être devenu le contenu de la semaine 1.
  assert.ok(!r.lignes.some((l) => /^palier\s*\d/i.test(l.contenu)),
    "aucun palier rangé comme contenu de séance");
  // L'activité que la ligne de palier portait est conservée.
  assert.ok(r.lignes.some((l) => l.activite === "Expression orale" && /^Palier 3/.test(l.palier || "")),
    "« Expression orale » garde son activité ET son palier");
  // Le palier d'un bloc ne suit pas le bloc suivant.
  assert.ok(lignesDu(r, "MATHEMATIQUES").every((l) => !/vocabulaire adéquat/.test(l.palier || "")),
    "le palier du français ne déborde pas sur les mathématiques");
});

// --- Cellules fusionnées -------------------------------------------------
test("🔴 une cellule fusionnée ne se voit pas attribuer une semaine inventée", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  const mois = r.lignes.filter((l) => l.semaine === null);
  assert.ok(mois.length > 0, "les lignes fusionnées existent dans le document");
  // « Géographie | Programme épuisé » : la tête nomme l'activité, et la
  // cellule fusionnée est son contenu — sur un mois dont on ignore le
  // découpage. L'attribuer à la semaine 1 serait une invention.
  const geo = r.lignes.find((l) => l.contenu === "Programme épuisé");
  assert.ok(geo, "« Programme épuisé » est lu comme un contenu");
  assert.equal(geo.activite, "Géographie", "et « Géographie » reste l'activité");
  assert.equal(geo.semaine, null, "sa semaine est indéterminable");
});

test("🔴 un titre fusionné derrière une étiquette reste un titre", async () => {
  const { analyserTableau } = await P();
  const r = analyserTableau(REEL.rows);
  // « OA3 | Copier des textes » : la tête n'est qu'une étiquette de colonne,
  // donc la seconde cellule est le TITRE du bloc, pas un contenu.
  assert.ok(r.lignes.some((l) => l.activite === "Copier des textes"),
    "« Copier des textes » est une activité");
  assert.ok(!r.lignes.some((l) => l.contenu === "Copier des textes"),
    "« Copier des textes » n'est pas un contenu");
});

// --- Robustesse ----------------------------------------------------------
test("un tableau sans colonne de semaine ne produit rien, sans planter", async () => {
  const { analyserTableau } = await P();
  // Un document d'une autre forme doit échouer VISIBLEMENT (zéro ligne,
  // donc aperçu vide) plutôt que d'inventer une planification.
  const r = analyserTableau([["Titre", "Autre"], ["a", "b"]]);
  assert.deepEqual(r.lignes, []);
  assert.deepEqual(r.domaines, []);
  assert.deepEqual(analyserTableau([]).lignes, []);
  assert.deepEqual(analyserTableau().lignes, []);
  assert.deepEqual(analyserTableau([null, undefined]).lignes, []);
});

test("l'ordre des lignes suit la lecture du document", async () => {
  const { analyserTableau } = await P();
  const ordres = analyserTableau(REEL.rows).lignes.map((l) => l.ordre);
  assert.deepEqual(ordres, [...ordres].sort((a, b) => a - b), "ordre croissant");
  assert.equal(new Set(ordres).size, ordres.length, "aucun doublon d'ordre");
});

// --- Regroupement et résumé ---------------------------------------------
test("le regroupement par domaine ne perd ni ne duplique aucune ligne", async () => {
  const { analyserTableau, grouperParDomaine } = await P();
  const r = analyserTableau(REEL.rows);
  const g = grouperParDomaine(r.lignes);
  // Une programmation par domaine : c'est la contrainte d'unicité de la
  // migration 165 (niveau, année, mois, domaine).
  assert.equal(g.length, r.domaines.length);
  assert.equal(g.reduce((a, x) => a + x.lignes.length, 0), r.lignes.length);
  assert.equal(new Set(g.map((x) => x.domaine)).size, g.length, "aucun domaine en double");
  assert.deepEqual(grouperParDomaine([]), []);
  assert.deepEqual(grouperParDomaine(), []);
});

test("le résumé permet de juger la lecture avant d'enregistrer", async () => {
  const { analyserTableau, resumer } = await P();
  const r = analyserTableau(REEL.rows);
  const s = resumer(r.lignes);
  assert.equal(s.total, r.lignes.length);
  const parSem = Object.values(s.parSemaine).reduce((a, b) => a + b, 0) + s.toutLeMois;
  assert.equal(parSem, s.total, "chaque ligne est comptée une fois et une seule par semaine");
  const parDom = Object.values(s.parDomaine).reduce((a, b) => a + b, 0);
  assert.equal(parDom, s.total, "chaque ligne est comptée une fois et une seule par domaine");
  assert.deepEqual(resumer(), {
    total: 0, parSemaine: {}, parDomaine: {}, toutLeMois: 0,
    activites: [], sousDomaines: [], rubriques: [],
  });
});
