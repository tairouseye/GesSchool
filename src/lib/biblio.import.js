// GesSchool — Bibliothèque : analyse et normalisation d'un import de notices.
//
// Volontairement PUR (aucun accès réseau ni Supabase) : c'est la partie où les
// erreurs coûtent cher — un import raté pollue le catalogue de milliers de
// lignes — donc elle doit être testable sans base.

// [clé, libellé, motifs de reconnaissance de l'en-tête]
export const CHAMPS_IMPORT = [
  ["titre",          "Titre",            [/^titre$/i, /^title$/i, /intitul/i]],
  ["sous_titre",     "Sous-titre",       [/sous.?titre/i, /subtitle/i]],
  ["auteur_libre",   "Auteur",           [/^auteurs?$/i, /^author/i]],
  ["editeur",        "Éditeur",          [/^[ée]diteur$/i, /^publisher$/i]],
  ["annee_pub",      "Année",            [/^ann[ée]e/i, /^year$/i, /publication/i]],
  ["isbn",           "ISBN",             [/isbn/i, /issn/i]],
  ["type_ressource", "Type",             [/^type$/i, /support/i]],
  ["discipline",     "Discipline",       [/discipline/i, /mati[èe]re/i, /^domaine$/i, /^subject$/i]],
  ["langue",         "Langue",           [/^langue$/i, /^language$/i]],
  ["resume",         "Résumé",           [/^r[ée]sum[ée]$/i, /^abstract$/i, /description/i]],
  ["mots_cles",      "Mots-clés",        [/mots?.?cl[ée]s?/i, /keywords?/i, /^tags?$/i]],
  ["cote",           "Cote",             [/^cote$/i, /^call.?number$/i, /classification/i]],
  ["quantite",       "Nombre d'exemplaires", [/quantit/i, /exemplaires?/i, /^nombre$/i, /^qt[ée]$/i, /^copies$/i]],
];

// Devine la colonne du fichier correspondant à un champ.
export function deviner(colonnes = [], motifs = []) {
  for (const m of motifs) {
    const trouve = colonnes.find((c) => m.test(String(c || "").trim()));
    if (trouve) return trouve;
  }
  return "";
}

// Pré-remplit le mapping complet à partir des en-têtes du fichier.
export function devinerMapping(colonnes = []) {
  const map = {};
  for (const [cle, , motifs] of CHAMPS_IMPORT) map[cle] = deviner(colonnes, motifs);
  return map;
}

const txt = (v) => String(v ?? "").trim();

// ISBN comparable : on retire tirets et espaces. Les X finaux (clé de contrôle
// d'un ISBN-10) sont conservés, d'où le passage en majuscules.
export function normaliserIsbn(v) {
  const s = txt(v).replace(/[\s-]/g, "").toUpperCase();
  return s || null;
}

// Année : accepte « 2019 », « c2019 », « 2019-2020 », une date complète…
export function normaliserAnnee(v) {
  const m = txt(v).match(/(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})/);
  if (!m) return null;
  const n = Number(m[1]);
  // Une année future lointaine est presque toujours une erreur de saisie.
  if (n > new Date().getFullYear() + 1) return null;
  return n;
}

// Mots-clés : séparateurs virgule, point-virgule ou barre verticale.
export function normaliserMotsCles(v) {
  return txt(v).split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

export function normaliserQuantite(v) {
  const s = txt(v).replace(/\s/g, "").replace(",", ".");
  if (s === "") return 0;
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 500); // garde-fou : une ligne ne crée pas 10 000 exemplaires
}

// Types acceptés en import : on tolère quelques synonymes courants, et tout le
// reste retombe sur « livre » plutôt que d'échouer.
const SYNONYMES_TYPE = {
  livre: "livre", ouvrage: "livre", book: "livre", monographie: "livre",
  revue: "revue", periodique: "revue", journal: "revue",
  article: "article", these: "these", memoire: "memoire",
  dvd: "dvd", cd: "cd", carte: "carte", ebook: "ebook", numerique: "ebook",
};
export function normaliserType(v) {
  const s = txt(v).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, ""); // sans accents
  return SYNONYMES_TYPE[s] || "livre";
}

