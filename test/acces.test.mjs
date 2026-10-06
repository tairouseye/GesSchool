// =====================================================================
//  Les accès du personnel, par cases à cocher
//
//  🔴 CE QUE CES ÉPREUVES PROTÈGENT. On remplace « choisir un rôle » par
//  « cocher des cases ». La bascule ne doit DÉPLACER AUCUN DROIT : le jour
//  où elle sera posée, chaque membre doit retrouver exactement ce qu'il
//  avait. C'est l'épreuve de fidélité ci-dessous, et c'est elle qui décide
//  si l'on bascule ou non.
//
//  ⚠️ ELLE M'A DÉJÀ ARRÊTÉ DEUX FOIS pendant l'écriture :
//   1. j'avais rendu les accueils d'espace « dérivés » (une case dans
//      l'espace ⇒ son accueil s'ouvre). Des clés comme Élèves, Annonces et
//      Messagerie figurant dans DEUX espaces, le comptable gagnait
//      l'accueil de Pédagogie et la direction celui de Gestion — huit
//      écarts pour une commodité. L'accueil est redevenu une case.
//   2. j'avais fusionné « Documents » et « À signer » en croyant qu'ils
//      partageaient une table sans recours. Vérifié dans la base :
//      `documents_select` distingue déjà la gestion de
//      `signataire_profil = auth.uid()`. La fusion aurait accordé
//      « Documents » à toute personne pouvant signer — dont les
//      enseignants. Elle a été retirée.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chargerLib } from "./bundle.helper.mjs";

const A = await chargerLib("acces", [
  'export * from "@/lib/acces.js";',
  'export { ESPACES, itemPourType } from "@/lib/espaces.js";',
  'export { peutVoir } from "@/lib/permissions.js";',
]);
const { FUSIONS, DERIVEES, POUVOIRS, MODELES, ESPACES_SANS_CASES,
        boiteDeCle, clesDeBoite, arbreDesCases, boitesDeLArbre, boitesDuModele,
        aAcces, aPouvoir, ESPACES, itemPourType, peutVoir } = A;

const CLES = [...new Set(ESPACES.flatMap((e) => e.items.map((i) => i.cle)))];
const ROLES = MODELES.map((m) => m.id);
const MIXTE = { type_etablissement: "superieur", paliers: ["elementaire", "college", "lycee", "universite"] };

//  Les clés de Pilotage ne sont pas des cases : elles sont gardées par
//  `estPromoteur` (ROUTES_PROMOTEUR), un autre mécanisme.
//
//  ⚠️ EXCLUSIVES à Pilotage, et c'est une correction de cette épreuve : des
//  clés transverses (Membres, À signer) figurent AUSSI dans Pilotage, et les
//  compter comme « clés de Pilotage » les rendait non cochables partout
//  ailleurs — alors que Membres est une case légitime de Gestion, de
//  Pédagogie et de RH.
const CLES_PILOTAGE = ESPACES
  .filter((e) => ESPACES_SANS_CASES.includes(e.id))
  .flatMap((e) => e.items.map((i) => i.cle))
  .filter((c) => !ESPACES
    .filter((e) => !ESPACES_SANS_CASES.includes(e.id))
    .some((e) => e.items.some((i) => i.cle === c)));
const CLES_COCHABLES = CLES.filter((c) => !CLES_PILOTAGE.includes(c) && !DERIVEES.includes(c));

// ---------------------------------------------------------------------
//  1. La fidélité — l'épreuve qui autorise (ou non) la bascule
// ---------------------------------------------------------------------

//  Le SEUL écart voulu, avec sa raison. Toute autre différence fait échouer
//  l'épreuve : c'est un droit déplacé en silence.
const ECARTS_ASSUMES = [
  {
    modele: "secretaire", cle: "recouvrement", attendu: true,
    pourquoi:
      "La case « Encaissements & relances » regroupe Paiements et Recouvrement, "
      + "parce que les deux lisent `factures` : les séparer ne donnerait qu'un "
      + "verrou d'affichage. Le secrétariat gagne donc l'ÉCRAN Recouvrement — "
      + "où il voyait déjà tous les impayés depuis Paiements — mais l'ACTE de "
      + "relancer reste tenu par le pouvoir `p_relancer`, qu'il n'a pas.",
  },
];

