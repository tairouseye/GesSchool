// Test de matrice — pour CHAQUE rôle et CHAQUE formule commerciale :
//   1. Aucun rôle disposant d'un espace accessible ne doit se retrouver sans
//      aucune page ouvrable (sinon écran « sans accès » = utilisateur bloqué).
//   2. Aucun couplage cassé entre modules : si une page est vendue (module
//      actif), l'infrastructure dont elle dépend doit l'être aussi.
//
// C'est ce test qui aurait attrapé le bug P1 (affectations enseignants
// verrouillées sous l'offre RH alors que appel/notes/emploi en dépendent).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerPermissions } from "./bundle.helper.mjs";

const P = await chargerPermissions();

const ROLES = ["direction", "comptable", "rh", "secretaire", "enseignant", "surveillant"];
const FORMULES = {
  "Basic (essentiel)": P.modulesDeFormule("essentiel"),
  "Classic (confort)": P.modulesDeFormule("confort"),
  "Premium (tout)": P.modulesDeFormule("tout"),
  "Tout activé (null)": null,
};

test("aucun rôle avec un espace accessible ne se retrouve sans page ouvrable", () => {
  for (const [fname, mods] of Object.entries(FORMULES)) {
    for (const role of ROLES) {
      const roles = [role];
      const esp = P.espacesAccessibles(roles, false);
      const first = P.premiereRoute(roles, false, mods);
      assert.ok(
        esp.length === 0 || first,
        `${role} @ ${fname}: espaces [${esp.map((e) => e.id)}] accessibles mais aucune page ouvrable`,
      );
    }
    assert.ok(P.premiereRoute([], true, mods), `promoteur @ ${fname}: aucune page ouvrable`);
  }
});

test("aucun couplage cassé : une page vendue a son infrastructure active", () => {
  // Pages consommatrices → infrastructure requise (par la logique métier).
  const DEPS = [
    { consommateur: "appel", besoin: "enseignants" },
    { consommateur: "notes", besoin: "enseignants" },
    { consommateur: "classement", besoin: "enseignants" },
    { consommateur: "emploi", besoin: "enseignants" },
    // La bibliothèque numérique n'a de sens qu'avec le module Bibliothèque.
    { consommateur: "biblio_numerique", besoin: "bibliotheque" },
    // Le dépôt institutionnel publie DANS le catalogue : il le suppose actif.
    { consommateur: "biblio_depots", besoin: "bibliotheque" },
  ];
  for (const [fname, mods] of Object.entries(FORMULES)) {
    if (mods === null) continue; // tout actif
    for (const d of DEPS) {
      const consoActif = P.moduleActif(mods, d.consommateur);
      const besoinActif = P.moduleActif(mods, d.besoin);
      assert.ok(
        !consoActif || besoinActif,
        `${fname}: '${d.consommateur}' (module ${P.moduleDeCle(d.consommateur)}) actif mais ` +
          `'${d.besoin}' (module ${P.moduleDeCle(d.besoin)}) verrouillé`,
      );
    }
  }
});

// Le bibliothécaire est à part : son espace n'existe que si l'établissement a
// souscrit le module Bibliothèque (vendu en option, hors formules). Il n'a donc
// pas sa place dans ROLES ci-dessus, qui décrit les rôles présents partout.
test("bibliothécaire : les pages biblio ne s''ouvrent qu''avec le module, et qu''au supérieur", () => {
  const roles = ["bibliothecaire"];
  const esp = P.espacesAccessibles(roles, false);
  assert.deepEqual(esp.map((e) => e.id), ["gestion", "pedagogie"],
    "le bibliothécaire emprunte les deux espaces où vit la bibliothèque (il n'en avait AUCUN avant)");

  // Module actif + établissement supérieur → il atterrit sur le catalogue.
  assert.equal(P.premiereRoute(roles, false, ["bibliotheque"], "superieur"), "/bibliotheque");

  // Module non souscrit : aucune page de bibliothèque n'est ouvrable. Depuis
  // que le rôle emprunte Pédagogie et Gestion, il n'est plus en cul-de-sac —
  // il retombe sur les transverses (« À signer », ouvert à tout le personnel).
  // Mieux qu'un écran « sans accès », mais l'essentiel reste vrai :
  for (const cle of ["bibliotheque", "biblio_circulation", "biblio_depots",
                     "biblio_acquisitions", "biblio_inventaire"]) {
    assert.equal(P.moduleActif(["scolarite"], cle), false,
      `${cle} ne doit pas être ouvrable sans le module Bibliothèque`);
  }

  // Même avec le module, une école (non supérieure) n'ouvre aucune page biblio :
  // toutes sont gatées `types:["superieur"]`.
  const bib = ["bibliotheque", "biblio_circulation", "biblio_depots",
               "biblio_acquisitions", "biblio_inventaire"];
  for (const esp of P.espacesAccessibles(roles, false)) {
    for (const it of esp.items.filter((i) => bib.includes(i.cle))) {
      assert.equal(P.itemPourType(it, "ecole"), false, `${it.cle} ne doit pas s'afficher en école`);
    }
  }
});

