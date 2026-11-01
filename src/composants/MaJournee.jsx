import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bloc } from "@/composants/TableauBord.jsx";
import { donneesMaJournee } from "@/lib/dashboard.js";
import { getMonEnseignant } from "@/lib/appel.js";
import { coursDuJourEnseignant, classesAppel, notesASaisir } from "@/lib/maJournee.js";

const TYPES = { devoir: "Devoir", composition: "Composition", examen: "Examen", interro: "Interrogation", tp: "TP", oral: "Oral", projet: "Projet" };
const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

// « Ma journée » de l'enseignant (lot 3 de l'audit du 31/10/2026) :
// ses cours du jour, ses classes à l'appel, ses notes à saisir.
// `ouvert(cle)` dit quels écrans ce rôle peut ouvrir (même règle que l'accueil).
export default function MaJournee({ anneeId, ouvert }) {
  const { ecoleId, profil, utilisateur } = useAuth();
  const [d, setD] = useState(undefined); // undefined : chargement · null : pas de fiche enseignant

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const ens = await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        const r = ens ? await donneesMaJournee(ecoleId, anneeId, ens.id) : null;
        if (vivant) setD(r);
      } catch { if (vivant) setD(null); }
    })();
    return () => { vivant = false; };
  }, [ecoleId, anneeId, profil?.id, utilisateur?.email]);

  if (d === undefined) return <Bloc titre="Ma journée"><p className="mt-3 text-sm text-navy-900/55">Chargement…</p></Bloc>;
  if (d === null) {
    return (
      <Bloc titre="Ma journée">
        <p className="mt-3 text-sm text-navy-900/60">
          Votre compte n&apos;est pas encore relié à une fiche enseignant. La direction le fait dans
          Enseignants (même adresse e-mail que votre compte).
        </p>
      </Bloc>
    );
  }

  const now = new Date();
  const cours = coursDuJourEnseignant(d.creneaux, now);
  const appel = classesAppel({ cours, mesClasses: d.mesClasses, absencesJour: d.absencesJour });
  const notes = notesASaisir({ affectations: d.affectations, evaluations: d.evaluations, notesParEval: d.notesParEval, now });
  const lienNotes = (x) => `/notes?classe=${x.classe_id}&matiere=${x.matiere_id || ""}&periode=${d.periode?.id || ""}`;
  const jourLong = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Bloc titre={`Mes cours · ${jourLong}`} to={ouvert("emploi") ? "/emploi-du-temps" : null} lien="Emploi du temps">
        {cours.length === 0 ? (
          <p className="mt-3 text-sm text-navy-900/60">
            {d.creneaux.length ? "Pas de cours aujourd'hui." : "Votre emploi du temps n'est pas encore saisi."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cours.map((c) => (
              <li key={c.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${c.moment === "en_cours" ? "bg-or-500/15" : c.moment === "passe" ? "opacity-60" : "bg-fond"}`}>
                <span className="w-24 shrink-0 font-mono text-xs text-navy-900/70">{c.debut} – {c.fin}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-navy-900">{c.intitule}</span>
                  <span className="block truncate text-xs text-navy-900/60">{[c.classe, c.salle].filter(Boolean).join(" · ")}</span>
                </span>
                {c.moment === "en_cours" && <span className="shrink-0 text-xs font-semibold text-navy-900">en cours</span>}
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc titre="L'appel" to={ouvert("appel") ? "/appel" : null} lien="Faire l'appel">
        {appel.length === 0 ? (
          <p className="mt-3 text-sm text-navy-900/60">Aucune classe affectée cette année.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {appel.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-navy-900">{c.libelle}</span>
                  <span className={`block text-xs ${c.absences ? "text-rose-700" : "text-navy-900/60"}`}>
                    {c.absences ? `${pl(c.absences, "absence saisie", "absences saisies")} aujourd'hui` : "Aucune absence saisie aujourd'hui"}
                    {c.debut ? ` · cours à ${c.debut}` : ""}
                  </span>
                </span>
                {ouvert("appel") && (
                  <Link to={`/appel?classe=${c.id}`} className="shrink-0 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme hover:bg-navy-800">Appel</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc titre={`Notes à saisir${d.periode ? ` · ${d.periode.libelle}` : ""}`} compteur={notes.sansNotes.length}
        to={ouvert("notes") ? "/notes" : null} lien="Notes">
        {!d.periode ? (
          <p className="mt-3 text-sm text-navy-900/60">Aucune période de notes définie pour cette année.</p>
        ) : notes.sansNotes.length === 0 && notes.sansEvaluation.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-700">✓ Tout est à jour pour cette période.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {notes.sansNotes.slice(0, 5).map((e) => (
              <li key={e.id}>
                <Link to={lienNotes(e)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-fond">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-navy-900">{TYPES[e.type] || "Évaluation"}{e.libelle ? ` — ${e.libelle}` : ""}</span>
                    <span className="block truncate text-xs text-navy-900/60">{[e.classe, e.matiere, `du ${fmtDate(e.date)}`].filter(Boolean).join(" · ")} · aucune note</span>
                  </span>
                </Link>
              </li>
            ))}
            {notes.sansEvaluation.slice(0, Math.max(0, 5 - notes.sansNotes.length)).map((a) => (
              <li key={`${a.classe_id}|${a.matiere_id}`}>
                <Link to={lienNotes(a)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-fond">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-or-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-navy-900">{a.matiere}</span>
                    <span className="block truncate text-xs text-navy-900/60">{a.classe} · pas encore d&apos;évaluation</span>
                  </span>
                </Link>
              </li>
            ))}
            {notes.sansNotes.length + notes.sansEvaluation.length > 5 && (
              <li className="px-2 text-xs text-navy-900/55">
                et {notes.sansNotes.length + notes.sansEvaluation.length - 5} autre(s)
              </li>
            )}
          </ul>
        )}
      </Bloc>
    </div>
  );
}
