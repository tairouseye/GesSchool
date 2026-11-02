// GesSchool — lire la grille d'un emploi du temps PDF (Mme Kane, 02/11/2026).
//
// Le PDF est un TABLEAU : une ligne d'en-tête (Lundi … Vendredi), une colonne
// d'horaires (« 08h00 – 08h30 »), et dans chaque case l'activité. On ne lit
// que le TEXTE et sa position — pas les traits du tableau — :
//   · la colonne d'une case = le jour dont l'en-tête est le plus proche ;
//   · sa ligne = l'horaire à la même hauteur. Une case fusionnée sur plusieurs
//     horaires (« Renforcement » de 15h00 à 16h00) a son texte centré ENTRE
//     ces horaires : on retient la plage libre dont le centre tombe dessus ;
//   · une ligne qui ne porte qu'un texte, centré sur la semaine (« Pause
//     goûter – Récréation »), vaut pour tous les jours.
//   · « Psychomotricité (G1) » / « Jeux (G2) » dans une même case : deux
//     créneaux, le groupe noté dans `salle` (comme à la saisie, mig. 204).
//
// ⚠️ C'est une LECTURE, pas une certitude : l'écran montre le résultat, et
// rien n'est enregistré sans validation. Un PDF scanné (une image) n'a pas de
// texte : `lirePdfEmploi` le dit au lieu de rendre une grille vide.

const JOURS = [["lundi", 1], ["mardi", 2], ["mercredi", 3], ["jeudi", 4], ["vendredi", 5], ["samedi", 6]];
const HORAIRE = /^(\d{1,2})\s*[hH:]\s*(\d{2})?\s*[–—\-à]+\s*(\d{1,2})\s*[hH:]\s*(\d{2})?$/;
const GROUPE = /^(.*?)\s*\((G\d+)\)\s*$/i;
const SANS_COURS = /pause|r[ée]cr[ée]ation|go[uû]ter|repas|sieste|accueil|rangement|d[ée]jeuner|toilettes?|repos/i;

export const normaliser = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

const hhmm = (h, m) => `${String(Number(h)).padStart(2, "0")}:${m || "00"}`;

export const estSansCours = (libelle) => SANS_COURS.test(libelle || "");

