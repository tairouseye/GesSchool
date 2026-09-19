// GesSchool — montant en toutes lettres (français).
//
// « Arrêtée la présente facture à la somme de … » est une mention d'usage
// constant sur les documents de caisse en zone OHADA : elle rend la falsification
// d'un chiffre inopérante. Elle n'existait pas dans l'application.
//
// Module PUR (aucun accès réseau) — testé dans `test/montantEnLettres.test.mjs`.

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = {
  20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante",
  60: "soixante", 80: "quatre-vingt",
};

// 0 → 99. Le français a trois irrégularités : 21/31/…/61 prennent « et un »,
// 70 et 90 se comptent en soixante-dix / quatre-vingt-dix, et 80 seul prend
// un « s » (quatre-vingts) que 81 perd.
//
// `accorde` dit si le groupe peut porter la marque du pluriel. Il vaut faux
// devant « mille » : on écrit « quatre-vingt mille », mais « quatre-vingts
// millions » — million est un nom, mille ne l'est pas.
function centaineBasse(n, accorde = true) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10) * 10;
  const u = n % 10;

  if (d === 70 || d === 90) {
    const base = d === 70 ? "soixante" : "quatre-vingt";
    const reste = UNITES[10 + u];
    // 71 = soixante et onze ; 91 = quatre-vingt-onze (pas de « et »).
    return u === 1 && d === 70 ? `${base} et ${reste}` : `${base}-${reste}`;
  }

  const base = DIZAINES[d];
  if (u === 0) return d === 80 && accorde ? "quatre-vingts" : base;
  if (u === 1 && d !== 80) return `${base} et un`;
  return `${base}-${UNITES[u]}`;
}

// 0 → 999. « cent » ne prend un « s » que multiplié ET en fin de groupe :
// deux cents, mais deux cent un — et deux cent mille.
function centaines(n, accorde = true) {
  if (n < 100) return centaineBasse(n, accorde);
  const c = Math.floor(n / 100);
  const reste = n % 100;
  const tete = c === 1 ? "cent" : `${UNITES[c]} cent`;
  if (reste === 0) return c === 1 ? "cent" : `${tete}${accorde ? "s" : ""}`;
  return `${tete} ${centaineBasse(reste, accorde)}`;
}

// « mille » est invariable ET bloque l'accord du groupe qui le précède ;
// million et milliard sont des noms : ils s'accordent et laissent accorder.
const ECHELLES = [
  [1e9, "milliard", true],
  [1e6, "million", true],
  [1e3, "mille", false],
];

export function nombreEnLettres(n) {
  const entier = Math.floor(Math.abs(Number(n) || 0));
  if (entier === 0) return "zéro";
  if (entier > 999999999999) return String(entier); // au-delà, le chiffre reste plus lisible

  const morceaux = [];
  let reste = entier;
  for (const [valeur, mot, nom] of ECHELLES) {
    const q = Math.floor(reste / valeur);
    if (q > 0) {
      const tete = q === 1 && !nom ? "" : `${centaines(q, nom)} `;
      const pluriel = nom && q > 1 ? "s" : "";
      morceaux.push(`${tete}${mot}${pluriel}`.trim());
      reste %= valeur;
    }
  }
  if (reste > 0) morceaux.push(centaines(reste));
  return morceaux.join(" ");
}

// Nom de la devise en toutes lettres. Le franc CFA est la seule devise où
// l'usage local impose une formule ; ailleurs on reprend le code tel quel.
const DEVISES = {
  XOF: ["franc CFA", "francs CFA"],
  XAF: ["franc CFA", "francs CFA"],
  EUR: ["euro", "euros"],
  USD: ["dollar", "dollars"],
  CDF: ["franc congolais", "francs congolais"],
  MAD: ["dirham", "dirhams"],
};

// « Cent vingt-cinq mille francs CFA ». La première lettre est capitalisée :
// la mention ouvre une phrase sur le document.
export function montantEnLettres(montant, devise = "XOF") {
  const n = Math.floor(Math.abs(Number(montant) || 0));
  const lettres = nombreEnLettres(n);
  const [sing, plur] = DEVISES[String(devise).toUpperCase()] || [devise, devise];
  const mot = n > 1 ? plur : sing;
  const phrase = `${lettres} ${mot}`.trim();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
