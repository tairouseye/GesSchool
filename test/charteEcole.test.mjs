// =====================================================================
//  Couleurs de l'emploi du temps tirées de la charte de l'école
//
//  Ce que l'épreuve verrouille, sur une gamme de chartes réelles ou
//  défavorables (Tut'Tank, le navy/doré d'origine, un jaune, un gris, des
//  couleurs invalides) :
//   • le texte navy reste lisible (≥ 4,5:1) sur TOUTES les teintes de matière ;
//   • le texte de l'en-tête est lisible sur la couleur primaire ;
//   • une grille n'a pas deux matières de la même couleur ;
//   • la première teinte part bien de la couleur secondaire de l'école.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { ratioContraste, NAVY } from "../src/lib/contraste.js";
import { charteEmploi, hexEnRgb, paletteMatieres } from "../src/lib/charteEcole.js";

const CHARTES = [
  { nom: "Tut'Tank", couleur_primaire: "#181848", couleur_secondaire: "#00A8D8" },
  { nom: "origine", couleur_primaire: "#0B1F3A", couleur_secondaire: "#C9A227" },
  { nom: "jaune clair", couleur_primaire: "#FFE600", couleur_secondaire: "#FFF4A0" },
  { nom: "gris", couleur_primaire: "#808080", couleur_secondaire: "#A0A0A0" },
  { nom: "deux bleus proches", couleur_primaire: "#1E40AF", couleur_secondaire: "#2563EB" },
  { nom: "invalide", couleur_primaire: "rouge", couleur_secondaire: null },
];

for (const ecole of CHARTES) {
  test(`charte « ${ecole.nom} » : lisible et sans doublon`, () => {
    const c = charteEmploi(ecole, 12);
    assert.equal(c.matieres.length, 12);
    assert.equal(new Set(c.matieres).size, 12, "deux matières de la même couleur");
    for (const t of c.matieres) {
      assert.ok(ratioContraste(NAVY[900], hexEnRgb(t)) >= 4.5, `navy sur ${t} illisible`);
    }
    assert.ok(ratioContraste(hexEnRgb(c.entete.color), hexEnRgb(c.entete.background)) >= 4.5, "en-tête illisible");
    assert.ok(ratioContraste(hexEnRgb(c.titre), [255, 255, 255]) >= 4.5, "nom de l'école illisible sur blanc");
  });
}

test("la première teinte suit la couleur secondaire de l'école", () => {
  const [premiere] = paletteMatieres(1, "#181848", "#00A8D8");
  const [r, g, b] = hexEnRgb(premiere);
  assert.ok(b > r && g > r, `teinte cyan attendue, obtenu ${premiere}`);
});
