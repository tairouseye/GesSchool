// =====================================================================
//  Le menu est-il lisible, et mène-t-il où il dit ?
//
//  🔴 POURQUOI DES ÉPREUVES ICI. Trois défauts d'ergonomie relevés à
//  l'audit du 04/10 sont tous nés d'une évolution récente, et tous
//  étaient détectables mécaniquement :
//
//   1. depuis qu'un établissement peut couvrir l'élémentaire ET
//      l'université (mig. 168), le menu Pédagogie affichait DEUX entrées
//      « Notes » et DEUX « Emploi du temps », même libellé, même icône ;
//   2. un bibliothécaire atterrissait sur son catalogue à la connexion et
//      sur « À signer » en changeant d'espace — deux réponses à la même
//      question, parce que la règle n'était écrite qu'à un seul endroit ;
//   3. le rôle `bibliothecaire` était proposé à l'invitation dans une
//      école élémentaire, où aucun de ses écrans n'existe.
//
//  ⚠️ Ces épreuves portent sur l'ERGONOMIE du menu, pas sur les droits :
//  ceux-là sont tenus par la RLS et vérifiés avec de vraies sessions.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerPermissions } from "./bundle.helper.mjs";

const P = await chargerPermissions();
const { ESPACES, espacesAccessibles, premiereRoute, routeDAtterrissage,
        routeOuvrable, itemPourType, grouperItems, libelleItem, rolesInvitables } = P;

//  Les quatre formes d'établissement qui changent le menu.
const ETABLISSEMENTS = [
  { nom: "élémentaire seul", ecole: { paliers: ["elementaire"] } },
  { nom: "université seule", ecole: { type_etablissement: "superieur", paliers: ["universite"] } },
  { nom: "élémentaire → université", ecole: { type_etablissement: "superieur", paliers: ["elementaire", "college", "lycee", "universite"] } },
  { nom: "collège-lycée", ecole: { paliers: ["college", "lycee"] } },
];

const ROLES = ["admin_ecole", "direction", "enseignant", "surveillant", "comptable", "secretaire", "rh", "bibliothecaire"];

const visibles = (espace, roles, prom, ecole) =>
  (espace.items || []).filter((i) => routeOuvrable(i, roles, prom, null) && itemPourType(i, ecole));

test("🔴 jamais deux entrées de même libellé dans un même groupe", () => {
  const fautes = [];
  for (const { nom, ecole } of ETABLISSEMENTS) {
    for (const r of ROLES) {
      const prom = r === "admin_ecole";
      for (const e of espacesAccessibles([r], prom)) {
        for (const sec of grouperItems(visibles(e, [r], prom, ecole))) {
          const vus = new Map();
          for (const it of sec.items) {
            const lib = libelleItem(it, ecole);
            if (vus.has(lib)) fautes.push(`${nom} · ${r} · ${e.label} / ${sec.groupe || "—"} : « ${lib} » = ${vus.get(lib)} et ${it.to}`);
            else vus.set(lib, it.to);
          }
        }
      }
    }
  }
  assert.deepEqual(fautes, [],
    "deux entrées indiscernables dans le même groupe : ajoutez un `labelMixte`");
});

test("une précision n'apparaît que si elle lève une ambiguïté", () => {
  const notes = ESPACES.flatMap((e) => e.items).find((i) => i.to === "/notes-lmd");
  //  ⚠️ `/eleves` figure dans DEUX espaces, avec deux intitulés voulus :
  //  « Élèves & inscriptions » en Gestion, « Élèves » en Pédagogie. On nomme
  //  donc l'espace, sinon on éprouve une entrée au hasard.
  const eleves = ESPACES.find((e) => e.id === "pedagogie").items.find((i) => i.to === "/eleves");
  //  Université seule : « Notes » suffit, « Notes (UE) » serait du bruit.
  assert.equal(libelleItem(notes, ETABLISSEMENTS[1].ecole), "Notes");
  //  Établissement mixte : il FAUT distinguer.
  assert.equal(libelleItem(notes, ETABLISSEMENTS[2].ecole), "Notes (UE)");
  //  Et `labelSup` garde sa logique propre : « Étudiants » seulement pour un
  //  établissement exclusivement universitaire.
  assert.equal(libelleItem(eleves, ETABLISSEMENTS[1].ecole), "Étudiants");
  assert.equal(libelleItem(eleves, ETABLISSEMENTS[2].ecole), "Élèves");
  assert.equal(libelleItem(eleves, ETABLISSEMENTS[0].ecole), "Élèves");
});

