// =====================================================================
//  Traduction des messages d'erreur — les deux sens comptent
//
//  🔴 POURQUOI CETTE ÉPREUVE EXISTE.
//  `messageErreur` était branché sur les toasts seulement. Les bandeaux,
//  eux, affichaient le message brut : la même panne disait « Vous n'avez
//  pas les droits pour cette action. » d'un côté, et
//  `new row violates row-level security policy for table "factures"` de
//  l'autre. 152 appels dans 68 pages. En branchant la traduction sur
//  `Alerte`, ce fichier devient le chemin de TOUS les messages d'erreur.
//
//  ⚠️ D'où un risque NOUVEAU, et c'est lui que l'épreuve surveille : les
//  phrases françaises que l'application écrit elle-même traversent
//  désormais les mêmes expressions. La règle `/session/` réécrivait
//  « session de rattrapage » en « Session expirée. Reconnectez-vous. » —
//  on envoyait l'utilisateur se reconnecter pour rien.
//
//  Les deux sens sont donc vérifiés :
//   1. un message technique anglais DOIT être traduit ;
//   2. une phrase française de l'application NE DOIT PAS être touchée.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chargerLib } from "./bundle.helper.mjs";

const RACINE = process.cwd();
const { messageErreur } = await chargerLib("erreurs", ['export * from "@/lib/erreurs.js";']);

