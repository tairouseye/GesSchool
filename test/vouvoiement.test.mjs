// =====================================================================
//  Un seul ton : le vouvoiement (lot 5 de l'audit du 31/10/2026, P2-13)
//
//  Une directrice ou un comptable lisait « Ajoute ton équipe » sur un écran
//  et « Ajoutez un élève » sur le suivant. L'épreuve refuse qu'un texte
//  affiché tutoie l'utilisateur. Seule exception : la console super-admin,
//  lue par le seul éditeur de GesSchool.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : [];
  });
}

const TU = /(^|[ >«("`])(tu|ta|ton|tes|te|toi|Tu|Ta|Ton|Tes) [a-zàâéèêîôûç]/;
const IMPERATIF = /["'`>] ?(Ajoute|Clique|Crée|Rouvre|Vérifie|Choisis|Saisis|Renseigne|Reçois|Réessaie|Définis|Associe|Permets|Publie|Applique|Confirme) /;

test("aucun texte affiché ne tutoie l'utilisateur", () => {
  const fautes = [];
  for (const f of fichiers("src")) {
    if (/SuperAdmin\.jsx$/.test(f)) continue;
    readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
      const t = l.trim();
      if (/^(\/\/|\*|\/\*|\{\/\*)/.test(t)) return;
      const sansCommentaire = l.replace(/\s\/\/\s.*$/, "");
      if (TU.test(sansCommentaire) || IMPERATIF.test(sansCommentaire)) fautes.push(`${f}:${i + 1}: ${t.slice(0, 100)}`);
    });
  }
  assert.deepEqual(fautes, []);
});
