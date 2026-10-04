// =====================================================================
//  Le mode d'emploi suit-il l'application ? — garde-fou documentaire
//
//  🔴 POURQUOI UNE ÉPREUVE, ET NON UNE BONNE INTENTION.
//  Le manuel avait pris 183 versions de retard. Pire : son chapitre sur
//  les bulletins décrivait un bouton qui n'existait plus, donc il
//  TROMPAIT. Une intention de « penser à mettre à jour la doc » ne tient
//  pas ; une épreuve qui échoue, si.
//
//  Ce que cette épreuve vérifie : tout écran atteignable par le menu est
//  MENTIONNÉ dans le manuel. C'est volontairement une barre basse — elle
//  ne juge pas la qualité du texte, elle interdit seulement qu'un écran
//  neuf parte en production sans qu'une ligne le nomme.
//
//  ⚠️ Si elle échoue, la réponse n'est PAS d'allonger la liste des
//  tolérances : c'est d'écrire le paragraphe manquant. Une tolérance se
//  justifie, elle ne s'ajoute pas par commodité.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const MANUEL = path.join(RACINE, "docs", "mode-emploi.md");
const ESPACES = path.join(RACINE, "src", "lib", "espaces.js");

const manuel = fs.readFileSync(MANUEL, "utf8");
const espaces = fs.readFileSync(ESPACES, "utf8");

//  Les entrées de menu, telles que `espaces.js` les déclare.
function entreesDeMenu() {
  const re = /\{\s*to:\s*"([^"]+)",\s*label:\s*"([^"]+)"[^}]*?cle:\s*"([^"]+)"/g;
  const vues = new Set();
  const out = [];
  for (const [, to, label, cle] of espaces.matchAll(re)) {
    if (vues.has(cle)) continue;
    vues.add(cle);
    out.push({ to, label, cle });
  }
  return out;
}

//  Un écran est « documenté » si le manuel cite son libellé OU sa route.
//  Deux critères plutôt qu'un : certains écrans sont décrits par leur
//  chemin (« /appel-sup »), d'autres par leur intitulé.
const documente = (e) => manuel.includes(e.label) || manuel.includes(e.to);

test("🔴 tout écran du menu est mentionné dans le mode d'emploi", () => {
  const entrees = entreesDeMenu();
  assert.ok(entrees.length > 40, `extraction douteuse : ${entrees.length} entrées trouvées`);

  const absents = entrees.filter((e) => !documente(e));
  assert.deepEqual(
    absents.map((e) => `${e.cle} — « ${e.label} » (${e.to})`),
    [],
    "écran(s) non documenté(s) : ajoutez-leur un paragraphe dans docs/mode-emploi.md, "
    + "puis régénérez avec « node docs/md2html.mjs »",
  );
});

test("le manuel annonce la version de l'application", () => {
  //  Un manuel sans version laisse le lecteur deviner s'il est à jour.
  const pkg = JSON.parse(fs.readFileSync(path.join(RACINE, "package.json"), "utf8"));
  const majeure = pkg.version.split(".").slice(0, 2).join(".");
  assert.match(manuel, /\*\*Version \d+\.\d+/,
    "le manuel doit porter une ligne « **Version x.y · mise à jour du … ** »");
  //  ⚠️ On ne compare que la version MAJEURE.MINEURE : un correctif
  //  (2.235.1 → 2.235.2) ne change rien à ce que l'utilisateur voit, et
  //  exiger la version exacte rendrait l'épreuve pénible sans rien
  //  protéger.
  assert.ok(manuel.includes(`**Version ${majeure}`),
    `le manuel annonce une autre version que ${majeure} — mettez à jour la ligne d'en-tête `
    + `de docs/mode-emploi.md (version du paquet : ${pkg.version})`);
});

test("le manuel reste cohérent : aucun renvoi interne cassé", () => {
  const chapitres = new Set([...manuel.matchAll(/^## (\d+)\./gm)].map((m) => m[1]));
  const sous = new Set([...manuel.matchAll(/^### (\d+\.\d+)/gm)].map((m) => m[1]));
  const renvois = new Set([...manuel.matchAll(/§(\d+(?:\.\d+)?)/g)].map((m) => m[1]));
  const casses = [...renvois].filter((r) => !chapitres.has(r) && !sous.has(r)).sort();
  //  Un renvoi « §16.2 » vers un chapitre renuméroté envoie le lecteur
  //  dans le vide : c'est le genre de défaut qu'on ne voit qu'en lisant.
  assert.deepEqual(casses, [], "renvoi(s) interne(s) vers une section inexistante");
});

test("aucun numéro de chapitre en double", () => {
  const nums = [...manuel.matchAll(/^## (\d+)\./gm)].map((m) => m[1]);
  const doubles = nums.filter((n, i) => nums.indexOf(n) !== i);
  assert.deepEqual([...new Set(doubles)], [],
    "deux chapitres portent le même numéro — le sommaire et les renvois en deviennent faux");
});

test("🔴 le manuel est bien SERVI par l'application", () => {
  //  Il a longtemps vécu dans `docs/`, c'est-à-dire nulle part pour une
  //  directrice. Il doit être dans `public/`, que Vite recopie dans
  //  `dist/`, et un écran doit y renvoyer.
  const servi = path.join(RACINE, "public", "mode-emploi.html");
  assert.ok(fs.existsSync(servi),
    "public/mode-emploi.html manque : lancez « node docs/md2html.mjs »");

  const layout = fs.readFileSync(path.join(RACINE, "src", "composants", "Layout.jsx"), "utf8");
  assert.match(layout, /mode-emploi\.html/,
    "aucun lien vers le manuel dans la navigation : un manuel qu'on ne peut pas atteindre n'existe pas");

  //  La sortie doit suivre la source : un HTML plus court que le Markdown
  //  signale une régénération oubliée.
  const html = fs.readFileSync(servi, "utf8");
  assert.ok(html.length > manuel.length,
    `public/mode-emploi.html (${html.length} o) semble plus ancien que la source `
    + `(${manuel.length} o) : régénérez avec « node docs/md2html.mjs »`);
});

test("le garde-fou détecte bien ce qu'il traque", () => {
  //  ⚠️ Une épreuve qui ne peut pas échouer ne protège rien. On lui soumet
  //  donc un écran manifestement absent du manuel, et on exige qu'elle le
  //  voie. Éprouvé aussi « en vrai » : un écran fictif ajouté dans
  //  espaces.js fait bien tomber l'épreuve ci-dessus, avec son nom.
  const fictif = { to: "/ecran-qui-n-existe-pas", label: "Écran absent du manuel", cle: "_sonde" };
  assert.equal(documente(fictif), false, "un écran inconnu doit être signalé comme non documenté");
  //  Et, symétriquement, qu'elle reconnaisse un écran réellement décrit.
  assert.equal(documente({ to: "/bulletins", label: "Bulletins", cle: "bulletins" }), true);
});
