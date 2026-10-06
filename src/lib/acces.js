// GesSchool — les accès du personnel, par cases à cocher.
//
// 🔴 CE QUE CE FICHIER REMPLACE. Jusqu'ici, on invitait quelqu'un en
// choisissant un RÔLE dans une liste (« Comptable / Gestion »,
// « Responsable pédagogique »…), et le rôle décidait de tout. Le promoteur
// a demandé l'inverse : on invite un **membre du personnel**, puis on
// **coche** ce à quoi il a droit — l'arbre des espaces avec leurs
// sous-menus, cocher un espace cochant ses sous-menus.
//
// Les enseignants font partie du personnel. Les **parents** et les
// **étudiants** n'en font pas partie : ils ont leur propre porte (code
// parent, code étudiant) et leur périmètre vient de leur LIEN, pas d'une
// permission. Ce fichier ne les concerne pas.
//
// ⚠️ UNE CASE = UNE GARANTIE, et c'est la contrainte qui a façonné tout le
// reste. Une case qui serait seulement masquée à l'écran, sans que la base
// la refuse, serait un mensonge — c'est le défaut corrigé deux fois cette
// semaine (migrations 173, lots 1 et 2 de l'audit). Or plusieurs écrans
// lisent LES MÊMES TABLES : les séparer en deux cases donnerait un verrou
// d'affichage. On les regroupe donc, et on l'assume.

import { ESPACES, grouperItems, libelleItem } from "@/lib/espaces.js";
import { peutVoir } from "@/lib/permissions.js";

// ---------------------------------------------------------------------
//  Les quatre fusions — la seule liste écrite à la main
// ---------------------------------------------------------------------
//
//  Chaque entrée dit : ces écrans partagent leurs tables, donc ils
//  s'accordent et se retirent ENSEMBLE. Le commentaire nomme la table :
//  c'est lui qui justifie la fusion, et c'est lui qu'il faudra relire si
//  un jour les données sont réellement séparées.
export const FUSIONS = [
  {
    id: "presence_vie",
    label: "Présence & vie scolaire",
    // `absences` et `incidents` : la feuille de présence écrit ce que
    // l'assiduité compte et ce que la vie scolaire commente.
    cles: ["appel", "appel_sup", "assiduite", "vie_scolaire"],
  },
  {
    id: "notes_bulletins",
    label: "Notes & bulletins",
    // `notes`, `evaluations`, `bulletins` : le classement est un calcul
    // sur les mêmes lignes, il ne peut pas être refusé séparément.
    cles: ["notes", "bulletins", "classement"],
  },
  {
    id: "encaissement",
    label: "Encaissements & relances",
    // `factures`, `paiements` : le recouvrement ne fait que trier et
    // relancer ce que l'écran Paiements lit déjà.
    cles: ["paiements", "recouvrement"],
  },
];

//  🔴 J'AVAIS VOULU RENDRE LES ACCUEILS « DÉRIVÉS » — au moins une case
//  dans l'espace, et son accueil s'ouvre. L'épreuve de fidélité l'a refusé,
//  et elle avait raison : des clés comme Élèves, Annonces ou Messagerie
//  figurent dans DEUX espaces, si bien que le comptable gagnait l'accueil
//  de Pédagogie et la direction celui de Gestion. Huit écarts d'un coup,
//  pour une commodité.
//
//  Un accueil est un écran comme un autre — il porte un tableau de bord et
//  la zone « À traiter ». Il est donc une case, pré-cochée par les modèles
//  exactement comme `ACCES` le dit aujourd'hui, et le promoteur peut la
//  décocher. Aucune règle spéciale, aucun écart.

//  🔴 « À SIGNER » N'EST PAS UNE PERMISSION, C'EST UN LIEN — et je
//  l'avais fusionné à tort avec « Documents ». Vérifié dans la base :
//  `documents_select` accorde la lecture à la gestion OU à
//  `signataire_profil = auth.uid()`. La seconde branche ne dépend d'aucun
//  droit : elle dit « ce document m'attend ». Comme la porte du parent, ce
//  n'est donc pas une case à cocher — et le menu ne l'affiche déjà que
//  s'il reste quelque chose à signer.
export const DERIVEES = ["signatures"];

//  Pilotage reste hors cases : ses écrans sont gardés par `estPromoteur`
//  (`ROUTES_PROMOTEUR` dans espaces.js), un autre mécanisme. Les mélanger
//  laisserait croire qu'on peut déléguer le pilotage par une case.
export const ESPACES_SANS_CASES = ["pilotage"];

