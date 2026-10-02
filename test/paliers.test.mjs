// =====================================================================
//  Les paliers de l'établissement — migration 168
//
//  🔴 CE MODULE DÉCIDE QUEL MENU S'AFFICHE. C'est précisément là que la
//  migration 108 avait échoué : son `type_etablissement` mal repris avait
//  fait perdre Appel, Notes, Bulletins et Emploi du temps à SIX écoles sur
//  sept. Les épreuves ci-dessous verrouillent le repli, école par école,
//  avec les données RÉELLES relevées en production.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { chargerLib } from "./bundle.helper.mjs";

const P = () => chargerLib("paliers", ['export * from "@/lib/paliers.js";']);

//  Les sept écoles telles qu'elles sont en base AVANT la migration 168.
const REEL = [
  { nom: "Bakany Soucko", type_etablissement: "ecole", cycles_actifs: ["prescolaire"] },
  { nom: "Centre de formation pro", type_etablissement: "ecole", cycles_actifs: ["formation_pro"] },
  { nom: "La Grâce", type_etablissement: "ecole", cycles_actifs: ["prescolaire", "premier_cycle", "second_cycle"] },
  { nom: "Ourson School", type_etablissement: "ecole", cycles_actifs: ["prescolaire", "premier_cycle"] },
  { nom: "Tut'Tank", type_etablissement: "ecole", cycles_actifs: ["prescolaire", "premier_cycle"] },
  { nom: "TutTank_Demo", type_etablissement: "ecole", cycles_actifs: ["premier_cycle"] },
  // 🔴 UCAD : « superieur », mais ses cycles_actifs sont ceux d'une ECOLE,
  // sans `universite`. C'est la donnée qui piège.
  { nom: "UCAD", type_etablissement: "superieur", cycles_actifs: ["prescolaire", "premier_cycle", "second_cycle", "lycee", "formation_pro"] },
];

// --- Le repli : rien ne doit changer pour l'existant --------------------
test("🔴 aucune école existante ne perd son menu (repli sûr)", async () => {
  const { couvreScolaire, couvreSuperieur } = await P();
  for (const e of REEL) {
    const attenduScolaire = e.type_etablissement !== "superieur";
    assert.equal(couvreScolaire(e), attenduScolaire, `${e.nom} : pages école`);
    assert.equal(couvreSuperieur(e), !attenduScolaire, `${e.nom} : pages supérieur`);
  }
});

test("🔴 UCAD reste au supérieur MALGRÉ ses cycles_actifs d'école", async () => {
  const { couvreSuperieur, couvreScolaire, paliersPourMenu } = await P();
  const ucad = REEL.find((e) => e.nom === "UCAD");
  // Se fier à `cycles_actifs` l'aurait fait passer pour une école et lui
  // aurait retiré Filières, Maquettes, Inscriptions LMD, Délibérations…
  assert.ok(couvreSuperieur(ucad), "UCAD couvre l'université");
  assert.ok(!couvreScolaire(ucad), "et pas le scolaire");
  assert.deepEqual(paliersPourMenu(ucad), ["universite"]);
});

test("une école sans rien de déclaré se comporte comme avant", async () => {
  const { paliersPourMenu, paliersDeclares } = await P();
  // Repli : toutes les pages école, comme aujourd'hui. Un ensemble vide
  // aurait vidé le menu — un écran blanc est une panne, pas une précaution.
  assert.deepEqual(paliersPourMenu({}), ["elementaire", "college", "lycee", "formation_pro"]);
  assert.deepEqual(paliersPourMenu(), ["elementaire", "college", "lycee", "formation_pro"]);
  assert.deepEqual(paliersPourMenu({ paliers: [] }), ["elementaire", "college", "lycee", "formation_pro"]);
  // Mais on n'AFFICHE pas ce repli comme une déclaration de l'école.
  assert.deepEqual(paliersDeclares({}), []);
  assert.deepEqual(paliersDeclares({ paliers: [] }), []);
});

test("🔴 déclaré et affiché ne sont pas la même question", async () => {
  const { paliersDeclares, paliersPourMenu, resume } = await P();
  const e = { type_etablissement: "ecole" };
  // Le menu ouvre tout le scolaire…
  assert.equal(paliersPourMenu(e).length, 4);
  // …mais on n'écrit PAS à l'écran que l'école couvre le collège et le lycée.
  assert.deepEqual(paliersDeclares(e), []);
  assert.equal(resume(paliersDeclares(e)), "", "aucun résumé mensonger");
});

// --- Les combinaisons ---------------------------------------------------
test("du plus simple au plus étendu, les combinaisons tiennent", async () => {
  const { couvre, couvreScolaire, couvreSuperieur } = await P();
  const simple = { paliers: ["elementaire"] };
  assert.ok(couvre(simple, "elementaire"));
  assert.ok(!couvre(simple, "college"));
  assert.ok(couvreScolaire(simple) && !couvreSuperieur(simple));

  const etendu = { paliers: ["elementaire", "college", "lycee", "universite"] };
  for (const p of ["elementaire", "college", "lycee", "universite"]) assert.ok(couvre(etendu, p), p);
  // 🔴 LE BESOIN QUE LA DEMANDE A REVELE : un etablissement peut avoir
  // BESOIN DES DEUX jeux de pages. La bascule binaire l'interdisait.
  assert.ok(couvreScolaire(etendu) && couvreSuperieur(etendu),
    "les deux jeux de pages s'ouvrent");
});

