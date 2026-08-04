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

test("les formules empilent bien leurs modules (Confort ⊃ Essentiel, etc.)", () => {
  const ess = new Set(P.modulesDeFormule("essentiel"));
  const conf = new Set(P.modulesDeFormule("confort"));
  const tout = new Set(P.modulesDeFormule("tout"));
  for (const m of ess) assert.ok(conf.has(m), `Confort doit contenir ${m}`);
  for (const m of conf) assert.ok(tout.has(m), `Premium doit contenir ${m}`);
});
