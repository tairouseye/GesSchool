// =====================================================================
//  Cloche du personnel — migration 219 (lot 2 de l'audit du 31/10/2026)
//
//  Ce que l'épreuve verrouille :
//   • le destinataire vient des CASES d'accès (`personnel_acces`, comme
//     `a_acces`) et des promoteurs — aucun rôle écrit en dur ;
//   • chaque catégorie émise par la base a son écran dans la cloche ;
//   • l'aide `_notifier_personnel` n'est pas appelable depuis l'appli ;
//   • la cloche filtre sur son propre destinataire (le super-admin lit
//     toute la table pour le dépannage).
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SQL = readFileSync("supabase/migrations/219_notifications_personnel.sql", "utf8");
const LIB = readFileSync("src/lib/notificationsPersonnel.js", "utf8");

test("219 : le destinataire est celui qui peut traiter", () => {
  assert.match(SQL, /from personnel_acces pa\s+where pa\.ecole_id = p_ecole and pa\.boite = public\.boite_de_cle\(p_cle\)/);
  assert.match(SQL, /pr\.role = 'admin_ecole'/);
  assert.doesNotMatch(SQL, /role (=|in) \(?'(comptable|secretaire|direction|surveillant)'/);
  assert.match(SQL, /revoke all on function public\._notifier_personnel\([^)]*\) from public, anon, authenticated;/);
  assert.doesNotMatch(SQL.replace(/--.*$/gm, ""), /create\s+table/i);
});

test("219 : chaque catégorie émise a son écran dans la cloche", () => {
  const emises = [...SQL.matchAll(/'(paiement_declare|justificatif|message_parent|demande_document)', (?:new\.eleve_id|null)\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(emises)].sort(), ["demande_document", "justificatif", "message_parent", "paiement_declare"]);
  for (const c of emises) assert.match(LIB, new RegExp(`${c}: "/`), `catégorie ${c} sans lien`);
});

test("la cloche ne lit que les notifications de son destinataire", () => {
  const lectures = LIB.match(/from\("notifications"\)/g).length;
  const filtres = LIB.match(/\.eq\("destinataire_id", profilId\)/g).length;
  assert.equal(filtres, lectures);
});
