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
  'export { peutVoir, voitToutesClasses } from "@/lib/permissions.js";',
]);
const { FUSIONS, DERIVEES, POUVOIRS, MODELES, ESPACES_SANS_CASES,
        boiteDeCle, clesDeBoite, arbreDesCases, boitesDeLArbre, boitesDuModele,
        aAcces, aPouvoir, ESPACES, itemPourType, peutVoir, voitToutesClasses } = A;

const SAUT = String.fromCharCode(10);
const DOSSIER_MIG = path.join(process.cwd(), "supabase", "migrations");
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

test("🔴 le SQL EN VIGUEUR reproduit exactement la carte et les modèles du JS", () => {
  //  Deux implémentations de la même règle, c'est deux vérités à maintenir
  //  — le défaut que l'audit a relevé ailleurs. Ici elles sont inévitables
  //  (l'écran a besoin du JS, les policies ont besoin du SQL), alors on les
  //  compare : les blocs SQL sont GÉNÉRÉS depuis ce fichier, et cette
  //  épreuve échoue si quelqu'un les édite à la main d'un seul côté.
  //
  //  ⚠️ ELLE LISAIT LA MIGRATION 175, ET C'ÉTAIT UN PIÈGE. Les modèles ont
  //  été redéfinis en 176, puis élargis en 180 (deux pouvoirs de plus) :
  //  épingler une migration historique revenait à interdire toute évolution,
  //  ou à réécrire une migration déjà appliquée — ce qu'on ne fait jamais.
  //  On compare donc la DÉFINITION EN VIGUEUR : la migration la plus récente
  //  qui porte le bloc. Les anciennes restent l'histoire, et c'est leur rôle.
  const fichiers = fs.readdirSync(DOSSIER_MIG)
    .filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const derniere = (motif) => {
    for (const f of [...fichiers].reverse()) {
      const sql = fs.readFileSync(path.join(DOSSIER_MIG, f), "utf8");
      if (motif.test(sql)) return { f, sql };
    }
    return null;
  };

  //  a) la carte clé → boîte
  //
  //  ⚠️ ON S'ANCRE SUR LE NOM DE LA FONCTION, et pas sur la forme
  //  `when 'x' then 'y'`. Première version : ce motif a fini par attraper
  //  `case r.polcmd when 'r' then 'select' when 'a' then 'insert' …` de la
  //  migration 188, qui n'a rien à voir avec la carte des cases. L'épreuve
  //  échouait en lisant le mauvais bloc — un faux positif, mais elle avait
  //  raison de crier : c'est bien son heuristique qui était trop large.
  const carte = derniere(/function public\.boite_de_cle/);
  assert.ok(carte, "aucune migration ne définit `boite_de_cle`");
  const paires = [...carte.sql.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
  const attendu = FUSIONS.flatMap((f) => f.cles.map((c) => [c, f.id]));
  assert.deepEqual(
    paires.map((p) => p.join("→")).sort(),
    attendu.map((p) => p.join("→")).sort(),
    carte.f + " : la carte SQL ne correspond plus aux FUSIONS — régénérez le bloc");

  //  b) les modèles, un par un.
  //  Lecture par chaînes et non par expression régulière : les crochets et
  //  les parenthèses d'un littéral `array[...]` demandent trois niveaux
  //  d'échappement, et c'est exactement là que cette épreuve s'est cassée la
  //  première fois.
  const mod = derniere(/when 'direction' then array\[/);
  assert.ok(mod, "aucune migration ne définit les modèles");
  for (const m of MODELES) {
    const marqueur = "when '" + m.id + "' then array[";
    const debut = mod.sql.indexOf(marqueur);
    assert.ok(debut >= 0, mod.f + " : le modèle « " + m.id + " » manque");
    const fin = mod.sql.indexOf("]", debut);
    assert.ok(fin > debut, mod.f + " : le modèle « " + m.id + " » n'est pas refermé");
    const dansSql = mod.sql.slice(debut + marqueur.length, fin)
      .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean).sort();
    assert.deepEqual(dansSql, boitesDuModele(m.id).sort(),
      mod.f + " : le modèle « " + m.id + " » diverge entre le SQL et le JS");
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

test("🔴 toute case nommée dans une bascule nomme une case qui existe", () => {
  //  🔴 LE DÉFAUT QUE CETTE ÉPREUVE REND IMPOSSIBLE. `boite_de_cle()` rend
  //  son argument tel quel quand elle ne le connaît pas : en base,
  //  `boite_de_cle('inexistant')` vaut `'inexistant'`. Donc une faute de
  //  frappe dans une policy — `a_acces('encaissements')` au pluriel, par
  //  exemple — ne lève AUCUNE erreur : elle cherche une case que personne ne
  //  possède, et verrouille l'écran pour tout le monde, en silence. C'est le
  //  pire mode de panne : la migration s'applique, les épreuves passent, et
  //  un écran devient inaccessible sans message.
  const connues = new Set([
    ...MODELES.flatMap((m) => boitesDuModele(m.id)),
    ...boitesDeLArbre(arbreDesCases(MIXTE)),
    ...POUVOIRS.map((p) => p.id),
  ]);
  for (const f of MIGRATIONS_BASCULE) {
    const sql = lireBascule(f);
    //  ⚠️ TROIS FORMES, et les deux dernières sont venues d'un angle mort que
    //  cette épreuve a elle-même révélé. Elle ne connaissait que la citation
    //  littérale `a_acces('x')`, et a donc échoué sur la migration 193 — qui
    //  construit ses policies depuis une CARTE (table → case), où les noms de
    //  cases sont des paramètres de `format()`, pas des littéraux. Le reproche
    //  était juste dans sa forme (« elle ne cite aucune case ») et faux dans
    //  son fond. L'élargir lui fait vérifier 14 noms de plus.
    const citees = [
      //  a) citation directe dans une policy
      ...[...sql.matchAll(/a_acces\('([a-z_]+)'\)/g)].map((m) => m[1]),
      //  b) citation DANS une chaîne SQL (guillemets doublés) : les blocs de
      //     substitution des gardes de RPC
      ...[...sql.matchAll(/a_acces\(''([a-z_]+)''\)/g)].map((m) => m[1]),
    ];
    //  ⚠️ PAS DE TROISIÈME FORME, et c'est une marche arrière assumée. J'avais
    //  ajouté « deuxième colonne d'une carte `array['table', 'case', …]` » pour
    //  couvrir la migration 193 — mais une carte (table, case, prédicat) et une
    //  simple LISTE de tables (`array['depenses', 'recettes', 'ecritures', …]`,
    //  migrations 177 et 178) sont indistinguables par la forme. L'épreuve
    //  croyait donc que `recettes` était une case inexistante. Les cartes ont
    //  leur propre épreuve, juste en dessous.
    //
    //  Une migration qui construit ses policies par `format(%L)` ne cite aucune
    //  case littéralement : on ne l'exige donc que des autres.
    if (!sql.includes("%2$L") && !sql.includes("a_acces(%")) {
      assert.ok(citees.length > 0, f + " : une migration de bascule qui ne cite aucune case ?");
    }
    const inconnues = [...new Set(citees)].filter((c) => !connues.has(boiteDeCle(c)));
    assert.deepEqual(inconnues, [],
      f + " : case(s) inexistante(s) — elles n'accorderaient rien à personne et"
        + " verrouilleraient l'écran sans erreur");
  }
});

test("🔴 un document ne naît jamais déjà authentifiable", () => {
  //  🔴 TROUVÉ EN BASCULANT LE DOMAINE Documents (mig. 179).
  //  `verifier_document()` — le QR public d'authenticité — déclare authentique
  //  tout document dont le statut vaut `valide`, `archive` ou `genere`. Or
  //  l'insertion dans `documents` est volontairement LARGE (l'archivage GED
  //  vient des bulletins, des paiements et de la paie), et elle n'avait
  //  aucune contrainte de statut : un appel REST direct permettait à un
  //  enseignant de créer un document déjà « validé », titre et montant
  //  choisis, que le QR présentait comme officiel.
  //
  //  Aucun chemin légitime n'insère `valide` ni `genere` : `creerDocument`
  //  laisse le défaut `en_attente`, `archiverDocument` pose `archive`, et la
  //  validation est un UPDATE réservé au signataire. Cette épreuve interdit
  //  qu'on rouvre la porte par inadvertance en réécrivant la policy.
  const sql = lireBascule("179_bascule_documents_demandes.sql");
  const m = sql.match(/create policy documents_insert[\s\S]*?;/i);
  assert.ok(m, "la policy documents_insert a disparu de la migration 179");
  assert.match(m[0], /statut in \('en_attente', 'archive'\)/,
    "documents_insert doit interdire de créer un document déjà authentifiable"
    + " (`valide`, `genere`)");
});

test("l'archivage GED reste ouvert à ses quatre domaines", () => {
  //  L'archivage est appelé SANS `await` et ses erreurs sont AVALÉES
  //  (`archiverDocument`, best-effort). Le resserrer à la seule case
  //  `certificats` n'aurait produit aucun message : l'archivage des bulletins
  //  et de la paie se serait arrêté en silence. Les quatre cases
  //  correspondent aux quatre écrans qui archivent.
  const sql = lireBascule("179_bascule_documents_demandes.sql");
  const m = sql.match(/create policy documents_insert[\s\S]*?;/i);
  for (const boite of ["certificats", "rh", "notes_bulletins", "encaissement"]) {
    assert.ok(m[0].includes("a_acces('" + boite + "')"),
      "documents_insert doit rester ouverte à la case `" + boite + "` : un des"
      + " quatre écrans qui archivent (certificats, paie, bulletins, factures)");
  }
});

test("🔴 p_frais ne va qu'à qui pouvait déjà fixer les tarifs", () => {
  //  🔴 CE POUVOIR EST NÉ D'UN ÉLARGISSEMENT ÉVITÉ (mig. 180). La case
  //  `encaissement` regroupe Paiements et Recouvrement — juste, ils lisent
  //  `factures` — mais `frais` ne s'écrivait que par
  //  `est_admin() or a_role('comptable')` : le secrétariat encaisse, il ne
  //  fixe pas les tarifs de l'école. Basculer naïvement lui aurait donné la
  //  grille tarifaire. Si quelqu'un ajoute `p_frais` à un autre modèle, c'est
  //  une décision commerciale — pas un détail d'implémentation — et cette
  //  épreuve l'oblige à la regarder en face.
  const porteurs = MODELES.filter((m) => boitesDuModele(m.id).includes("p_frais")).map((m) => m.id);
  assert.deepEqual(porteurs, ["comptable"],
    "p_frais reproduit `a_role('comptable')` sur la table `frais` : le comptable seul");
});

test("🔴 p_voir_impayes distingue la direction de l'enseignant", () => {
  //  🔴 L'AUTRE ÉLARGISSEMENT ÉVITÉ (mig. 180). `statut_paiement_classe`
  //  — l'indicateur de paiement de la liste Élèves — nomme
  //  `est_admin() or direction or comptable or secretaire`. Or la case
  //  `eleves` est partagée par l'enseignant ET le surveillant : s'appuyer sur
  //  elle aurait montré à tout enseignant quelles familles sont en retard de
  //  paiement. C'est une information sur la situation financière des
  //  familles, pas une information pédagogique.
  const porteurs = MODELES.filter((m) => boitesDuModele(m.id).includes("p_voir_impayes"))
    .map((m) => m.id).sort();
  assert.deepEqual(porteurs, ["comptable", "direction", "secretaire"],
    "p_voir_impayes reproduit la garde de statut_paiement_classe");
  for (const sans of ["enseignant", "surveillant", "rh", "bibliothecaire"]) {
    assert.ok(!boitesDuModele(sans).includes("p_voir_impayes"),
      "« " + sans + " » ne doit pas voir quelles familles sont en retard de paiement");
  }
});

test("🔴 relancer_eleve prend l'élève de son paramètre, pas d'un champ absent", () => {
  //  🔴 BUG TROUVÉ EN ÉPROUVANT LA MIGRATION 180, corrigé par la 181.
  //  `relancer_eleve` chargeait `r` avec
  //  `e.ecole_id, e.prenom, e.nom, ec.nom, ec.devise` puis insérait la
  //  notification en lisant `r.eleve_id` — un champ que `r` NE CONTIENT PAS.
  //  PL/pgSQL ne s'en aperçoit qu'à l'exécution :
  //  « record "r" has no field "eleve_id" ». Le bouton « Relancer (push) » de
  //  l'écran Recouvrement n'a donc JAMAIS fonctionné — et c'est le seul
  //  chemin de relance que l'interface utilise.
  //
  //  ⚠️ LA LEÇON, plus large que le bug : une garde se lit dans l'en-tête,
  //  un corps ne se vérifie qu'en APPELANT la fonction. Les bascules
  //  précédentes n'avaient éprouvé que des policies ; celle-ci a appelé les
  //  huit RPC pour de vrai, et c'est ainsi qu'elle l'a trouvé.
  //  ⚠️ ON RETIRE LES COMMENTAIRES D'ABORD. Première version de cette
  //  épreuve : elle échouait sur le commentaire de la migration, qui CITE
  //  `r.eleve_id` pour expliquer le correctif. Une épreuve qui lit du
  //  commentaire ne lit pas le code.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "181_corriger_relancer_eleve.sql"), "utf8"));
  const corps = sql.slice(sql.indexOf("create or replace function public.relancer_eleve"));
  assert.ok(!/r\.eleve_id/.test(corps),
    "r.eleve_id n'existe pas dans l'enregistrement chargé : la fonction échouerait"
    + " à chaque appel");
  assert.match(corps, /v_msg, p_eleve, 'facture'/,
    "la notification doit porter `p_eleve`, le paramètre de la fonction");
});

test("🔴 la paie ne se voit que par la case `rh`", () => {
  //  🔴 CE QUE CETTE ÉPREUVE PROTÈGE (mig. 182). Avant la bascule,
  //  `bareme_ir` et `cotisations_paie` — la configuration de la paie —
  //  portaient `est_gestion() or a_role('rh') or a_role('comptable')`. Or
  //  `est_gestion()` vaut vrai pour la **direction** : un responsable
  //  pédagogique pouvait donc lire ET ÉCRIRE le barème de l'impôt, ce qui
  //  change tous les bulletins de paie suivants. Chez le premier client réel,
  //  les deux responsables de cycle sont `comptable+direction` : la
  //  confidentialité de la paie reposait donc sur un écran, pas sur la base.
  //
  //  Si un jour la case `rh` est accordée à un autre modèle, c'est une
  //  décision à prendre les yeux ouverts : des salaires nominatifs.
  const porteurs = MODELES.filter((m) => boitesDuModele(m.id).includes("rh")).map((m) => m.id);
  assert.deepEqual(porteurs, ["rh"],
    "la case `rh` ouvre les salaires nominatifs : elle ne va qu'au modèle RH");
});

test("🔴 la dette envers le personnel reste lisible par la Comptabilité", () => {
  //  🔴 LA SEULE EXCEPTION DU DOMAINE RH, et elle est réelle :
  //  `dettes_personnel` est appelée depuis `src/lib/comptabilite.js` —
  //  l'écran du comptable, qui affiche la dette envers le personnel. La
  //  réduire à la seule case `rh` aurait cassé son bilan. C'est le même cas
  //  que `comptes` à la migration 177 : une donnée lue par deux domaines.
  const sql = lireBascule("182_bascule_rh_paie.sql");
  const i = sql.indexOf("'dettes_personnel'");
  assert.ok(i > 0, "la paire de dettes_personnel a disparu de la migration 182");
  const ligne = sql.slice(i, sql.indexOf("]", i));
  for (const boite of ["rh", "comptabilite"]) {
    assert.ok(ligne.includes("a_acces(''" + boite + "'')"),
      "dettes_personnel doit rester ouverte à la case `" + boite + "`");
  }
});

test("🔴 la policy du barème reste HOISTÉE, sinon elle met 29 secondes", () => {
  //  🔴 MESURÉ, PAS SUPPOSÉ (mig. 183). Sous une session RH réelle :
  //      select count(*) from personnels  →     33 ms
  //      select count(*) from bareme_ir   → 35 408 ms
  //  Le prédicat était évalué par ligne sur 59 346 lignes, parce que
  //  l'expression mêle un terme dépendant de la ligne
  //  (`ecole_id = ecole_courante()`) aux appels de fonction : PostgreSQL ne
  //  peut alors rien sortir de la boucle.
  //
  //  ⚠️ CE N'EST PAS LA BASCULE QUI L'A CAUSÉ, mesuré sur 8 000 lignes :
  //  l'ancienne forme par rôles prenait 9 715 ms, la nouvelle 6 203 ms, la
  //  forme hoistée 3 ms. Le défaut était antérieur ; la bascule l'a rendu
  //  visible en lisant la table pour de vrai.
  //
  //  Envelopper chaque appel dans `(select f())` en fait un InitPlan évalué
  //  UNE fois : 35 408 ms → 14 ms. Sémantique identique (`(select f())` rend
  //  ce que rend `f()`, NULL compris).
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "183_rls_hoistee_bareme_ir.sql"), "utf8"));
  const i = sql.indexOf("create policy bareme_ir_acces");
  assert.ok(i > 0, "la policy hoistée de bareme_ir a disparu");
  const policy = sql.slice(i, sql.indexOf(";", i));
  for (const appel of ["(select est_super_admin())", "(select ecole_courante())",
                       "(select a_acces('rh'))"]) {
    assert.ok(policy.includes(appel),
      "la policy doit appeler " + appel + " en sous-requête scalaire : un appel nu"
      + " ramènerait la lecture du barème à 29 secondes");
  }
});

test("🔴 p_toutes_classes reproduit `voitToutesClasses`, ni plus ni moins", () => {
  //  🔴 CE POUVOIR COMBLE UN MANQUE DE LA BASE (mig. 184). La notion
  //  « voit toutes les classes, pas seulement les siennes » n'existait que dans
  //  le front (`voitToutesClasses`) : neuf écrans s'en servent, mais les gardes
  //  SQL qui en avaient besoin énuméraient des rôles à la main.
  //
  //  Il doit coïncider EXACTEMENT avec la fonction du front : sinon l'écran et
  //  la base ne diraient pas la même chose, et c'est précisément le défaut que
  //  tout ce chantier corrige.
  for (const m of MODELES) {
    assert.equal(
      boitesDuModele(m.id).includes("p_toutes_classes"),
      voitToutesClasses([m.id]),
      "« " + m.id + " » : `p_toutes_classes` et `voitToutesClasses()` divergent");
  }
});

test("🔴 la bascule des absences NE SUPPRIME PAS le cloisonnement par classe", () => {
  //  🔴 LA FAUTE QUE CETTE ÉPREUVE REND IMPOSSIBLE (mig. 184).
  //  `absences_classe_periode` gardait :
  //      est_admin() or direction or comptable or secretaire
  //      or enseigne_classe(p_classe)
  //  — l'administration voit TOUTES les classes, l'enseignant seulement
  //  CELLES QU'IL ENSEIGNE (cloisonnement de la migration 058).
  //
  //  Remplaçer la liste de rôles par `a_acces('presence_vie')` aurait été une
  //  faute grave : l'enseignant DÉTIENT cette case, il aurait donc obtenu
  //  toutes les classes. La bascule aurait supprimé le cloisonnement en
  //  croyant le traduire. Éprouvé en base, même classe et même période :
  //  enseignante sans `p_toutes_classes` → 0 élève, direction → 16.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "184_bascule_presence_vie_scolaire.sql"), "utf8"));
  assert.match(sql, /enseigne_classe\(p_classe\)/,
    "le cloisonnement `enseigne_classe` doit survivre à la bascule");
  assert.match(sql, /a_acces\(''p_toutes_classes''\)/,
    "l'administration doit passer par `p_toutes_classes`, pas par `presence_vie`"
    + " — que l'enseignant détient aussi");
  //  Et la case `presence_vie` ne doit JAMAIS servir à ouvrir toutes les
  //  classes dans cette migration.
  assert.ok(!/a_acces\(''presence_vie''\)[^;]{0,80}enseigne_classe/.test(sql),
    "`presence_vie` ne remplace pas `p_toutes_classes` dans la garde par classe");
});

test("🔴 absences et incidents : policies HOISTÉES (tables qui grandissent)", () => {
  //  ⚠️ LEÇON DE LA MIGRATION 183, APPLIQUÉE AVANT D'EN AVOIR BESOIN.
  //  `absences` grandit avec les effectifs : une ligne par absence et par
  //  élève. Un prédicat qui mêle un terme dépendant de la ligne à des appels de
  //  fonction est réévalué PAR LIGNE — c'est ce qui faisait mettre 29 secondes
  //  à la lecture du barème. On ne recommence pas sur une table qui grossit.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "184_bascule_presence_vie_scolaire.sql"), "utf8"));
  for (const appel of ["(select est_super_admin())", "(select ecole_courante())",
                       "(select a_acces('presence_vie'))"]) {
    assert.ok(sql.includes(appel),
      "la policy doit appeler " + appel + " en sous-requête scalaire");
  }
});

test("🔴 les gardes factorisées gardent le cloisonnement par classe ET par matière", () => {
  //  🔴 LE MÊME PIÈGE QU'À LA 184, EN PLUS GRAVE (mig. 185). Tout le
  //  domaine Notes & bulletins porte le motif
  //      est_gestion() OR (a_role('enseignant') AND <cloisonnement>)
  //  et `est_gestion()` = {promoteur, direction} = `p_toutes_classes`.
  //  Traduire la première branche par `a_acces('notes_bulletins')` aurait
  //  donné toutes les classes à TOUT enseignant, qui détient cette case :
  //  le cloisonnement des migrations 058 et 173 aurait disparu.
  //
  //  Éprouvé en base, dans une transaction annulée : le même enseignant voit
  //  0 note SANS affectation, et 1 note APRÈS avoir été affecté à la classe.
  //  C'est bien `enseigne_classe` qui travaille.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "185_bascule_notes_bulletins.sql"), "utf8"));
  for (const fn of ["peut_noter_evaluation", "peut_editer_bulletin"]) {
    const i = sql.indexOf("function public." + fn);
    assert.ok(i > 0, fn + " a disparu de la migration 185");
    const corps = sql.slice(i, sql.indexOf("$fn$;", i));
    assert.match(corps, /a_acces\('p_toutes_classes'\)/,
      fn + " : l'administration passe par `p_toutes_classes`, pas par `notes_bulletins`");
    assert.match(corps, /enseigne_classe/,
      fn + " : le cloisonnement par classe doit survivre à la bascule");
  }
  //  ⚠️ ET LA DISTINCTION CLASSE / MATIÈRE NE DOIT PAS ÊTRE UNIFORMISÉE :
  //  un enseignant VOIT les évaluations de sa classe (pour s'y situer) mais ne
  //  NOTE que sa matière. C'est une décision de la migration 058.
  assert.match(sql, /enseigne_classe_matiere\(classe_id, matiere_id\)/,
    "l'écriture des évaluations reste bornée à la MATIÈRE de l'enseignant");
  assert.match(sql, /enseigne_classe\(classe_id\)/,
    "la lecture des évaluations reste bornée à la CLASSE, pas à la matière");
});

test("🔴 le procès-verbal garde ses DEUX signatures distinctes", () => {
  //  🔴 CE QUE CETTE ÉPREUVE PROTÈGE (mig. 185). `signer_conseil` exclut
  //  DÉLIBÉRÉMENT `est_gestion()` de la signature « gestion », avec un
  //  commentaire qui le dit : ce helper vaut vrai pour `direction`, et un
  //  responsable pédagogique aurait alors pu fournir les DEUX signatures — le
  //  « PV à deux signatures » n'en aurait exigé qu'une.
  //
  //  En cases : comptable et secrétariat partagent `_gestion`, que la
  //  direction N'A PAS. La traduction conserve donc la propriété. Si quelqu'un
  //  remplaçait `_gestion` par une case que la direction détient, le PV
  //  perdrait sa raison d'être.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "185_bascule_notes_bulletins.sql"), "utf8"));
  const i = sql.indexOf("'signer_conseil'");
  assert.ok(i > 0, "la paire de signer_conseil a disparu");
  const ligne = sql.slice(i, sql.indexOf("]", i));
  const boite = (ligne.match(/a_acces\(''([a-z_]+)''\)/) || [])[1];
  assert.ok(boite, "signer_conseil doit recevoir une case");
  assert.ok(!boitesDuModele("direction").includes(boite),
    "la signature « gestion » passerait par `" + boite + "`, que la direction"
    + " détient : elle pourrait alors fournir les DEUX signatures du PV");
  for (const m of ["comptable", "secretaire"]) {
    assert.ok(boitesDuModele(m).includes(boite),
      "« " + m + " » doit pouvoir apposer la signature « gestion »");
  }
});

test("notes et bulletins : policies HOISTÉES (les tables qui grandiront le plus)", () => {
  //  ⚠️ `notes` est la table qui grandira le plus vite de l'application : une
  //  école de 1 000 élèves × 10 matières × 3 trimestres × 3 devoirs fait
  //  90 000 lignes. La leçon de la 183 (29 secondes sur 59 346 lignes)
  //  s'applique donc ici avant même que le problème se pose.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "185_bascule_notes_bulletins.sql"), "utf8"));
  for (const appel of ["(select est_super_admin())", "(select ecole_courante())",
                       "(select a_acces('p_toutes_classes'))",
                       "(select a_acces('notes_bulletins'))"]) {
    assert.ok(sql.includes(appel),
      "les policies doivent appeler " + appel + " en sous-requête scalaire");
  }
});

test("🔴 la structure ne s'écrit que par sa case, mais se LIT largement", () => {
  //  🔴 LE TROU LE PLUS LARGE DU CHANTIER (mig. 186). `classes`,
  //  `niveaux`, `matieres`, `series`, `enseignants` et `affectations`
  //  portaient UNE policy `for all` avec pour seul prédicat
  //  `ecole_id = ecole_courante()`. N'importe quel membre du personnel — un
  //  enseignant, un surveillant, un bibliothécaire — pouvait donc **créer,
  //  modifier et SUPPRIMER** toute la structure de l'établissement, alors que
  //  l'écran Structure est réservé à la direction. La migration 174 avait
  //  verrouillé `cycles` pour cette raison ; ces six-là avaient été oubliées.
  //  Éprouvé : un enseignant qui tente de supprimer une classe touche
  //  **0 ligne**.
  //
  //  ⚠️ ET LA LECTURE RESTE LARGE, DÉLIBÉRÉMENT : le sélecteur de classe est
  //  sur presque tous les écrans. La fermer à une case viderait des listes
  //  déroulantes partout, en silence.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "186_bascule_eleves_structure.sql"), "utf8"));
  assert.match(sql, /a_acces\(%2\$L\)/,
    "les six tables de structure doivent recevoir leur case d'écriture");
  assert.match(sql, /'structure'/, "classes, niveaux, matières, séries → case `structure`");
  assert.match(sql, /'enseignants'/, "enseignants, affectations → case `enseignants`");
  //  La policy de LECTURE de la structure ne doit PAS citer de case.
  //  ⚠️ ON PART DU BLOC DE LA STRUCTURE, et pas du premier `_select` du
  //  fichier : celui-là appartient au bloc des élèves, qui cite bien
  //  `a_acces('eleves')`. Première version de cette épreuve, elle échouait
  //  sur la bonne policy en lisant la mauvaise.
  const bloc = sql.indexOf("'classes', 'niveaux'");
  assert.ok(bloc > 0, "le bloc des tables de structure a disparu");
  const i = sql.indexOf("%1$s_select on public.%1$I for select", bloc);
  assert.ok(i > 0, "la policy de lecture de la structure a disparu");
  const lecture = sql.slice(i, sql.indexOf("$p$,", i));
  assert.ok(!lecture.includes("a_acces"),
    "la lecture de la structure reste ouverte au personnel : le sélecteur de"
    + " classe est partout, et le fermer viderait des listes en silence");
});

test("🔴 le SIGB garde sa lecture des élèves", () => {
  //  🔴 LA DÉPENDANCE QUI A FAILLI M'ÉCHAPPER (mig. 186).
  //  `src/lib/bibliotheque.js` lit `eleves` pour afficher le nom de
  //  l'emprunteur et pour le CHERCHER (`chercherEtudiants`). Or le
  //  bibliothécaire ne détient PAS la case `eleves` : fermer la lecture à
  //  cette seule case aurait vidé la liste des prêts et rendu la recherche
  //  d'emprunteur muette — **sans aucune erreur à l'écran**.
  //  Vérifié : la bibliothèque ne lit NI inscriptions, NI tuteurs, NI
  //  documents_eleve, donc ceux-là restent à la seule case `eleves`.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "186_bascule_eleves_structure.sql"), "utf8"));
  const i = sql.indexOf("create policy eleves_select");
  assert.ok(i > 0, "la policy de lecture des élèves a disparu");
  const p = sql.slice(i, sql.indexOf(";", i));
  assert.ok(p.includes("a_acces('eleves')") && p.includes("a_acces('biblio_circulation')"),
    "eleves_select doit rester ouverte à `biblio_circulation` : sinon le prêt"
    + " de livres à un élève cesse de fonctionner, en silence");
  //  Et le bibliothécaire ne doit PAS gagner la case `eleves` au passage.
  assert.ok(!boitesDuModele("bibliothecaire").includes("eleves"),
    "le bibliothécaire lit les élèves par `biblio_circulation`, pas par la case"
    + " `eleves` — il n'a pas à ouvrir l'écran Élèves");
});

test("🔴 le matricule couvre SES DEUX chemins d'appel", () => {
  //  🔴 UNE VÉRIFICATION QUI A CHANGÉ MA RÉPONSE (mig. 186).
  //  `prochain_matricule` n'avait qu'un contrôle d'établissement : tout membre
  //  du personnel pouvait consommer des numéros. La fermer à
  //  `p_eleves_editer` semblait évident — mais `convertir_candidature`
  //  L'APPELLE, et cette fonction est ouverte à la **direction**, qui n'a pas
  //  `p_eleves_editer`. Convertir une candidature aurait donc échoué pour la
  //  direction, sur une erreur venue d'une fonction qu'elle n'appelle pas
  //  elle-même. Toujours chercher les appelants INTERNES avant de garder une
  //  fonction utilitaire.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "186_bascule_eleves_structure.sql"), "utf8"));
  const i = sql.indexOf("'prochain_matricule'");
  assert.ok(i > 0, "la paire de prochain_matricule a disparu");
  const bloc = sql.slice(i, sql.indexOf("];", i));
  for (const boite of ["p_eleves_editer", "admissions"]) {
    assert.ok(bloc.includes("a_acces(''" + boite + "'')"),
      "prochain_matricule doit couvrir le chemin `" + boite + "`");
  }
  //  Et la direction, qui convertit les candidatures, doit bien avoir `admissions`.
  assert.ok(boitesDuModele("direction").includes("admissions"),
    "la direction convertit les candidatures : elle doit garder la case `admissions`");
});

test("🔴 personne ne peut s'accorder un rôle : l'escalade reste fermée", () => {
  //  🔴 LE DÉFAUT LE PLUS GRAVE DU CHANTIER (mig. 187), et il annulait
  //  TOUT le reste. `profil_roles` portait une policy `for all` avec pour seul
  //  prédicat `ecole_id = ecole_courante()` : tout membre du personnel pouvait
  //  écrire dans la table qui DÉFINIT les rôles, donc s'accorder le sien.
  //
  //  Éprouvé avant correction, session d'un simple enseignant :
  //      insert into profil_roles values (auth.uid(), <son école>, 'admin_ecole')
  //      → PASSE. Il obtenait aussitôt 4 salaires et 14 832 lignes de barème.
  //  Et il n'avait même pas besoin des cases : `a_acces()` commence par
  //  `est_super_admin() or a_role('admin_ecole')` — le rôle de promoteur ouvre
  //  tout. Les huit migrations de bascule reposaient donc sur une table que
  //  leurs propres utilisateurs pouvaient réécrire.
  //
  //  Éprouvé après, par l'API : HTTP 403 « new row violates row-level security
  //  policy », et les PATCH rendent un corps vide (0 ligne).
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "187_fermer_escalade_profil_roles.sql"), "utf8"));
  for (const t of ["profil_roles", "profils"]) {
    const i = sql.indexOf("create policy " + t + "_ecrire");
    assert.ok(i > 0, "la policy d'écriture de " + t + " a disparu");
    const p = sql.slice(i, sql.indexOf(";", i));
    assert.ok(!p.includes("ecole_courante"),
      t + " : une écriture bornée au seul établissement vaut escalade de"
      + " privilèges — c'est exactement le défaut que la 187 ferme");
    assert.match(p, /est_super_admin\(\)/,
      t + " : l'écriture directe est réservée à la console de la plateforme ;"
      + " tout le reste passe par des fonctions security definer");
  }
  //  Et la LECTURE doit rester ouverte, sinon l'application ne sait plus qui
  //  est connecté (`AuthContext` lit son profil et ses rôles au démarrage).
  for (const t of ["profil_roles", "profils"]) {
    const i = sql.indexOf("create policy " + t + "_select");
    assert.ok(i > 0, "la policy de lecture de " + t + " a disparu");
    assert.match(sql.slice(i, sql.indexOf(";", i)), /auth\.uid\(\)/,
      t + " : chacun doit pouvoir lire SON profil, sinon la connexion échoue");
  }
});

