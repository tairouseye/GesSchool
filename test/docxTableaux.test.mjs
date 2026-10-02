// =====================================================================
//  Extraction des tableaux d'un .docx — migration 165, point 15
//
//  Deux familles d'épreuves, et la distinction compte :
//
//   • les premières portent sur des XML écrits à la main — elles valident
//     les RÈGLES de lecture (runs recollés, entités, fusion, imbrication) ;
//   • les dernières ouvrent le VRAI document de l'école et vérifient des
//     faits relevés à la main sur son contenu (81 lignes, quatre domaines,
//     l'en-tête qui contredit le nom du fichier).
//
//  ⚠️ `fixtures-ief.json` est PRODUIT par cet extracteur : le comparer à sa
//  propre sortie ne prouverait rien. On vérifie donc ici des faits
//  indépendants, constatés en lisant le document.
//
//  Si le document n'est pas présent (poste de dev sans les pièces de
//  l'école), les épreuves qui en dépendent sont ignorées, pas silencieuses.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chargerLib } from "./bundle.helper.mjs";

const D = () => chargerLib("docxtab", ['export * from "@/lib/docxTableaux.js";']);
const DOC = path.join(process.cwd(), "docs", "CE1 juin.docx");
const PRESENT = fs.existsSync(DOC);
const REEL = JSON.parse(fs.readFileSync(new URL("./fixtures-ief.json", import.meta.url), "utf8"));

// --- Lecture du XML : les pièges du format ------------------------------
test("les runs d'un même mot sont recollés sans séparateur", async () => {
  const { extraireTableaux } = await D();
  // Word coupe un mot en plusieurs « runs » dès qu'un caractère change de
  // style. Insérer une espace entre eux casserait « Sous-domaine 1COMMUNI… »
  // et le marqueur de sous-domaine ne serait plus reconnu.
  const xml = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Sous-domaine 1</w:t></w:r>`
    + `<w:r><w:t>COMMUNICATION ORALE</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
  assert.deepEqual(extraireTableaux(xml), [[["Sous-domaine 1COMMUNICATION ORALE"]]]);
});

test("les entités XML sont décodées", async () => {
  const { extraireTableaux } = await D();
  const xml = `<w:tbl><w:tr><w:tc><w:t>l&apos;&#233;cole &amp; l&#x27;IEF</w:t></w:tc></w:tr></w:tbl>`;
  assert.deepEqual(extraireTableaux(xml), [[["l'école & l'IEF"]]]);
});

test("🔴 une ligne courte le reste : la fusion ne doit pas être comblée", async () => {
  const { extraireTableaux } = await D();
  // Word ne répète pas une cellule fusionnée. Le NOMBRE de cellules est
  // l'information qui dit « semaine indéterminable » ; compléter la ligne
  // ici détruirait le signal avant qu'il serve.
  const xml = `<w:tbl><w:tr><w:tc><w:t>a</w:t></w:tc><w:tc><w:t>b</w:t></w:tc><w:tc><w:t>c</w:t></w:tc></w:tr>`
    + `<w:tr><w:tc><w:t>fusion</w:t></w:tc></w:tr></w:tbl>`;
  const t = extraireTableaux(xml)[0];
  assert.equal(t[0].length, 3);
  assert.equal(t[1].length, 1, "la ligne fusionnée garde sa cellule unique");
});

test("un tableau imbriqué ne mêle pas ses lignes au tableau porteur", async () => {
  const { extraireTableaux } = await D();
  const xml = `<w:tbl><w:tr><w:tc><w:t>dehors</w:t>`
    + `<w:tbl><w:tr><w:tc><w:t>dedans</w:t></w:tc></w:tr></w:tbl>`
    + `</w:tc></w:tr></w:tbl>`;
  const tx = extraireTableaux(xml);
  assert.equal(tx.length, 1, "un seul tableau de premier niveau");
  assert.equal(tx[0].length, 1, "une seule ligne de premier niveau");
});

test("l'en-tête s'arrête au premier tableau", async () => {
  const { extraireEntete } = await D();
  const xml = `<w:p><w:r><w:t>EN-TETE</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:t>DEDANS</w:t></w:tc></w:tr></w:tbl>`;
  assert.equal(extraireEntete(xml), "EN-TETE");
  assert.equal(extraireEntete(""), "");
  assert.equal(extraireEntete(null), "");
});

test("un document sans tableau ne produit rien, sans planter", async () => {
  const { extraireTableaux } = await D();
  assert.deepEqual(extraireTableaux("<w:p><w:t>rien</w:t></w:p>"), []);
  assert.deepEqual(extraireTableaux(""), []);
  assert.deepEqual(extraireTableaux(null), []);
});

