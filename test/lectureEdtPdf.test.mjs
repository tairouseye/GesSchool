// =====================================================================
//  Lecture d'un emploi du temps PDF (mig. 222, Mme Kane 02/11/2026)
//
//  Les positions reprennent celles des PDF de Tut'Tank (A4 paysage) : la
//  colonne d'horaires à gauche, un jour tous les ~135 points. Le module
//  n'importe pdf.js qu'à l'usage : on le charge tel quel, sans bundle.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const L = () => import(pathToFileURL(resolve("src/lib/lectureEdtPdf.js")).href);

const X = { lundi: 189, mardi: 323, mercredi: 450, jeudi: 593, vendredi: 719 };
const it = (x, y, str, w = 40) => ({ x, y, w, str });
const entete = [
  it(265, 77, "EMPLOI DU TEMPS CI / CP A — 2026-2027", 312),
  it(66, 107, "Horaire", 37), it(X.lundi, 107, "Lundi", 29), it(X.mardi, 107, "Mardi", 29),
  it(X.mercredi, 107, "Mercredi", 45), it(X.jeudi, 107, "Jeudi", 28), it(X.vendredi, 107, "Vendredi", 46),
];
const heure = (y, t) => it(52, y, t, 66);
// Une case centrée sur la colonne d'un jour.
const cas = (jour, y, str, w = 60) => it(X[jour] + 15 - w / 2, y, str, w);

test("une case par jour et par horaire, le titre désigne la classe", async () => {
  const { analyserPage } = await L();
  const r = analyserPage([
    ...entete,
    heure(133, "08h00 – 08h30"), heure(162, "08h30 – 09h00"),
    cas("lundi", 133, "Communication orale"), cas("mardi", 162, "Anglais"),
  ]);
  assert.equal(r.titre, "CI / CP A");
  assert.deepEqual(r.jours, [1, 2, 3, 4, 5]);
  assert.deepEqual(r.creneaux, [
    { jour: 1, heure_debut: "08:00", heure_fin: "08:30", libelle: "Communication orale", salle: null },
    { jour: 2, heure_debut: "08:30", heure_fin: "09:00", libelle: "Anglais", salle: null },
  ]);
});

test("une case fusionnée sur deux horaires : texte centré entre les deux", async () => {
  const { analyserPage } = await L();
  const r = analyserPage([
    ...entete,
    heure(466, "15h00 – 15h30"), heure(495, "15h30 – 16h00"), heure(535, "16h00 – 17h00"),
    cas("lundi", 466, "Résolution de problèmes"),
    cas("lundi", 520, "Renforcement"),          // 15h30 → 17h00
    cas("jeudi", 481, "Renforcement"),          // 15h00 → 16h00
    cas("jeudi", 535, "Informatique"),
  ]);
  const de = (j) => r.creneaux.filter((c) => c.jour === j).map((c) => `${c.heure_debut}-${c.heure_fin} ${c.libelle}`);
  assert.deepEqual(de(1), ["15:00-15:30 Résolution de problèmes", "15:30-17:00 Renforcement"]);
  assert.deepEqual(de(4), ["15:00-16:00 Renforcement", "16:00-17:00 Informatique"]);
});

test("une ligne au texte unique centré vaut pour toute la semaine", async () => {
  const { analyserPage, estSansCours } = await L();
  const r = analyserPage([
    ...entete,
    heure(220, "09h30 – 10h00"), heure(250, "10h00 – 10h30"),
    cas("lundi", 220, "Jeux"), cas("mardi", 220, "EPS"),
    it(411, 250, "Pause goûter – Récréation", 122),
  ]);
  const pauses = r.creneaux.filter((c) => c.heure_debut === "10:00");
  assert.equal(pauses.length, 5);
  assert.ok(pauses.every((c) => estSansCours(c.libelle)));
});

test("deux groupes dans une case : un créneau par groupe, noté dans salle", async () => {
  const { analyserPage } = await L();
  const r = analyserPage([
    ...entete,
    heure(223, "09h00 – 09h30"),
    cas("lundi", 218, "Psychomotricité (G1) /", 92), cas("lundi", 229, "Jeux (G2)", 43),
    cas("mardi", 218, "Vivre ensemble / Vivre dans", 120), cas("mardi", 229, "son milieu", 45),
  ]);
  assert.deepEqual(r.creneaux.map((c) => [c.jour, c.libelle, c.salle]), [
    [1, "Psychomotricité", "G1"], [1, "Jeux", "G2"],
    [2, "Vivre ensemble / Vivre dans son milieu", null],
  ]);
});

test("le même cours dans deux cases qui se suivent devient un seul cours", async () => {
  const { analyserPage } = await L();
  const r = analyserPage([
    ...entete,
    heure(191, "09h00 – 09h30"), heure(220, "09h30 – 10h00"),
    cas("mardi", 191, "EPS"), cas("mardi", 220, "EPS"),
  ]);
  assert.deepEqual(r.creneaux.map((c) => `${c.heure_debut}-${c.heure_fin}`), ["09:00-10:00"]);
});

test("sans en-tête de jours : aucune grille (et pas d'erreur)", async () => {
  const { analyserPage } = await L();
  assert.deepEqual(analyserPage([it(10, 10, "Facture n° 12")]).creneaux, []);
});

test("le titre retrouve la classe, ou les classes qui le prolongent", async () => {
  const { classesDuTitre } = await L();
  const classes = [
    { id: "a", libelle: "TPS/PS A" }, { id: "b", libelle: "TPS/PS B" },
    { id: "c", libelle: "CI/CP A" }, { id: "d", libelle: "CI/CP B" }, { id: "e", libelle: "CM1" },
  ];
  assert.deepEqual(classesDuTitre("TPS / PS", classes), ["a", "b"]);
  assert.deepEqual(classesDuTitre("CI / CP A", classes), ["c"]);
  assert.deepEqual(classesDuTitre("CM1", classes), ["e"]);
  assert.deepEqual(classesDuTitre("", classes), []);
});