test("les valeurs inconnues sont ignorées, jamais propagées", async () => {
  const { paliersDeclares, couvre } = await P();
  assert.deepEqual(paliersDeclares({ paliers: ["elementaire", "maternelle", "doctorat"] }), ["elementaire"]);
  assert.ok(!couvre({ paliers: ["n_importe_quoi"] }, "n_importe_quoi"));
  // Que des valeurs inconnues : on retombe sur le repli sûr.
  assert.deepEqual(paliersDeclares({ paliers: ["xxx"] }), []);
});

test("l'ordre d'affichage ne dépend pas de l'ordre de saisie", async () => {
  const { paliersDeclares, resume } = await P();
  assert.deepEqual(paliersDeclares({ paliers: ["universite", "college", "elementaire"] }),
    ["elementaire", "college", "universite"]);
  assert.equal(resume(["lycee", "elementaire"]), "Élémentaire et Lycée");
  assert.equal(resume(["elementaire"]), "Élémentaire");
  assert.equal(resume(["elementaire", "college", "lycee"]), "Élémentaire, Collège et Lycée");
  assert.equal(resume([]), "");
  assert.equal(resume(), "");
});

test("les doublons ne se voient pas", async () => {
  const { paliersDeclares } = await P();
  assert.deepEqual(paliersDeclares({ paliers: ["college", "college", "elementaire"] }),
    ["elementaire", "college"]);
});

// --- Vocabulaire --------------------------------------------------------
test("🔴 le vocabulaire suit l'établissement, pas les pages ouvertes", async () => {
  const { typeDominant } = await P();
  // Une université seule parle d'étudiants partout.
  assert.equal(typeDominant({ paliers: ["universite"] }), "superieur");
  assert.equal(typeDominant({ type_etablissement: "superieur" }), "superieur");
  // Un établissement qui va de l'élémentaire à l'université a surtout des
  // ELEVES : dire « étudiant » au préscolaire serait absurde. Les pages du
  // supérieur portent déjà leurs propres intitulés.
  assert.equal(typeDominant({ paliers: ["elementaire", "college", "lycee", "universite"] }), "ecole");
  assert.equal(typeDominant({ paliers: ["elementaire"] }), "ecole");
  assert.equal(typeDominant({}), "ecole");
});

// --- Cohérence de l'échelle --------------------------------------------
test("un trou dans l'échelle est signalé, pas interdit", async () => {
  const { trou } = await P();
  // Élémentaire + Lycée sans Collège : probablement un oubli.
  assert.equal(trou(["elementaire", "lycee"]), "Collège");
  // Les enchaînements continus ne signalent rien.
  assert.equal(trou(["elementaire", "college", "lycee"]), null);
  assert.equal(trou(["college", "lycee"]), null);
  assert.equal(trou(["elementaire"]), null);
  // L'université et la formation pro sont hors de l'échelle : leur absence
  // n'est pas un trou.
  assert.equal(trou(["elementaire", "universite"]), null);
  assert.equal(trou(["formation_pro", "universite"]), null);
  assert.equal(trou([]), null);
  assert.equal(trou(), null);
});

// --- Pédagogie ----------------------------------------------------------
test("la pédagogie ne se demande que si l'élémentaire est couvert", async () => {
  const { pedagogiePertinente, PEDAGOGIES } = await P();
  assert.ok(pedagogiePertinente(["elementaire"]));
  assert.ok(pedagogiePertinente(["elementaire", "college"]));
  // Demander « classique ou Montessori » à une université n'a aucun sens.
  assert.ok(!pedagogiePertinente(["universite"]));
  assert.ok(!pedagogiePertinente(["college", "lycee"]));
  assert.ok(!pedagogiePertinente([]));
  assert.ok(!pedagogiePertinente());
  assert.deepEqual(PEDAGOGIES.map((p) => p.cle), ["classique", "montessori"]);
});

// --- Liens avec la structure -------------------------------------------
test("les cycles attendus découlent des paliers", async () => {
  const { cyclesAttendus } = await P();
  // « Élémentaire » INCLUT le préscolaire — c'est la demande, mot pour mot.
  assert.deepEqual(cyclesAttendus(["elementaire"]), ["prescolaire", "premier_cycle"]);
  assert.deepEqual(cyclesAttendus(["elementaire", "college"]),
    ["prescolaire", "premier_cycle", "second_cycle"]);
  assert.deepEqual(cyclesAttendus(["universite"]), ["universite"]);
  assert.deepEqual(cyclesAttendus([]), []);
  assert.deepEqual(cyclesAttendus(), []);
});

