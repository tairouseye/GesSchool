// GesSchool — les étapes de la mise en route (module PUR, éprouvé par
// test/miseEnRoute.test.mjs). L'ordre est celui du travail réel : la
// structure, puis l'argent, puis les élèves, puis les gens.
//
// `etat` : les compteurs d'`etatMiseEnRoute` (lib/academique.js).
// `options.paiements` : le module Encaissements est-il ouvert ? Sans lui, les
// étapes de frais et de paiement mobile n'ont pas de sens.

const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

//  Une école n'a pas « fini » tant que la moitié des familles n'est pas
//  reliée : avec 4 parents sur 145, l'espace parent ne sert à personne.
export const SEUIL_PARENTS = 0.5;

export function etapesMiseEnRoute(etat, { paiements = true } = {}) {
  const e = etat || {};
  const etapes = [
    { id: "structure", ok: e.niveaux > 0 && e.classes > 0, label: "Niveaux & classes",
      detail: `${pl(e.niveaux || 0, "niveau", "niveaux")} · ${pl(e.classes || 0, "classe")}`,
      aide: "créez les niveaux et les classes de l'année (ou la structure type en un clic).",
      to: "/parametres/structure", action: "Configurer" },
    //  « Datée » = datée DANS l'année scolaire (test du 09/11/2026 : la démo
    //  cochait 3 / 3 avec des trimestres de l'année précédente, et l'accueil
    //  suivait le « 3ème Trimestre » en novembre).
    { id: "periodes", ok: e.periodes > 0 && e.periodesDatees === e.periodes, label: "Dates des trimestres",
      detail: e.periodes
        ? (e.periodesHorsAnnee ? `${pl(e.periodesHorsAnnee, "période")} hors de l'année` : `${e.periodesDatees || 0} / ${e.periodes} datée${e.periodes > 1 ? "s" : ""}`)
        : "aucune période",
      aide: "datez chaque trimestre : les bulletins, l'assiduité et les tableaux de bord en dépendent.",
      to: "/parametres/structure", action: "Dater" },
    { id: "matieres", ok: e.matieres > 0, label: "Matières", detail: pl(e.matieres || 0, "matière"),
      aide: "listez les matières enseignées, avec leurs coefficients.",
      to: "/parametres/structure", action: "Configurer" },
    paiements && { id: "frais", ok: e.frais > 0, label: "Grille tarifaire", detail: pl(e.frais || 0, "frais", "frais"),
      aide: "fixez l'inscription et la mensualité de chaque niveau, pour facturer.",
      to: "/paiements?onglet=frais", action: "Fixer" },
    { id: "eleves", ok: e.inscriptions > 0, label: "Élèves inscrits", detail: `${pl(e.inscriptions || 0, "inscrit")} · import Excel possible`,
      aide: "inscrivez vos élèves, un par un ou d'un coup depuis un fichier Excel.",
      to: "/eleves", action: "Inscrire" },
    { id: "enseignants", ok: e.enseignants > 0 && e.affectations > 0, label: "Enseignants & affectations",
      detail: `${pl(e.enseignants || 0, "enseignant")} · ${pl(e.affectations || 0, "affectation")}`,
      aide: "ajoutez vos enseignants et dites qui enseigne quoi, dans quelle classe.",
      to: "/enseignants", action: "Ajouter" },
    { id: "comptes_enseignants", ok: e.enseignants > 0 && e.enseignantsRelies > 0, label: "Comptes des enseignants",
      detail: `${e.enseignantsRelies || 0} / ${e.enseignants || 0} connecté${(e.enseignants || 0) > 1 ? "s" : ""}`,
      aide: "donnez à chaque enseignant son code d'accès : sans compte, il ne peut ni faire l'appel ni saisir de notes.",
      to: "/enseignants", action: "Donner les codes" },
    { id: "parents", ok: e.tuteurs > 0 && (e.tuteursRelies || 0) / e.tuteurs >= SEUIL_PARENTS, label: "Parents connectés",
      detail: `${e.tuteursRelies || 0} / ${e.tuteurs || 0} relié${(e.tuteurs || 0) > 1 ? "s" : ""}`,
      aide: "distribuez les codes parents (ou la connexion par téléphone) : c'est ce qui fait vivre l'espace des familles.",
      to: "/codes-parents", action: "Distribuer" },
    paiements && { id: "mobile", ok: !!e.mobile, label: "Paiement mobile", detail: e.mobile ? "numéros enregistrés" : "Wave, Orange Money…",
      aide: "enregistrez vos numéros Wave ou Orange Money pour que les parents paient depuis leur téléphone.",
      to: "/paiements?onglet=mobile", action: "Configurer" },
  ];
  return etapes.filter(Boolean);
}

//  Les périodes datées DANS l'année : début et fin remplis, et compris entre
//  le début et la fin de l'année scolaire (si elle est datée).
export function compterPeriodesDatees(periodes = [], annee = null) {
  let datees = 0, hors = 0;
  for (const p of periodes) {
    if (!p?.date_debut || !p?.date_fin) continue;
    const dedans = !annee?.date_debut || !annee?.date_fin
      || (p.date_debut >= annee.date_debut && p.date_fin <= annee.date_fin);
    if (dedans) datees += 1; else hors += 1;
  }
  return { datees, hors };
}

//  Les lignes « À traiter » de l'adoption (prise en main, lot 3) : elles
//  restent après la mise en route, et le secrétariat les voit aussi. Une
//  ligne n'apparaît que si l'écran qui la traite est ouvert à ce rôle.
//  `a` : { enseignants, enseignantsRelies, tuteurs, tuteursRelies }.
export function lignesAdoption(a, ouvert) {
  if (!a) return [];
  const sansCompte = Math.max(0, (a.enseignants || 0) - (a.enseignantsRelies || 0));
  const familles = Math.max(0, (a.tuteurs || 0) - (a.tuteursRelies || 0));
  return [
    ouvert("enseignants") && sansCompte > 0 && {
      to: "/enseignants", ton: "or", bouton: "Donner les accès",
      titre: `${pl(sansCompte, "enseignant")} sans compte (${a.enseignantsRelies || 0} / ${a.enseignants} connecté${(a.enseignantsRelies || 0) > 1 ? "s" : ""})` },
    ouvert("codes_parents") && familles > 0 && {
      to: "/codes-parents", ton: "navy", bouton: "Inviter",
      titre: `${pl(familles, "parent")} pas encore connecté${familles > 1 ? "s" : ""} (${a.tuteursRelies || 0} / ${a.tuteurs})` },
  ].filter(Boolean);
}