test("bibliothèque : réparties entre Pédagogie et Gestion selon leur nature", () => {
  const ped = P.espaceParId("pedagogie");
  const ges = P.espaceParId("gestion");
  assert.equal(P.espaceParId("bibliotheque"), null, "l'espace dédié a été dissous");

  const cles = (e) => e.items.filter((i) => i.groupe === "Bibliothèque").map((i) => i.cle);
  // Consulter, prêter, publier : pédagogique.
  assert.deepEqual(cles(ped), ["bibliotheque", "biblio_circulation", "biblio_depots"]);
  // Acheter et inventorier : prix d'achat, fournisseurs, biens → gestion.
  assert.deepEqual(cles(ges), ["bibliotheque", "biblio_acquisitions", "biblio_inventaire"]);

  // Une entrée que personne de l'espace ne peut ouvrir serait un leurre.
  assert.ok(P.peutVoir(["comptable"], "biblio_acquisitions"), "le comptable doit voir Acquisitions");
  assert.ok(P.peutVoir(["comptable"], "biblio_inventaire"), "le comptable doit voir Inventaire");
});

test("les formules empilent bien leurs modules (Confort ⊃ Essentiel, etc.)", () => {
  const ess = new Set(P.modulesDeFormule("essentiel"));
  const conf = new Set(P.modulesDeFormule("confort"));
  const tout = new Set(P.modulesDeFormule("tout"));
  for (const m of ess) assert.ok(conf.has(m), `Confort doit contenir ${m}`);
  for (const m of conf) assert.ok(tout.has(m), `Premium doit contenir ${m}`);
});

test("grouperItems : sections contiguës, entrées libres isolées, groupe solitaire déplié", () => {
  const g = P.grouperItems([
    { cle: "accueil" },                       // libre → isolée
    { cle: "a", groupe: "Éval" },
    { cle: "b", groupe: "Éval" },
    { cle: "c", groupe: "Vie" },              // seule de son groupe → dépliée
    { cle: "d", groupe: "Éval" },             // NON contigu → nouvelle section, donc seule → dépliée
    { cle: "membres" },                       // libre → isolée
  ]);
  assert.deepEqual(g.map((s) => [s.groupe, s.items.length]),
    [[null, 1], ["Éval", 2], [null, 1], [null, 1], [null, 1]]);
  // Aucune entrée perdue ni dupliquée.
  assert.equal(g.reduce((n, s) => n + s.items.length, 0), 6);
});

test("Pédagogie et Gestion : toutes leurs pages métier sont rangées en section", () => {
  // Accueils et utilitaires transverses restent volontairement libres.
  const libres = ["_pedagogie", "_gestion", "membres", "signatures", "parametres"];
  for (const id of ["pedagogie", "gestion"]) {
    const orphelines = P.espaceParId(id).items.filter((i) => !i.groupe && !libres.includes(i.cle));
    assert.deepEqual(orphelines.map((i) => i.cle), [],
      `toute page métier de ${id} doit porter un groupe`);
  }
});

test("les groupes de menu sont contigus : jamais deux fois le même en-tête", () => {
  for (const esp of P.ESPACES) {
    for (const type of ["ecole", "superieur"]) {
      const visibles = esp.items.filter((i) => P.itemPourType(i, type));
      const titres = P.grouperItems(visibles).map((s) => s.groupe).filter(Boolean);
      assert.deepEqual([...new Set(titres)], titres,
        `${esp.id} @ ${type} : en-tête de section répété (ordre de déclaration fragmenté) — ${titres}`);
    }
  }
});