test("🔴 aucune ligne de périmètre = aucune restriction (la migration est inerte)", () => {
  //  🔴 LA PROPRIÉTÉ QUI REND L'ÉTAPE 4 DÉPLOYABLE (mig. 188). Le
  //  périmètre touche 51 policies sur 22 tables : s'il n'était pas inerte par
  //  défaut, la mise en ligne aurait changé ce que voient sept écoles d'un
  //  coup. Chaque conjonction DOIT donc commencer par un test de nullité, et
  //  les helpers doivent rendre NULL quand personne n'est cloisonné.
  //
  //  Éprouvé en base avant d'activer quoi que ce soit : responsable 96/96,
  //  promoteur 50/50, enseignant 1/1, parent 4/4 notes. Rien n'avait changé.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "188_perimetre_par_cycle.sql"), "utf8"));
  //  Chaque prédicat de la carte est soit `peut_voir_eleve(...)` — qui porte
  //  le test en elle — soit préfixé de `classes_autorisees() is null or`.
  //  ⚠️ MOTIF SOUPLE, et le compte EXACT. Première version : un motif plus
  //  strict n'attrapait que 19 des 22 entrées — et mon seuil était à 20, donc
  //  l'épreuve échouait en croyant la carte changée. Exiger le compte exact
  //  vaut mieux qu'un seuil : si la carte gagne une table, l'épreuve le dit
  //  au lieu de la vérifier à moitié.
  const predicats = [...sql.matchAll(/array\[\s*'[a-z_]+'\s*,\s*'([\s\S]*?)'\s*\]/g)].map((m) => m[1]);
  assert.equal(predicats.length, 22,
    "la carte table → prédicat ne compte plus 22 entrées : ajustez cette épreuve"
    + " en même temps que la migration, pour qu'elle les vérifie TOUTES");
  for (const p of predicats) {
    assert.ok(p.includes("peut_voir_eleve") || p.includes("is null or"),
      "prédicat sans porte de sortie : « " + p + " ». Sans `is null or`, le"
      + " périmètre cloisonnerait TOUT LE MONDE dès la mise en ligne.");
  }
});

