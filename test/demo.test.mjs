// =====================================================================
//  Démonstration sans compte — toute nouvelle table reste en lecture seule
//
//  La migration 216 pose le trigger trg_demo_lecture_seule sur les tables
//  qui EXISTENT ce jour-là. Une table créée plus tard naîtrait sans verrou,
//  et les visiteurs de la démo pourraient y écrire. Toute migration
//  postérieure qui crée une table doit donc rappeler
//  `public.demo_proteger_tables()`.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DOSSIER = path.join(process.cwd(), "supabase", "migrations");

test("migrations après 216 : une table créée est protégée pour la démo", () => {
  const fautives = fs.readdirSync(DOSSIER)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) > 216)
    .filter((f) => {
      const sql = fs.readFileSync(path.join(DOSSIER, f), "utf8").replace(/--.*$/gm, "");
      return /create\s+table/i.test(sql) && !/demo_proteger_tables\s*\(/i.test(sql);
    });
  assert.deepEqual(fautives, [], "Ajouter `select public.demo_proteger_tables();` à la fin de ces migrations.");
});

test("la 217 laisse passer les seuls marquages de lecture", () => {
  const sql = fs.readFileSync(path.join(DOSSIER, "217_demo_marquages_lecture.sql"), "utf8");
  assert.match(sql, /when 'notifications' then array\['lu'\]/);
  assert.match(sql, /when 'messages'\s+then array\['lu'\]/);
  assert.match(sql, /when 'bulletins'\s+then array\['consulte_le'\]/);
  assert.match(sql, /before insert or update or delete on public\.%I/);
  assert.doesNotMatch(sql, /'insert or delete'/);
});

test("la 218 cache les comptes réels aux visiteurs de la démo", () => {
  const sql = fs.readFileSync(path.join(DOSSIER, "218_demo_donnees_personnelles.sql"), "utf8");
  //  Les deux RPC, qui ignorent la RLS, portent leur propre filtre…
  assert.match(sql, /function public\.membres_ecole\(\)[\s\S]*not est_compte_demo\(\) or p\.id = auth\.uid\(\)/);
  assert.match(sql, /function public\.invitations_ecole\(\)[\s\S]*and not est_compte_demo\(\)/);
  //  … et la lecture directe des tables est fermée par des policies restrictives.
  assert.match(sql, /on public\.profils\s+as restrictive for select to authenticated\s+using \(not public\.est_compte_demo\(\) or id = auth\.uid\(\)\)/);
  assert.match(sql, /on public\.invitations\s+as restrictive for select to authenticated\s+using \(not public\.est_compte_demo\(\)\)/);
});

test("la 216 protège les tables, les fichiers et laisse lire les notifications", () => {
  const sql = fs.readFileSync(path.join(DOSSIER, "216_demo_sans_compte.sql"), "utf8");
  assert.match(sql, /select public\.demo_proteger_tables\(\);/);
  assert.match(sql, /for each row execute function public\.demo_lecture_seule\(\)/);
  assert.match(sql, /'notifications' then 'insert or delete'/);
  for (const op of ["insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`as restrictive for ${op} to authenticated`));
  }
});
