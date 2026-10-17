// =====================================================================
//  Le paiement anticipé — migration 202
//
//  🔴 LE CONTRAT QUI COMPTE LE PLUS. La facturation en lot saute un mois
//  déjà facturé en comparant des LIBELLÉS (« Scolarité — Novembre 2026 »).
//  Le libellé du mois est écrit deux fois : `libelleMois()` côté écran,
//  `_libelle_mois()` en SQL. S'ils divergent d'un accent ou d'une
//  majuscule, le mois payé d'avance est facturé une seconde fois — et la
//  famille reçoit une facture pour un mois qu'elle a déjà réglé.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const A = () => chargerLib("avance", ['export * from "@/lib/avance.js";']);
const P = () => chargerLib("paiements", ['export * from "@/lib/paiements.js";']);

test("🔴 le libellé du mois est IDENTIQUE en SQL et dans l'écran", async () => {
  const { libelleMois } = await P();
  const sql = readFileSync(new URL("../supabase/migrations/202_paiement_anticipe.sql", import.meta.url), "utf8");
  const bloc = /create or replace function public\._libelle_mois[\s\S]*?array\[([\s\S]*?)\]/.exec(sql);
  assert.ok(bloc, "fonction _libelle_mois introuvable dans la migration 202");
  const noms = [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(noms.length, 12);
  noms.forEach((nom, i) => {
    const mois = `2026-${String(i + 1).padStart(2, "0")}`;
    assert.equal(`${nom} 2026`, libelleMois(mois), `mois ${mois}`);
  });
});

test("🔴 le tiret du libellé est le même cadratin que la facturation en lot", async () => {
  const sql = readFileSync(new URL("../supabase/migrations/202_paiement_anticipe.sql", import.meta.url), "utf8");
  const js = readFileSync(new URL("../src/lib/paiements.js", import.meta.url), "utf8");
  assert.ok(js.includes("`${fr.libelle} — ${moisLbl}`"), "le lot ne construit plus le libellé comme prévu");
  assert.ok(sql.includes("fr.libelle || ' — ' || _libelle_mois(m.mois)"), "la migration ne construit plus le libellé comme prévu");
});

const LIGNES = [
  { mois: "2026-12", libelle_mois: "Décembre 2026", libelle: "Scolarité — Décembre 2026", montant: 35000 },
  { mois: "2026-11", libelle_mois: "Novembre 2026", libelle: "Scolarité — Novembre 2026", montant: 35000 },
  { mois: "2026-11", libelle_mois: "Novembre 2026", libelle: "Informatique — Novembre 2026", montant: "5000" },
  { mois: "2027-01", libelle_mois: "Janvier 2027", libelle: "Scolarité — Janvier 2027", montant: 35000 },
];

test("les lignes sont regroupées par mois, dans l'ordre, et additionnées", async () => {
  const { grouperParMois } = await A();
  const g = grouperParMois(LIGNES);
  assert.deepEqual(g.map((x) => x.mois), ["2026-11", "2026-12", "2027-01"]);
  assert.equal(g[0].total, 40000);
  assert.equal(g[0].lignes.length, 2);
  assert.deepEqual(grouperParMois(null), []);
});

test("par défaut, le premier mois proposé est coché (le cas fréquent)", async () => {
  const { grouperParMois, choixParDefaut } = await A();
  assert.deepEqual(choixParDefaut(grouperParMois(LIGNES)), ["2026-11"]);
  assert.deepEqual(choixParDefaut([]), []);
});

test("cocher un mois coche ceux d'avant ; décocher décoche ceux d'après", async () => {
  const { grouperParMois, basculerMois, totalDesMois } = await A();
  const g = grouperParMois(LIGNES);
  const trois = basculerMois(g, ["2026-11"], "2027-01");
  assert.deepEqual(trois, ["2026-11", "2026-12", "2027-01"]);
  assert.equal(totalDesMois(g, trois), 110000);
  assert.deepEqual(basculerMois(g, trois, "2026-12"), ["2026-11"]);
  assert.deepEqual(basculerMois(g, trois, "2026-11"), []);
  assert.deepEqual(basculerMois(g, trois, "inconnu"), trois);
});

test("résumé des mois pour une phrase", async () => {
  const { resumeMois } = await A();
  assert.equal(resumeMois(["Novembre 2026"]), "Novembre 2026");
  assert.equal(resumeMois(["Novembre 2026", "Décembre 2026"]), "Novembre et Décembre 2026");
  assert.equal(resumeMois(["Décembre 2026", "Janvier 2027"]), "Décembre 2026 et Janvier 2027");
  assert.equal(resumeMois([]), "");
});

test("🔴 une avance EN ATTENTE réserve ses mois pour la facturation en lot", async () => {
  const { libellesReserves } = await A();
  const r = libellesReserves([
    { eleve_id: "e1", statut: "en_attente", avance_lignes: [{ libelle: "Scolarité — Novembre 2026" }] },
    //  Validée : la facture existe, le lot la voit déjà par ses lignes.
    { eleve_id: "e2", statut: "valide", avance_lignes: [{ libelle: "Scolarité — Novembre 2026" }] },
    //  Déclaration ordinaire sur facture : ne réserve rien.
    { eleve_id: "e3", statut: "en_attente", facture_id: "f1", avance_lignes: null },
  ]);
  assert.deepEqual(Object.keys(r), ["e1"]);
  assert.ok(r.e1.has("Scolarité — Novembre 2026"));
});

test("🔴 deux parents : la carte dit ce que l'AUTRE a déjà payé d'avance", async () => {
  const { avancesCouvertes } = await A();
  const r = avancesCouvertes([
    { id: "d1", avance: "Novembre 2026", statut: "en_attente", declarant: "Awa Diop" },
    { id: "d2", avance: "Décembre 2026", statut: "valide", declarant: "Vous" },
    //  Rejetée : le mois redevient libre, on ne l'affiche plus comme couvert.
    { id: "d3", avance: "Janvier 2027", statut: "rejete", declarant: "Awa Diop" },
    //  Déclaration sur facture : pas une avance.
    { id: "d4", avance: null, statut: "en_attente", declarant: "Awa Diop" },
  ]);
  assert.deepEqual(r, [
    { id: "d1", mois: "Novembre 2026", enAttente: true, par: "Awa Diop" },
    { id: "d2", mois: "Décembre 2026", enAttente: false, par: null },
  ]);
});