const PAR_CLE = {};
for (const f of FUSIONS) for (const c of f.cles) PAR_CLE[c] = f;

/**
 * La boîte qui porte cette clé d'écran.
 *
 * ⚠️ C'EST LA BOÎTE QUI EST STOCKÉE, pas la clé. Si l'on stockait les clés,
 * un accès pourrait un jour être accordé à « Paiements » sans
 * « Recouvrement » — l'invariant « une case = une garantie » ne tiendrait
 * plus que par la discipline de l'interface. Là, il tient par la structure.
 */
export function boiteDeCle(cle) {
  return PAR_CLE[cle]?.id || cle || null;
}

/** Les clés qu'une boîte ouvre (une fusion, ou la clé elle-même). */
export function clesDeBoite(id) {
  const f = FUSIONS.find((x) => x.id === id);
  return f ? [...f.cles] : [id];
}

// ---------------------------------------------------------------------
//  Les quatre pouvoirs qui ne sont pas des écrans
// ---------------------------------------------------------------------
//
//  Ce sont des ACTES, et ce sont eux qui distinguent la direction de
//  l'enseignante. Sans eux, cocher « Notes & bulletins » pour une
//  enseignante lui permettrait de DIFFUSER aux familles — ce que le
//  circuit du bulletin réserve à la direction (migration 166).
export const POUVOIRS = [
  { id: "p_bulletins_diffuser", label: "Arrêter et publier les bulletins",
    aide: "Valider, publier, retirer de l'espace parent, et signer le procès-verbal du conseil." },
  { id: "p_eleves_editer", label: "Modifier la fiche élève",
    aide: "Créer, modifier, supprimer un élève, et importer une liste." },
  { id: "p_codes_parents", label: "Générer les codes parents",
    aide: "Délivrer, depuis la fiche d'un élève, le code qui permet à sa famille de créer son compte." },
  //  🔴 CELUI-CI EST NÉ D'UN DÉFAUT DE MA PREMIÈRE VERSION. Fusionner
  //  Paiements et Recouvrement est juste — ils lisent `factures` — mais
  //  aujourd'hui le secrétariat encaisse SANS pouvoir relancer, et la
  //  fusion lui aurait accordé les relances au passage. La donnée se
  //  partage, l'acte non : il devient un pouvoir à part.
  { id: "p_relancer", label: "Relancer les familles",
    aide: "Envoyer les rappels d'impayés, par notification ou WhatsApp, et régler les relances automatiques." },
  //  🔴 CEUX-CI SONT NÉS DE LA BASCULE DES ENCAISSEMENTS (mig. 180), pour la
  //  même raison que `p_relancer` : la case `encaissement` couvre le
  //  comptable ET le secrétariat, mais la base ne leur donne pas les mêmes
  //  droits. Sans ces deux pouvoirs, la bascule aurait élargi en silence.
  //
  //  `frais` ne s'écrit aujourd'hui que par `est_admin() or a_role('comptable')`
  //  — le secrétariat encaisse mais ne fixe pas les tarifs.
  { id: "p_frais", label: "Fixer la grille des frais",
    aide: "Créer et modifier les frais de scolarité par niveau, et les règles de relance automatique." },
  //  `statut_paiement_classe` (l'indicateur de paiement de la liste Élèves)
  //  nomme `direction`, que la case `eleves` ne distingue pas de l'enseignant
  //  ni du surveillant. Sans ce pouvoir, tout enseignant verrait quelles
  //  familles sont en retard de paiement.
  { id: "p_voir_impayes", label: "Voir l'état de paiement des familles",
    aide: "Afficher, dans la liste des élèves, qui est à jour et qui a des factures échues." },
  //  🔴 CELUI-CI COMBLE UN MANQUE, pas seulement une bascule (mig. 184). La
  //  notion « voit toutes les classes, pas seulement les siennes » existait
  //  SEULEMENT dans le front (`voitToutesClasses`, permissions.js) : neuf
  //  écrans s'en servent pour choisir entre `getClasses` et `getMesClasses`,
  //  mais la base ne la connaissait pas. Les gardes qui en avaient besoin
  //  énuméraient donc des rôles à la main — et énumérer des rôles est
  //  précisément ce que ce chantier remplace.
  //
  //  Il reproduit `voitToutesClasses` : promoteur et direction, ni
  //  l'enseignant ni le surveillant, qui restent bornés par
  //  `enseigne_classe()`. Sans lui, remplacer la liste de rôles de
  //  `absences_classe_periode` par la case `presence_vie` aurait donné
  //  TOUTES les classes à TOUT enseignant — c'est-à-dire supprimé le
  //  cloisonnement de la migration 058 en croyant le traduire.
  //
  //  C'est aussi le point d'accroche de l'étape 4 : le périmètre par cycle
  //  viendra RESTREINDRE ce pouvoir, pas le contourner.
  { id: "p_toutes_classes", label: "Voir toutes les classes",
    aide: "Accéder aux classes de tout l'établissement, et pas seulement à celles où l'on enseigne." },
];

