// GesSchool — lecture de la planification mensuelle officielle (IEF).
//
// L'école fournit le document Word diffusé par l'IEF : un tableau dont les
// colonnes sont les SEMAINES et les lignes les activités du mois. Le point 15
// de la visite demande que l'enseignante RÉUTILISE ces contenus au lieu de
// les ressaisir.
//
// ⚠️ MODULE PUR : aucun accès réseau, aucun composant. Il reçoit un tableau
// de lignes de cellules déjà extraites du .docx, et rend des lignes prêtes à
// enregistrer. C'est la partie qui peut se tromper — elle doit donc être
// éprouvable sans navigateur ni base.
//
// ⚠️ CE QUE LE DOCUMENT RÉEL NOUS A APPRIS (exemplaire IEF de Sangalkam,
// CM1, avril — 81 lignes) — chaque règle ci-dessous vient d'une ligne
// observée, aucune n'est supposée :
//
//   • UN SEUL TABLEAU PORTE TOUT LE MOIS, tous domaines confondus : il
//     enchaîne « Langue et communication », « MATHEMATIQUES », « ESVS » et
//     « EPSA ». Supposer un domaine par tableau — ce que faisait la première
//     version — rangeait les mathématiques sous le français.
//   • Le changement de domaine s'écrit de DEUX façons : une ligne
//     « DOMAINE | MATHEMATIQUES », ou le code du domaine posé à gauche du
//     marqueur de sous-domaine (« ESVS | SOUS-DOMMAINE 1 : … »).
//   • Le marqueur de sous-domaine s'écrit de QUATRE façons dans le même
//     document : « Sous-domaine 1 », « Sous -domaine 2 », « SOUS-DOMMAINE 1 »
//     (deux M), « SOUS DOMAINE 2 » (sans tiret ni deux-points). Une
//     expression trop stricte en perdait la moitié.
//   • Chaque bloc ne nomme que les sous-domaines qu'il MARQUE. Les titres en
//     capitales qui suivent (« LECTURE », « PRODUCTION DE TEXTES ») sont des
//     RUBRIQUES internes, pas de nouveaux sous-domaines. Les prendre pour des
//     sous-domaines faisait disparaître « COMMUNICATION ECRITE ».
//   • Les cellules sont FUSIONNÉES par endroits : une ligne de 2 cellules
//     dans un tableau de 5 colonnes ne dit pas quelle semaine elle couvre.
//     On n'invente pas : `semaine` vaut alors `null` (« tout le mois »).
//   • Un palier peut occuper une cellule fusionnée de 183 caractères. Le
//     lire comme un contenu de semaine 1 était le défaut le plus grave :
//     l'intention pédagogique du mois passait pour une séance.
//   • Le document laisse souvent « Palier » SEUL, sans énoncé. Un palier sans
//     énoncé n'apprend rien : on l'écarte au lieu d'en faire une activité.
//   • Le même contenu est parfois recopié dans neuf cellules fusionnées
//     (« Copier le texte 1… »). Sans dédoublonnage, l'aperçu devient
//     illisible et l'enseignante ne peut plus juger de la lecture.
//
// ⚠️ ET ELLE PEUT ENCORE SE TROMPER. On lit donc avec prudence, et JAMAIS
// sans faire valider un aperçu : une planification mal lue serait recopiée
// toute l'année.

const txt = (s) => String(s == null ? "" : s).trim();
const vide = (s) => !txt(s);

