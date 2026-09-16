// Tests de la logique LMD pure (crédits de la maquette) — sans BD.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const L = await chargerLib("lmd", ['export * from "@/lib/lmd.js";']);

test("totalCredits : somme des crédits, tolère valeurs manquantes", () => {
  assert.equal(L.totalCredits([{ credits: 6 }, { credits: 9 }, { credits: 15 }]), 30);
  assert.equal(L.totalCredits([{ credits: "6" }, {}, { credits: null }]), 6);
  assert.equal(L.totalCredits([]), 0);
  assert.equal(L.totalCredits(null), 0);
});

test("ecartCreditsSemestre : négatif = manque, 0 = conforme à 30", () => {
  assert.equal(L.ecartCreditsSemestre([{ credits: 30 }]), 0);
  assert.equal(L.ecartCreditsSemestre([{ credits: 24 }]), -6);
  assert.equal(L.ecartCreditsSemestre([{ credits: 33 }]), 3);
  // Cible personnalisée
  assert.equal(L.ecartCreditsSemestre([{ credits: 20 }], 20), 0);
});

test("semestreConforme : vrai seulement si la somme atteint la cible", () => {
  assert.equal(L.semestreConforme([{ credits: 12 }, { credits: 18 }]), true);
  assert.equal(L.semestreConforme([{ credits: 12 }, { credits: 12 }]), false);
});

test("ueCoherente : ECUE doivent totaliser les crédits de l'UE (sinon UE seule OK)", () => {
  assert.equal(L.ueCoherente({ credits: 6 }, [{ credits: 3 }, { credits: 3 }]), true);
  assert.equal(L.ueCoherente({ credits: 6 }, [{ credits: 3 }, { credits: 2 }]), false);
  assert.equal(L.ueCoherente({ credits: 6 }, []), true); // pas d'ECUE → cohérente
});

// --- Moteur de calcul LMD ---
test("noteFinale : pondération CC/examen, tolère une seule composante", () => {
  assert.equal(L.noteFinale({ cc: 10, examen: 15 }), 13); // 10*0.4 + 15*0.6
  assert.equal(L.noteFinale({ cc: 12 }), 12);
  assert.equal(L.noteFinale({ examen: 8 }), 8);
  assert.equal(L.noteFinale({}), null);
});

test("moyenneUE : moyenne des ECUE pondérée par coefficient + drapeau complet", () => {
  const ue = { credits: 6 };
  const ecues = [{ id: "a", coefficient: 1 }, { id: "b", coefficient: 2 }];
  const r = L.moyenneUE(ue, ecues, { a: { cc: 10, examen: 10 }, b: { cc: 16, examen: 16 } });
  assert.equal(r.moyenne, 14); // (10*1 + 16*2) / 3
  assert.equal(r.complet, true);
  const r2 = L.moyenneUE(ue, ecues, { a: { cc: 10, examen: 10 } });
  assert.equal(r2.moyenne, 10);
  assert.equal(r2.complet, false);
});

test("resultatUE : UE acquise et crédits capitalisés si moyenne ≥ 10", () => {
  const acquise = L.resultatUE({ id: "u1", credits: 6 }, [{ id: "a", coefficient: 1 }], { a: { examen: 12 } });
  assert.equal(acquise.acquise, true);
  assert.equal(acquise.creditsAcquis, 6);
  const echec = L.resultatUE({ id: "u2", credits: 6 }, [{ id: "a", coefficient: 1 }], { a: { examen: 8 } });
  assert.equal(echec.acquise, false);
  assert.equal(echec.creditsAcquis, 0);
});

test("resultatSemestre : toutes UE acquises → Admis, crédits complets", () => {
  const r = L.resultatSemestre([
    { moyenne: 14, credits: 6, acquise: true, creditsAcquis: 6 },
    { moyenne: 12, credits: 9, acquise: true, creditsAcquis: 9 },
  ]);
  assert.equal(r.valide, true);
  assert.equal(r.parCompensation, false);
  assert.equal(r.creditsAcquis, 15);
  assert.equal(r.decision, "Admis");
});

test("resultatSemestre : moyenne ≥ 10 malgré une UE faible → Admis par compensation (tous crédits)", () => {
  const r = L.resultatSemestre([
    { moyenne: 14, credits: 20, acquise: true, creditsAcquis: 20 },
    { moyenne: 8, credits: 10, acquise: false, creditsAcquis: 0 },
  ]);
  assert.equal(r.valide, true);
  assert.equal(r.parCompensation, true);
  assert.equal(r.creditsAcquis, 30); // compensation → tout le semestre acquis
  assert.equal(r.decision, "Admis par compensation");
});

test("resultatSemestre : moyenne < 10 → Ajourné, seules les UE acquises capitalisent", () => {
  const r = L.resultatSemestre([
    { moyenne: 12, credits: 6, acquise: true, creditsAcquis: 6 },
    { moyenne: 5, credits: 24, acquise: false, creditsAcquis: 0 },
  ]);
  assert.equal(r.valide, false);
  assert.equal(r.creditsAcquis, 6);
  assert.equal(r.uesEnDette.length, 1);
  assert.equal(r.decision, "Ajourné");
});

test("mentionLMD : seuils 16/14/12/10, sinon null", () => {
  assert.equal(L.mentionLMD(16), "Très Bien");
  assert.equal(L.mentionLMD(14), "Bien");
  assert.equal(L.mentionLMD(12), "Assez Bien");
  assert.equal(L.mentionLMD(10), "Passable");
  assert.equal(L.mentionLMD(9.99), null);
  assert.equal(L.mentionLMD(null), null);
});
