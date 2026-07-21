// GesSchool — référentiel des pays desservis.
// Périmètre actuel : zone UEMOA (huit pays, monnaie commune XOF), ce qui permet
// une grille tarifaire unique. Les autres pays restent saisissables, avec leur
// propre devise.

export const PAYS_UEMOA = [
  "Bénin", "Burkina Faso", "Côte d'Ivoire", "Guinée-Bissau",
  "Mali", "Niger", "Sénégal", "Togo",
];

// Pays hors UEMOA rencontrés dans la région (devise différente).
export const PAYS_AUTRES = [
  "Cameroun", "Congo", "Gabon", "Tchad",       // zone CEMAC → XAF
  "Guinée",                                     // GNF
  "Mauritanie", "Maroc", "France",
];

export const PAYS = [...PAYS_UEMOA, ...PAYS_AUTRES];

// Devise par défaut d'un pays. Sert à pré-remplir, jamais à contraindre :
// l'établissement garde la main dans Paramètres.
const DEVISE_PAR_PAYS = {
  Cameroun: "XAF", Congo: "XAF", Gabon: "XAF", Tchad: "XAF",
  "Guinée": "GNF", Mauritanie: "MRU", Maroc: "MAD", France: "EUR",
};

export function deviseDuPays(pays) {
  if (PAYS_UEMOA.includes(pays)) return "XOF";
  return DEVISE_PAR_PAYS[pays] || "XOF";
}

export function estUemoa(pays) {
  return PAYS_UEMOA.includes(pays);
}
