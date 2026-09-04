// GesSchool — parseur de barème IR + TRIMF (feuille Excel/CSV → lignes).
// Format attendu (comme les barèmes officiels sénégalais) : une ligne d'en-tête
// contenant « TRIMF » et des colonnes « 1 part », « 1,5 parts », … ; la colonne
// juste avant TRIMF = « Revenu brut ». Tolérant aux colonnes vides à gauche.

// "1,5 parts" -> "1.5" ; "1 part" -> "1" ; null si ce n'est pas une colonne de parts.
export function normaliserPart(label) {
  const m = /([\d]+(?:[.,]\d+)?)\s*parts?/i.exec(String(label || ""));
  if (!m) return null;
  return String(parseFloat(m[1].replace(",", ".")));
}

const estNombre = (v) => v !== "" && v != null && Number.isFinite(Number(v));

// matrix : tableau de lignes (array-of-arrays), issu de XLSX sheet_to_json({header:1}).
// Renvoie { rows: [{revenu, trimf, ir:{part:val}}], parts:[...], lignesLues }.
// Lève une erreur explicite si la structure n'est pas reconnue.
export function parserFeuilleBareme(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) throw new Error("Feuille vide.");

  // 1) Ligne d'en-tête = première ligne contenant une colonne « … part(s) ».
  let hRow = -1;
  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    if ((matrix[r] || []).some((c) => normaliserPart(c))) { hRow = r; break; }
  }
  if (hRow === -1) throw new Error("En-tête introuvable : aucune colonne « … parts » détectée.");

  const entete = matrix[hRow];
  // 2) Colonnes des parts + colonne TRIMF.
  const partCols = {};
  entete.forEach((c, i) => { const p = normaliserPart(c); if (p) partCols[i] = p; });
  let trimfCol = entete.findIndex((c) => /trimf/i.test(String(c || "")));
  const premierePartCol = Math.min(...Object.keys(partCols).map(Number));
  if (trimfCol === -1) trimfCol = premierePartCol - 1;      // repli : juste avant les parts
  const revenuCol = trimfCol - 1;                            // revenu = colonne avant TRIMF
  if (revenuCol < 0) throw new Error("Colonne « Revenu brut » introuvable (attendue avant TRIMF).");
  const parts = [...new Set(Object.values(partCols))];

  // 3) Données : lignes sous l'en-tête où la colonne revenu est un nombre.
  const rows = [];
  for (let r = hRow + 1; r < matrix.length; r++) {
    const ligne = matrix[r] || [];
    if (!estNombre(ligne[revenuCol])) continue;
    const ir = {};
    for (const [i, p] of Object.entries(partCols)) ir[p] = Number(ligne[i]) || 0;
    rows.push({ revenu: Number(ligne[revenuCol]), trimf: Number(ligne[trimfCol]) || 0, ir });
  }
  if (rows.length === 0) throw new Error("Aucune ligne de barème lue sous l'en-tête.");
  return { rows, parts, lignesLues: rows.length };
}

// Recherche l'IR + TRIMF pour un revenu brut et un nombre de parts, dans un
// barème trié par revenu croissant. On prend la borne la plus élevée <= revenu
// (fonction en escalier) ; en dessous de la 1re borne → 0.
export function chercherBareme(bareme, revenu, part) {
  if (!bareme || bareme.length === 0) return { ir: 0, trimf: 0, trouve: false };
  const cle = String(parseFloat(part) || 1);
  let choisi = null;
  for (const row of bareme) {           // trié croissant
    if (Number(row.revenu) <= revenu) choisi = row; else break;
  }
  if (!choisi) return { ir: 0, trimf: 0, trouve: false };
  const ir = choisi.ir ? Number(choisi.ir[cle] ?? choisi.ir[String(part)] ?? 0) : 0;
  return { ir: Math.round(ir), trimf: Math.round(Number(choisi.trimf) || 0), trouve: true };
}