test("🔴 la bascule ne déplace aucun droit, sauf l'écart assumé", () => {
  const trouves = [];
  for (const m of MODELES) {
    const acces = { boites: boitesDuModele(m.id) };
    for (const cle of CLES_COCHABLES) {
      const avant = peutVoir([m.id], cle);
      const apres = aAcces(acces, cle);
      if (avant !== apres) trouves.push({ modele: m.id, cle, attendu: apres });
    }
  }
  const attendus = ECARTS_ASSUMES.map((e) => `${e.modele}/${e.cle}=${e.attendu}`).sort();
  assert.deepEqual(trouves.map((t) => `${t.modele}/${t.cle}=${t.attendu}`).sort(), attendus,
    "un droit a changé sans être inscrit dans ECARTS_ASSUMES, avec sa raison");
});

test("🔴 une fusion n'élargit pas sans qu'un pouvoir le compense", () => {
  //  C'est cette épreuve qui a condamné la fusion « Documents + À signer » :
  //  `signatures` est ouvert à tout le personnel, `certificats` à la gestion
  //  seule. Les fusionner accordait Documents aux enseignants.
  const COMPENSEES = {
    encaissement: "p_relancer",   // cf. ECARTS_ASSUMES
  };
  for (const f of FUSIONS) {
    const jeux = [...new Set(f.cles.map((c) => ROLES.filter((r) => peutVoir([r], c)).sort().join("+")))];
    if (jeux.length === 1) continue;             // homogène : rien à compenser
    assert.ok(COMPENSEES[f.id],
      `la fusion « ${f.id} » regroupe des écrans ouverts à des rôles différents `
      + `(${jeux.join(" ≠ ")}) : soit on la défait, soit on inscrit ici le pouvoir qui compense`);
    assert.ok(POUVOIRS.some((p) => p.id === COMPENSEES[f.id]),
      `le pouvoir compensateur « ${COMPENSEES[f.id]} » n'existe pas`);
  }
});

// ---------------------------------------------------------------------
//  2. L'arbre
// ---------------------------------------------------------------------

test("🔴 toute clé de menu est couverte par exactement une case", () => {
  //  Garde-fou de fond : un écran neuf ne doit pas pouvoir arriver sans
  //  permission. S'il manque ici, c'est qu'il n'est dans aucun espace
  //  cochable — à rattacher, ou à déclarer dérivé avec sa raison.
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  const boites = boitesDeLArbre(arbre);
  const orphelines = CLES_COCHABLES.filter((c) => !boites.includes(boiteDeCle(c)));
  assert.deepEqual(orphelines, [], "clé(s) de menu sans case");
  //  Et l'inverse : une case qui ne correspond à aucune clé est un reste.
  const inutiles = boites.filter((b) => !clesDeBoite(b).some((c) => CLES.includes(c)));
  assert.deepEqual(inutiles, [], "case(s) sans clé de menu");
});

test("une case n'apparaît jamais deux fois dans un même groupe", () => {
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  for (const e of arbre) {
    for (const g of e.groupes) {
      const ids = g.cases.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length,
        `doublon dans ${e.label} / ${g.groupe || "—"} : ${ids.join(", ")}`);
    }
  }
  //  Une clé transverse (Membres, Paramètres) figure dans plusieurs espaces :
  //  la liste à plat doit la compter UNE fois, sinon « tout cocher » et
  //  l'affichage se contredisent.
  const plat = boitesDeLArbre(arbre);
  assert.equal(new Set(plat).size, plat.length);
});

test("une case fusionnée dit ce qu'elle couvre", () => {
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  const toutes = arbre.flatMap((e) => e.groupes.flatMap((g) => g.cases));
  for (const f of FUSIONS) {
    const c = toutes.find((x) => x.id === f.id);
    if (!c) continue;   // la fusion peut ne pas être pertinente pour ce palier
    assert.equal(c.couvre?.length, f.cles.length,
      `la case « ${f.id} » doit nommer les ${f.cles.length} écrans qu'elle ouvre`);
    //  Les libellés, pas les clés techniques : le promoteur doit reconnaître
    //  ses écrans. Le piège était de chercher le libellé dans le seul espace
    //  courant, ce qui rendait « certificats » au lieu de « Documents ».
    for (const lib of c.couvre) assert.ok(!f.cles.includes(lib), `« ${lib} » est une clé, pas un libellé`);
  }
});

