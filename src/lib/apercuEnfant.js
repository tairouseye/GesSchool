// GesSchool — l'aperçu d'un enfant, tel que le parent le lit sur l'accueil
// et en tête de la liste des rubriques (refonte « Classter » du 31/10/2026,
// docs/maquette-tableaux-classter.html, onglet 4).
//
// ⚠️ MODULE PUR : il ne fait que trier, compter et nommer ce que les RPC
// parent ont déjà rendu (`enfant_factures`, `enfant_notes`, `enfant_absences`,
// `enfant_cahier`, `enfant_emploi`, `enfant_fournitures`). Les droits sont
// tenus par ces RPC. Testé par test/apercuEnfant.test.mjs.
//
// 🔴 `enfant_bulletins` N'EST JAMAIS APPELÉE POUR UN APERÇU : elle marque
// les bulletins comme CONSULTÉS (mig. 166). L'appeler depuis l'accueil
// ferait croire à l'école que la famille a lu un bulletin qu'elle n'a pas
// ouvert. D'où « Dernière note » plutôt qu'une moyenne de bulletin.

import { facturesVisibles, peutPayer, syntheseFactures } from "@/lib/situationParent.js";

export const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// `enfant_emploi.jour` : 1 = lundi … 7 = dimanche.
export const jourSemaine = (d) => ((d.getDay() + 6) % 7) + 1;

const hm = (t) => String(t || "").slice(0, 5);

/** Les cours du jour : celui en cours (ou le prochain), puis les suivants. */
export function coursDuJour(creneaux = [], now = new Date()) {
  const j = jourSemaine(now);
  const maintenant = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const du = (Array.isArray(creneaux) ? creneaux : [])
    .filter((c) => Number(c.jour) === j)
    .sort((a, b) => hm(a.heure_debut).localeCompare(hm(b.heure_debut)));
  const restants = du.filter((c) => hm(c.heure_fin) > maintenant);
  if (restants.length === 0) return { premier: null, suivants: [], termine: du.length > 0 };
  const [premier, ...suivants] = restants;
  return {
    premier: { ...premier, enCours: hm(premier.heure_debut) <= maintenant, debut: hm(premier.heure_debut), fin: hm(premier.heure_fin) },
    suivants: suivants.slice(0, 2).map((c) => ({ ...c, debut: hm(c.heure_debut) })),
    termine: false,
  };
}

/** Horaires d'un jour donné (« 8 h – 13 h »), pour la rubrique Emploi du temps. */
export function amplitudeJour(creneaux = [], jour) {
  const du = (Array.isArray(creneaux) ? creneaux : []).filter((c) => Number(c.jour) === jour);
  if (du.length === 0) return null;
  const h = (t) => { const [hh, mm] = hm(t).split(":"); return mm === "00" ? `${Number(hh)} h` : `${Number(hh)} h ${mm}`; };
  const debut = du.map((c) => hm(c.heure_debut)).sort()[0];
  const fin = du.map((c) => hm(c.heure_fin)).sort().at(-1);
  return `${h(debut)} – ${h(fin)}`;
}

/** Devoirs à faire : une date « pour » aujourd'hui ou plus tard. */
export function devoirsAVenir(cahier = [], now = new Date()) {
  const jour = isoJour(now);
  return (Array.isArray(cahier) ? cahier : [])
    .filter((c) => String(c.devoirs || "").trim() && c.date_pour && c.date_pour >= jour)
    .sort((a, b) => a.date_pour.localeCompare(b.date_pour));
}

/** Les notes les plus récentes d'abord (`enfant_notes` les rend par période et matière). */
export function dernieresNotes(notes = [], n = 3) {
  return [...(Array.isArray(notes) ? notes : [])]
    .sort((a, b) => String(b.date_eval || "").localeCompare(String(a.date_eval || "")))
    .slice(0, n);
}

/** Une note sur 20 (ou sur son barème) colorée : sous la moitié, limite, au-dessus. */
export function tonNote(valeur, bareme = 20) {
  const r = Number(valeur) / (Number(bareme) || 20);
  return r < 0.5 ? "rouge" : r < 0.6 ? "or" : "vert";
}

export const absencesAJustifier = (absences = []) =>
  (Array.isArray(absences) ? absences : []).filter((a) => a.statut === "non_justifie");

/** Échéances encore dues, de la plus ancienne à la plus lointaine. */
export function echeancesDues(factures = []) {
  return facturesVisibles(factures)
    .filter((f) => peutPayer(f) && f.date_echeance)
    .sort((a, b) => String(a.date_echeance).localeCompare(String(b.date_echeance)));
}