test("🔴 le promoteur et la RH ne peuvent pas être cloisonnés", () => {
  //  🔴 LE VERROU DE SÉCURITÉ DU MÉCANISME (mig. 188). Si le promoteur
  //  pouvait se verrouiller lui-même — ou être verrouillé — il perdrait la
  //  main sur son propre établissement sans moyen de revenir. C'est écrit
  //  DANS le helper, pas chez l'appelant, pour qu'aucune policy ne puisse
  //  l'oublier. Éprouvé : même DÉSIGNÉ sur un cycle, `cycles_autorises()`
  //  lui rend NULL.
  //
  //  La RH de même : la paie et le personnel ne se découpent pas par cycle
  //  (décision du promoteur, 05/10/2026).
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "188_perimetre_par_cycle.sql"), "utf8"));
  const i = sql.indexOf("function public.cycles_autorises");
  assert.ok(i > 0, "`cycles_autorises` a disparu");
  const corps = sql.slice(i, sql.indexOf("$fn$;", i));
  assert.match(corps, /est_super_admin\(\) or a_role\('admin_ecole'\) or a_role\('rh'\)[\s\S]{0,40}return null/,
    "le promoteur et la RH doivent rendre NULL — inconditionnellement, dans le helper");
  //  Et le fail-closed : pas de session, aucun cycle (et non « tous »).
  assert.match(corps, /auth\.uid\(\) is null then return '\{\}'/,
    "sans session, le périmètre doit être VIDE, pas absent de restriction");
});