test("Pilotage reste hors des cases", () => {
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  assert.ok(!arbre.some((e) => ESPACES_SANS_CASES.includes(e.espace)));
  //  Et aucune de ses clés ne se retrouve dans une case par un autre chemin.
  const boites = boitesDeLArbre(arbre);
  for (const c of CLES_PILOTAGE) assert.ok(!boites.includes(c), `${c} ne doit pas être cochable`);
});

test("l'arbre suit les paliers de l'établissement", () => {
  const ecole = { paliers: ["elementaire"] };
  const arbre = arbreDesCases(ecole, (i) => itemPourType(i, ecole));
  const boites = boitesDeLArbre(arbre);
  //  Une école élémentaire n'a pas à régler la bibliothèque universitaire.
  assert.ok(!boites.includes("biblio_circulation"));
  assert.ok(!boites.includes("notes_lmd"));
  //  Mais elle a ses notes et ses bulletins.
  assert.ok(boites.includes("notes_bulletins"));
});

// ---------------------------------------------------------------------
//  3. Les boîtes, les dérivées, les pouvoirs
// ---------------------------------------------------------------------

test("boiteDeCle et clesDeBoite sont réciproques", () => {
  for (const f of FUSIONS) {
    for (const c of f.cles) assert.equal(boiteDeCle(c), f.id);
    assert.deepEqual(clesDeBoite(f.id).sort(), [...f.cles].sort());
  }
  //  Une clé sans fusion est sa propre boîte.
  assert.equal(boiteDeCle("comptabilite"), "comptabilite");
  assert.deepEqual(clesDeBoite("comptabilite"), ["comptabilite"]);
});

test("🔴 « À signer » n'est pas une case : c'est un lien", () => {
  //  `documents_select` l'accorde sur `signataire_profil = auth.uid()`, ce
  //  qui ne dépend d'aucun droit. En faire une case laisserait croire qu'on
  //  peut la retirer à quelqu'un dont un document attend la signature.
  assert.ok(DERIVEES.includes("signatures"));
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  assert.ok(!boitesDeLArbre(arbre).includes("signatures"));
  //  Elle reste ouverte à qui a au moins un accès…
  assert.equal(aAcces({ boites: ["comptabilite"] }, "signatures"), true);
  //  …et fermée à qui n'en a aucun.
  assert.equal(aAcces({ boites: [] }, "signatures"), false);
});

test("les pouvoirs ne se confondent pas avec les écrans", () => {
  const arbre = arbreDesCases(MIXTE, (i) => itemPourType(i, MIXTE));
  const boites = boitesDeLArbre(arbre);
  for (const p of POUVOIRS) {
    assert.ok(!boites.includes(p.id), `${p.id} ne doit pas être une case de l'arbre`);
    assert.ok(p.label && p.aide, `${p.id} doit porter un libellé et une aide`);
  }
  //  Une enseignante saisit les notes mais ne diffuse pas : c'est la règle
  //  du circuit du bulletin (migration 166), et elle doit survivre.
  const ens = { boites: boitesDuModele("enseignant") };
  assert.equal(aAcces(ens, "notes"), true);
  assert.equal(aPouvoir(ens, "p_bulletins_diffuser"), false);
  const dir = { boites: boitesDuModele("direction") };
  assert.equal(aPouvoir(dir, "p_bulletins_diffuser"), true);
  //  Et le secrétariat encaisse sans relancer.
  const sec = { boites: boitesDuModele("secretaire") };
  assert.equal(aAcces(sec, "paiements"), true);
  assert.equal(aPouvoir(sec, "p_relancer"), false);
  assert.equal(aPouvoir({ boites: boitesDuModele("comptable") }, "p_relancer"), true);
});

test("le promoteur a tout, sans condition", () => {
  const prom = { total: true, boites: [] };
  for (const cle of CLES) assert.equal(aAcces(prom, cle), true, cle);
  for (const p of POUVOIRS) assert.equal(aPouvoir(prom, p.id), true, p.id);
});

test("entrées vides : fail-closed", () => {
  for (const a of [undefined, null, {}, { boites: [] }]) {
    assert.equal(aAcces(a, "paiements"), false);
    assert.equal(aPouvoir(a, "p_relancer"), false);
  }
  assert.equal(aAcces({ boites: ["paiements"] }, null), false);
  assert.equal(aAcces({ boites: ["paiements"] }, undefined), false);
});

