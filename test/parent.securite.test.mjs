// Cloisonnement de l'espace parent — contrôle STATIQUE des migrations.
//
// Pour chaque RPC appelée par l'espace parent, on retrouve sa DERNIÈRE
// définition (les migrations se rejouent dans l'ordre, la dernière gagne) et
// on vérifie :
//   1. qu'elle contrôle l'association parent ↔ enfant (`_parent_possede`, ou
//      un garde qui l'appelle) — ou, pour les RPC « mes_* » sans élève en
//      paramètre, qu'elle filtre sur `auth.uid()` ;
//   2. que le dernier état de ses droits exclut `anon`.
//
// Hors ligne, sans base : il attrape une régression (une future migration qui
// recrée une RPC sans son garde) au moment où elle est écrite. Le test en base
// réelle est supabase/tests/essai_208_parent.sql (recette).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("supabase/migrations");
const FICHIERS = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const SQL = FICHIERS.map((f) => ({ f, sql: fs.readFileSync(path.join(DIR, f), "utf8") }));

// Dernière définition d'une fonction : corps entre ses balises dollar.
function derniereDefinition(nom) {
  let dernier = null;
  for (const { f, sql } of SQL) {
    const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${nom}\\s*\\(`, "gi");
    let m;
    while ((m = re.exec(sql))) {
      const suite = sql.slice(m.index);
      const tag = suite.match(/\bas\s+(\$[a-z_]*\$)/i);
      if (!tag) continue;
      const debut = suite.indexOf(tag[1], tag.index) + tag[1].length;
      const fin = suite.indexOf(tag[1], debut);
      dernier = { f, corps: suite.slice(0, fin) };
    }
  }
  return dernier;
}

// Les droits d'exécution : on rejoue grant/revoke dans l'ordre, et on retient
// si `anon` (directement ou via `public`) peut exécuter à la fin.
function anonPeutExecuter(nom) {
  let anon = true; // défaut PostgreSQL : EXECUTE accordé à PUBLIC
  for (const { sql } of SQL) {
    // Une (re)création par `drop` + `create` remet les droits par défaut.
    const evts = [];
    const reDrop = new RegExp(`drop\\s+function\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${nom}\\s*\\(`, "gi");
    const reDroit = new RegExp(`(grant|revoke)\\s+(?:execute|all)[^;]*?function\\s+(?:public\\.)?${nom}\\s*\\([^;]*?(to|from)\\s+([^;]+);`, "gi");
    let m;
    while ((m = reDrop.exec(sql))) if (!/^\s*--/.test(sql.slice(sql.lastIndexOf("\n", m.index) + 1, m.index + 2))) evts.push({ i: m.index, t: "drop" });
    while ((m = reDroit.exec(sql))) {
      const ligne = sql.slice(sql.lastIndexOf("\n", m.index) + 1, m.index);
      if (/--/.test(ligne)) continue; // commenté
      evts.push({ i: m.index, t: m[1].toLowerCase(), roles: m[3].toLowerCase() });
    }
    for (const e of evts.sort((a, b) => a.i - b.i)) {
      if (e.t === "drop") anon = true;
      else if (/\b(anon|public)\b/.test(e.roles)) anon = e.t === "grant";
    }
  }
  return anon;
}

// RPC prenant un élève / une facture / un bulletin / une absence : il faut le garde.
const GARDEES = [
  "mon_acces_notes", "demander_acces_notes",
  "enfant_notes", "enfant_bulletins", "enfant_bulletin_lignes", "enfant_acquis",
  "enfant_factures", "enfant_facture_detail", "enfant_declarations",
  "enfant_absences", "justifier_absence_parent", "demander_document",
  "enfant_emploi", "enfant_fournitures", "enfant_cahier", "annonces_enfant",
  "enfant_cantine", "enfant_cantine_menu", "enfant_transport",
  "ecole_paiement_infos", "psp_etat_eleve", "declarer_paiement",
  "avance_options", "declarer_avance",
  "enfant_echeancier", "enfant_programme",
];
const GARDE = /_parent_possede\s*\(|_peut_payer_pour\s*\(/;

// RPC « mes_* » : pas d'élève en paramètre, le filtre est l'appelant.
const PAR_APPELANT = ["mes_enfants", "mes_demandes", "mes_conversations", "mes_messages_non_lus",
  "conversation_messages", "parent_envoyer"];

test("chaque RPC parent sur un enfant vérifie l'association parent ↔ enfant", () => {
  for (const nom of GARDEES) {
    const d = derniereDefinition(nom);
    assert.ok(d, `${nom} : définition introuvable dans les migrations`);
    assert.match(d.corps, GARDE, `${nom} (dernière définition : ${d.f}) ne vérifie pas _parent_possede`);
  }
});

test("les RPC parent sans élève en paramètre filtrent sur l'appelant", () => {
  for (const nom of PAR_APPELANT) {
    const d = derniereDefinition(nom);
    assert.ok(d, `${nom} : définition introuvable`);
    assert.match(d.corps, /auth\.uid\(\)/, `${nom} (${d.f}) ne filtre pas sur auth.uid()`);
  }
});

test("aucune RPC parent n'est exécutable par anon", () => {
  for (const nom of [...GARDEES, ...PAR_APPELANT]) {
    assert.equal(anonPeutExecuter(nom), false, `${nom} : exécutable par anon (aucun revoke … from public, anon)`);
  }
});

test("le garde interne _acces_notes_autorise n'est pas appelable directement", () => {
  assert.equal(anonPeutExecuter("_acces_notes_autorise"), false);
  const revoque = SQL.some(({ sql }) =>
    /revoke\s+execute\s+on\s+function\s+public\._acces_notes_autorise\(uuid\)\s+from\s+[^;]*authenticated/i.test(sql));
  assert.ok(revoque, "_acces_notes_autorise reste exécutable par authenticated");
});

test("une déclaration de paiement exige une preuve rangée dans le dossier de l'élève", () => {
  for (const nom of ["declarer_paiement", "declarer_avance"]) {
    const d = derniereDefinition(nom);
    assert.match(d.corps, /_preuve_de_eleve\s*\(/, `${nom} (${d.f}) ne contrôle pas le dossier de la preuve`);
  }
});

test("les lignes de bulletin ne sortent que d'un bulletin publié", () => {
  const d = derniereDefinition("enfant_bulletin_lignes");
  assert.match(d.corps, /'publie'/, `enfant_bulletin_lignes (${d.f}) ne filtre pas les bulletins publiés`);
});

test("les notes parent excluent les évaluations archivées (comme les bulletins)", () => {
  const d = derniereDefinition("enfant_notes");
  assert.match(d.corps, /ev\.actif/, `enfant_notes (${d.f}) inclut les évaluations archivées`);
});

//  Mig. 209 : `_eleve_courant()` vaut NULL pour un compte qui n'est pas un
//  élève. Comparé sans `coalesce`, il rend tout le OR NULL, et
//  `if not NULL then raise` ne lève rien : la garde échouait OUVERTE
//  (constaté en recette sur avance_options le 20/10/2026).
test("aucune garde d'accès ne compare _eleve_courant() sans coalesce", () => {
  for (const nom of [...GARDEES, "_peut_payer_pour"]) {
    const d = derniereDefinition(nom);
    for (const ligne of d.corps.split("\n")) {
      const code = ligne.replace(/--.*$/, "");
      if (/_eleve_courant\s*\(\s*\)\s*=|=\s*(?:public\.)?_eleve_courant\s*\(\s*\)/.test(code)) {
        assert.match(code, /coalesce\s*\(/, `${nom} (${d.f}) : « ${code.trim()} » peut valoir NULL`);
      }
    }
  }
});

//  Mig. 210 : l'échéancier, le tarif, la fratrie. Les fonctions internes ne
//  sont appelables par aucun client (elles ne vérifient aucun droit) ; les
//  RPC du personnel vérifient l'école ET un pouvoir, et refusent `anon`.
test("échéancier (mig. 210) : internes fermées, RPC gardées", () => {
  const revoqueClients = (nom) => SQL.some(({ sql }) =>
    new RegExp(String.raw`revoke\s+execute\s+on\s+function\s+public\.${nom}\([^)]*\)\s+from\s+[^;]*authenticated`, "i").test(sql));
  for (const nom of ["_echeancier", "_statut_paiement", "_tarif_scolarite", "_frais_eleve", "_fratrie", "_echeancier_json", "_garder_tarif_inscription", "_est_nouveau"]) {
    assert.ok(derniereDefinition(nom), `${nom} : introuvable`);
    assert.ok(revoqueClients(nom), `${nom} : reste exécutable par authenticated`);
  }
  const POUVOIR = /a_acces\('(encaissement|p_voir_impayes|p_frais|eleves)'\)/;
  for (const nom of ["eleve_echeancier", "fratrie_eleve", "definir_tarif_eleve", "tarifs_eleves", "definir_nouveau_eleve", "definir_fin_facturation"]) {
    const d = derniereDefinition(nom);
    assert.ok(d, `${nom} : introuvable`);
    assert.match(d.corps, /ecole_courante\(\)/, `${nom} (${d.f}) ne vérifie pas l'école`);
    assert.match(d.corps, POUVOIR, `${nom} (${d.f}) ne vérifie aucun pouvoir`);
    assert.match(d.corps, /coalesce\(/, `${nom} (${d.f}) : garde sans coalesce (leçon de la mig. 209)`);
    assert.equal(anonPeutExecuter(nom), false, `${nom} : exécutable par anon`);
  }
  //  Le tarif d'un élève est un acte de caisse : la policy d'écriture
  //  d'`inscriptions` (p_eleves_editer) ne doit pas suffire à le changer.
  const g = derniereDefinition("_garder_tarif_inscription");
  assert.match(g.corps, /a_acces\('p_frais'\)/);
});