test("🔴 les RPC `security definer` sont cloisonnées elles aussi", () => {
  //  🔴 SANS ÇA, LE PÉRIMÈTRE ÉTAIT UN TROMPE-L'ŒIL (mig. 189). Une
  //  fonction `security definer` ne passe pas par la RLS : la liste des
  //  factures et les totaux du tableau de bord auraient continué de compter
  //  toute l'école, juste au-dessus d'une liste d'élèves cloisonnée. C'est
  //  exactement le défaut corrigé au lot 2 : un nombre derrière lequel on ne
  //  peut pas regarder.
  //
  //  Éprouvé : responsable cloisonnée préscolaire → `factures_paginees`
  //  total 0 et `tableau_bord_finances` 0/0, alors que l'école a 8 factures.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "189_perimetre_dans_les_rpc.sql"), "utf8"));
  for (const fn of ["factures_paginees", "tableau_bord_finances", "statut_paiement_classe",
                    "absences_classe_periode", "moyenne_notes_ecole", "moyenne_notes_par_niveau",
                    "bulletin_pour_attestation", "relancer_eleve", "relancer_facture",
                    "supprimer_facture"]) {
    assert.ok(sql.includes("'" + fn + "'"),
      "`" + fn + "` contourne la RLS : elle doit porter le périmètre à la main");
  }
  //  ⚠️ ET CHAQUE `exists` DOIT ÊTRE PRÉCÉDÉ DE LA PORTE DE SORTIE. Sans
  //  elle, une ligne dont le rattachement est absent (un paiement sans
  //  facture) disparaîtrait AUSSI pour les non-cloisonnés — une régression
  //  pour tout le monde au lieu d'un cloisonnement pour quelques-uns.
  for (const m of sql.matchAll(/exists \(select 1 from factures/g)) {
    const avant = sql.slice(Math.max(0, m.index - 60), m.index);
    assert.ok(avant.includes("classes_autorisees() is null or"),
      "un `exists` sans `classes_autorisees() is null or` devant : il cacherait"
      + " des lignes aux non-cloisonnés");
  }
});

test("🔴 le journal d'audit est APPEND-ONLY : personne ne peut effacer ses traces", () => {
  //  🔴 CE GARDE-FOU EXISTE PARCE QUE J'AI CAUSÉ L'INCIDENT (mig. 192).
  //  En éprouvant la migration 191, j'ai lancé depuis une vraie session un
  //  `DELETE /rest/v1/journal_audit` **en supposant qu'il serait refusé**. Il
  //  ne l'a pas été : 82 lignes du journal de l'école cliente ont été
  //  supprimées, dont 67 définitivement perdues (dernière sauvegarde
  //  exploitable : 23/09).
  //
  //  La cause : `journal_audit_tenant` était `for all`. Sa garde de RÔLE était
  //  pourtant correcte — et c'est ce qui rendait le défaut invisible : la
  //  table AVAIT L'AIR protégée. Mais `for all` comprend `delete`, donc les
  //  personnes dont le journal enregistre les actes pouvaient les effacer.
  //
  //  ⚠️ UN JOURNAL D'AUDIT N'A QU'UNE PROPRIÉTÉ UTILE : être append-only.
  //  S'il peut être vidé par ceux qu'il surveille, il n'atteste plus rien.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "192_journal_audit_append_only.sql"), "utf8"));
  //  La lecture reste ouverte à la gestion…
  const lecture = sql.slice(sql.indexOf("create policy journal_audit_select"));
  assert.match(lecture.slice(0, lecture.indexOf(";")), /for select/,
    "la lecture du journal doit rester possible : Pilotage → Journal en dépend");
  //  …mais AUCUNE policy d'écriture ne doit mentionner l'établissement.
  for (const m of sql.matchAll(/create policy journal_audit_\w+[\s\S]*?;/g)) {
    const p = m[0];
    if (!/for all|for delete|for update|for insert/.test(p)) continue;
    assert.ok(!p.includes("ecole_courante"),
      "une policy d'écriture bornée à l'établissement redonne à la gestion le"
      + " droit de vider son propre journal d'audit — le défaut de la mig. 192 :"
      + String.fromCharCode(10) + p);
  }
});

test("🔴 la carte de la pédagogie ne nomme que des cases qui existent", () => {
  //  🔴 LE MÊME RISQUE QUE L'ÉPREUVE GÉNÉRIQUE, par un autre chemin.
  //  La migration 193 ne cite pas ses cases littéralement : elle construit ses
  //  14 policies depuis une CARTE (table → case → prédicat) passée à
  //  `format(%L)`. L'épreuve générique ne les voyait donc pas — et quand je
  //  l'ai élargie pour les voir, elle a pris les simples LISTES de tables des
  //  migrations 177 et 178 pour des cartes de cases. D'où cette épreuve-ci,
  //  qui connaît la forme exacte de cette carte.
  //
  //  L'enjeu est le même : `boite_de_cle()` rend son argument tel quel, donc
  //  une faute de frappe (`cahiers` au pluriel) ne lève aucune erreur — elle
  //  verrouille l'écran pour tout le monde, en silence.
  const connues = new Set([
    ...MODELES.flatMap((m) => boitesDuModele(m.id)),
    ...boitesDeLArbre(arbreDesCases(MIXTE)),
    ...POUVOIRS.map((p) => p.id),
  ]);
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "193_bascule_pedagogie_calendrier.sql"), "utf8"));
  //  Les deux cartes de cette migration : (table, case, prédicat) pour le
  //  contenu, (table, case, mode) pour les référentiels. Même forme à trois
  //  colonnes, donc une seule lecture suffit.
  const paires = [...sql.matchAll(/array\['([a-z_]+)',\s*'([a-z_]+)',/g)]
    .map((m) => ({ table: m[1], boite: m[2] }));
  assert.equal(paires.length, 14,
    "la carte ne compte plus 14 tables : ajustez cette épreuve en même temps"
    + " que la migration, pour qu'elle les vérifie TOUTES");
  const inconnues = paires.filter((p) => !connues.has(boiteDeCle(p.boite)));
  assert.deepEqual(inconnues.map((p) => p.table + " → " + p.boite), [],
    "case(s) inexistante(s) : elles n'accorderaient rien à personne et"
    + " verrouilleraient l'écran sans aucune erreur");
  //  Et deux correspondances qu'il ne faut pas confondre, parce qu'elles
  //  déplaceraient des moyennes ou ouvriraient le cahier d'un collègue.
  const par = Object.fromEntries(paires.map((p) => [p.table, p.boite]));
  assert.equal(par["coefficients_matieres"], "structure",
    "les coefficients de matières déplacent toutes les moyennes : ils"
    + " appartiennent à la case `structure`, que la direction seule détient");
  assert.equal(par["cahier_textes"], "cahier",
    "le cahier de textes appartient à la case de son écran");
});

