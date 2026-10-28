// Rubriques de la page Paramètres : menu latéral (ordinateur), liste
// (téléphone) et sous-pages /parametres/:rubrique. Une seule liste, pour que
// le menu et les routes ne divergent jamais.
//
// Aucun import : le module est chargé tel quel par les tests Node. Les droits
// arrivent en paramètres (`voit` = peutVoirSection de permissions.js), pour ne
// pas recopier ici les règles de SECTIONS_PARAMETRES.
//
// ⚠️ PLUSIEURS RUBRIQUES PEUVENT PARTAGER UNE SECTION. « Identité », « Ce que
// l'école couvre » et « Apparence » étaient une seule fiche, et restent la
// section `etablissement` : les couper n'ouvre ni ne ferme rien à personne.
// Le paiement en ligne et les modules restent À PART du profil (audit
// d'ergonomie, P2) : ce sont des réglages sensibles, réservés au promoteur.

export const GROUPES_PARAMETRES = ["Établissement", "Scolarité", "Finances", "Abonnement"];

export const RUBRIQUES_PARAMETRES = [
  { id: "identite", groupe: "Établissement", titre: "Identité et coordonnées",
    resume: "Nom, sigle, pays, devise, contacts", section: "etablissement" },
  { id: "couverture", groupe: "Établissement", titre: "Ce que l'école couvre",
    resume: "Paliers et pédagogie", section: "etablissement" },
  { id: "apparence", groupe: "Établissement", titre: "Apparence",
    resume: "Logo, cachet, couleurs", section: "etablissement" },
  //  Cycles, niveaux, classes, matières, coefficients : sortie du menu
  //  Pédagogie le 28/10/2026 (/structure redirige ici). École seulement —
  //  le supérieur a ses Filières & maquettes.
  { id: "structure", groupe: "Scolarité", titre: "Structure académique",
    resume: "Cycles, niveaux, classes, matières", section: "structure", module: "structure",
    scolaire: true, large: true },
  { id: "notation", groupe: "Scolarité", titre: "Notation et bulletins",
    resume: "Barème, mentions, affichage", section: "notation" },
  { id: "signataires", groupe: "Scolarité", titre: "Signataires",
    resume: "Signatures des documents officiels", section: "signataires" },
  { id: "champs-eleve", groupe: "Scolarité", titre: "Champs élève personnalisés",
    resume: "Informations propres à l'école", section: "champs_eleve" },
  { id: "matricule", groupe: "Scolarité", titre: "Matricule des élèves",
    resume: "Format et numérotation", section: "matricule" },
  { id: "relances", groupe: "Finances", titre: "Relances automatiques",
    resume: "Rappels d'impayés aux parents", section: "relances", module: "recouvrement" },
  { id: "paiement-en-ligne", groupe: "Finances", titre: "Paiement en ligne",
    resume: "Prestataire et clés", promoteurSeul: true },
  { id: "modules", groupe: "Abonnement", titre: "Modules actifs",
    resume: "Ce que l'établissement utilise", section: "modules", promoteurSeul: true },
];

// Les rubriques que ce membre peut ouvrir.
//   voit(section)      → peutVoirSection(roles, section)
//   estComplet         → estRoleComplet(roles) (promoteur)
//   moduleOk(module)   → moduleActif(modulesActifs, module)
//   scolaireOk         → couvreScolaire(ecole) (absent = oui)
export function rubriquesVisibles({ voit, estComplet, moduleOk, scolaireOk = true }) {
  return RUBRIQUES_PARAMETRES.filter((r) => {
    if (r.scolaire && !scolaireOk) return false;
    if (r.promoteurSeul && !estComplet) return false;
    if (r.section && !voit(r.section)) return false;
    if (r.module && !moduleOk(r.module)) return false;
    return true;
  });
}

// Les rubriques visibles, rangées par groupe (groupes vides omis).
export function grouperRubriques(rubriques) {
  return GROUPES_PARAMETRES
    .map((groupe) => ({ groupe, rubriques: rubriques.filter((r) => r.groupe === groupe) }))
    .filter((g) => g.rubriques.length > 0);
}