const IDS_POUVOIRS = POUVOIRS.map((p) => p.id);

// ---------------------------------------------------------------------
//  L'arbre à cocher
// ---------------------------------------------------------------------
/**
 * L'arbre des cases pour CET établissement : espace → groupe → cases.
 *
 * Il est CALCULÉ depuis `ESPACES`, jamais déclaré : une entrée de menu
 * ajoutée demain apparaît ici sans qu'on y pense, et c'est exactement ce
 * qu'on veut — une page neuve ne doit pas arriver sans permission.
 *
 * @param {object} ecole  pour les libellés et le gating par palier
 * @param {(item:object) => boolean} pertinent  filtre de palier (itemPourType)
 */
export function arbreDesCases(ecole, pertinent = () => true) {
  //  Le libellé d'une clé se cherche dans TOUT le menu, pas dans l'espace
  //  courant : une clé transverse y apparaît plusieurs fois, et une fusion
  //  peut couvrir des écrans d'un autre espace. Chercher localement rendait
  //  « certificats » au lieu de « Documents ».
  const tous = ESPACES.flatMap((e) => e.items);
  const lib = (cle) => {
    const it = tous.find((x) => x.cle === cle);
    return it ? libelleItem(it, ecole) : cle;
  };

  const out = [];
  for (const e of ESPACES) {
    if (ESPACES_SANS_CASES.includes(e.id)) continue;
    const groupes = [];
    for (const sec of grouperItems((e.items || []).filter(pertinent))) {
      const cases = [];
      for (const it of sec.items) {
        //  Seules les clés dérivées ne se cochent pas.
        if (DERIVEES.includes(it.cle)) continue;
        const id = boiteDeCle(it.cle);
        if (cases.some((c) => c.id === id)) continue; // une fusion n'apparaît qu'une fois
        const f = FUSIONS.find((x) => x.id === id);
        cases.push({
          id,
          label: f ? f.label : libelleItem(it, ecole),
          icone: it.icone,
          //  Dire ce que la case couvre vraiment, quand elle en couvre
          //  plusieurs : le promoteur doit pouvoir le vérifier d'un œil.
          couvre: f ? f.cles.map(lib) : null,
        });
      }
      if (!cases.length) continue;
      //  Les entrées sans groupe (espace RH & Paie) formaient autant de
      //  sections d'un seul élément : on les réunit, sinon l'écran affiche
      //  quatre en-têtes vides.
      const dernier = groupes[groupes.length - 1];
      if (!sec.groupe && dernier && !dernier.groupe) dernier.cases.push(...cases);
      else groupes.push({ groupe: sec.groupe, cases });
    }
    if (groupes.length) out.push({ espace: e.id, label: e.label, icone: e.icone, groupes });
  }
  return out;
}

/**
 * Toutes les boîtes de l'arbre, à plat et SANS DOUBLON.
 *
 * ⚠️ Une clé transverse (Membres, Paramètres) apparaît dans plusieurs
 * espaces, et une case cochée accorde LA BOÎTE, pas « la boîte dans cet
 * espace ». Sans ce dédoublonnage, « tout cocher » compterait deux fois et
 * l'écran afficherait deux états pour une même autorisation.
 */
export function boitesDeLArbre(arbre) {
  return [...new Set(arbre.flatMap((e) => e.groupes.flatMap((g) => g.cases.map((c) => c.id))))];
}

