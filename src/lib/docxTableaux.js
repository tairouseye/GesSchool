// GesSchool — extraction des tableaux d'un document Word (.docx).
//
// Un .docx est une archive zip dont `word/document.xml` porte le contenu.
// On en tire deux choses, et rien de plus :
//   • le texte qui précède le premier tableau → l'en-tête (mois, cours) ;
//   • les tableaux, ligne par ligne, cellule par cellule.
//
// ⚠️ LECTURE DU XML SANS DOM, À DESSEIN. `DOMParser` n'existe pas sous Node :
// l'extraction ne serait éprouvable que dans un navigateur, donc en pratique
// jamais. Écrite en pur texte, elle se teste sur le VRAI document — et c'est
// ce qui a permis de voir que le tableau fusionne ses cellules.
//
// ⚠️ LE NOMBRE DE CELLULES D'UNE LIGNE EST UNE INFORMATION. Word ne répète
// pas une cellule fusionnée : une ligne de 2 cellules dans un tableau de 5
// colonnes signale une fusion. `programmationIEF.js` s'appuie dessus pour
// refuser d'inventer une semaine. Ne « complétez » donc jamais les lignes
// courtes ici : ce serait détruire le signal avant qu'il serve.

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decoder = (s) =>
  String(s == null ? "" : s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITES[e]);

/**
 * Rend les blocs `<tag …>…</tag>` de PREMIER niveau. Les blocs imbriqués
 * (un tableau dans une cellule) restent à l'intérieur de leur parent au lieu
 * d'être rendus à part — sans quoi les lignes d'un tableau imbriqué se
 * mêleraient à celles du tableau principal.
 */
function blocs(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, "g");
  let prof = 0;
  let debut = -1;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("</")) {
      prof = Math.max(0, prof - 1);
      if (prof === 0 && debut >= 0) { out.push(xml.slice(debut, m.index + m[0].length)); debut = -1; }
    } else {
      if (prof === 0) debut = m.index;
      prof += 1;
    }
  }
  return out;
}

//  Le texte d'un fragment : la suite des `<w:t>`, concaténée telle quelle.
//  ⚠️ Sans séparateur : Word découpe un même mot en plusieurs « runs » dès
//  qu'un caractère change de style. Insérer une espace entre les runs
//  couperait « Sous-domaine 1COMMUNICATION ORALE » n'importe où.
const texte = (xml) => {
  const morceaux = String(xml || "")
    .replace(/<w:(?:tab|br)\b[^>]*\/?>/g, " ")
    .match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) || [];
  return decoder(morceaux.map((b) => b.replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g, "")).join(""))
    .replace(/\s+/g, " ")
    .trim();
};

/** Le texte qui précède le premier tableau : l'en-tête du document. */
export function extraireEntete(xml) {
  const s = String(xml || "");
  const i = s.indexOf("<w:tbl");
  return texte(i < 0 ? s : s.slice(0, i));
}

/**
 * Les tableaux du document, chacun sous forme de lignes de cellules.
 * @returns {string[][][]}  tableaux → lignes → cellules
 */
export function extraireTableaux(xml) {
  return blocs(String(xml || ""), "w:tbl").map((t) =>
    blocs(t, "w:tr").map((r) => blocs(r, "w:tc").map(texte)));
}

/**
 * Lit un .docx (ArrayBuffer, Blob ou Uint8Array) et rend son en-tête et ses
 * tableaux. Seule fonction non pure du module — elle ne fait que dézipper.
 */
export async function lireDocx(donnees) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(donnees);
  const fichier = zip.file("word/document.xml");
  if (!fichier) {
    // Un .doc ancien, un PDF renommé, un classeur Excel : le dire plutôt que
    // de rendre un document vide que l'écran prendrait pour « rien à lire ».
    throw new Error("Ce fichier n'est pas un document Word (.docx) lisible.");
  }
  const xml = await fichier.async("string");
  return { entete: extraireEntete(xml), tableaux: extraireTableaux(xml) };
}