// items : [{ x, y, w, str }] — y mesuré depuis le HAUT de la page.
// Rend { titre, jours: [n…], creneaux: [{ jour, heure_debut, heure_fin, libelle, salle }], ignores: [texte…] }
export function analyserPage(items) {
  const propres = items
    .map((it) => ({ ...it, str: String(it.str || "").replace(/\s+/g, " ").trim() }))
    .filter((it) => it.str);

  // 1. L'en-tête des jours.
  const entetes = [];
  for (const it of propres) {
    const j = JOURS.find(([nom]) => normaliser(it.str) === nom);
    if (j && !entetes.some((e) => e.jour === j[1])) entetes.push({ jour: j[1], cx: it.x + it.w / 2, y: it.y });
  }
  if (entetes.length < 2) return { titre: titreDe(propres), jours: [], creneaux: [], ignores: [] };
  entetes.sort((a, b) => a.cx - b.cx);
  const yEntete = Math.max(...entetes.map((e) => e.y));
  const pas = (entetes[entetes.length - 1].cx - entetes[0].cx) / (entetes.length - 1);
  const gaucheJours = entetes[0].cx - pas / 2;
  const colonneDe = (cx) => entetes.reduce((m, e) => (Math.abs(e.cx - cx) < Math.abs(m.cx - cx) ? e : m)).jour;

  // 2. Les horaires (colonne de gauche).
  const lignes = propres
    .filter((it) => it.y > yEntete + 2 && it.x + it.w / 2 < gaucheJours)
    .map((it) => ({ it, m: it.str.match(HORAIRE) }))
    .filter((r) => r.m)
    .map(({ it, m }) => ({ y: it.y, debut: hhmm(m[1], m[2]), fin: hhmm(m[3], m[4]) }))
    .sort((a, b) => a.y - b.y);
  if (lignes.length === 0) return { titre: titreDe(propres), jours: entetes.map((e) => e.jour), creneaux: [], ignores: [] };
  // Haut et bas de chaque ligne : à mi-chemin des horaires voisins.
  lignes.forEach((l, k) => {
    const prec = lignes[k - 1], suiv = lignes[k + 1];
    l.haut = prec ? (prec.y + l.y) / 2 : l.y - ((suiv ? suiv.y - l.y : 30) / 2);
    l.bas = suiv ? (l.y + suiv.y) / 2 : l.y + ((prec ? l.y - prec.y : 30) / 2);
  });
  const basGrille = lignes[lignes.length - 1].bas + 10;

  // 3. Le contenu, colonne par colonne, en blocs de lignes rapprochées.
  const contenu = propres.filter((it) => it.y > yEntete + 2 && it.y < basGrille && it.x + it.w / 2 >= gaucheJours);
  const parJour = new Map(entetes.map((e) => [e.jour, []]));
  for (const it of contenu) parJour.get(colonneDe(it.x + it.w / 2)).push(it);

  const blocs = [];
  for (const [jour, its] of parJour) {
    // Les morceaux d'une même ligne de texte (pdf.js coupe parfois) d'abord.
    const rangs = [];
    for (const it of [...its].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const r = rangs.find((x) => Math.abs(x.y - it.y) < 2);
      if (r) { r.parts.push(it); } else rangs.push({ y: it.y, parts: [it] });
    }
    rangs.forEach((r) => {
      r.parts.sort((a, b) => a.x - b.x);
      r.texte = r.parts.map((p) => p.str).join(" ");
      r.cx = (r.parts[0].x + r.parts[r.parts.length - 1].x + r.parts[r.parts.length - 1].w) / 2;
    });
    let courant = null;
    for (const r of rangs) {
      if (courant && r.y - courant.yFin <= 13) { courant.rangs.push(r); courant.yFin = r.y; }
      else { courant = { jour, rangs: [r], yDebut: r.y, yFin: r.y }; blocs.push(courant); }
    }
  }
  blocs.forEach((b) => { b.centre = (b.yDebut + b.yFin) / 2; b.cx = b.rangs.reduce((s, r) => s + r.cx, 0) / b.rangs.length; });

  // 4. Chaque bloc sur sa ou ses lignes horaires.
  const occupe = new Set(); // "jour:indexLigne"
  const places = [];
  const surUneLigne = (b) => lignes.findIndex((l) => Math.abs(l.y - b.centre) <= 6);
  for (const b of blocs) {
    const k = surUneLigne(b);
    if (k >= 0) { places.push({ b, de: k, a: k }); occupe.add(`${b.jour}:${k}`); }
  }
  const ignores = [];
  for (const b of blocs) {
    if (surUneLigne(b) >= 0) continue;
    let meilleur = null;
    for (let de = 0; de < lignes.length; de++) {
      for (let a = de + 1; a < lignes.length && a <= de + 6; a++) {
        let libre = true;
        for (let k = de; k <= a; k++) if (occupe.has(`${b.jour}:${k}`)) libre = false;
        if (!libre) break;
        const ecart = Math.abs((lignes[de].haut + lignes[a].bas) / 2 - b.centre);
        if (b.centre < lignes[de].haut || b.centre > lignes[a].bas) continue;
        if (!meilleur || ecart < meilleur.ecart) meilleur = { de, a, ecart };
      }
    }
    if (meilleur && meilleur.ecart <= 12) {
      places.push({ b, de: meilleur.de, a: meilleur.a });
      for (let k = meilleur.de; k <= meilleur.a; k++) occupe.add(`${b.jour}:${k}`);
    } else {
      ignores.push(b.rangs.map((r) => r.texte).join(" "));
    }
  }

  // 5. Une ligne qui ne porte qu'un texte centré sur la semaine vaut pour
  //    tous les jours (pauses, accueil, repas).
  const milieu = (entetes[0].cx + entetes[entetes.length - 1].cx) / 2;
  const creneaux = [];
  for (const p of places) {
    const debut = lignes[p.de].debut, fin = lignes[p.a].fin;
    const seul = p.de === p.a && places.filter((q) => q.de <= p.de && q.a >= p.de).length === 1;
    const jours = seul && Math.abs(p.b.cx - milieu) < pas / 3 && entetes.length > 2
      ? entetes.map((e) => e.jour) : [p.b.jour];
    for (const c of contenuBloc(p.b)) {
      for (const jour of jours) creneaux.push({ jour, heure_debut: debut, heure_fin: fin, ...c });
    }
  }
  const fusionnes = fusionnerSuites(creneaux);
  fusionnes.sort((a, b) => a.jour - b.jour || a.heure_debut.localeCompare(b.heure_debut) || (a.salle || "").localeCompare(b.salle || ""));
  return { titre: titreDe(propres), jours: entetes.map((e) => e.jour), creneaux: fusionnes, ignores };
}