test("les cas courants couvrent ce qui a été demandé", async () => {
  const { COMBINAISONS, combinaisonDe } = await P();
  const par = Object.fromEntries(COMBINAISONS.map((c) => [c.cle, c.paliers]));
  // Le plus simple et le plus étendu, nommés dans la demande.
  assert.deepEqual(par.el, ["elementaire"]);
  assert.deepEqual(par.tout, ["elementaire", "college", "lycee", "universite"]);
  // Reconnaître une sélection, quel que soit l'ordre de saisie.
  assert.equal(combinaisonDe(["college", "elementaire"])?.cle, "el_co");
  assert.equal(combinaisonDe(["elementaire", "lycee"]), null, "une combinaison inhabituelle n'est pas nommée");
  assert.equal(combinaisonDe([]), null);
  assert.equal(combinaisonDe(), null);
});

test("chaque palier a son libellé et ses cycles", async () => {
  const { PALIERS, LABELS, SCOLAIRES } = await P();
  assert.deepEqual(PALIERS.map((p) => p.cle),
    ["elementaire", "college", "lycee", "formation_pro", "universite"]);
  for (const p of PALIERS) {
    assert.ok(p.label, `libellé manquant : ${p.cle}`);
    assert.ok(p.cycles.length, `cycles manquants : ${p.cle}`);
    assert.equal(LABELS[p.cle], p.label);
  }
  // La formation professionnelle n'était pas demandée, mais une école de
  // production ne couvre QUE ce palier : l'omettre lui laisserait un
  // ensemble vide, donc aucun menu.
  assert.ok(SCOLAIRES.includes("formation_pro"));
  assert.ok(!SCOLAIRES.includes("universite"));
});

// --- Ce qui part en base ------------------------------------------------
test("🔴 `type_etablissement` est déduit, plus jamais saisi", async () => {
  const { profilAEnregistrer } = await P();
  // Une université seule : « superieur », comme avant.
  assert.equal(profilAEnregistrer({ paliers: ["universite"] }).type_etablissement, "superieur");
  // Dès qu'un palier scolaire s'y ajoute, l'établissement n'est plus
  // « supérieur » au sens de l'ancienne bascule — et ses pages LMD restent
  // ouvertes, car elles dépendent désormais du PALIER, pas de ce champ.
  assert.equal(profilAEnregistrer({ paliers: ["elementaire", "universite"] }).type_etablissement, "ecole");
  assert.equal(profilAEnregistrer({ paliers: ["elementaire"] }).type_etablissement, "ecole");
  // 🔴 Rien de déclaré : on NE TOUCHE PAS au type. Le réécrire aurait pu
  // faire basculer une école qui n'avait rien demandé — c'est exactement
  // l'accident de la migration 108.
  assert.equal(profilAEnregistrer({ paliers: [], type_etablissement: "superieur" }).type_etablissement, "superieur");
  assert.equal(profilAEnregistrer({ type_etablissement: "Privé" }).type_etablissement, "Privé");
});

test("la pédagogie ne survit pas à la perte de l'élémentaire", async () => {
  const { profilAEnregistrer } = await P();
  const avec = profilAEnregistrer({ paliers: ["elementaire"], pedagogie_elementaire: "montessori" });
  assert.equal(avec.pedagogie_elementaire, "montessori");
  // L'école retire l'élémentaire : garder « Montessori » laisserait une
  // valeur qui ne veut plus rien dire.
  const sans = profilAEnregistrer({ paliers: ["college"], pedagogie_elementaire: "montessori" });
  assert.equal(sans.pedagogie_elementaire, null);
  // Une chaîne vide devient NULL, pas "".
  assert.equal(profilAEnregistrer({ paliers: ["elementaire"], pedagogie_elementaire: "" }).pedagogie_elementaire, null);
  assert.equal(profilAEnregistrer().pedagogie_elementaire, null);
});

test("les paliers partent triés et dédoublonnés", async () => {
  const { profilAEnregistrer } = await P();
  assert.deepEqual(
    profilAEnregistrer({ paliers: ["universite", "elementaire", "elementaire", "xxx"] }).paliers,
    ["elementaire", "universite"]);
});

test("🔴 l'ordre de mise en ligne ne doit pas compter", async () => {
  const { profilAEnregistrer } = await P();
  // Migration 168 PAS encore appliquée : les colonnes n'existent pas.
  // Les envoyer ferait échouer TOUT l'enregistrement de la fiche
  // établissement — le promoteur ne pourrait plus changer ni le nom, ni le
  // logo, ni les couleurs.
  const sans = profilAEnregistrer(
    { nom: "École", paliers: ["elementaire"], pedagogie_elementaire: "montessori" }, false);
  assert.ok(!("paliers" in sans), "`paliers` n'est pas envoyé");
  assert.ok(!("pedagogie_elementaire" in sans), "`pedagogie_elementaire` non plus");
  assert.equal(sans.nom, "École", "mais le reste de la fiche part normalement");
  // Migration appliquée : tout part.
  const avec = profilAEnregistrer({ nom: "École", paliers: ["elementaire"] }, true);
  assert.deepEqual(avec.paliers, ["elementaire"]);
});
