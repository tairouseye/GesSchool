// =====================================================================
//  Journal des actes — résolution de l'auteur et libellés
//
//  Née d'un défaut signalé le 28/09/2026 : la page ne s'ouvrait pas du tout,
//  sur « Could not find a relationship between 'journal_audit' and
//  'utilisateur' in the schema cache ». `journal_audit.utilisateur` est un
//  uuid SANS clé étrangère (mig. 079), or un embed PostgREST exige une
//  relation déclarée.
//
//  On n'a PAS ajouté la clé étrangère : en `on delete set null`, supprimer un
//  compte effacerait l'auteur de tous ses actes — la seule chose qu'un
//  journal d'audit ne doit jamais perdre. Les noms sont donc résolus à part,
//  et c'est ce recollage que ces tests gardent.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const journal = () => chargerLib("journal", ['export * from "@/lib/journal.js";']);

test("les uuid à résoudre sont distincts, non nuls, et rien de plus", async () => {
  const { auteursARésoudre } = await journal();
  // Relevé réel : sur une page de 25 actes de l'école démo, un seul auteur
  // distinct, et plusieurs lignes sans auteur (actes faits hors session
  // utilisateur — éditeur SQL ou clé de service).
  const lignes = [
    { utilisateur: "u1" }, { utilisateur: "u1" }, { utilisateur: null },
    { utilisateur: "u2" }, {}, { utilisateur: undefined },
  ];
  assert.deepEqual(auteursARésoudre(lignes), ["u1", "u2"]);
  assert.deepEqual(auteursARésoudre([]), [], "aucune ligne ⇒ aucune requête à faire");
  assert.deepEqual(auteursARésoudre([{ utilisateur: null }]), [],
    "que des actes sans auteur ⇒ ne pas interroger le serveur pour rien");
});

test("le recollage rend la même forme que l'embed disparu", async () => {
  const { attacherAuteurs } = await journal();
  const lignes = [{ id: "a", utilisateur: "u1" }, { id: "b", utilisateur: "u2" }];
  const [x, y] = attacherAuteurs(lignes, [{ id: "u1", prenom: "Binette", nom: "Gueye Fall" }]);
  // La page lit `l.profils` : la forme doit être exactement celle de l'embed.
  assert.deepEqual(x.profils, { prenom: "Binette", nom: "Gueye Fall" });
  assert.equal(x.id, "a", "les autres champs de la ligne sont conservés");
  // 🔴 Le point qui compte : un auteur non résolu reste `null`. Un objet aux
  // champs vides afficherait « · par   » au lieu de « auteur non identifié ».
  assert.equal(y.profils, null);
});

test("un acte sans auteur n'en reçoit pas un par accident", async () => {
  const { attacherAuteurs } = await journal();
  // `par.get(undefined)` doit rester vide, même si la table des profils en
  // contient : un acte fait hors session ne doit jamais être imputé à quelqu'un.
  const [l] = attacherAuteurs([{ id: "a", utilisateur: null }],
    [{ id: "u1", prenom: "Binette", nom: "Gueye Fall" }]);
  assert.equal(l.profils, null);
  assert.deepEqual(attacherAuteurs([], []), []);
  assert.deepEqual(attacherAuteurs(undefined, undefined), []);
});

test("⚠️ tout ce que les déclencheurs écrivent porte un libellé", async () => {
  const { ENTITES, OPERATIONS } = await journal();
  // Relevé en base le 28/09/2026 sur les 137 actes existants. 101 d'entre eux
  // — la majorité du journal — portaient `salaire_ligne / suppr_ligne`, que
  // ni ENTITES ni OPERATIONS ne connaissaient : affichés bruts, et surtout
  // impossibles à filtrer. La paie journalise depuis la mig. 079 ; seul le
  // volet pédagogique (134-135) avait été déclaré.
  const observees = {
    entites: ["salaire_ligne", "notes", "salaire", "factures", "notes_lmd",
              "contrat", "eleves", "inscriptions_sup"],
    operations: ["suppr_ligne", "DELETE", "validation", "devalidation",
                 "UPDATE", "modif_salaire_base"],
  };
  const cles = ENTITES.map(([v]) => v);
  for (const e of observees.entites) {
    assert.ok(cles.includes(e), `entité « ${e} » sans libellé : elle s'affichera brute et sera hors du filtre`);
  }
  for (const o of observees.operations) {
    assert.ok(OPERATIONS[o], `opération « ${o} » sans libellé`);
  }
  // Les tons doivent exister dans le composant Badge, sinon la pastille est nue.
  const tonsValides = ["neutre", "navy", "or", "success", "warning", "danger", "info"];
  for (const [op, o] of Object.entries(OPERATIONS)) {
    assert.ok(tonsValides.includes(o.ton), `ton « ${o.ton} » inconnu de Badge (opération ${op})`);
    assert.ok(o.label && o.label !== op, `l'opération ${op} doit porter un libellé lisible`);
  }
});

test("lireDetails : une suppression se lit comme un avant sans après", async () => {
  const { lireDetails } = await journal();
  const champs = lireDetails({ ligne_supprimee: { id: "x", valeur: 12, absent: false, vide: "" } });
  // Les champs nuls ou vides sont écartés : un diff doit montrer ce qui existait.
  assert.deepEqual(champs.map((c) => c.champ).sort(), ["absent", "id", "valeur"]);
  assert.ok(champs.every((c) => c.apres === null));
  assert.deepEqual(lireDetails(null), []);
  assert.deepEqual(lireDetails("texte"), []);
  // Un diff classique garde avant ET après.
  assert.deepEqual(lireDetails({ note: { avant: 10, apres: 12 } }),
    [{ champ: "note", avant: 10, apres: 12 }]);
});
