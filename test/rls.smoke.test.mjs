// Smoke-test RLS (isolation multi-tenant) — LECTURE SEULE.
// Ne s'exécute que si les variables d'environnement sont fournies (sinon skip),
// pour ne JAMAIS committer de clé ni dépendre du réseau en CI hors ligne :
//   GESSCHOOL_URL           = https://<projet>.supabase.co
//   GESSCHOOL_ANON          = clé publishable/anon
//   GESSCHOOL_PARENT_EMAIL  = e-mail d'un compte parent de test
//   GESSCHOOL_PARENT_PASS   = son mot de passe
//
//   Exemple :  GESSCHOOL_URL=… GESSCHOOL_ANON=… npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { GESSCHOOL_URL: URL, GESSCHOOL_ANON: ANON } = process.env;
const PARENT_EMAIL = process.env.GESSCHOOL_PARENT_EMAIL;
const PARENT_PASS = process.env.GESSCHOOL_PARENT_PASS;

const SENSIBLES = ["eleves", "notes", "bulletins", "paiements", "factures", "profils",
  "notifications", "personnels", "push_subscriptions", "affectations", "inscriptions"];

const skip = !URL || !ANON;

test("anonyme : aucune table sensible n'est lisible sans session", { skip }, async () => {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  for (const t of SENSIBLES) {
    const { data, error } = await sb.from(t).select("*").limit(5);
    // RLS correcte = refus explicite OU 0 ligne (jamais de fuite de données).
    assert.ok(error != null || (data ?? []).length === 0, `fuite anonyme sur ${t}: ${data?.length} lignes`);
  }
});

test("parent : ne voit que ses données et ne peut pas écrire", {
  skip: skip || !PARENT_EMAIL || !PARENT_PASS,
}, async () => {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: session, error } = await sb.auth.signInWithPassword({ email: PARENT_EMAIL, password: PARENT_PASS });
  assert.ok(!error && session?.user, `connexion parent échouée: ${error?.message}`);
  const uid = session.user.id;

  const { data: prof } = await sb.from("profils").select("id, user_id");
  const autres = (prof ?? []).filter((p) => p.user_id && p.user_id !== uid);
  assert.equal(autres.length, 0, "le parent voit des profils qui ne sont pas le sien");

  const mesProfils = new Set((prof ?? []).map((p) => p.id));
  const { data: notifs } = await sb.from("notifications").select("id, profil_id").limit(200);
  const fuite = (notifs ?? []).filter((n) => n.profil_id && !mesProfils.has(n.profil_id));
  assert.equal(fuite.length, 0, "le parent voit des notifications d'autrui");

  const { data: eleves } = await sb.from("eleves").select("id").limit(500);
  assert.ok((eleves ?? []).length < 50, `le parent voit trop d'élèves (${eleves?.length}) — pas seulement ses enfants`);

  const { error: eIns } = await sb.from("notifications").insert({ profil_id: [...mesProfils][0] ?? null, titre: "x", corps: "x" });
  assert.ok(eIns != null, "une insertion de notification par un parent a été ACCEPTÉE (faille)");

  await sb.auth.signOut();
});
