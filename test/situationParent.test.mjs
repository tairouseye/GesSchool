// =====================================================================
//  Espace parent, « Paiements » — situation financière de l'enfant
//
//  Ce que l'épreuve verrouille :
//   • la synthèse (facturé, payé, reste) ignore les factures ANNULÉES et
//     les BROUILLONS — une dette annulée ne doit plus apparaître ;
//   • une facture annulée n'est jamais proposée au paiement ;
//   • une déclaration VALIDÉE quitte la liste « en attente / rejetées » ;
//   • les reçus : le plus récent est ouvert par défaut, celui demandé l'est
//     s'il existe ;
//   • la migration 206 garde le verrou parent et n'ouvre aucun droit.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargerLib } from "./bundle.helper.mjs";

const S = () => chargerLib("situationParent", ['export * from "@/lib/situationParent.js";']);

const FACTURES = [
  { id: "f1", numero: "F-1", montant_total: 65000, montant_paye: 65000, statut: "payee", nb_paiements: 2 },
  { id: "f2", numero: "F-2", montant_total: 65000, montant_paye: 20000, statut: "partiellement_payee", nb_paiements: 1 },
  { id: "f3", numero: "F-3", montant_total: 65000, montant_paye: 0, statut: "emise", nb_paiements: 0 },
  { id: "f4", numero: "F-4", montant_total: 50000, montant_paye: 0, statut: "annulee", nb_paiements: 0 },
  { id: "f5", numero: "F-5", montant_total: 30000, montant_paye: 0, statut: "brouillon", nb_paiements: 0 },
];

test("synthèse : facturé, payé et reste, sans les annulées ni les brouillons", async () => {
  const { syntheseFactures } = await S();
  const s = syntheseFactures(FACTURES);
  assert.equal(s.facture, 195000, "F-1 + F-2 + F-3 ; l'annulée et le brouillon ne comptent pas");
  assert.equal(s.paye, 85000);
  assert.equal(s.reste, 110000, "45 000 sur F-2 et 65 000 sur F-3");
  assert.equal(s.aRegler, 2);
  assert.equal(s.facture - s.paye, s.reste, "facturé − payé = reste");
});

test("synthèse : un trop-perçu ne réduit pas le reste des autres factures", async () => {
  const { syntheseFactures } = await S();
  const s = syntheseFactures([
    { montant_total: 10000, montant_paye: 15000, statut: "payee" },
    { montant_total: 10000, montant_paye: 0, statut: "emise" },
  ]);
  assert.equal(s.reste, 10000);
  assert.equal(s.paye, 10000, "le payé est plafonné au montant de chaque facture");
});

test("synthèse : aucune facture, rien à payer", async () => {
  const { syntheseFactures } = await S();
  assert.deepEqual(syntheseFactures([]), { facture: 0, paye: 0, reste: 0, aRegler: 0, nb: 0 });
  assert.equal(syntheseFactures(null).reste, 0);
});

test("état de chaque facture : à payer, partielle, réglée, annulée", async () => {
  const { etatFacture } = await S();
  const etats = FACTURES.slice(0, 4).map((f) => etatFacture(f).cle);
  assert.deepEqual(etats, ["reglee", "partielle", "a_payer", "annulee"]);
});

test("🔴 une facture annulée ne doit rien et n'est pas proposée au paiement", async () => {
  const { resteFacture, peutPayer } = await S();
  const annulee = FACTURES[3];
  assert.equal(resteFacture(annulee), 0);
  assert.equal(peutPayer(annulee), false);
  assert.equal(peutPayer(FACTURES[0]), false, "une facture réglée non plus");
  assert.equal(peutPayer(FACTURES[1]), true);
  assert.equal(peutPayer(FACTURES[2]), true);
});

test("le brouillon n'est pas montré ; l'annulée l'est (avec son état)", async () => {
  const { facturesVisibles } = await S();
  assert.deepEqual(facturesVisibles(FACTURES).map((f) => f.id), ["f1", "f2", "f3", "f4"]);
});

test("🔴 une déclaration validée quitte la liste « en attente / rejetées »", async () => {
  const { declarationsAffichees, enAttenteParFacture } = await S();
  const decl = [
    { id: "d1", statut: "valide", facture_id: "f1", montant: 65000 },
    { id: "d2", statut: "en_attente", facture_id: "f2", montant: 45000 },
    { id: "d3", statut: "rejete", facture_id: "f3", montant: 65000, motif: "Aucune preuve n’est jointe." },
    { id: "d4", statut: "en_attente", facture_id: null, montant: 65000, avance: "Novembre 2026" },
  ];
  const vues = declarationsAffichees(decl);
  assert.deepEqual(vues.map((d) => d.id), ["d2", "d3", "d4"]);
  assert.equal(vues.find((d) => d.id === "d3").motif, "Aucune preuve n’est jointe.", "le motif du rejet reste lisible");
  assert.deepEqual(enAttenteParFacture(decl), { f2: 45000 }, "seules les déclarations EN ATTENTE marquent leur facture");
});

