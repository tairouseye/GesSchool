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
test("bibliothécaire : espace ouvrable avec le module, dead-end explicite sans lui", () => {
  const roles = ["bibliothecaire"];
  const esp = P.espacesAccessibles(roles, false);
  assert.deepEqual(esp.map((e) => e.id), ["bibliotheque"],
    "le bibliothécaire doit avoir exactement l'espace Bibliothèque (il n'en avait AUCUN avant)");

  // Module actif + établissement supérieur → il atterrit sur le catalogue.
  assert.equal(P.premiereRoute(roles, false, ["bibliotheque"], "superieur"), "/bibliotheque");

  // Module non souscrit → aucune page. `premiereRoute` renvoie null, ce que
  // l'appelant traduit par un écran « sans accès » explicite, jamais par une
  // boucle de redirection. C'est une erreur de configuration (avoir nommé un
  // bibliothécaire sans acheter le module), pas un bug.
  assert.equal(P.premiereRoute(roles, false, ["scolarite"], "superieur"), null);

  // Même avec le module, une école (non supérieure) ne lui ouvre rien : toutes
  // les pages biblio sont gatées `types:["superieur"]`.
  assert.equal(P.premiereRoute(roles, false, ["bibliotheque"], "ecole"), null);
});

test("les pages biblio ont quitté Pédagogie pour leur espace dédié", () => {
  const ped = P.espaceParId("pedagogie");
  const bib = P.espaceParId("bibliotheque");
  assert.ok(bib, "l'espace Bibliothèque doit exister");
  for (const cle of ["bibliotheque", "biblio_circulation", "biblio_depots",
                     "biblio_acquisitions", "biblio_inventaire"]) {
    assert.ok(bib.items.some((i) => i.cle === cle), `${cle} doit être dans l'espace Bibliothèque`);
    assert.ok(!ped.items.some((i) => i.cle === cle), `${cle} ne doit plus être dans Pédagogie`);
  }
  // `direction` n'est pas un rôle complet : sans cette ligne, elle perdrait
  // l'accès au menu Bibliothèque en le sortant de Pédagogie.
  assert.ok(bib.roles.includes("direction"), "direction doit garder l'accès à l'espace");
  assert.ok(P.premiereRoute(["direction"], false, ["bibliotheque", "scolarite"], "superieur"),
    "direction doit conserver au moins une page ouvrable");
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

test("Pédagogie : toutes ses pages métier sont rangées dans une section", () => {
  const ped = P.espaceParId("pedagogie");
  // Les utilitaires transverses et l'accueil restent volontairement libres.
  const libres = ["_pedagogie", "membres", "signatures", "parametres"];
  const orphelines = ped.items.filter((i) => !i.groupe && !libres.includes(i.cle));
  assert.deepEqual(orphelines.map((i) => i.cle), [],
    "toute page métier de Pédagogie doit porter un groupe");
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