// --- Le vrai document de l'école ---------------------------------------
//  ⚠️ Faits relevés à la main sur `docs/CE1 juin.docx`. Ils ne viennent pas
//  d'une sortie de ce module, mais de sa lecture par un humain.
test("🔴 le vrai .docx de l'école se lit en entier",
  { skip: PRESENT ? false : "docs/CE1 juin.docx absent de ce poste" }, async () => {
    const { lireDocx } = await D();
    const { entete, tableaux } = await lireDocx(fs.readFileSync(DOC));

    assert.equal(tableaux.length, 1, "le document ne porte qu'UN tableau");
    assert.equal(tableaux[0].length, 81, "et ce tableau compte 81 lignes");

    // L'en-tête nomme l'IEF, le cours et le mois — et contredit le nom du
    // fichier, ce qui est tout l'objet de la confirmation à l'écran.
    assert.match(entete, /IEF DE SANGALKAM/);
    assert.match(entete, /CM1/);
    assert.match(entete, /MOIS DE AVRIL/);
    assert.ok(!/CE1/.test(entete), "le document ne contient nulle part « CE1 »");
    assert.ok(!/juin/i.test(entete), "ni « juin »");

    const rows = tableaux[0];
    // La ligne d'en-tête du tableau : domaine à gauche, puis 4 semaines.
    assert.equal(rows[0][0], "Langue et communication");
    assert.deepEqual(rows[0].slice(1), ["Semaine 1", "Semaine 2", "Semaine 3", "Semaine 4"]);

    // 🔴 Les largeurs IRRÉGULIÈRES sont l'information clé : elles signalent
    // les cellules fusionnées. Les lisser ici reviendrait à inventer des
    // semaines plus loin.
    assert.equal(rows[2].length, 2, "ligne 3 fusionnée (palier)");
    assert.equal(rows[3].length, 5, "ligne 4 pleine");
    assert.ok(new Set(rows.map((r) => r.length)).size > 2, "plusieurs largeurs coexistent");

    // Les quatre domaines, chacun dans sa graphie propre.
    const plat = rows.map((r) => r.join(" ~ "));
    assert.ok(plat.some((t) => /^DOMAINE ~ MATHEMATIQUES/.test(t)), "« DOMAINE | MATHEMATIQUES »");
    assert.ok(plat.some((t) => /^ESVS ~ SOUS-DOMMAINE 1/.test(t)), "« ESVS | SOUS-DOMMAINE 1 » (deux M)");
    assert.ok(plat.some((t) => /^EPSA ~ SOUS DOMAINE 2/.test(t)), "« EPSA | SOUS DOMAINE 2 » (sans tiret)");
  });

test("🔴 du fichier Word aux lignes de programmation, sans intermédiaire",
  { skip: PRESENT ? false : "docs/CE1 juin.docx absent de ce poste" }, async () => {
    const { lireDocx } = await D();
    const { lireEntete, analyserTableau, resumer } =
      await chargerLib("progief2", ['export * from "@/lib/programmationIEF.js";']);
    const { entete, tableaux } = await lireDocx(fs.readFileSync(DOC));

    // 🔴 Le fichier s'appelle « CE1 juin » et contient du CM1 d'avril.
    // C'est l'en-tête qui fait foi, et c'est ce que l'écran affichera.
    assert.deepEqual(lireEntete(entete), { mois: 4, cours: "CM1" });

    const r = analyserTableau(tableaux[0]);
    const s = resumer(r.lignes);
    assert.deepEqual(r.domaines, ["Langue et communication", "MATHEMATIQUES", "ESVS", "EPSA"]);
    assert.ok(s.total >= 40, `au moins 40 contenus lus, obtenu ${s.total}`);
    // Chaque domaine rend quelque chose : la garde contre la perte muette.
    for (const d of r.domaines) {
      assert.ok((s.parDomaine[d] || 0) > 0, `le domaine « ${d} » ne rend aucune ligne`);
    }
    assert.ok(s.activites.includes("Récitation"));
  });

test("un fichier qui n'est pas un .docx est refusé clairement", async () => {
  const { lireDocx } = await D();
  // Une archive zip valide mais sans `word/document.xml` : le dire, plutôt
  // que de rendre un document vide que l'écran prendrait pour « rien à lire ».
  const { default: JSZip } = await import("jszip");
  const z = new JSZip();
  z.file("autre.txt", "pas un document Word");
  const buf = await z.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => lireDocx(buf), /pas un document Word/);
});