// Le même cours écrit dans deux cases qui se suivent (« EPS » à 9h00 puis à
// 9h30) est UN cours d'une heure : c'est ainsi qu'il a été saisi à la main.
function fusionnerSuites(creneaux) {
  const tries = [...creneaux].sort((a, b) =>
    a.jour - b.jour || (a.salle || "").localeCompare(b.salle || "") || a.heure_debut.localeCompare(b.heure_debut));
  const sortie = [];
  for (const c of tries) {
    const p = sortie[sortie.length - 1];
    if (p && p.jour === c.jour && (p.salle || "") === (c.salle || "") && p.heure_fin === c.heure_debut
        && normaliser(p.libelle) === normaliser(c.libelle)) {
      p.heure_fin = c.heure_fin;
    } else sortie.push({ ...c });
  }
  return sortie;
}

// Le texte d'une case : une activité, ou une par groupe (G1, G2…).
function contenuBloc(b) {
  const textes = b.rangs.map((r) => r.texte);
  const groupes = textes.map((t) => t.match(GROUPE));
  if (textes.length > 1 && groupes.every(Boolean)) {
    return groupes.map((g) => ({ libelle: g[1].trim(), salle: g[2].toUpperCase() }));
  }
  const libelle = textes.join(" ").replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
  // « Psychomotricité (G1) / Jeux (G2) » écrit sur deux lignes.
  const parts = libelle.split(" / ");
  if (parts.length > 1 && parts.every((p) => GROUPE.test(p))) {
    return parts.map((p) => { const m = p.match(GROUPE); return { libelle: m[1].trim(), salle: m[2].toUpperCase() }; });
  }
  const g = libelle.match(GROUPE);
  return g ? [{ libelle: g[1].trim(), salle: g[2].toUpperCase() }] : [{ libelle, salle: null }];
}

// « EMPLOI DU TEMPS CI / CP A — 2026-2027 » → « CI / CP A ».
function titreDe(items) {
  const t = items.find((it) => /emploi du temps/i.test(it.str));
  if (!t) return "";
  return t.str.replace(/.*emploi du temps\s*/i, "").replace(/\s*[—–-]\s*\d{4}\s*[-/]\s*\d{4}.*$/, "").trim();
}

// Les classes que le titre désigne : égalité d'abord (« CI / CP A »), sinon
// le préfixe (« TPS / PS » → « TPS/PS A » et « TPS/PS B »).
export function classesDuTitre(titre, classes) {
  const cle = (s) => normaliser(s).replace(/[^a-z0-9]/g, "");
  const t = cle(titre);
  if (!t) return [];
  const egales = classes.filter((c) => cle(c.libelle) === t);
  if (egales.length) return egales.map((c) => c.id);
  return classes.filter((c) => cle(c.libelle).startsWith(t)).map((c) => c.id);
}

// Lit le fichier dans le navigateur. pdf.js n'est chargé qu'ici : il pèse
// lourd, et seul cet écran s'en sert.
export async function lirePdfEmploi(fichier) {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
  // La première page qui porte une grille : un PDF d'EDT = une classe.
  let vide = true;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const h = page.getViewport({ scale: 1 }).height;
    const { items } = await page.getTextContent();
    const its = items.filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: h - i.transform[5], w: i.width, str: i.str }));
    if (its.length) vide = false;
    const r = analyserPage(its);
    if (r.creneaux.length) return r;
  }
  throw new Error(vide
    ? "Ce PDF ne contient pas de texte (c'est sans doute un scan) : la grille ne peut pas être lue. Saisissez-le en mode « Modifier », ou demandez le PDF d'origine (exporté depuis Word ou Excel)."
    : "Aucune grille d'emploi du temps reconnue dans ce PDF (il faut une ligne Lundi… Vendredi et une colonne d'horaires).");
}
