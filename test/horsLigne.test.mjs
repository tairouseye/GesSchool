// =====================================================================
//  Lot 4 de l'audit du 31/10/2026 — espace parent sur le terrain.
//
//  Ce que l'épreuve verrouille :
//   • une lecture qui échoue POUR CAUSE DE RÉSEAU rend la dernière copie ;
//     un refus du serveur n'est jamais masqué par une copie ;
//   • les copies sont rangées sous le compte, et la déconnexion les efface
//     toutes (téléphone partagé) ;
//   • la reprise hors ligne du profil ne vaut que pour un parent ;
//   • `mes_enfants` rend la devise, en FIN de liste, et l'espace parent
//     n'écrit plus « XOF » en dur.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const H = () => chargerLib("horsligne", ['export * from "@/lib/horsLigne.js";']);

function fauxStockage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}

test("erreur réseau : reconnue ; refus serveur : non", async () => {
  const { estErreurReseau } = await H();
  assert.equal(estErreurReseau(new TypeError("Failed to fetch"), true), true);
  assert.equal(estErreurReseau({ message: "TypeError: Load failed" }, true), true);
  assert.equal(estErreurReseau({ message: "permission denied for function" }, true), false);
  assert.equal(estErreurReseau({ message: "n'importe quoi" }, false), true);
});

test("hors ligne : la dernière copie revient, un refus remonte", async () => {
  const { creerCache, avecRepli } = await H();
  const c = creerCache(fauxStockage());
  c.definirUtilisateur("parent-1");
  assert.deepEqual(await avecRepli("notes:e1", async () => [{ note: 14 }], c), [{ note: 14 }]);
  assert.deepEqual(await avecRepli("notes:e1", async () => { throw new TypeError("Failed to fetch"); }, c), [{ note: 14 }]);
  await assert.rejects(avecRepli("notes:e1", async () => { throw new Error("permission denied"); }, c), /permission denied/);
  //  Sans copie, l'erreur réseau remonte : l'écran dit qu'il n'a rien.
  await assert.rejects(avecRepli("notes:e2", async () => { throw new TypeError("Failed to fetch"); }, c), /Failed to fetch/);
});

test("copies rangées par compte, toutes effacées à la déconnexion", async () => {
  const { creerCache } = await H();
  const st = fauxStockage();
  st.setItem("autre_cle", "garde");
  const c = creerCache(st);
  c.definirUtilisateur("parent-1");
  c.ecrire("mesEnfants", [1]);
  c.definirUtilisateur("parent-2");
  assert.equal(c.lire("mesEnfants"), null, "un autre compte ne lit pas les copies du premier");
  c.ecrire("mesEnfants", [2]);
  c.vider();
  assert.deepEqual([...st._m.keys()], ["autre_cle"]);
  c.definirUtilisateur(null);
  c.ecrire("x", 1);
  assert.equal(st._m.size, 1, "sans compte, rien ne s'écrit");
});

test("la déconnexion vide le cache, la reprise hors ligne est réservée aux parents", () => {
  const auth = readFileSync("src/contextes/AuthContext.jsx", "utf8");
  assert.match(auth, /const deconnexion = \(\) => \{ viderCacheHorsLigne\(\);/);
  assert.match(auth, /if \(evenement === "SIGNED_OUT"\) viderCacheHorsLigne\(\);/);
  assert.match(auth, /if \(rolesLus\.includes\("parent"\)\) cacheHL\.ecrire\("auth"/);
  assert.match(auth, /!copie\.roles\?\.includes\("parent"\)\) return false;/);
});

test("les lectures parent passent par le repli, les écritures non", () => {
  const p = readFileSync("src/lib/parent.js", "utf8").replace(/\r/g, "");
  for (const f of ["mesEnfants", "enfantNotes", "enfantFactures", "enfantAbsences", "enfantEmploi", "enfantEcheancier"]) {
    assert.match(p, new RegExp(`function ${f}\\([^)]*\\) \\{\\n  return avecRepli\\(`), f);
  }
  for (const f of ["declarerPaiement", "declarerAvance", "justifierAbsenceParent", "demanderDocument"]) {
    assert.doesNotMatch(p, new RegExp(`function ${f}\\([^)]*\\) \\{\\n  return avecRepli\\(`), f);
  }
});

test("220 : mes_enfants rend la devise en fin de liste ; plus de XOF en dur côté parent", () => {
  const sql = readFileSync("supabase/migrations/220_mes_enfants_devise.sql", "utf8");
  assert.match(sql, /couleur_primaire text, couleur_secondaire text,\s+devise text\)/);
  assert.match(sql, /grant execute on function public\.mes_enfants\(\) to authenticated;/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /create\s+table/i);
  const page = readFileSync("src/pages/ParentEnfant.jsx", "utf8").replace(/\/\/.*$/gm, "");
  assert.equal((page.match(/XOF/g) || []).length, 2, "seuls les replis createContext et Provider gardent XOF");
});
