// GesSchool — moteur de génération d'emplois du temps (heuristique sous contraintes).
//
// Contraintes DURES respectées :
//   - une classe n'a qu'un cours par créneau,
//   - un enseignant n'est jamais dans deux classes au même créneau,
//   - une salle n'accueille jamais deux classes au même créneau.
// Préférence SOUPLE : étaler les heures d'une matière sur des jours différents.
//
// Fonction pure (testable) : ne touche pas à la base. Renvoie les créneaux à
// écrire + la liste des heures qui n'ont pas pu être placées (rapport).

const cle = (jour, debut) => `${jour}|${debut}`;

// Params :
//   classes           : [{ id, niveau_id, libelle }]  (classes à générer)
//   grille            : [{ jour, ordre, heure_debut, heure_fin, pause }]
//   volumesParNiveau  : { niveauId: [{ matiere_id, heures }] }
//   matiereLibelle    : { matiereId: "Maths" }         (pour le rapport)
//   affectationMap    : { "classeId:matiereId": enseignantId }
//   salles            : [{ id, nom }]
//   emploisExistants  : [{ classe_id, jour, heure_debut, enseignant_id, salle }]
//                        (créneaux des classes NON régénérées → occupation initiale)
export function genererEDT({
  classes = [], grille = [], volumesParNiveau = {}, matiereLibelle = {},
  affectationMap = {}, salles = [], emploisExistants = [],
}) {
  // Créneaux planifiables (hors pauses), triés.
  const slots = grille
    .filter((c) => !c.pause)
    .slice()
    .sort((a, b) => a.jour - b.jour || String(a.heure_debut).localeCompare(String(b.heure_debut)));

  const profBusy = new Set();   // `${enseignantId}|${jour}|${debut}`
  const salleBusy = new Set();  // `${salleNom}|${jour}|${debut}`

  // Occupation initiale depuis les classes non régénérées.
  const regen = new Set(classes.map((c) => c.id));
  for (const e of emploisExistants) {
    if (regen.has(e.classe_id)) continue; // ces classes seront réécrites
    const k = cle(e.jour, e.heure_debut);
    if (e.enseignant_id) profBusy.add(`${e.enseignant_id}|${k}`);
    if (e.salle) salleBusy.add(`${e.salle}|${k}`);
  }

  const creneaux = [];
  const nonPlaces = [];

  for (const cl of classes) {
    const vols = volumesParNiveau[cl.niveau_id] || [];
    // Développe le volume en séances unitaires.
    const lecons = [];
    for (const v of vols) {
      const ens = affectationMap[`${cl.id}:${v.matiere_id}`] || null;
      for (let h = 0; h < (Number(v.heures) || 0); h++) {
        lecons.push({ matiere_id: v.matiere_id, enseignant_id: ens, total: Number(v.heures) || 0 });
      }
    }
    // Les plus contraignantes d'abord : celles qui ont un prof, puis gros volume.
    lecons.sort((a, b) => (b.enseignant_id ? 1 : 0) - (a.enseignant_id ? 1 : 0) || b.total - a.total);

    const classeBusy = new Set();      // `${jour}|${debut}`
    const matiereJour = {};            // `${matiereId}|${jour}` -> nb déjà posés ce jour

    for (const lecon of lecons) {
      const candidats = slots
        .filter((s) => {
          const k = cle(s.jour, s.heure_debut);
          if (classeBusy.has(k)) return false;
          if (lecon.enseignant_id && profBusy.has(`${lecon.enseignant_id}|${k}`)) return false;
          return true;
        })
        .sort((s1, s2) => {
          // Préfère le jour où cette matière est le moins présente (étalement).
          const d1 = matiereJour[`${lecon.matiere_id}|${s1.jour}`] || 0;
          const d2 = matiereJour[`${lecon.matiere_id}|${s2.jour}`] || 0;
          if (d1 !== d2) return d1 - d2;
          if (s1.jour !== s2.jour) return s1.jour - s2.jour;
          return String(s1.heure_debut).localeCompare(String(s2.heure_debut));
        });

      let place = false;
      for (const s of candidats) {
        const k = cle(s.jour, s.heure_debut);
        // Salle libre (si des salles sont configurées).
        let salleNom = null;
        if (salles.length) {
          const libre = salles.find((sa) => !salleBusy.has(`${sa.nom}|${k}`));
          if (!libre) continue; // aucune salle libre ce créneau → créneau suivant
          salleNom = libre.nom;
        }
        creneaux.push({
          classe_id: cl.id, jour: s.jour,
          heure_debut: s.heure_debut, heure_fin: s.heure_fin,
          matiere_id: lecon.matiere_id, enseignant_id: lecon.enseignant_id, salle: salleNom,
        });
        classeBusy.add(k);
        if (lecon.enseignant_id) profBusy.add(`${lecon.enseignant_id}|${k}`);
        if (salleNom) salleBusy.add(`${salleNom}|${k}`);
        matiereJour[`${lecon.matiere_id}|${s.jour}`] = (matiereJour[`${lecon.matiere_id}|${s.jour}`] || 0) + 1;
        place = true;
        break;
      }
      if (!place) {
        nonPlaces.push({
          classe_id: cl.id, classe: cl.libelle,
          matiere: matiereLibelle[lecon.matiere_id] || "—",
          sansProf: !lecon.enseignant_id,
        });
      }
    }
  }

  return { creneaux, nonPlaces };
}