/** Le bloc « À régler » : montant, retard, prochaine échéance. */
export function aRegler(factures = [], now = new Date()) {
  const s = syntheseFactures(factures);
  const jour = isoJour(now);
  const ech = echeancesDues(factures);
  const premiere = ech[0] || null;
  return {
    reste: s.reste, paye: s.paye, facture: s.facture,
    part: s.facture > 0 ? Math.round((s.paye / s.facture) * 100) : null,
    enRetard: Boolean(premiere && premiere.date_echeance < jour),
    echeance: premiere?.date_echeance || null,
  };
}

/** « À venir » : échéances et devoirs, les plus proches d'abord. */
export function aVenir({ factures = [], cahier = [] } = {}, now = new Date(), n = 3) {
  const jour = isoJour(now);
  const parDate = {};
  for (const f of echeancesDues(factures)) {
    if (f.date_echeance >= jour) parDate[`e${f.date_echeance}`] ||= { date: f.date_echeance, ton: "rouge", titre: "Échéance de paiement" };
  }
  for (const d of devoirsAVenir(cahier, now)) {
    parDate[`d${d.date_pour}${d.matiere}`] ||= { date: d.date_pour, ton: "bleu", titre: `Devoir de ${d.matiere || "classe"}` };
  }
  return Object.values(parDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
}

const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;
const JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** « pour lundi », « pour demain », « pour le 12 nov. » */
export function pourQuand(date, now = new Date()) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  const ecart = Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)) / 86400000);
  if (ecart <= 0) return "pour aujourd'hui";
  if (ecart === 1) return "pour demain";
  if (ecart < 7) return `pour ${JOURS[jourSemaine(d)]}`;
  return `pour le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

/**
 * Ce que chaque rubrique contient, en une ligne : la rubrique dit déjà ce
 * qu'il y a dedans, sans qu'on ait besoin de l'ouvrir. Une donnée absente
 * (non chargée, ou refusée) ne produit AUCUNE ligne plutôt qu'une fausse.
 */
export function resumeRubriques(d = {}, now = new Date()) {
  const r = {};
  if (d.factures) {
    const a = aRegler(d.factures, now);
    r.paiements = a.reste > 0
      ? { texte: `${new Intl.NumberFormat("fr-FR").format(a.reste)} ${d.devise || "XOF"} à régler${a.enRetard ? " · en retard" : ""}`, ton: a.enRetard ? "rouge" : "or" }
      : a.facture > 0 ? { texte: "Tout est réglé ✓", ton: "vert" } : null;
  }
  if (d.notes) {
    const nouvelles = Number(d.alertes?.note || 0);
    const der = dernieresNotes(d.notes, 1)[0];
    r.notes = nouvelles > 0 ? { texte: pl(nouvelles, "nouvelle note", "nouvelles notes"), ton: "or" }
      : der ? { texte: `Dernière : ${der.matiere} ${fmtNote(der.valeur)}/${fmtNote(der.bareme)}` } : null;
  }
  if (d.cahier) {
    const dv = devoirsAVenir(d.cahier, now);
    r.cahier = dv.length > 0 ? { texte: `${pl(dv.length, "devoir")} ${pourQuand(dv[0].date_pour, now)}`, ton: "or" } : { texte: "Aucun devoir à venir" };
  }
  if (d.emploi) {
    const j = jourSemaine(now);
    const auj = amplitudeJour(d.emploi, j);
    //  Le prochain jour de classe, si aujourd'hui n'en est pas un.
    let k = j, prochain = null;
    for (let i = 0; i < 7 && !prochain; i++) { k = (k % 7) + 1; prochain = amplitudeJour(d.emploi, k) && k; }
    r.emploi = auj ? { texte: `Aujourd'hui : ${auj}` }
      : prochain ? { texte: `${JOURS[prochain].charAt(0).toUpperCase()}${JOURS[prochain].slice(1)} : ${amplitudeJour(d.emploi, prochain)}` } : null;
  }
  if (d.absences) {
    const aj = absencesAJustifier(d.absences).length;
    r.absences = aj > 0 ? { texte: `${aj} à justifier`, ton: "or" } : { texte: d.absences.length ? pl(d.absences.length, "absence") + " cette année" : "Aucune absence", ton: d.absences.length ? undefined : "vert" };
  }
  if (d.fournitures) {
    const n = d.fournitures.length;
    r.fournitures = n > 0 ? { texte: pl(n, "article") + " sur la liste" } : null;
  }
  if (d.demandesEnCours != null) {
    r.documents = d.demandesEnCours > 0 ? { texte: `${pl(d.demandesEnCours, "demande")} en cours`, ton: "or" } : { texte: "Certificats et attestations" };
  }
  if (d.annonces) {
    const a = d.annonces[0];
    r.annonces = a ? { texte: a.titre } : null;
  }
  return r;
}

const fmtNote = (v) => String(Math.round(Number(v) * 100) / 100).replace(".", ",");
export { fmtNote };