// Une cellule qui ne contient qu'un intitulé de colonne n'est pas un contenu.
const EST_ENTETE_SEMAINE = (s) => /^semaine\s*\d/i.test(txt(s));
// « OA », « OS », « OA1 : » employés seuls : étiquettes de colonne, pas des
// objectifs. Les garder produirait des lignes vides de sens.
const EST_ETIQUETTE = (s) => /^(oa|os)\s*\d*\s*:?\s*$/i.test(txt(s));
// « Palier 3 : intégrer… » décrit l'intention du bloc, pas une séance.
const EST_PALIER = (s) => /^palier\s*\d/i.test(txt(s));
// ⚠️ Le document laisse souvent « Palier » SEUL, sans énoncé (lignes 43, 61,
// 70, 74). Un palier sans son énoncé n'apprend rien : on l'écarte, au lieu
// d'en faire une activité nommée « Palier ».
const EST_PALIER_VIDE = (s) => /^palier\s*\d*\s*:?\s*$/i.test(txt(s));
// « Sous-domaine 2 », « Sous -domaine 1COMMUNICATION ORALE », mais aussi
// « SOUS-DOMMAINE 1 : » (deux M) et « SOUS DOMAINE 2 » — le même document
// écrit les quatre. `dom+aine` absorbe la coquille.
const EST_MARQUEUR_SD = (s) => /sous\s*-?\s*dom+aine/i.test(txt(s));
// « DOMAINE | MATHEMATIQUES » : la ligne qui ouvre un nouveau domaine.
const EST_ETIQUETTE_DOMAINE = (s) => /^domaines?\s*:?\s*$/i.test(txt(s));
// Un titre tout en capitales. Sert à distinguer un intitulé de structure
// (« PRODUCTION DE TEXTES ») d'une activité (« Expression orale »).
const EST_CAPITALES = (s) => {
  const t = txt(s);
  return t.length > 3 && /[A-ZÀ-ÖØ-Þ]/.test(t) && t === t.toUpperCase();
};

// Débarrasse « SOUS-DOMMAINE 1 : » du marqueur, du numéro et des deux-points
// que le document colle au titre, dans l'une ou l'autre de ses graphies.
const nettoyerSousDomaine = (s) =>
  txt(s).replace(/sous\s*-?\s*dom+aine\s*\d*\s*:?\s*/i, "").trim();

export const MOIS = [
  ["1", "Janvier"], ["2", "Février"], ["3", "Mars"], ["4", "Avril"],
  ["5", "Mai"], ["6", "Juin"], ["7", "Juillet"], ["8", "Août"],
  ["9", "Septembre"], ["10", "Octobre"], ["11", "Novembre"], ["12", "Décembre"],
];
const MOIS_PAR_NOM = Object.fromEntries(MOIS.map(([n, l]) => [l.toLowerCase(), Number(n)]));

// Les cours que l'on sait reconnaître. ⚠️ Liste FERMÉE à dessein : le
// document écrit « COURS…………… CM1PLANIFICATION » — sans espace ni
// ponctuation après le cours. Une expression générique y attraperait
// « PLA » et rangerait la planification sous un niveau inexistant. Mieux
// vaut ne rien reconnaître et le demander à l'écran.
export const COURS_CONNUS = [
  "TPS", "PS", "MS", "GS",                  // préscolaire
  "CI", "CP", "CE1", "CE2", "CM1", "CM2",   // élémentaire
];
// Les plus longs d'abord : « TPS » avant « PS », sinon « PS » gagnerait au
// milieu de « TPS ».
const COURS_TRIES = [...COURS_CONNUS].sort((a, b) => b.length - a.length);

/**
 * Lit l'en-tête : « PLANIFICATION DU MOIS DE AVRIL », « COURS … CM1 ».
 * Rend ce qu'on a trouvé, et `null` pour le reste — à l'écran de le demander.
 *
 * 🔴 On ne devine JAMAIS. Le fichier fourni par l'école s'appelait
 * « CE1 juin » et contenait du CM1 d'avril. Se fier au nom du fichier aurait
 * rangé le programme dans la mauvaise classe ET le mauvais mois — une erreur
 * recopiée toute l'année.
 */