// Auteurs : les fichiers de bibliothèque séparent les auteurs par « ; » ou
// « / », et écrivent souvent « Nom, Prénom » (usage catalographique). On ne
// coupe donc sur la virgule QUE s'il n'y en a qu'une — « Diop, Mamadou » donne
// bien {nom: Diop, prenom: Mamadou}, tandis que « Diop, Fall, Sow » reste un
// cas ambigu que l'on préfère laisser en nom complet plutôt que d'inventer.
export function decouperAuteurs(v) {
  const brut = String(v ?? "").trim();
  if (!brut) return [];
  return brut.split(/[;/]|\set\s|\s&\s/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const bouts = p.split(",").map((s) => s.trim()).filter(Boolean);
    if (bouts.length === 2) return { nom: bouts[0], prenom: bouts[1] };
    return { nom: p, prenom: null };
  });
}

// Clé de dédoublonnage d'un auteur, insensible à la casse et aux accents.
export function cleAuteur(a) {
  const n = (s) => String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${n(a.nom)}|${n(a.prenom)}`;
}

// Transforme une ligne brute du tableur en notice, selon le mapping choisi.
export function normaliserLigne(row = {}, mapping = {}) {
  const val = (cle) => (mapping[cle] ? row[mapping[cle]] : "");
  return {
    titre: txt(val("titre")),
    sous_titre: txt(val("sous_titre")) || null,
    auteurs: decouperAuteurs(val("auteur_libre")),
    editeur: txt(val("editeur")) || null,
    annee_pub: normaliserAnnee(val("annee_pub")),
    isbn: normaliserIsbn(val("isbn")),
    type_ressource: normaliserType(val("type_ressource")),
    discipline: txt(val("discipline")) || null,
    langue: txt(val("langue")) || "fr",
    resume: txt(val("resume")) || null,
    mots_cles: normaliserMotsCles(val("mots_cles")),
    cote: txt(val("cote")) || null,
    quantite: normaliserQuantite(val("quantite")),
  };
}

// Analyse complète : sépare le bon grain de l'ivraie AVANT toute écriture.
//   valides   : notices prêtes à insérer
//   rejets    : [{ ligne, motif }] — numéro de ligne tel qu'il apparaît au tableur
//   doublons  : ISBN répétés À L'INTÉRIEUR du fichier (le 1er est gardé)
export function analyser(rows = [], mapping = {}) {
  const valides = [];
  const rejets = [];
  const doublons = [];
  const vusIsbn = new Map();

  rows.forEach((row, i) => {
    const numero = i + 2; // +1 pour l'en-tête, +1 pour passer en base 1
    const n = normaliserLigne(row, mapping);

    if (!n.titre) { rejets.push({ ligne: numero, motif: "Titre manquant" }); return; }
    if (n.titre.length > 500) { rejets.push({ ligne: numero, motif: "Titre anormalement long" }); return; }

    if (n.isbn) {
      const deja = vusIsbn.get(n.isbn);
      if (deja) { doublons.push({ ligne: numero, isbn: n.isbn, premiere: deja, titre: n.titre }); return; }
      vusIsbn.set(n.isbn, numero);
    }
    valides.push(n);
  });

  return { valides, rejets, doublons, total: rows.length };
}

// Découpe en lots pour ne jamais envoyer 10 000 lignes en une requête.
export function enLots(liste = [], taille = 200) {
  const t = Math.max(1, Math.min(500, Math.floor(taille) || 200));
  const lots = [];
  for (let i = 0; i < liste.length; i += t) lots.push(liste.slice(i, i + t));
  return lots;
}
