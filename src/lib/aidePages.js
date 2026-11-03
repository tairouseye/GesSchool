// GesSchool — l'aide contextuelle : chaque écran du menu renvoie à SA section
// du mode d'emploi (public/mode-emploi.html, ancres générées par md2html).
//
// 🔴 POURQUOI UNE TABLE. Le manuel compte 124 sections, et le seul accès était
// « Aide & mode d'emploi », qui ouvre le document au début. Pour savoir à quoi
// sert « Progression », il fallait chercher dans mille lignes.
//
// ⚠️ Une ancre suit le TITRE de la section : renommer un titre dans
// docs/mode-emploi.md la change. L'épreuve test/aidePages.test.mjs refuse
// une ancre absente du manuel, et un écran du menu sans entrée ici.

export const AIDE_PAGES = {
  // Pilotage
  "/pilotage": "25-1-vue-d-ensemble-menu-vue-d-ensemble-promoteur",
  "/passage-annee": "16-passage-d-annee-scolaire-pilotage-passage-d-annee-promoteur",
  "/abonnement": "25-6-mon-abonnement-menu-mon-abonnement-promoteur",
  "/organigramme": "25-2-organigramme-menu-organigramme-promoteur",
  "/documentation": "25-3-documentation-menu-documentation-promoteur",
  "/journal": "25-4-journal-des-actes-menu-journal-des-actes-promoteur",
  "/membres": "4-membres-de-l-equipe-delegation-des-acces-menu-membres",
  "/a-signer": "9-1-produire-un-certificat-ou-une-attestation-menu-documents",

  // Gestion
  "/gestion": "15-tableaux-de-bord-mise-en-route",
  "/parametres": "2-2-parametres-menu-parametres",
  "/parametres/structure": "2-1-structure-academique-parametres-structure-academique",
  "/enseignants": "4-6-enseignants-relies-a-leur-fiche",
  "/eleves": "3-eleves-inscriptions-menu-eleves",
  "/codes-parents": "17-1-donner-l-acces",
  "/certificats": "9-1-produire-un-certificat-ou-une-attestation-menu-documents",
  "/demandes": "9-2-repondre-aux-demandes-des-familles-menu-demandes",
  "/paiements": "10-paiements-recouvrement-espace-gestion",
  "/recouvrement": "10-5-recouvrement-menu-recouvrement",
  "/situation-paiements": "10-4-ter-situation-des-paiements-menu-situation-des-paiements",
  "/comptabilite": "14-5-comptabilite-syscohada",
  "/cantine": "12-1-cantine",
  "/transport": "12-2-transport",
  "/annonces": "13-5-annonces",
  "/messagerie": "13-6-messagerie",
  "/bibliotheque": "24-3-la-bibliotheque-universitaire",
  "/biblio-acquisitions": "24-3-la-bibliotheque-universitaire",
  "/biblio-inventaire": "24-3-la-bibliotheque-universitaire",
  "/biblio-circulation": "24-3-la-bibliotheque-universitaire",
  "/biblio-depots": "24-3-la-bibliotheque-universitaire",

  // Pédagogie
  "/pedagogie": "15-tableaux-de-bord-mise-en-route",
  "/appel": "5-1-le-matin-la-feuille-de-presence",
  "/appel-sup": "22-presence-par-seance-au-superieur-menu-presence-par-seance",
  "/cahier-textes": "5-2-apres-la-seance-le-cahier-de-textes",
  "/progression": "5-3-au-fil-des-semaines-la-progression",
  "/acquis": "20-suivi-des-acquis-au-prescolaire-menu-suivi-des-acquis",
  "/programmation": "21-la-programmation-officielle-menu-programmation-officielle",
  "/emploi-du-temps": "11-emploi-du-temps-automatique-menu-emploi-du-temps",
  "/emploi-sup": "24-1-la-structure-et-ce-qu-elle-remplace",
  "/photos": "23-photos-des-eleves-menu-photos-des-eleves",
  "/fournitures": "13-4-fournitures-constituer-et-remettre-la-liste",
  "/filieres": "24-1-la-structure-et-ce-qu-elle-remplace",
  "/admissions": "24-1-la-structure-et-ce-qu-elle-remplace",
  "/inscriptions-sup": "24-1-la-structure-et-ce-qu-elle-remplace",
  "/notes": "6-notes-menu-notes",
  "/bulletins": "7-bulletins-un-circuit-en-trois-temps-menu-bulletins",
  "/classement": "8-classement-tableau-d-honneur-menu-classement",
  "/notes-lmd": "24-2-notes-deliberations-et-releves",
  "/deliberations": "24-2-notes-deliberations-et-releves",
  "/vie-scolaire": "13-1-absences-retards-et-justifications",
  "/assiduite": "13-3-assiduite-menu-assiduite",
  "/codes-etudiants": "24-5-le-vocabulaire-et-les-comptes",

  // RH & Paie
  "/rh": "14-rh-paie-comptabilite",
};

// Section d'aide d'une route : la plus longue route connue qui la couvre
// (« /eleves/123 » → « /eleves », « /parametres/structure » avant « /parametres »).
export function sectionAide(chemin) {
  const p = (chemin || "").replace(/\/+$/, "") || "/";
  let meilleure = null;
  for (const route of Object.keys(AIDE_PAGES)) {
    if ((p === route || p.startsWith(`${route}/`)) && (!meilleure || route.length > meilleure.length)) meilleure = route;
  }
  return meilleure ? AIDE_PAGES[meilleure] : null;
}
