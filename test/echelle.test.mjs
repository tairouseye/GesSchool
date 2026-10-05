// =====================================================================
//  Tenir l'échelle : aucune lecture « tous les élèves »
//
//  🔴 CE QUE CES ÉPREUVES EMPÊCHENT DE REVENIR.
//  `getEleves()` lisait « tous les élèves » — en réalité au plus 1 000
//  lignes, triées par nom, SANS JAMAIS DIRE qu'elle tronquait. Sept pages
//  s'en servaient. Au-delà de ce seuil, un élève en fin d'alphabet
//  devenait introuvable : pas de facture, pas d'attestation, pas de
//  message à son parent — et aucune explication à l'écran.
//
//  Mesuré au moment du correctif : la plus grande école compte 96 élèves,
//  donc rien n'était cassé. Mais le prospect de Kinshasa est annoncé à
//  plus de 1 000 élèves : il franchit exactement cette borne.
//
//  ⚠️ Ces épreuves lisent le CODE, faute de pouvoir mesurer une requête.
//  C'est une barre basse, et c'est voulu : elles n'empêchent pas d'écrire
//  une requête lente, elles empêchent de réintroduire les deux motifs
//  précis qui ont causé le défaut.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const PAGES = path.join(RACINE, "src", "pages");
const fichiers = fs.readdirSync(PAGES).filter((f) => f.endsWith(".jsx"));
const lire = (f) => fs.readFileSync(path.join(PAGES, f), "utf8");

test("🔴 aucune lecture « tous les élèves » n'est réintroduite", () => {
  const lib = fs.readFileSync(path.join(RACINE, "src", "lib", "eleves.js"), "utf8");
  //  Le nom exact, parce que c'est lui qui rendait le piège invisible : il
  //  promettait « les élèves » et en rendait mille.
  assert.doesNotMatch(lib, /export\s+(async\s+)?function\s+getEleves\s*\(/,
    "`getEleves` est de retour : une lecture plafonnée en silence. Utilisez "
    + "`SelecteurEleve` pour choisir, une jointure pour afficher un nom, "
    + "`getElevesPage` pour une liste, ou `getElevesLot` qui rend `complet`.");

  const coupables = fichiers.filter((f) => /\bgetEleves\s*\(/.test(lire(f)));
  assert.deepEqual(coupables, [], "des pages appellent encore getEleves()");
});

test("🔴 aucune page ne rend une <option> par élève", () => {
  //  Le motif que `SelecteurEleve` a été écrit pour remplacer : « indolore à
  //  96 élèves, impraticable à 10 000 », dit son en-tête. Et comme la liste
  //  était plafonnée, l'élève au-delà n'y figurait même pas.
  const fautes = [];
  for (const f of fichiers) {
    const src = lire(f);
    src.split("\n").forEach((ligne, i) => {
      //  Une boucle sur des élèves qui produit une <option>. On ne vise que
      //  `eleves`/`etudiants` : les listes de classes, de matières ou de
      //  circuits sont bornées par nature.
      if (/\b(eleves|etudiants)\s*\.map\s*\(/.test(ligne) && /<option/.test(ligne)) {
        fautes.push(`src/pages/${f}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(fautes, [],
    "remplacez ce <select> par `SelecteurEleve`, qui cherche au serveur");
});

test("le sélecteur d'élève cherche bien au SERVEUR, et de façon bornée", () => {
  const sel = fs.readFileSync(path.join(RACINE, "src", "composants", "SelecteurEleve.jsx"), "utf8");
  assert.match(sel, /chercherEleves/, "le sélecteur ne cherche plus au serveur");
  assert.match(sel, /limite:\s*\d+/, "la recherche n'est plus bornée");
  //  Et un anti-rebond : sans lui, une requête par frappe.
  assert.match(sel, /setTimeout/, "l'anti-rebond a disparu du sélecteur");

  const lib = fs.readFileSync(path.join(RACINE, "src", "lib", "eleves.js"), "utf8");
  //  La borne vit dans la requête, pas seulement dans l'appelant.
  assert.match(lib, /export async function chercherEleves[\s\S]{0,400}\.range\(/,
    "`chercherEleves` ne borne plus sa requête");
});

test("Paiements ne relance pas son référentiel à chaque frappe", () => {
  //  Un seul chargement dépendait de `recherche` et relançait les huit
  //  requêtes de référentiel. Les deux chargements doivent rester séparés :
  //  celui du référentiel ne connaît pas la recherche.
  const src = lire("Paiements.jsx");
  const bloc = src.match(/const chargerReferentiel = useCallback\([\s\S]*?\}, \[([^\]]*)\]\);/);
  assert.ok(bloc, "`chargerReferentiel` a disparu : le chargement a-t-il été refusionné ?");
  assert.doesNotMatch(bloc[1], /recherche|pageFac/,
    "le référentiel dépend de nouveau de la recherche : taper un nom relancera tout");
});
