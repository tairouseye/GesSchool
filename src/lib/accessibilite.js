// Nom accessible d'un lien à pastille : « Messagerie, 3 messages non lus ».
// Sans non-lu, le libellé seul — pas de « 0 message non lu » à chaque passage.
export function libelleCompteur(libelle, n, singulier, pluriel) {
  if (!n || n <= 0) return libelle;
  return `${libelle}, ${n} ${n > 1 ? pluriel : singulier}`;
}