test("🔴 changer d'espace mène là où la connexion mènerait", () => {
  //  La règle « une page d'atterrissage est du TRAVAIL, pas un utilitaire »
  //  ne vivait que dans `premiereRoute` ; `Layout` prenait la première entrée
  //  du menu. Les deux doivent maintenant répondre pareil.
  for (const { nom, ecole } of ETABLISSEMENTS) {
    for (const r of ROLES) {
      const prom = r === "admin_ecole";
      const espaces = espacesAccessibles([r], prom).filter((e) => visibles(e, [r], prom, ecole).length > 0);
      if (espaces.length === 0) continue;
      const connexion = premiereRoute([r], prom, null, ecole);
      const premierEspace = routeDAtterrissage(espaces[0], [r], prom, null, ecole);
      assert.equal(connexion, premierEspace,
        `${nom} · ${r} : la connexion mène à ${connexion}, le changement d'espace à ${premierEspace}`);
      //  Et dans CHAQUE espace, on n'atterrit sur un utilitaire que s'il n'y
      //  a vraiment rien d'autre.
      for (const e of espaces) {
        const to = routeDAtterrissage(e, [r], prom, null, ecole);
        const items = visibles(e, [r], prom, ecole);
        const travail = items.filter((i) => !i.transverse);
        if (travail.length > 0) {
          assert.ok(travail.some((i) => i.to === to),
            `${nom} · ${r} · ${e.label} : atterrit sur ${to}, un utilitaire, alors que ${travail[0].to} est ouvert`);
        }
      }
    }
  }
});

test("🔴 on ne propose pas un rôle que l'établissement ne peut pas utiliser", () => {
  const ecole = ETABLISSEMENTS[0].ecole;        // élémentaire : pas de bibliothèque
  const universite = ETABLISSEMENTS[1].ecole;
  for (const r of ["admin_ecole", "direction"]) {
    assert.ok(!rolesInvitables([r], ecole).includes("bibliothecaire"),
      `${r} ne doit pas pouvoir inviter un bibliothécaire dans une école élémentaire`);
    assert.ok(rolesInvitables([r], universite).includes("bibliothecaire"),
      `${r} doit pouvoir inviter un bibliothécaire au supérieur`);
  }
  //  Sans établissement, rien n'est retiré : les appels existants gardent
  //  leur comportement.
  assert.ok(rolesInvitables(["admin_ecole"]).includes("bibliothecaire"));
});

test("l'épreuve des libellés détecte bien ce qu'elle traque", () => {
  //  Garde-fou du garde-fou : sans `labelMixte`, les deux « Notes » doivent
  //  être signalées. On le vérifie sur une copie, sans toucher au vrai menu.
  const faux = [
    { to: "/a", label: "Notes", groupe: "Évaluation", cle: "notes" },
    { to: "/b", label: "Notes", groupe: "Évaluation", cle: "notes" },
  ];
  const libs = faux.map((i) => libelleItem(i, ETABLISSEMENTS[2].ecole));
  assert.equal(libs[0], libs[1], "deux entrées sans labelMixte restent indiscernables");
});

test("🔴 aucune page ne devient gratuite par oubli", () => {
  //  `moduleActif` répond `true` pour une clé inconnue de `MODULES` : une
  //  page sans module est donc une page « cœur », toujours offerte et jamais
  //  facturable. C'est volontaire pour les accueils et les utilitaires —
  //  mais douze clés du supérieur s'y sont retrouvées par simple oubli, si
  //  bien qu'une université en formule d'entrée reçoit filières, admissions,
  //  inscriptions, notes et délibérations gratuitement, pendant qu'une école
  //  élémentaire paie « Vie scolaire » pour faire l'appel.
  //
  //  ⚠️ CETTE ÉPREUVE NE TRANCHE PAS LA QUESTION COMMERCIALE : rattacher ces
  //  clés verrouillerait des pages aujourd'hui ouvertes à sept écoles, et
  //  cela se décide avec la grille de prix université. Elle FIGE l'existant :
  //  toute NOUVELLE page devra être rattachée à un module, ou ajoutée ici
  //  avec sa raison. C'est l'oubli silencieux qu'on interdit, pas le choix.
  const COEUR_ASSUME = [
    //  Utilitaires et accueils : jamais facturables, par nature.
    "membres", "signatures", "parametres",
    "_pilotage", "_gestion", "_pedagogie", "_passage_annee",
    "_abonnement", "_organigramme", "_documentation", "_journal",
    //  Scolarité : indissociables du socle (un élève a des parents, une photo).
    "codes_parents", "photos",
    //  ⬜ DETTE CONNUE — branche « supérieur » et deux écrans d'école, hors
    //  module par oubli. Voir l'audit du 04/10 (point C3), à traiter avec la
    //  tarification université.
    "acquis", "programmation",
    "appel_sup", "emploi_sup", "codes_etudiants", "filieres",
    "admissions", "inscriptions_sup", "notes_lmd", "deliberations_sup",
  ];
  const cles = [...new Set(ESPACES.flatMap((e) => e.items.map((i) => i.cle)))];
  const sansModule = cles.filter((c) => !P.moduleDeCle(c));
  const nouvelles = sansModule.filter((c) => !COEUR_ASSUME.includes(c));
  assert.deepEqual(nouvelles, [],
    "page(s) sans module : rattachez-les dans modules.js, ou inscrivez-les dans "
    + "COEUR_ASSUME avec la raison");
  //  Et symétriquement : une clé retirée du menu doit sortir de cette liste,
  //  sinon elle masque un futur oubli.
  const obsoletes = COEUR_ASSUME.filter((c) => !cles.includes(c));
  assert.deepEqual(obsoletes, [], "clé(s) absente(s) du menu à retirer de COEUR_ASSUME");
});
