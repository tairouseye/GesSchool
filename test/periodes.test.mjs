// =====================================================================
//  Dates de période (migration 162)
//
//  17 des 20 périodes en base n'avaient aucune date, et `periodes` n'était
//  jamais écrite par l'application : aucun écran ne permettait de les
//  saisir. Sans elles, rien ne peut être borné dans le temps — le comptage
//  des absences d'un trimestre en particulier.
//
//  Deux trimestres qui se chevauchent compteraient DEUX FOIS la même
//  absence. La base ne peut pas l'interdire simplement (il y faudrait une
//  contrainte d'exclusion) : on le détecte ici pour le signaler à la saisie.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const acad = () => chargerLib("academique", ['export { chevauchements } from "@/lib/academique.js";']);
const P = (libelle, date_debut, date_fin) => ({ libelle, date_debut, date_fin });

test("trois trimestres qui se suivent : aucun chevauchement", async () => {
  const { chevauchements } = await acad();
  assert.deepEqual(chevauchements([
    P("Trimestre 1", "2026-10-01", "2026-12-20"),
    P("Trimestre 2", "2027-01-05", "2027-03-28"),
    P("Trimestre 3", "2027-04-06", "2027-07-10"),
  ]), []);
});

test("🔴 deux périodes qui se recouvrent sont signalées", async () => {
  const { chevauchements } = await acad();
  const r = chevauchements([
    P("Trimestre 1", "2026-10-01", "2026-12-31"),
    P("Trimestre 2", "2026-12-15", "2027-03-28"),
  ]);
  assert.deepEqual(r, [["Trimestre 1", "Trimestre 2"]]);
});

test("une journée partagée compte comme un chevauchement", async () => {
  const { chevauchements } = await acad();
  // T1 finit le 20 et T2 commence le 20 : une absence du 20 serait comptée
  // dans les deux. La borne est inclusive des deux côtés.
  assert.equal(chevauchements([
    P("T1", "2026-10-01", "2026-12-20"),
    P("T2", "2026-12-20", "2027-03-28"),
  ]).length, 1);
});

test("l'ordre de saisie n'a pas d'importance", async () => {
  const { chevauchements } = await acad();
  // Les périodes arrivent triées par `ordre`, pas par date : une école peut
  // dater le trimestre 2 avant le trimestre 1.
  assert.deepEqual(chevauchements([
    P("Trimestre 2", "2026-12-15", "2027-03-28"),
    P("Trimestre 1", "2026-10-01", "2026-12-31"),
  ]), [["Trimestre 1", "Trimestre 2"]]);
});

test("les périodes incomplètes sont ignorées, pas signalées à tort", async () => {
  const { chevauchements } = await acad();
  // C'est le cas de 17 périodes sur 20 aujourd'hui : une date manquante ne
  // permet aucune comparaison, et crier au chevauchement serait faux.
  assert.deepEqual(chevauchements([
    P("T1", null, null),
    P("T2", "2026-10-01", null),
    P("T3", null, "2026-12-20"),
    P("T4", "2026-10-15", "2026-12-01"),
  ]), []);
});

test("entrée vide ou absente : aucune alerte", async () => {
  const { chevauchements } = await acad();
  assert.deepEqual(chevauchements([]), []);
  assert.deepEqual(chevauchements(), []);
});