// ---------------------------------------------------------------------
//  Les modèles de pré-cochage
// ---------------------------------------------------------------------
//
//  ⚠️ DÉRIVÉS DES RÔLES EXISTANTS, et non retapés : `ACCES`
//  (permissions.js) dit déjà quel rôle ouvre quel écran. Le redéclarer ici
//  créerait deux vérités, et c'est précisément le piège que l'audit a
//  relevé ailleurs. Un modèle n'est qu'un point de départ : le promoteur
//  décoche ensuite ce qui n'a pas de sens chez lui.
export const MODELES = [
  { id: "direction", label: "Responsable pédagogique" },
  { id: "comptable", label: "Comptable / Gestion" },
  { id: "secretaire", label: "Secrétariat / Caisse" },
  { id: "enseignant", label: "Enseignant" },
  { id: "surveillant", label: "Surveillant" },
  { id: "rh", label: "Responsable RH" },
  { id: "bibliothecaire", label: "Bibliothécaire" },
];

/**
 * Les boîtes (et les pouvoirs) qu'un modèle pré-coche.
 *
 * Les pouvoirs ne se déduisent pas de `ACCES` : ils reproduisent les règles
 * écrites ailleurs — `voitToutesClasses` pour la diffusion des bulletins,
 * `peutEditerEleves` pour la fiche élève, `peutGererParents` pour les
 * codes, `rolesInvitables` pour les membres.
 */
export function boitesDuModele(modele) {
  const r = [modele];
  const cles = [...new Set(ESPACES.flatMap((e) => e.items.map((i) => i.cle)))];
  const boites = [...new Set(
    cles.filter((c) => !DERIVEES.includes(c) && peutVoir(r, c)).map(boiteDeCle)
  )];
  //  ⚠️ CES POUVOIRS REPRODUISENT LES RÈGLES ACTUELLES, pas une opinion :
  //  `voitToutesClasses` pour la diffusion (direction seule),
  //  `peutEditerEleves` pour la fiche élève (gestion), `peutGererParents`
  //  pour le code d'un élève (direction), `ACCES.recouvrement` pour les
  //  relances (comptable seul, PAS le secrétariat). Une épreuve vérifie
  //  cette fidélité : sans elle, la bascule déplacerait des droits en
  //  silence.
  //  ⚠️ `p_frais` au comptable SEUL (c'est `a_role('comptable')` sur `frais`),
  //  et `p_voir_impayes` aux trois que `statut_paiement_classe` nomme —
  //  direction, comptable, secrétariat — mais ni l'enseignant ni le
  //  surveillant, qui n'ont pas à savoir quelle famille est en retard.
  const pouvoirs = [];
  //  `p_toutes_classes` reproduit `voitToutesClasses()` : la direction seule
  //  (le promoteur l'a de toute façon par `a_acces`).
  if (modele === "direction") pouvoirs.push("p_bulletins_diffuser", "p_codes_parents", "p_voir_impayes", "p_toutes_classes");
  if (modele === "comptable") pouvoirs.push("p_eleves_editer", "p_relancer", "p_frais", "p_voir_impayes");
  if (modele === "secretaire") pouvoirs.push("p_eleves_editer", "p_voir_impayes");
  return [...boites.filter((b) => !IDS_POUVOIRS.includes(b)), ...pouvoirs];
}

// ---------------------------------------------------------------------
//  La décision, côté écran
// ---------------------------------------------------------------------
/**
 * Cet utilisateur peut-il ouvrir cette page ?
 *
 * ⚠️ CE N'EST PAS LA SÉCURITÉ. La base décide, par ses policies et les
 * gardes de ses RPC. Cette fonction dit seulement quoi AFFICHER — et elle
 * doit rendre la même réponse, sinon on propose un écran qui sera refusé
 * (ou, pire, on en cache un qui reste ouvert).
 *
 * @param {{boites?:string[], total?:boolean}} acces  ce que rend `mes_acces()`
 */
export function aAcces(acces, cle) {
  if (!acces || !cle) return false;
  if (acces.total) return true;                 // promoteur : tout, sans condition
  const boites = acces.boites || [];
  //  L'accueil d'un espace suit ses cases : au moins une case dans cet
  //  espace suffit. Sans cette règle, on cocherait « Notes & bulletins »
  //  et l'accueil de Pédagogie resterait refusé.
  //  Une clé dérivée n'est jamais refusée par une case : son verrou est
  //  ailleurs (le document m'attend, ou non).
  if (DERIVEES.includes(cle)) return boites.length > 0;
  return boites.includes(boiteDeCle(cle));
}

/** Un pouvoir particulier est-il accordé ? */
export function aPouvoir(acces, id) {
  if (!acces || !id) return false;
  if (acces.total) return true;
  return (acces.boites || []).includes(id);
}