test("🔴 une annonce de l'établissement reste visible par une responsable cloisonnée", () => {
  //  🔴 LE PÉRIMÈTRE DES ANNONCES EST LE PLUS SUBTIL DU CHANTIER, parce
  //  qu'une annonce se cible de QUATRE façons : l'établissement entier (aucune
  //  des trois colonnes renseignée), un cycle, un niveau, ou une classe.
  //
  //  ⚠️ SI L'ON « RESSERRE » EN RETIRANT LA PORTE DE SORTIE, le resserrement
  //  a l'air plus sûr et casse l'application : la responsable du préscolaire ne
  //  verrait plus « Rentrée des classes 2026/27 », l'annonce que l'école
  //  adresse à TOUTES les familles. Elle perdrait les communications de son
  //  propre établissement — ce qui n'a aucun sens, et ne lui dirait rien :
  //  l'écran afficherait simplement une liste plus courte.
  //
  //  Mesuré sur les données réelles de Tut'Tank (3 annonces : une générale, une
  //  ciblée Élémentaire, une ciblée CM1) — bureau (Préscolaire) en voit 1,
  //  primaire (Élémentaire) en voit 3, et bureau ne peut ni publier pour
  //  l'autre cycle ni réécrire le règlement de l'élémentaire (0 ligne).
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "194_bascule_communication.sql"), "utf8"));

  const annonces = sql.slice(sql.indexOf("create policy annonces_acces"),
                             sql.indexOf("create policy messages_acces"));
  //  La garde par case, et PAS `est_membre_ecole` — ce helper vaut vrai pour
  //  les parents : une annonce deviendrait publiable par une famille.
  assert.match(annonces, /a_acces\('annonces'\)/,
    "les annonces appartiennent à la case `annonces` : sans elle, l'écriture"
    + " était ouverte à TOUT le personnel (le défaut corrigé par la mig. 194)");
  assert.ok(!annonces.includes("est_membre_ecole"),
    "`est_membre_ecole()` vaut vrai pour les PARENTS : il ouvrirait la"
    + " publication d'annonces au nom de l'école aux familles");

  //  La porte de sortie, présente DANS LES DEUX moitiés de la policy : sans
  //  elle dans le `with check`, la responsable verrait l'annonce générale sans
  //  pouvoir en publier une — l'asymétrie que la mig. 179 a déjà coûtée.
  const porte = /classe_id is null and niveau_id is null and cycle_id is null/g;
  assert.equal((annonces.match(porte) || []).length, 2,
    "la porte de sortie « annonce de tout l'établissement » doit figurer dans"
    + " le `using` ET dans le `with check` : une responsable cloisonnée doit"
    + " LIRE et POUVOIR PUBLIER les communications générales de son école");
  //  Et le niveau se compare par REMONTÉE vers son cycle : une annonce
  //  adressée au niveau « GS » concerne la responsable du préscolaire.
  assert.match(annonces, /from niveaux n[\s\S]*?n\.cycle_id = any/,
    "une annonce ciblée sur un NIVEAU doit remonter à son cycle, sinon elle"
    + " échappe à la responsable du cycle concerné");

  const messages = sql.slice(sql.indexOf("create policy messages_acces"));
  assert.match(messages, /a_acces\('messagerie'\)/,
    "la messagerie appartient à sa case");
  //  ⚠️ LA REMONTÉE TUTEUR → ENFANTS, sans laquelle le cloisonnement ne tient
  //  pas : un fil se rattache SOIT à un élève, SOIT à un tuteur, les deux
  //  colonnes étant nullables. Comparer seulement `eleve_id` laisserait passer
  //  TOUS les fils de parents de l'école — c'est-à-dire l'essentiel de la
  //  table, puisque c'est par là que les familles écrivent.
  assert.match(messages, /from eleve_tuteurs et[\s\S]*?peut_voir_eleve\(et\.eleve_id\)/,
    "un fil de parent (`tuteur_id` renseigné, `eleve_id` nul) doit être"
    + " cloisonné en remontant aux ENFANTS du tuteur : sans cette remontée, une"
    + " responsable cloisonnée lit toutes les conversations de l'école");
});

