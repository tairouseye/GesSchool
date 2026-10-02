// =====================================================================
//  Le chemin d'une photo d'élève — migration 169
//
//  🔴 CE FORMAT EST UN CONTRAT ENTRE LE CLIENT ET UNE POLICY SQL.
//  `_photo_eleve` lit le DEUXIÈME segment du chemin et le valide par
//  `^[0-9a-fA-F-]{36}$` pour savoir de quel élève il s'agit, puis demande
//  à `_parent_possede` si le parent connecté en est bien le tuteur.
//
//  Si le format dérive, la policy rend NULL : le parent ne voit plus la
//  photo de son enfant — SANS erreur, en silence. C'est un défaut
//  fail-closed, donc sans fuite, mais invisible. D'où ces épreuves.
//
//  ⚠️ L'ANCIENNE FORME ÉTAIT `<ecole>/<eleve>-<horodatage>.<ext>` :
//  inanalysable, car un UUID contient quatre tirets. Corrigée sans
//  migration de données parce qu'aucune photo n'existait encore (0 sur
//  172 élèves) — l'occasion ne se représentera pas.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const E = () => chargerLib("photoel", ['export { cheminPhoto } from "@/lib/eleves.js";']);

const ECOLE = "11111111-2222-4333-8444-555555555555";
const ELEVE = "6ae277b2-1111-4222-8333-944444444444";
//  La MÊME expression que la fonction SQL `_photo_eleve`.
const REGEX_SQL = /^[0-9a-fA-F-]{36}$/;

test("🔴 le 2e segment est l'élève, et la regex SQL le reconnaît", async () => {
  const { cheminPhoto } = await E();
  const c = cheminPhoto(ECOLE, ELEVE, "photo.jpg", 1700000000000);
  const segments = c.split("/");
  assert.equal(segments.length, 3, `trois segments attendus : ${c}`);
  assert.equal(segments[0], ECOLE, "le 1er segment est l'école (policy de la mig. 015)");
  assert.equal(segments[1], ELEVE, "le 2e segment est l'élève (policy de la mig. 169)");
  assert.ok(REGEX_SQL.test(segments[1]), "et la regex SQL le valide");
});

test("🔴 l'ancienne forme NE passait PAS la regex SQL", async () => {
  // La preuve que la correction était nécessaire : avec l'ancien chemin,
  // le 2e segment n'existe même pas.
  const ancien = `${ECOLE}/${ELEVE}-1700000000000.jpg`;
  const segments = ancien.split("/");
  assert.equal(segments.length, 2, "l'ancienne forme n'avait que deux segments");
  assert.equal(segments[1], undefined ?? segments[1]);
  assert.ok(!REGEX_SQL.test(segments[1]), "le 2e segment ne pouvait pas être lu comme un élève");
});

test("l'extension est nettoyée, jamais devinée au hasard", async () => {
  const { cheminPhoto } = await E();
  const ext = (nom) => cheminPhoto(ECOLE, ELEVE, nom, 1).split(".").pop();
  assert.equal(ext("portrait.JPG"), "jpg", "mise en minuscules");
  assert.equal(ext("photo.png"), "png");
  assert.equal(ext("image.jpeg"), "jpeg");
  // Un nom sans extension ne doit pas produire un chemin se terminant par
  // un point, que le stockage servirait sans type.
  assert.equal(ext("sans_extension"), "jpg");
  assert.equal(ext(""), "jpg");
  assert.equal(ext(undefined), "jpg");
});

test("🔴 un nom de fichier hostile ne sort pas de son dossier", async () => {
  const { cheminPhoto } = await E();
  // Une extension forgée ne doit pas pouvoir ajouter de segment : sinon le
  // 2e segment ne serait plus l'élève, et la policy lirait autre chose.
  for (const nom of ["x.../../../autre", "x.jp g", "x.j/pg", "x.<script>", "x.jpg?a=b"]) {
    const c = cheminPhoto(ECOLE, ELEVE, nom, 1);
    assert.equal(c.split("/").length, 3, `trois segments malgré « ${nom} » : ${c}`);
    assert.equal(c.split("/")[1], ELEVE, `l'élève reste le 2e segment : ${c}`);
    assert.ok(/^[a-z0-9]+$/.test(c.split(".").pop()), `extension saine : ${c}`);
  }
});

test("deux photos du même élève ne s'écrasent pas par accident", async () => {
  const { cheminPhoto } = await E();
  const a = cheminPhoto(ECOLE, ELEVE, "p.jpg", 1700000000000);
  const b = cheminPhoto(ECOLE, ELEVE, "p.jpg", 1700000000001);
  assert.notEqual(a, b, "l'horodatage distingue les prises");
  // …mais toutes deux restent dans le dossier de l'élève, donc toutes deux
  // lisibles par SON parent et par personne d'autre.
  assert.equal(a.split("/")[1], b.split("/")[1]);
});
