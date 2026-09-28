import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

// Le ciblage des annonces (migration 152) : une annonce peut viser toute
// l'école, un cycle, un niveau ou une classe. Le front doit demander la bonne
// entité, n'en renseigner qu'une, et savoir la nommer.
//
// Ces tests remplacent ceux d'`annoncesParEcole`, retiré en 2.218.0 avec la
// liste d'annonces de l'accueil parent (migration 157).
const charger = () => chargerLib("annonces", ['export * from "@/lib/annonces.js";']);

test("seules les cibles classe / niveau / cycle exigent de désigner une entité", async () => {
  const { CIBLES, CHAMP_CIBLE, cibleExigeChoix } = await charger();
  for (const [cle] of CIBLES) {
    const exige = cibleExigeChoix(cle);
    assert.equal(exige, ["classe", "niveau", "cycle"].includes(cle),
      `cible « ${cle} » : exigence de choix incohérente`);
    // Et si elle exige un choix, le champ à renseigner doit être connu —
    // sinon la validation du formulaire laisserait passer une annonce sans
    // audience, donc invisible pour tout le monde.
    if (exige) assert.ok(CHAMP_CIBLE[cle], `« ${cle} » sans colonne d'identifiant`);
  }
  assert.equal(cibleExigeChoix("tous"), false);
  assert.equal(cibleExigeChoix(undefined), false);
});

test("à chaque cible sa colonne, et pas celle du voisin", async () => {
  const { CHAMP_CIBLE } = await charger();
  assert.deepEqual(CHAMP_CIBLE, { classe: "classe_id", niveau: "niveau_id", cycle: "cycle_id" });
  // Trois colonnes distinctes : un ciblage fantôme viendrait d'un mélange.
  const cols = Object.values(CHAMP_CIBLE);
  assert.equal(new Set(cols).size, cols.length);
});

test("l'audience s'affiche par son nom réel, pas par le mot « classe »", async () => {
  const { libelleAudience } = await charger();
  // C'était le reproche d'origine : la pastille disait « classe » sans dire
  // laquelle. Elle doit nommer l'entité visée.
  assert.equal(libelleAudience({ cible: "classe", classes: { libelle: "CM1" } }), "CM1");
  assert.equal(libelleAudience({ cible: "niveau", niveaux: { libelle: "CE1/CE2" } }), "CE1/CE2");
  assert.equal(libelleAudience({ cible: "cycle", cycles: { libelle: "Élémentaire" } }), "Élémentaire");
  // Une annonce non ciblée garde son libellé général.
  assert.equal(libelleAudience({ cible: "tous" }), "Toute l'école");
  assert.equal(libelleAudience({ cible: "parents" }), "Parents");
});

test("une jointure vide ne produit pas une pastille muette", async () => {
  const { libelleAudience } = await charger();
  // L'entité peut avoir été supprimée, ou l'embed échouer : mieux vaut « Une
  // classe » qu'une pastille vide, qui se lirait comme un défaut d'affichage.
  assert.equal(libelleAudience({ cible: "classe" }), "Une classe");
  assert.equal(libelleAudience({ cible: "niveau", niveaux: null }), "Un niveau");
  assert.equal(libelleAudience({ cible: "cycle", cycles: {} }), "Un cycle");
  // Et une entrée absurde ne fait pas tomber l'écran.
  assert.equal(libelleAudience(null), "Toute l'école");
  assert.equal(libelleAudience({}), "Toute l'école");
  assert.equal(libelleAudience({ cible: "inconnue" }), "Toute l'école");
});

test("libelleCible couvre chaque valeur proposée à l'utilisateur", async () => {
  const { CIBLES, libelleCible } = await charger();
  for (const [cle, libelle] of CIBLES) {
    assert.equal(libelleCible(cle), libelle, `« ${cle} » mal libellé`);
  }
});