// ---------------------------------------------------------------------
//  4. La base et le JS ne doivent pas diverger
// ---------------------------------------------------------------------

test("🔴 la migration 175 reproduit EXACTEMENT la carte et les modèles du JS", () => {
  //  Deux implémentations de la même règle, c'est deux vérités à maintenir
  //  — le défaut que l'audit a relevé ailleurs. Ici elles sont inévitables
  //  (l'écran a besoin du JS, les policies ont besoin du SQL), alors on les
  //  compare : les blocs SQL sont GÉNÉRÉS depuis ce fichier, et cette
  //  épreuve échoue si quelqu'un les édite à la main d'un seul côté.
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "175_acces_personnel.sql"), "utf8");

  //  a) la carte clé → boîte
  const paires = [...sql.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
  const attendu = FUSIONS.flatMap((f) => f.cles.map((c) => [c, f.id]));
  assert.deepEqual(
    paires.map((p) => p.join("→")).sort(),
    attendu.map((p) => p.join("→")).sort(),
    "la carte SQL ne correspond plus aux FUSIONS : régénérez le bloc");

  //  b) les modèles, un par un.
  //  Lecture par chaînes et non par expression régulière : les crochets et
  //  les parenthèses d'un littéral `array[...]` demandent trois niveaux
  //  d'échappement, et c'est exactement là que ce test s'est cassé la
  //  première fois.
  for (const m of MODELES) {
    const marqueur = `('${m.id}', array[`;
    const debut = sql.indexOf(marqueur);
    assert.ok(debut >= 0, `le modèle « ${m.id} » manque dans la migration`);
    const fin = sql.indexOf("])", debut);
    assert.ok(fin > debut, `le modèle « ${m.id} » n'est pas refermé`);
    const dansSql = sql.slice(debut + marqueur.length, fin)
      .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean).sort();
    assert.deepEqual(dansSql, boitesDuModele(m.id).sort(),
      `le modèle « ${m.id} » diverge entre le SQL et le JS`);
  }
});

test("la migration ne touche AUCUNE policy existante", () => {
  //  L'étape 1 doit être inerte : elle pose le mécanisme, elle ne bascule
  //  rien. Une policy modifiée ici changerait des droits avant qu'on ait
  //  vérifié quoi que ce soit.
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "175_acces_personnel.sql"), "utf8");
  const touchees = [...sql.matchAll(/(?:drop|create) policy[^;]*?on public\.(\w+)/gi)]
    .map((m) => m[1])
    .filter((t) => !t.startsWith("personnel_"));
  assert.deepEqual([...new Set(touchees)], [],
    "cette migration ne doit créer ou détruire que les policies de ses propres tables");
});


// ---------------------------------------------------------------------
//  4. La règle de bascule, éprouvée sur CHAQUE migration de bascule
//
//  🔴 POURQUOI C'EST GÉNÉRIQUE. L'étape 3 bascule huit domaines, un par
//  un. Écrire une épreuve par domaine garantirait d'en oublier une ; ces
//  trois-là trouvent les migrations par leur NOM (`NNN_bascule_*.sql`), donc
//  elles couvriront Encaissements, RH, Notes et Élèves sans qu'on revienne
//  ici.
// ---------------------------------------------------------------------
const SAUT = String.fromCharCode(10);
const DOSSIER_MIG = path.join(process.cwd(), "supabase", "migrations");
const MIGRATIONS_BASCULE = fs.readdirSync(DOSSIER_MIG)
  .filter((f) => /^\d+_bascule_.*\.sql$/.test(f));

//  ⚠️ ON RETIRE LES COMMENTAIRES AVANT D'ANALYSER. Le bloc ANNULATION de
//  chaque migration contient volontairement l'ancienne garde par rôle : sans
//  ce filtre, toutes les épreuves ci-dessous échouent sur du texte inerte.
function sansCommentaires(sql) {
  return sql.split(SAUT).filter((l) => !l.trimStart().startsWith("--")).join(SAUT);
}
function lireBascule(f) {
  return sansCommentaires(fs.readFileSync(path.join(DOSSIER_MIG, f), "utf8"));
}

