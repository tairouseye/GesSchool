// =====================================================================
//  Passage d'année dans une classe multi-niveaux (Montessori)
//
//  🔴 CE QUE CES ÉPREUVES PROTÈGENT. « TPS/PS A » est UNE classe qui
//  contient des enfants de TPS et de PS (migration 164). Le passage
//  d'année ignorait `inscriptions.sous_niveau_id` : il lisait le niveau
//  de la CLASSE, donc le TPS et le PS recevaient la même proposition et
//  l'enfant de TPS sautait une année. Et la réinscription n'écrivait pas
//  la colonne, donc le niveau réel était EFFACÉ chaque année.
//
//  Vérifié en base au moment d'écrire ces lignes : 0 sous-niveau défini.
//  La fonction n'avait donc jamais produit d'effet — c'est à la première
//  utilisation qu'elle aurait déçu, chez la cliente qui l'a demandée.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const P = () => chargerLib("promotion", ['export * from "@/lib/promotion.js";']);

//  Une école Montessori : deux niveaux combinés, chacun à deux crans, puis
//  un niveau simple pour éprouver la sortie.
const NIVEAUX = [
  { id: "n1", libelle: "TPS/PS", ordre: 1 },
  { id: "n2", libelle: "CI/CP", ordre: 2 },
  { id: "n3", libelle: "CE1", ordre: 3 },
];
const SOUS = [
  { id: "s_tps", niveau_id: "n1", libelle: "TPS", ordre: 1 },
  { id: "s_ps", niveau_id: "n1", libelle: "PS", ordre: 2 },
  { id: "s_ci", niveau_id: "n2", libelle: "CI", ordre: 1 },
  { id: "s_cp", niveau_id: "n2", libelle: "CP", ordre: 2 },
];

test("🔴 un TPS devient PS et NE CHANGE PAS de classe", async () => {
  const { prochaineEtape } = await P();
  const r = prochaineEtape({ niveauId: "n1", sousNiveauId: "s_tps", niveaux: NIVEAUX, sousNiveaux: SOUS });
  //  C'est tout le défaut : il recevait « niveau suivant », donc CI/CP.
  assert.equal(r.niveau_id, "n1", "le TPS doit rester dans « TPS/PS »");
  assert.equal(r.sous_niveau_id, "s_ps");
  assert.equal(r.memeNiveau, true);
  assert.equal(r.sortant, false);
});

test("un PS passe au niveau suivant, et y entre par le PREMIER cran", async () => {
  const { prochaineEtape } = await P();
  const r = prochaineEtape({ niveauId: "n1", sousNiveauId: "s_ps", niveaux: NIVEAUX, sousNiveaux: SOUS });
  assert.equal(r.niveau_id, "n2");
  assert.equal(r.sous_niveau_id, "s_ci", "il entre en CI, pas en CP");
  assert.equal(r.memeNiveau, false);
});

test("du dernier cran vers un niveau SIMPLE : aucun sous-niveau", async () => {
  const { prochaineEtape } = await P();
  const r = prochaineEtape({ niveauId: "n2", sousNiveauId: "s_cp", niveaux: NIVEAUX, sousNiveaux: SOUS });
  assert.equal(r.niveau_id, "n3");
  assert.equal(r.sous_niveau_id, null);
});

test("🔴 un élève SANS sous-niveau se comporte exactement comme avant", async () => {
  const { prochaineEtape } = await P();
  //  C'est le cas de TOUTES les données existantes : aucune ne doit changer
  //  de comportement du fait de cette fonction.
  const r = prochaineEtape({ niveauId: "n1", sousNiveauId: null, niveaux: NIVEAUX, sousNiveaux: SOUS });
  assert.equal(r.niveau_id, "n2", "niveau suivant, comme auparavant");
  assert.equal(r.memeNiveau, false);
  //  Il atterrit tout de même sur le premier cran du niveau d'arrivée : ne
  //  pas le faire laisserait l'inscription sans niveau réel alors que la
  //  classe en attend un.
  assert.equal(r.sous_niveau_id, "s_ci");
});

test("un niveau sans sous-niveau se promeut normalement", async () => {
  const { prochaineEtape } = await P();
  const simples = [{ id: "a", ordre: 1 }, { id: "b", ordre: 2 }];
  const r = prochaineEtape({ niveauId: "a", niveaux: simples, sousNiveaux: [] });
  assert.deepEqual(r, { niveau_id: "b", sous_niveau_id: null, sortant: false, memeNiveau: false });
});

test("le dernier niveau fait un SORTANT, jamais une boucle", async () => {
  const { prochaineEtape } = await P();
  const r = prochaineEtape({ niveauId: "n3", niveaux: NIVEAUX, sousNiveaux: SOUS });
  assert.equal(r.sortant, true);
  assert.equal(r.niveau_id, null);
  //  Et depuis le dernier cran du dernier niveau, s'il en avait.
  const r2 = prochaineEtape({
    niveauId: "n3", sousNiveauId: "x",
    niveaux: NIVEAUX, sousNiveaux: [...SOUS, { id: "x", niveau_id: "n3", libelle: "CE1", ordre: 1 }],
  });
  assert.equal(r2.sortant, true);
});

test("🔴 ordres à 0 : on suit la CRÉATION, surtout pas l'alphabet", async () => {
  const { prochaineEtape } = await P();
  //  La migration 164 met `ordre` à 0 par défaut. Le piège : l'alphabet met
  //  « PS » AVANT « TPS ». Un départage alphabétique ferait du PS le premier
  //  cran, et promouvrait les TPS de deux crans d'un coup. L'ordre de
  //  création reflète, lui, l'ordre dans lequel l'école les a saisis.
  const sous = [
    { id: "b", niveau_id: "n1", libelle: "PS", ordre: 0, created_at: "2026-02-02T10:00:00Z" },
    { id: "a", niveau_id: "n1", libelle: "TPS", ordre: 0, created_at: "2026-02-01T10:00:00Z" },
  ];
  for (let i = 0; i < 5; i++) {
    const r = prochaineEtape({ niveauId: "n1", sousNiveauId: "a", niveaux: NIVEAUX, sousNiveaux: sous });
    assert.equal(r.sous_niveau_id, "b", "TPS (créé d'abord) doit précéder PS");
    assert.equal(r.memeNiveau, true);
  }
});

test("sans ordre NI date, le départage reste stable", async () => {
  const { prochaineEtape } = await P();
  const sous = [
    { id: "zzz", niveau_id: "n1", libelle: "PS" },
    { id: "aaa", niveau_id: "n1", libelle: "TPS" },
  ];
  //  Faute de signal, on départage par identifiant : arbitraire, mais
  //  IDENTIQUE à chaque exécution — une proposition de passage ne doit
  //  jamais varier d'une ouverture d'écran à l'autre.
  const vus = new Set();
  for (let i = 0; i < 5; i++) {
    vus.add(prochaineEtape({ niveauId: "n1", sousNiveauId: "aaa", niveaux: NIVEAUX, sousNiveaux: sous }).sous_niveau_id);
  }
  assert.equal(vus.size, 1, "la proposition a changé entre deux exécutions");
});

test("entrées vides : aucune exception, et aucune promotion inventée", async () => {
  const { prochaineEtape } = await P();
  for (const arg of [undefined, {}, { niveauId: null }, { niveauId: "inconnu", niveaux: NIVEAUX }]) {
    const r = prochaineEtape(arg);
    assert.equal(r.sortant, true);
    assert.equal(r.niveau_id, null);
  }
});
