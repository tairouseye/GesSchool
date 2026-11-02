// GesSchool — confronter le fichier « Suivi des mensualités » tenu par
// l'école avec l'appli (Mme Kane, 02/11/2026 ; mig. 222).
//
// C'est la confrontation faite à la main le 27/10 (TutTank/
// generer_confrontation.py), rendue à l'école : elle charge son Excel,
// l'appli liste les écarts, et elle coche ceux à enregistrer.
//
// Le fichier est repéré par ses EN-TÊTES, pas par la position des colonnes :
// « Matricule », « Nom », « Prénom », « Classe », « Montant mensualité »,
// « Inscription », puis un mois par colonne (« Octobre » … « Juin »). Le
// fichier exporté par l'appli (GrilleMensualites) se relit donc aussi.
//
// ⚠️ L'élève est reconnu par son MATRICULE, seul repère sûr : deux « Fall
// Awa » dans une école, cela arrive.

const normaliser = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const nombre = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(/(F|FCFA|XOF)$/i, "").replace(",", ".");
  return s && /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

// lignes : le tableau de lignes de la feuille (XLSX sheet_to_json, header: 1).
// moisAnnee : les mois de l'année au format « AAAA-MM », dans l'ordre.
// Rend { eleves: [{ matricule, nom, prenom, classe, niveau, mensualite, inscription, mois: { "AAAA-MM": montant } }], colonnesMois }
export function lireSuivi(lignes, moisAnnee) {
  const iEntete = lignes.findIndex((l) => (l || []).some((c) => normaliser(c) === "matricule"));
  if (iEntete < 0) throw new Error("Colonne « Matricule » introuvable : ce n'est pas un fichier de suivi des mensualités.");
  const entete = lignes[iEntete].map((c) => normaliser(c));
  const col = (...noms) => entete.findIndex((h) => noms.some((n) => h === n || h.startsWith(n)));
  const c = {
    matricule: col("matricule"), nom: col("nom"), prenom: col("prenom"),
    niveau: col("niveau"), classe: col("classe"),
    mensualite: col("montant mensualite", "mensualite"), inscription: col("inscription"),
  };
  // Un mois d'en-tête → la clé de l'année qui a ce numéro de mois.
  const colonnesMois = [];
  entete.forEach((h, i) => {
    const n = MOIS.indexOf(h);
    if (n < 0) return;
    const k = moisAnnee.find((m) => Number(m.slice(5, 7)) === n + 1);
    if (k) colonnesMois.push({ i, k });
  });
  if (colonnesMois.length === 0) throw new Error("Aucune colonne de mois (Octobre, Novembre…) trouvée dans le fichier.");

  const eleves = [];
  for (const l of lignes.slice(iEntete + 1)) {
    const matricule = String(l?.[c.matricule] ?? "").trim();
    if (!matricule) continue;
    const ins = c.inscription >= 0 ? l[c.inscription] : null;
    const nIns = nombre(ins);
    const mois = {};
    for (const { i, k } of colonnesMois) {
      const v = nombre(l[i]);
      if (v > 0) mois[k] = v;
    }
    eleves.push({
      matricule,
      nom: String(l[c.nom] ?? "").trim(), prenom: String(l[c.prenom] ?? "").trim(),
      niveau: String(l[c.niveau] ?? "").trim(), classe: String(l[c.classe] ?? "").trim(),
      mensualite: c.mensualite >= 0 ? nombre(l[c.mensualite]) : null,
      // « Oui », ou un montant : payée (convention de Mme Kane, 26/10).
      inscription: nIns > 0 ? nIns : normaliser(ins) === "oui" ? "oui" : "non",
      mois,
    });
  }
  return { eleves, colonnesMois };
}

// grille : les lignes de `grille_mensualites` (mig. 213).
// Rend les écarts : [{ type, matricule, eleve, eleve_id, mois, fichier, appli, montant }]
//   a_encaisser   payé dans le fichier, pas (ou moins) dans l'appli → à cocher
//   appli_plus    payé dans l'appli, pas (ou moins) dans le fichier
//   absent_appli  matricule du fichier inconnu ou non inscrit cette année
//   absent_fichier inscrit dans l'appli, absent du fichier
//   mensualite    tarif différent
export function confronter(fichier, grille) {
  const parMat = new Map(grille.filter((g) => g.matricule).map((g) => [g.matricule.trim().toUpperCase(), g]));
  const vus = new Set();
  const ecarts = [];
  const nom = (x) => `${x.nom || ""} ${x.prenom || ""}`.trim();

  for (const f of fichier) {
    const g = parMat.get(f.matricule.toUpperCase());
    if (!g) { ecarts.push({ type: "absent_appli", matricule: f.matricule, eleve: nom(f), fichier: f.classe }); continue; }
    vus.add(g.eleve_id);
    const base = { matricule: g.matricule, eleve: nom(g), eleve_id: g.eleve_id };

    if (f.mensualite != null && !g.exonere && g.mensualite != null && Math.round(f.mensualite) !== Math.round(Number(g.mensualite))) {
      ecarts.push({ ...base, type: "mensualite", fichier: f.mensualite, appli: Number(g.mensualite) });
    }

    // L'inscription : « Oui » = le montant de l'appli ; un nombre = ce montant.
    const insDu = Number(g.inscription_montant) || 0, insPaye = Number(g.inscription_paye) || 0;
    if (!g.exonere && insDu > 0 && f.inscription !== "non") {
      const voulu = f.inscription === "oui" ? insDu : Math.min(f.inscription, insDu);
      if (voulu > insPaye) {
        ecarts.push({ ...base, type: "a_encaisser", mois: null, fichier: voulu, appli: insPaye, montant: voulu - insPaye });
      }
    }

    const moisAppli = g.mois || {};
    const cles = new Set([...Object.keys(f.mois), ...Object.keys(moisAppli).filter((k) => Number(moisAppli[k]?.paye) > 0)]);
    for (const k of [...cles].sort()) {
      const vf = f.mois[k] || 0, va = Math.round(Number(moisAppli[k]?.paye) || 0);
      if (vf > va) {
        if (!moisAppli[k]) {
          // Mois hors échéancier (exonéré, fin de facturation…) : rien à régler.
          ecarts.push({ ...base, type: "hors_echeancier", mois: k, fichier: vf, appli: 0 });
        } else {
          ecarts.push({ ...base, type: "a_encaisser", mois: k, fichier: vf, appli: va, montant: vf - va });
        }
      } else if (va > vf) {
        ecarts.push({ ...base, type: "appli_plus", mois: k, fichier: vf, appli: va });
      }
    }
  }
  for (const g of grille) {
    if (!vus.has(g.eleve_id)) ecarts.push({ type: "absent_fichier", matricule: g.matricule || "—", eleve: nom(g), eleve_id: g.eleve_id, appli: g.classe });
  }
  return ecarts;
}
