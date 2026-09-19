import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Emploi du temps du supérieur — les deux fonctions qui portent une règle
// métier : le regroupement par jour et la détection des chevauchements.
// Le reste du module n'est que des appels Supabase.
const charger = () => chargerLib("emploisup", ['export * from "@/lib/emploiSup.js";']);

const s = (id, jour, debut, fin) => ({ id, jour, heure_debut: debut, heure_fin: fin });

test("parJour : ordre de la semaine, tri horaire, jours vides écartés", async () => {
  const { parJour } = await charger();
  const jours = parJour([
    s("c", 3, "08:00:00", "10:00:00"),
    s("b", 1, "14:00:00", "16:00:00"),
    s("a", 1, "08:00:00", "10:00:00"),
  ]);

  assert.deepEqual(jours.map((j) => j.jour), [1, 3], "mardi n'a pas de séance : il ne doit pas apparaître");
  assert.equal(jours[0].libelle, "Lundi");
  assert.deepEqual(jours[0].seances.map((x) => x.id), ["a", "b"], "les séances d'un jour se lisent dans l'ordre horaire");
});

test("chevauchements : deux séances au même moment sont signalées", async () => {
  const { chevauchements } = await charger();
  const conflits = chevauchements([
    s("a", 1, "08:00:00", "10:00:00"),
    s("b", 1, "09:00:00", "11:00:00"),
  ]);
  assert.deepEqual([...conflits].sort(), ["a", "b"], "les DEUX séances en cause sont signalées, pas seulement la seconde");
});

test("chevauchements : le contact bord à bord n'est pas un conflit", async () => {
  const { chevauchements } = await charger();
  // 10:00–12:00 commence quand 08:00–10:00 finit : un cours enchaîne l'autre.
  const conflits = chevauchements([
    s("a", 1, "08:00:00", "10:00:00"),
    s("b", 1, "10:00:00", "12:00:00"),
  ]);
  assert.equal(conflits.size, 0);
});

test("chevauchements : même horaire, jours différents = aucun conflit", async () => {
  const { chevauchements } = await charger();
  const conflits = chevauchements([
    s("a", 1, "08:00:00", "10:00:00"),
    s("b", 2, "08:00:00", "10:00:00"),
  ]);
  assert.equal(conflits.size, 0);
});

test("chevauchements : une séance englobée par une autre est détectée", async () => {
  const { chevauchements } = await charger();
  const conflits = chevauchements([
    s("grande", 4, "08:00:00", "18:00:00"),
    s("petite", 4, "10:00:00", "11:00:00"),
  ]);
  assert.deepEqual([...conflits].sort(), ["grande", "petite"]);
});

test("heure : l'affichage retient hh:mm, et supporte l'absence de valeur", async () => {
  const { heure, libJour } = await charger();
  assert.equal(heure("08:30:00"), "08:30");
  assert.equal(heure(null), "—");
  assert.equal(libJour(7), "Dimanche");
  assert.equal(libJour("1"), "Lundi", "les jours arrivent parfois en texte depuis un <select>");
  assert.equal(libJour(9), "—");
});
