// =====================================================================
//  Sous-niveaux — le niveau réel dans une classe multi-niveaux (mig. 164)
//
//  Chez Tut'Tank, « TPS/PS A » est UNE classe qui contient des élèves de
//  TPS et de PS (Montessori). Le sous-niveau dit lequel.
//
//  🔴 PROPRIÉTÉ ESSENTIELLE : la fonctionnalité est OPT-IN. Un niveau sans
//  sous-niveaux doit se comporter exactement comme avant — sinon les six
//  autres écoles, et les niveaux simples de Tut'Tank (CM1), verraient
//  apparaître un choix qui n'a aucun sens chez elles.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const acad = () => chargerLib("sousniveaux", ['export { sousNiveauxDeClasse } from "@/lib/academique.js";']);

const CLASSES = [
  { id: "tpsps_a", libelle: "TPS/PS A", niveau_id: "n_tpsps" },
  { id: "tpsps_b", libelle: "TPS/PS B", niveau_id: "n_tpsps" },
  { id: "cm1",     libelle: "CM1",      niveau_id: "n_cm1" },
];
const SOUS = [
  { id: "s_tps", niveau_id: "n_tpsps", libelle: "TPS", ordre: 1 },
  { id: "s_ps",  niveau_id: "n_tpsps", libelle: "PS",  ordre: 2 },
  { id: "s_ci",  niveau_id: "n_cicp",  libelle: "CI",  ordre: 1 },
];

test("une classe multi-niveaux propose les sous-niveaux de SON niveau", async () => {
  const { sousNiveauxDeClasse } = await acad();
  assert.deepEqual(sousNiveauxDeClasse(SOUS, CLASSES, "tpsps_a").map((s) => s.libelle), ["TPS", "PS"]);
});

test("les deux classes d'un même niveau partagent ses sous-niveaux", async () => {
  const { sousNiveauxDeClasse } = await acad();
  // TPS/PS A et TPS/PS B sont deux classes distinctes (deux salles, deux
  // équipes de maîtresses) mais relèvent du même découpage.
  assert.deepEqual(
    sousNiveauxDeClasse(SOUS, CLASSES, "tpsps_a"),
    sousNiveauxDeClasse(SOUS, CLASSES, "tpsps_b"),
  );
});

test("🔴 un niveau SIMPLE ne propose rien — la fonctionnalité reste invisible", async () => {
  const { sousNiveauxDeClasse } = await acad();
  // CM1 n'a pas de sous-niveaux : aucun choix ne doit apparaître, sinon on
  // imposerait une distinction là où elle n'existe pas.
  assert.deepEqual(sousNiveauxDeClasse(SOUS, CLASSES, "cm1"), []);
});

test("les sous-niveaux d'un AUTRE niveau ne fuient jamais", async () => {
  const { sousNiveauxDeClasse } = await acad();
  // « CI » appartient à CI/CP : il ne doit jamais être proposé en TPS/PS.
  // C'est l'écran qui l'évite ici ; le déclencheur le refuse en base.
  assert.ok(!sousNiveauxDeClasse(SOUS, CLASSES, "tpsps_a").some((s) => s.libelle === "CI"));
});

test("classe inconnue ou absente : aucun choix, aucune erreur", async () => {
  const { sousNiveauxDeClasse } = await acad();
  assert.deepEqual(sousNiveauxDeClasse(SOUS, CLASSES, "inconnue"), []);
  assert.deepEqual(sousNiveauxDeClasse(SOUS, CLASSES, null), []);
  assert.deepEqual(sousNiveauxDeClasse(SOUS, CLASSES), []);
  assert.deepEqual(sousNiveauxDeClasse(), []);
});

test("aucun sous-niveau défini : l'établissement entier est inchangé", async () => {
  const { sousNiveauxDeClasse } = await acad();
  for (const c of CLASSES) assert.deepEqual(sousNiveauxDeClasse([], CLASSES, c.id), []);
});
