// =====================================================================
//  Connexion des parents par numéro — migration 221
//
//  Ce que l'épreuve verrouille :
//   • les écritures d'un même numéro donnent le même identifiant, côté
//     navigateur, fonction Edge et base (trois copies d'une même règle) ;
//   • le numéro ne suffit jamais : l'activation exige le code parent, et
//     le code est effacé après usage ;
//   • deux personnes différentes sur un numéro = connexion refusée ;
//   • les fonctions d'activation sont fermées à l'appli (clé de service seule).
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const T = () => chargerLib("connexiontel", ['export * from "@/lib/connexionTelephone.js";']);
const SQL = readFileSync("supabase/migrations/221_connexion_parent_telephone.sql", "utf8");
const EDGE = readFileSync("supabase/functions/parent-telephone/index.ts", "utf8");

test("un numéro, une écriture", async () => {
  const { normaliserTelephone, emailTelephone, telephoneDuCompte } = await T();
  for (const t of ["77 123 45 67", "771234567", "+221 77 123 45 67", "00221 77-123-45-67", "(221) 771 234 567"]) {
    assert.equal(normaliserTelephone(t), "771234567", t);
  }
  assert.equal(normaliserTelephone("7712345"), null);
  assert.equal(normaliserTelephone("33 12"), null);
  assert.equal(normaliserTelephone(""), null);
  assert.equal(emailTelephone("771234567"), "221771234567@tel.gesprosn.org");
  assert.equal(telephoneDuCompte("221771234567@tel.gesprosn.org"), "77 123 45 67");
  assert.equal(telephoneDuCompte("awa@gmail.com"), null);
});

test("la même règle de numéro dans la base et la fonction Edge", () => {
  assert.match(SQL, /when d ~ '\^00221\\d\{9\}\$' then substr\(d, 6\)/);
  assert.match(SQL, /when d ~ '\^221\\d\{9\}\$' {3}then substr\(d, 4\)/);
  assert.match(EDGE, /\/\^00221\\d\{9\}\$\/\.test\(d\) \? d\.slice\(5\) : \/\^221\\d\{9\}\$\/\.test\(d\) \? d\.slice\(3\)/);
  assert.match(EDGE, /`221\$\{tel\}@tel\.gesprosn\.org`/);
});

test("le numéro seul ne suffit jamais ; le code ne sert qu'une fois", () => {
  //  Code inconnu OU attaché à un autre numéro : même réponse.
  assert.match(SQL, /if v_t is null or public\.tel_normalise\(v_t\.telephone\) is distinct from v_tel then\s+return jsonb_build_object\('statut', 'code_invalide'\);/);
  assert.match(SQL, /update tuteurs set code_acces = null where id = v_t\.id;/);
  //  Le lien rejoue la vérification, et refuse un compte qui n'est pas celui de ce numéro.
  assert.match(SQL, /v_v := public\._verifier_activation_telephone\(p_tel, p_code\);/);
  assert.match(SQL, /if v_email is distinct from \('221' \|\| v_tel \|\| '@tel\.gesprosn\.org'\) then/);
  assert.match(EDGE, /_verifier_activation_telephone[\s\S]*createUser[\s\S]*_lier_parent_telephone/);
});

test("deux personnes sur un numéro : refusé ; compte e-mail existant : pas de doublon", () => {
  assert.match(SQL, /if v_personnes > 1 then return jsonb_build_object\('statut', 'a_verifier'\);/);
  assert.match(SQL, /if v_email then return jsonb_build_object\('statut', 'compte_email'\);/);
});

test("activation réservée à la clé de service ; aucune table nouvelle", () => {
  for (const f of ["_verifier_activation_telephone(text, text)", "_lier_parent_telephone(uuid, text, text)", "_uid_compte_telephone(text)"]) {
    assert.match(SQL, new RegExp(`revoke all on function public\\.${f.replace(/[()]/g, "\\$&")} from public, anon, authenticated;`), f);
  }
  assert.doesNotMatch(SQL.replace(/--.*$/gm, ""), /create\s+table/i);
  assert.match(SQL, /where public\.a_acces\('codes_parents'\)/);
});