test("reçus : la facture payée en propose, celle sans encaissement non", async () => {
  const { aDesRecus } = await S();
  assert.equal(aDesRecus(FACTURES[0]), true);
  assert.equal(aDesRecus(FACTURES[2]), false, "sans paiement, seule la facture reste accessible");
});

test("reçus : le plus récent est ouvert par défaut, sinon celui demandé", async () => {
  const { recuParDefaut } = await S();
  const paiements = [
    { id: "p1", montant: 30000, date_paiement: "2026-09-10" },
    { id: "p2", montant: 35000, date_paiement: "2026-10-02" },
    { id: "p3", montant: 1000, date_paiement: "2026-10-02" },
  ];
  assert.equal(recuParDefaut(paiements).id, "p3", "le plus récent ; à date égale, le dernier saisi");
  assert.equal(recuParDefaut(paiements, "p1").id, "p1");
  assert.equal(recuParDefaut(paiements, "inconnu").id, "p3", "un identifiant inconnu retombe sur le plus récent");
  assert.equal(recuParDefaut([]), null);
});

test("🔴 migration 206 : verrou parent conservé, aucun droit élargi", () => {
  const sql = readFileSync(new URL("../supabase/migrations/206_parent_paiements_recus.sql", import.meta.url), "utf8");
  for (const fn of ["enfant_factures", "enfant_declarations"]) {
    const corps = new RegExp(`create function public\\.${fn}\\(p_eleve uuid\\)[\\s\\S]*?end \\$function\\$;`).exec(sql);
    assert.ok(corps, `${fn} introuvable`);
    assert.match(corps[0], /security definer/);
    assert.match(corps[0], /if not public\._parent_possede\(p_eleve\) then raise exception/, `${fn} : le verrou parent doit précéder toute lecture`);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(uuid\\) from public, anon;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(uuid\\) to authenticated;`));
  }
  assert.doesNotMatch(sql, /create policy|alter policy|disable row level security|grant (select|insert|update|delete)/i,
    "aucune policy ni aucun droit de table ne doit être touché");
  assert.match(sql, /nb_paiements integer, dernier_paiement_id uuid\)/, "les encaissements sont comptés");
  assert.match(sql, /declarant text, facture_id uuid\)/, "la facture de la déclaration est rendue");
});

test("🔴 migration 207 : une facture annulée ne se déclare ni ne se valide", () => {
  const sql = readFileSync(new URL("../supabase/migrations/207_facture_annulee_non_payable.sql", import.meta.url), "utf8");
  const verif = /create or replace function public\._verifier_declaration[\s\S]*?end \$fn\$;/.exec(sql);
  assert.ok(verif, "_verifier_declaration introuvable");
  assert.match(verif[0], /v_statut = 'annulee' then\s+raise exception/);
  assert.ok(verif[0].indexOf("'annulee'") < verif[0].indexOf("coalesce(trim(p_preuve)"), "le refus passe avant tout autre contrôle");
  const valid = /create or replace function public\.valider_declaration[\s\S]*?end \$function\$;/.exec(sql);
  assert.ok(valid, "valider_declaration introuvable");
  assert.ok(valid[0].indexOf("'annulee'") < valid[0].indexOf("insert into paiements"), "le refus précède l'encaissement");
  assert.match(valid[0], /a_acces\('encaissement'\)/, "le contrôle de la caisse est conservé");
  assert.match(sql, /revoke execute on function public\._verifier_declaration\(uuid, numeric, text\)\s+from public, anon, authenticated;/,
    "la brique interne n'est plus appelable directement");
  assert.doesNotMatch(sql, /\bgrant\b|create policy|alter policy/i, "aucun droit n'est accordé");
});

test("🔴 paiement en ligne : facture annulée refusée, APRÈS le contrôle d'accès", () => {
  const ts = readFileSync(new URL("../supabase/functions/paiement/index.ts", import.meta.url), "utf8");
  const acces = ts.indexOf('if (!tuteur) return json({ error: "Accès refusé." }, 403);');
  const refus = ts.indexOf('fac.statut === "annulee"');
  assert.ok(acces > 0 && refus > 0, "contrôles introuvables");
  assert.ok(refus > acces, "l'état d'une facture ne se dit qu'à un parent de l'élève");
});
