import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// La RPC `factures_paginees` (mig. 136) renvoie l'élève À PLAT
// (prenom / nom / matricule), alors que tout le reste de l'application le lit
// sous `eleves: { … }`. En basculant la liste des factures sur cette RPC, la
// colonne « Élève » de l'écran Paiements s'est vidée EN SILENCE : rien ne
// plantait, la colonne était simplement blanche.
//
// `getFactures` remet la forme attendue à la frontière. Ce test verrouille ce
// contrat sans toucher au réseau : on remplace la réponse de la RPC.
const charger = () => chargerLib("paiements", ['export * from "@/lib/paiements.js";', 'export { supabase } from "@/lib/supabase.js";']);

async function avecReponse(data) {
  const ns = await charger();
  const original = ns.supabase.rpc;
  ns.supabase.rpc = async () => ({ data, error: null });
  try { return await ns.getFactures("ecole-1", {}); }
  finally { ns.supabase.rpc = original; }
}

test("getFactures : l'élève est replié sous `eleves`, comme partout ailleurs", async () => {
  const r = await avecReponse({
    total: 2,
    lignes: [
      { id: "f1", numero: "F-2026-0001", montant_total: 220000,
        prenom: "Aïssatou", nom: "Sané", matricule: "TT-26-0001" },
      { id: "f2", numero: "F-2026-0002", montant_total: 50000,
        prenom: "Mamadou", nom: "Sow", matricule: "TT-26-0002" },
    ],
  });

  assert.equal(r.total, 2);
  assert.deepEqual(r.lignes[0].eleves, { prenom: "Aïssatou", nom: "Sané", matricule: "TT-26-0001" },
    "sans ce repliage, la colonne « Élève » reste blanche");
  assert.equal(r.lignes[0].numero, "F-2026-0001", "les champs de la facture sont conservés");
  // Les champs à plat ne doivent PAS subsister : deux sources de vérité pour
  // la même donnée finissent toujours par diverger.
  assert.equal(r.lignes[0].prenom, undefined);
  assert.equal(r.lignes[1].eleves.nom, "Sow");
});

test("getFactures : une facture sans élève rattaché ne fabrique pas d'objet vide", async () => {
  // `factures.eleve_id` est nullable et la RPC fait un LEFT JOIN : une facture
  // orpheline doit donner `eleves = null`, pas `{prenom: null, …}` — sinon
  // l'affichage rendrait « null null ».
  const r = await avecReponse({ total: 1, lignes: [{ id: "f3", numero: "F-2026-0003", prenom: null, nom: null, matricule: null }] });
  assert.equal(r.lignes[0].eleves, null);
});

test("getFactures : réponse vide ou absente ne casse pas l'écran", async () => {
  assert.deepEqual(await avecReponse({ total: 0, lignes: [] }), { lignes: [], total: 0 });
  assert.deepEqual(await avecReponse(null), { lignes: [], total: 0 });
});