// --- Sens 1 : les messages techniques réels sont traduits -------------
//  Tous ceux-ci sont des messages que Postgres, PostgREST ou Supabase Auth
//  renvoient vraiment — pas des exemples inventés.
const TECHNIQUES = [
  ['new row violates row-level security policy for table "factures"', /droits/i],
  ['permission denied for table bulletins', /droits/i],
  ['duplicate key value violates unique constraint "eleves_matricule_key"', /existe déjà/i],
  ['null value in column "annee_id" of relation "factures" violates not-null constraint', /obligatoire/i],
  ['new row for relation "seances" violates check constraint "seances_session_check"', /pas acceptée/i],
  ['update or delete on table "classes" violates foreign key constraint "inscriptions_classe_id_fkey"', /utilisé ailleurs/i],
  //  Message relevé tel quel sur l'API de production (2026-10-04) : le parent
  //  manque, ce n'est PAS un verrou de suppression. Les deux disaient
  //  « utilisé ailleurs », ce qui était un contresens pour celui-ci.
  ['insert or update on table "facture_compteurs" violates foreign key constraint "facture_compteurs_ecole_id_fkey"', /n'existe plus/i],
  ['invalid input syntax for type uuid: "abc"', /format/i],
  ['value too long for type character varying(20)', /trop longue/i],
  ["Invalid login credentials", /mot de passe/i],
  ["User already registered", /compte existe déjà/i],
  ["Auth session missing!", /reconnect/i],
  ["JWT expired", /reconnect/i],
  ["Token has expired or is invalid", /invalide ou expiré/i],
  ["Email link is invalid or has expired", /invalide ou expiré/i],
  ["For security purposes, you can only request this after 54 seconds.", /tentatives/i],
  ["TypeError: Failed to fetch", /connexion/i],
];

test("🔴 un message technique ne doit jamais atteindre l'utilisateur tel quel", () => {
  for (const [brut, attendu] of TECHNIQUES) {
    const traduit = messageErreur(brut);
    assert.notEqual(traduit, brut, `non traduit : « ${brut} »`);
    assert.match(traduit, attendu, `mal traduit : « ${brut} » → « ${traduit} »`);
  }
});

test("une violation de contrainte dit QUEL geste corriger", () => {
  //  Les trois étaient confondues sous « cet élément est utilisé ailleurs »,
  //  qui ne vaut que pour la clé étrangère : un champ vide et une valeur
  //  refusée demandent deux gestes différents de l'utilisateur.
  const nul = messageErreur('null value in column "nom" violates not-null constraint');
  const check = messageErreur('violates check constraint "frais_portee_check"');
  const fk = messageErreur('violates foreign key constraint "x_fkey"');
  assert.notEqual(nul, check);
  assert.notEqual(check, fk);
  assert.notEqual(nul, fk);
  //  Et les deux sens de la clé étrangère ne disent pas la même chose.
  const parentManquant = messageErreur('insert or update on table "factures" violates foreign key constraint "f_eleve_fkey"');
  const encoreUtilise = messageErreur('update or delete on table "eleves" violates foreign key constraint "f_eleve_fkey"');
  assert.notEqual(parentManquant, encoreUtilise,
    "un parent manquant et un verrou de suppression demandent deux gestes différents");
});

// --- Sens 2 : les phrases françaises de l'application sont intouchées --
const FRANCAIS = [
  "Choisissez une classe et une période.",
  "Session normale",                                    // module Supérieur
  "La session de rattrapage n'est pas ouverte.",        // le piège d'origine
  "Aucune session de délibération pour ce semestre.",
  "Cette permission ne vous est pas accordée.",
  "Le réseau de transport n'a pas de circuit.",
  "Un bulletin se crée en brouillon.",
  "Jeton de liaison introuvable.",
  "Les notes sont déjà saisies pour cette évaluation.",
  "Le fichier est trop volumineux.",
  //  Les deux seuls bandeaux au ton « erreur » dont le texte est construit à
  //  l'exécution (Abonnement.jsx) : « expiré » en français ne doit pas être
  //  confondu avec « expired » en anglais.
  "Votre abonnement a expiré le 12 juin 2026. Contactez GesPro pour le renouveler.",
  "Vous dépassez le palier « Essentiel » (120 élèves pour 100).",
];

test("🔴 une phrase écrite par l'application traverse sans être réécrite", () => {
  for (const m of FRANCAIS) {
    assert.equal(messageErreur(m), m,
      `réécrite à tort : « ${m} » → « ${messageErreur(m)} »`);
  }
});

test("🔴 AUCUN message français du code n'est réécrit", () => {
  //  L'épreuve ci-dessus juge une liste choisie ; celle-ci balaie le code
  //  réel. C'est elle qui attrapera la prochaine règle trop large.
  const dossiers = ["src/pages", "src/lib", "src/composants"];
  const messages = new Map();
  for (const d of dossiers) {
    for (const f of fs.readdirSync(path.join(RACINE, d))) {
      if (!/\.(jsx?|mjs)$/.test(f)) continue;
      const src = fs.readFileSync(path.join(RACINE, d, f), "utf8");
      for (const m of src.matchAll(/(?:setErreur|onErreur|toast\.erreur|new Error)\(\s*"([^"]{4,})"/g)) {
        if (!messages.has(m[1])) messages.set(m[1], `${d}/${f}`);
      }
    }
  }
  //  Et les exceptions levées en base : l'utilisateur les lit aussi.
  const mig = path.join(RACINE, "supabase", "migrations");
  for (const f of fs.readdirSync(mig)) {
    if (!f.endsWith(".sql")) continue;
    const src = fs.readFileSync(path.join(mig, f), "utf8");
    for (const m of src.matchAll(/raise exception\s*'([^']{4,})'/gi)) {
      if (!messages.has(m[1])) messages.set(m[1], `migrations/${f}`);
    }
  }
  assert.ok(messages.size > 100, `trop peu de messages collectés (${messages.size}) : le balayage ne cherche plus au bon endroit`);
  const fautives = [];
  for (const [m, f] of messages) {
    //  Un message contenant une accolade est un gabarit, pas une phrase.
    if (m.includes("${") || m.includes("%s")) continue;
    const t = messageErreur(m);
    if (t !== m) fautives.push(`${f} : « ${m} » → « ${t} »`);
  }
  assert.deepEqual(fautives, [],
    "une règle de erreurs.js réécrit une phrase que l'application a écrite elle-même");
});

test("un message vide reste exploitable", () => {
  assert.match(messageErreur(""), /erreur/i);
  assert.match(messageErreur(null), /erreur/i);
  assert.match(messageErreur({}), /erreur/i);
  //  Les trois formes que renvoient Supabase et fetch.
  assert.match(messageErreur({ message: "Invalid login credentials" }), /mot de passe/i);
  assert.match(messageErreur({ error_description: "JWT expired" }), /reconnect/i);
});

test("🔴 le bandeau d'erreur traduit, comme le toast", () => {
  //  Les deux chemins doivent donner le même message pour la même panne,
  //  sinon on retombe exactement dans le défaut d'origine.
  const ui = fs.readFileSync(path.join(RACINE, "src", "composants", "ui.jsx"), "utf8");
  assert.match(ui, /messageErreur/,
    "ui.jsx n'appelle plus messageErreur : les bandeaux affichent de nouveau les messages bruts");
  const feedback = fs.readFileSync(path.join(RACINE, "src", "composants", "Feedback.jsx"), "utf8");
  assert.match(feedback, /messageErreur/, "Feedback.jsx ne traduit plus les toasts");
});