test("🔴 une bascule REMPLACE la garde par rôle, elle ne l'ajoute pas", () => {
  assert.ok(MIGRATIONS_BASCULE.length > 0, "aucune migration de bascule trouvée");
  for (const f of MIGRATIONS_BASCULE) {
    const sql = lireBascule(f);
    //  Chaque policy créée est examinée seule. Si elle parle de cases, elle
    //  ne doit plus parler de rôles : garder les deux ferait que décocher une
    //  case masquerait l'écran pendant que la base continuerait d'autoriser.
    //  C'est exactement le défaut corrigé par la migration 173 et par les
    //  lots 1 et 2 de l'audit.
    for (const m of sql.matchAll(/create policy[\s\S]*?;/gi)) {
      const p = m[0];
      if (!p.includes("a_acces")) continue;
      assert.ok(!/a_role\s*\(/.test(p) && !/est_gestion\s*\(/.test(p),
        f + " : une policy mêle les cases et les rôles —" + SAUT + p);
    }
  }
});

test("🔴 une substitution de garde échoue bruyamment, jamais en silence", () => {
  //  Les gardes des RPC sont remplacées par substitution de texte sur
  //  `pg_get_functiondef`. Si la chaîne attendue a changé depuis, la
  //  substitution ne fait RIEN — et la fonction reste ouverte alors que la
  //  migration a « réussi ». D'où le `raise exception` obligatoire.
  for (const f of MIGRATIONS_BASCULE) {
    const sql = lireBascule(f);
    for (const bloc of sql.split("do $$")) {
      if (!bloc.includes("replace(v_def")) continue;
      //  ⚠️ IL NE SUFFIT PAS DE CHERCHER UN `raise exception` DANS LE BLOC :
      //  ces blocs en contiennent déjà un pour « fonction introuvable ». J'ai
      //  saboté la migration pour éprouver cette épreuve, et elle a passé
      //  quand même. Ce qu'il faut exiger, c'est la comparaison du texte
      //  substitué avec l'original, SUIVIE du refus.
      assert.match(bloc, /v_new\s*=\s*v_def[\s\S]{0,200}raise exception/i,
        f + " : la substitution doit comparer v_new à v_def et refuser si rien"
          + " n'a changé — sinon une RPC reste ouverte alors que la migration"
          + " annonce avoir réussi");
    }
  }
});

test("🔴 une bascule ne touche JAMAIS le chemin des familles", () => {
  //  Les parents et les étudiants ne sont pas du personnel : leur accès vient
  //  de leur LIEN, par des fonctions `security definer` gardées par
  //  `_parent_possede()` et la grille de consentement (mig. 114). Une bascule
  //  qui les redéfinirait risquerait « un parent voit les notes d'un autre
  //  enfant » — le pire défaut possible dans cette application.
  const INTERDITS = ["enfant_notes", "enfant_bulletins", "enfant_cantine",
                     "enfant_cantine_menu", "enfant_transport", "mes_enfants",
                     "_parent_possede", "_acces_notes_autorise"];
  for (const f of MIGRATIONS_BASCULE) {
    const sql = lireBascule(f);
    for (const nom of INTERDITS) {
      const motif = new RegExp("(create or replace function|drop function)[^;]{0,120}" + nom, "i");
      assert.ok(!motif.test(sql),
        f + " : ne redéfinissez pas " + nom + " dans une migration de bascule");
    }
  }
});

test("la bascule Cantine / Transport garde les deux cases séparées", () => {
  //  Une école peut avoir un bus sans cantine. Les fusionner sous prétexte
  //  qu'elles partagent le groupe de menu « Services » créerait un droit que
  //  le promoteur ne peut plus défaire.
  const sql = lireBascule("178_bascule_cantine_transport.sql");
  const cantine = [...sql.matchAll(/a_acces\('cantine'\)/g)].length;
  const transport = [...sql.matchAll(/a_acces\('transport'\)/g)].length;
  assert.ok(cantine >= 2, "la case `cantine` doit garder ses tables");
  assert.ok(transport >= 2, "la case `transport` doit garder ses tables");
  assert.ok(!/a_acces\('cantine_transport'\)|a_acces\('services'\)/.test(sql),
    "les deux cases ont été fusionnées : ce n'est pas le modèle");
});