export function lireEntete(texte) {
  const t = String(texte == null ? "" : texte).replace(/\s+/g, " ");
  const m = t.match(/mois\s+d[eu']?\s*([A-Za-zÀ-ÿ]+)/i);
  const mois = m ? MOIS_PAR_NOM[m[1].toLowerCase()] ?? null : null;
  // Le cours suit « COURS », séparé par des points de conduite (… ou .).
  // ⚠️ On prend le JETON qui suit, puis on le confronte à la liste fermée —
  // on ne laisse pas une expression régulière décider. Un `(?![a-zà-ÿ])`
  // paraissait plus élégant, mais sous le drapeau `i` la classe `[a-zà-ÿ]`
  // filtre AUSSI les majuscules : le « P » de « CM1PLANIFICATION »
  // invalidait la trouvaille, et le cours du vrai document n'était jamais
  // reconnu.
  const j = t.match(/cours[\s.…:·-]*([A-Za-zÀ-ÿ0-9]*)/i);
  const jeton = (j ? j[1] : "").toUpperCase();
  const cours = COURS_TRIES.find((c) => jeton.startsWith(c)) || null;
  return { mois: mois || null, cours };
}

// Repère la ligne d'en-tête : [domaine, « Semaine 1 », « Semaine 2 », …].
// Rend l'index des colonnes de semaine, pour ne pas supposer qu'elles
// commencent en 1 — un tableau peut porter une colonne de plus à gauche.
function colonnesSemaine(ligne) {
  const cols = [];
  (Array.isArray(ligne) ? ligne : []).forEach((c, i) => { if (EST_ENTETE_SEMAINE(c)) cols.push(i); });
  return cols;
}

/**
 * Analyse les lignes d'un tableau de planification.
 *
 * ⚠️ UN SEUL TABLEAU PEUT PORTER PLUSIEURS DOMAINES. Chaque ligne rendue
 * porte donc SON domaine : l'appelant crée une programmation par domaine.
 *
 * @param {string[][]} lignes  cellules déjà extraites, ligne par ligne
 * @returns {{domaines:string[], lignes:Array, ignorees:number}}
 *   chaque ligne : { domaine, sous_domaine, theme, rubrique, activite,
 *                    palier, semaine (1..6 ou null = tout le mois),
 *                    contenu, ordre }
 */
export function analyserTableau(lignes = []) {
  const tableau = Array.isArray(lignes) ? lignes : [];
  const iEntete = tableau.findIndex((l) => colonnesSemaine(l).length >= 2);
  // Un document d'une autre forme doit échouer VISIBLEMENT (zéro ligne, donc
  // aperçu vide) plutôt que d'inventer une planification.
  if (iEntete < 0) return { domaines: [], lignes: [], ignorees: tableau.length };

  const entete = tableau[iEntete];
  let largeur = entete.length;
  let colsSem = colonnesSemaine(entete);

  const out = [];
  const vus = new Set();   // dédoublonnage des contenus « tout le mois »
  const domaines = [];
  //  Le premier domaine occupe la cellule de gauche de l'en-tête.
  let domaine = txt(entete.slice(0, colsSem[0]).find((c) => !vide(c))) || null;
  let sousDomaine = null;  // nommé par une ligne « Sous-domaine N »
  let nomme = false;       // le sous-domaine courant porte-t-il déjà son nom ?
  let theme = null;        // « LECTURE DE TEXTES INJONCTIFS »
  let rubrique = null;     // « LECTURE », « PRODUCTION DE TEXTES »
  let activite = null;     // « Expression orale », « Vocabulaire »
  let palier = null;
  let ordre = 0;
  let ignorees = 0;
  if (domaine) domaines.push(domaine);

  const poser = (cellule, semaine) => {
    const contenu = txt(cellule);
    if (contenu.length <= 2 || EST_ETIQUETTE(contenu) || EST_ENTETE_SEMAINE(contenu)
        || EST_PALIER_VIDE(contenu)) {
      ignorees += 1;
      return;
    }
    // Les lignes fusionnées répètent le même texte (jusqu'à neuf fois dans
    // le document réel) : on n'en garde qu'une, sinon l'aperçu est illisible.
    if (semaine === null) {
      const cle = `${domaine || ""}|${activite || ""}|${contenu}`;
      if (vus.has(cle)) { ignorees += 1; return; }
      vus.add(cle);
    }
    out.push({
      domaine, sous_domaine: sousDomaine, theme, rubrique, activite, palier,
      semaine, contenu, ordre: (ordre += 1),
    });
  };

  // Un nouveau bloc remet à zéro ce qui lui appartient — sans quoi le palier
  // de COMMUNICATION ORALE suivrait les séances de PRODUCTION DE TEXTES.
  const ouvrirRubrique = (titre) => { rubrique = titre || null; activite = null; palier = null; };
  const ouvrirSousDomaine = (nom, nouveauTheme) => {
    sousDomaine = nom || null;
    nomme = Boolean(nom);
    theme = nouveauTheme || null;
    ouvrirRubrique(null);
  };
  const ouvrirDomaine = (nom) => {
    domaine = nom || null;
    if (nom && !domaines.includes(nom)) domaines.push(nom);
    ouvrirSousDomaine(null, null);
  };

  for (let i = iEntete + 1; i < tableau.length; i += 1) {
    const l = Array.isArray(tableau[i]) ? tableau[i] : [];
    const pleines = l.map(txt).filter((c) => c);
    if (!pleines.length) continue;

    // --- Une ligne d'en-tête réapparaît en cours de tableau ----------------
    //  Le document redéclare « Semaine 1 … Semaine 4 » au milieu (ligne 16).
    //  On resynchronise les colonnes au cas où elles se décalent, mais on ne
    //  touche NI au domaine NI au sous-domaine : la cellule de gauche porte
    //  ici un objectif (« OA1 : Maitriser les outils de langue »), pas un
    //  domaine. La confondre avec un domaine couperait le bloc en deux.
    const colsLigne = colonnesSemaine(l);
    if (colsLigne.length >= 2) { colsSem = colsLigne; largeur = l.length; }

    // --- « DOMAINE | MATHEMATIQUES » : on change de domaine ---------------
    if (EST_ETIQUETTE_DOMAINE(pleines[0]) && pleines.length > 1) {
      ouvrirDomaine(pleines[1]);
      continue;
    }

    // --- Ligne portant un marqueur de sous-domaine ------------------------
    const iMarq = pleines.findIndex((c) => EST_MARQUEUR_SD(c));
    if (iMarq === 0) {
      //  Le document écrit tantôt le marqueur ET le nom dans la même cellule
      //  (« Sous-domaine 1COMMUNICATION ORALE »), tantôt le marqueur seul
      //  avec le THÈME à côté (« Sous -domaine 2 » | « LECTURE DE TEXTES
      //  INJONCTIFS »), le nom arrivant à la ligne suivante.
      ouvrirSousDomaine(nettoyerSousDomaine(pleines[0]), pleines.slice(1).join(" "));
      continue;
    }
    if (iMarq > 0) {
      //  « ESVS | SOUS-DOMMAINE 1 : DECOUVERTE DU MONDE » : ce qui précède le
      //  marqueur est le DOMAINE. C'est la seconde façon dont le document
      //  change de domaine, et la seule pour ESVS et EPSA.
      const gauche = pleines[0];
      if (!EST_ETIQUETTE_DOMAINE(gauche) && gauche !== domaine) ouvrirDomaine(gauche);
      ouvrirSousDomaine(nettoyerSousDomaine(pleines[iMarq]), null);
      continue;
    }

    // --- Ligne portant un palier ------------------------------------------
    //  Le palier accompagne le bloc, il ne remplace pas l'activité : la
    //  première cellule nomme encore l'activité (« Expression orale »).
    const iPalier = pleines.findIndex((c, k) => k > 0 && EST_PALIER(c));
    if (iPalier > 0) {
      palier = pleines[iPalier];
      const tete = pleines[0];
      if (!EST_ETIQUETTE(tete) && !EST_PALIER(tete)) {
        if (EST_CAPITALES(tete) && nomme) rubrique = tete;
        else activite = tete;
      }
      continue;
    }

    // --- Une seule cellule remplie ----------------------------------------
    //  ⚠️ OÙ ELLE SE TROUVE CHANGE TOUT. Dans la colonne de gauche, c'est un
    //  titre (« COMMUNICATION ECRITE », « Histoire »). Dans une colonne de
    //  SEMAINE, c'est un contenu — et la traiter comme un titre faisait
    //  disparaître en silence tout ce que le document a écrit en
    //  mathématiques et en ESVS.
    const idxPleins = l.map((c, k) => (vide(c) ? -1 : k)).filter((k) => k >= 0);
    if (idxPleins.length === 1) {
      const k = idxPleins[0];
      const t = txt(l[k]);
      const kSem = colsSem.indexOf(k);
      if (kSem >= 0) { poser(t, l.length < largeur ? null : kSem + 1); continue; }
      if (EST_PALIER_VIDE(t)) { ignorees += 1; continue; }
      if (EST_PALIER(t)) { palier = t; continue; }
      if (EST_ETIQUETTE(t)) { ignorees += 1; continue; }
      if (EST_CAPITALES(t)) {
        // Le sous-domaine ouvert par le marqueur reçoit enfin son nom.
        if (!nomme) { sousDomaine = t; nomme = true; ouvrirRubrique(null); }
        else ouvrirRubrique(t);
      } else {
        activite = t;
      }
      continue;
    }

    // --- Ligne à cellules FUSIONNÉES --------------------------------------
    //  Moins de cellules que de colonnes : on ne peut pas savoir laquelle
    //  couvre quelle semaine. On ne devine pas.
    if (l.length < largeur) {
      if (pleines.length === 2) {
        const t = pleines[1];
        if (EST_PALIER_VIDE(t)) { ignorees += 1; continue; }
        //  ⚠️ C'EST LA TÊTE QUI TRANCHE. « OA3 | Copier des textes » : la
        //  tête n'est qu'une étiquette de colonne, donc la seconde cellule
        //  est le TITRE du bloc. « Géographie | Programme épuisé » : la tête
        //  nomme l'activité, donc la seconde cellule est son CONTENU, étalé
        //  sur un mois dont on ignore le découpage.
        if (EST_ETIQUETTE(pleines[0])) {
          if (EST_CAPITALES(t) && nomme) ouvrirRubrique(t);
          else activite = t;
        } else {
          activite = pleines[0];
          poser(t, null);
        }
        continue;
      }
      for (const c of pleines) poser(c, null);
      continue;
    }

    // --- Ligne de contenu : lecture positionnelle --------------------------
    //  La première cellule AVANT les semaines nomme l'activité ; sinon on
    //  poursuit la précédente (le document laisse la tête vide pour « idem »).
    const tete = txt(l.slice(0, colsSem[0]).find((c) => !vide(c)));
    if (tete && !EST_ETIQUETTE(tete) && !EST_PALIER(tete) && !EST_PALIER_VIDE(tete)) activite = tete;
    colsSem.forEach((col, k) => poser(l[col], k + 1));
  }

  return { domaines, lignes: out, ignorees };
}

/**
 * Regroupe les lignes par domaine : une programmation par domaine, c'est ce
 * que la base attend (unicité niveau/année/mois/domaine, migration 165).
 */
export function grouperParDomaine(lignes = []) {
  const par = new Map();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const d = l.domaine || "Sans domaine";
    if (!par.has(d)) par.set(d, []);
    par.get(d).push(l);
  }
  return [...par.entries()].map(([domaine, lgs]) => ({ domaine, lignes: lgs }));
}

/**
 * Résumé pour l'aperçu. L'enseignante doit pouvoir juger en un coup d'œil si
 * la lecture est juste AVANT d'enregistrer — c'est le garde-fou contre une
 * planification fausse recopiée toute l'année.
 */
export function resumer(lignes = []) {
  const parSemaine = {};
  const parDomaine = {};
  let toutLeMois = 0;
  const activites = new Set();
  const sousDomaines = new Set();
  const rubriques = new Set();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (l.semaine == null) toutLeMois += 1;
    else parSemaine[l.semaine] = (parSemaine[l.semaine] || 0) + 1;
    if (l.domaine) parDomaine[l.domaine] = (parDomaine[l.domaine] || 0) + 1;
    if (l.activite) activites.add(l.activite);
    if (l.sous_domaine) sousDomaines.add(l.sous_domaine);
    if (l.rubrique) rubriques.add(l.rubrique);
  }
  return {
    total: Array.isArray(lignes) ? lignes.length : 0,
    parSemaine,
    parDomaine,
    toutLeMois,
    activites: [...activites],
    sousDomaines: [...sousDomaines],
    rubriques: [...rubriques],
  };
}