test("🔴 les notes du supérieur ne se lisent plus par tout le personnel", () => {
  //  🔴 LE DÉFAUT QUE LA MIGRATION 195 FERME. `notes_lmd_select`,
  //  `releves_select` et `deliberations_select` n'avaient pour prédicat que
  //  `ecole_id = ecole_courante()`. Dans une université, le bibliothécaire, le
  //  surveillant, la RH, le magasinier lisaient donc **toutes les notes et
  //  tous les relevés de tous les étudiants**. C'est la famille du défaut
  //  corrigé par la migration 173 côté école, jamais appliquée au supérieur.
  //
  //  Mesuré : l'enseignant de l'UCAD lisait 1 relevé et 1 délibération, il en
  //  lit 0 ; ses 10 autres lectures sont inchangées.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "195_bascule_superieur_lmd.sql"), "utf8"));
  const paires = [...sql.matchAll(/array\['([a-z_]+)',\s*'([a-z_:,]+)',\s*'([a-zA-Z_:]+)'\]/g)]
    .map((m) => ({ table: m[1], lecture: m[2], ecriture: m[3] }));
  assert.equal(paires.length, 12,
    "la carte du supérieur ne compte plus 12 tables : ajustez cette épreuve en"
    + " même temps que la migration, pour qu'elle les vérifie TOUTES");
  const par = Object.fromEntries(paires.map((p) => [p.table, p]));

  //  Les trois lectures resserrées, et par les BONNES cases.
  for (const t of ["notes_lmd", "releves", "deliberations"]) {
    assert.match(par[t].lecture, /^boites:/,
      `la lecture de ${t} doit être réservée à des cases : sinon tout le`
      + " personnel de l'université lit les notes des étudiants");
  }
  //  ⚠️ ET LE COUPLAGE QUI M'AURAIT CASSÉ LE PV : l'écran Délibérations LIT
  //  `notes_lmd` pour calculer les moyennes (`Deliberations.jsx:55`). Sans sa
  //  case dans la lecture, le PV se calculerait sur zéro note — EN SILENCE,
  //  car une lecture refusée par la RLS ne lève rien, elle rend 0 ligne.
  assert.ok(par["notes_lmd"].lecture.includes("deliberations_sup"),
    "l'écran Délibérations lit `notes_lmd` pour délibérer : sa case doit"
    + " figurer dans la lecture des notes, sinon le procès-verbal se calcule"
    + " sur zéro note sans qu'aucune erreur ne le signale");

  //  Les neuf référentiels gardent une lecture LARGE : ils composent
  //  l'affichage de presque tous les écrans du supérieur.
  for (const t of ["filieres", "semestres", "ue", "ecue", "inscriptions_sup"]) {
    assert.equal(par[t].lecture, "tenant",
      `${t} est un référentiel : fermer sa lecture viderait des grilles en`
      + " silence, comme l'aurait fait `classes` à la migration 186");
  }
  //  ⚠️ `emplois_sup` garde `est_membre_ecole` : les ÉTUDIANTS lisent leur
  //  emploi du temps, et pour eux `ecole_courante()` vaut NULL.
  assert.equal(par["emplois_sup"].lecture, "membres",
    "les étudiants consultent l'emploi du temps de leurs séances :"
    + " `ecole_courante()` vaut NULL pour eux, il faut `est_membre_ecole`");
  //  ⚠️ ET SON ÉCRITURE N'ÉLARGIT PAS : la case `emploi_sup` couvre aussi
  //  l'enseignant, alors que la base réservait l'écriture à la direction.
  assert.equal(par["emplois_sup"].ecriture, "_DIRECTION:emploi_sup",
    "la case `emploi_sup` SEULE élargirait l'écriture de l'emploi du temps aux"
    + " enseignants : il faut exiger aussi le pouvoir `p_toutes_classes`,"
    + " qui reproduit exactement {promoteur, direction}");

  //  Toute case nommée existe. `boite_de_cle()` rend son argument tel quel,
  //  donc une faute de frappe verrouillerait l'écran sans aucune erreur.
  const connues = new Set([
    ...MODELES.flatMap((m) => boitesDuModele(m.id)),
    ...boitesDeLArbre(arbreDesCases(MIXTE)),
    ...POUVOIRS.map((p) => p.id),
  ]);
  const citees = paires.flatMap((p) => [
    ...p.lecture.replace("boites:", "").split(",").filter((b) => b && b !== "tenant" && b !== "membres"),
    p.ecriture.replace("_DIRECTION:", ""),
  ]);
  const inconnues = [...new Set(citees)].filter((b) => !connues.has(boiteDeCle(b)));
  assert.deepEqual(inconnues, [],
    "case(s) inexistante(s) : elles n'accorderaient rien à personne et"
    + " verrouilleraient l'écran sans aucune erreur");
});

test("🔴 décocher « Messagerie » doit fermer les RPC, pas seulement l'écran", () => {
  //  🔴 LE DÉFAUT QUE LA MIGRATION 194 AVAIT LAISSÉ, ET QUE J'AI MESURÉ.
  //  La 194 a basculé les TABLES `annonces` et `messages`, et je m'y suis
  //  arrêté. Or la messagerie école ↔ familles ne passe PAS par la table :
  //  elle passe par quatre fonctions `security definer`, qui contournent la
  //  RLS par construction.
  //
  //  Mesuré avant la 196, en transaction annulée : case « Messagerie »
  //  décochée → la table `messages` rend **0** ligne (la 194 ferme bien) mais
  //  `ecole_conversations()` rend encore **4** conversations. La case était
  //  défaite par la couche RPC. Après la 196 : 0, et les deux autres lèvent.
  //
  //  ⚠️ Le défaut n'était pas exploitable AUJOURD'HUI, parce que les cases
  //  reflètent encore les rôles après le backfill. Il se serait manifesté au
  //  premier décochage — c'est-à-dire dès que l'arbre à cocher sert à
  //  quelque chose.
  const sql = sansCommentaires(fs.readFileSync(
    path.join(DOSSIER_MIG, "196_rpc_communication_oubliees.sql"), "utf8"));

  //  Les quatre fonctions de messagerie passent à la case…
  for (const f of ["ecole_conversations", "ecole_conversations_etudiants",
                   "ecole_fil_parent", "ecole_envoyer_parent"]) {
    const i = sql.indexOf(`function public.${f}(`);
    assert.ok(i > 0, `la migration doit redéfinir ${f}`);
    const corps = sql.slice(i, sql.indexOf("$fn$;", i));
    assert.match(corps, /a_acces\('messagerie'\)/,
      `${f} contourne la RLS : sans la case dans son corps, décocher`
      + " « Messagerie » masque l'écran et laisse la RPC servir");
    assert.ok(!/a_role\('(direction|comptable|secretaire)'\)/.test(corps),
      `${f} garde une branche par RÔLE : la case ne déciderait plus rien`
      + " (le défaut « ne pas garder les deux »)");
    //  ⚠️ ET LE PÉRIMÈTRE, structurellement absent de ces fonctions : la
    //  conjonction que la 194 a posée sur `messages` ne les gouverne pas.
    assert.match(corps, /peut_voir_eleve\(/,
      `${f} doit porter le périmètre à la main : « security definer »`
      + " contourne la RLS, c'est la leçon de la migration 167");
  }
  //  …et la notification de masse aux familles relève de `annonces`.
  const notif = sql.slice(sql.indexOf("function public._notifier_parents_ecole"));
  assert.match(notif.slice(0, notif.indexOf("$fn$;")), /a_acces\('annonces'\)/,
    "notifier toutes les familles de l'école relève de la case `annonces`");
  //  ⚠️ ET SA BRANCHE SYSTÈME RESTE : `auth.uid() is null` = appel du cron.
  //  La retirer casserait les relances automatiques de 07h00.
  assert.match(notif.slice(0, notif.indexOf("$fn$;")), /auth\.uid\(\) is not null/,
    "la branche d'appel système (cron, clé de service) doit rester : sans"
    + " elle, les relances automatiques de 07h00 lèveraient toutes");

  //  ⚠️ ET `_annonce_visible_par` N'EST PAS TOUCHÉE, délibérément : elle est
  //  appelée par la policy `fichiers_ecole_select`, donc elle décide qui peut
  //  ouvrir la PIÈCE JOINTE d'une annonce. Sa liste de rôles inclut
  //  l'enseignant : c'est un test de DESTINATAIRE, pas une permission de
  //  gestion. La remplacer par `a_acces('annonces')` rendrait ces pièces
  //  jointes illisibles aux enseignants — en silence.
  assert.ok(!sql.includes("_annonce_visible_par("),
    "`_annonce_visible_par` décide qui ouvre la pièce jointe d'une annonce"
    + " (policy `fichiers_ecole_select`) : la basculer sur `a_acces('annonces')`"
    + " retirerait aux enseignants l'accès aux pièces jointes de l'école");
});
