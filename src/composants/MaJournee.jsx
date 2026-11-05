import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte, SkeletonListe } from "@/composants/ui.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { donneesMaJournee } from "@/lib/dashboard.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { getMonEnseignant } from "@/lib/appel.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import { coursDuJourEnseignant, classesAppel, notesASaisir, appelEnTete, resumeAppel } from "@/lib/maJournee.js";

const TYPES = { devoir: "Devoir", composition: "Composition", examen: "Examen", interro: "Interrogation", tp: "TP", oral: "Oral", projet: "Projet" };
const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

//  L'ACCUEIL DE L'ENSEIGNANT, sur le modèle de l'espace parent (05/11/2026).
//  Il arrive entre deux cours, le téléphone à la main : ses trois gestes en
//  grand, puis ce qui l'attend aujourd'hui. Le reste est dans le menu.
export default function MaJournee() {
  const { ecoleId, ecole, profil, utilisateur, roles, modulesActifs } = useAuth();
  const [d, setD] = useState(undefined); // undefined : chargement · null : pas de fiche enseignant
  const [erreur, setErreur] = useState("");
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [annee, ens] = await Promise.all([
          getAnneeCourante(ecoleId), getMonEnseignant(ecoleId, profil?.id, utilisateur?.email),
        ]);
        const r = ens ? await donneesMaJournee(ecoleId, annee?.id, ens.id) : null;
        if (vivant) setD(r);
      } catch (e) { if (vivant) { setErreur(e.message); setD(null); } }
    })();
    return () => { vivant = false; };
  }, [ecoleId, profil?.id, utilisateur?.email]);

  const now = new Date();
  const jourLong = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const entete = (
    <div>
      <p className="text-sm text-navy-900/60 first-letter:uppercase">{jourLong}</p>
      <h1 className="font-display text-2xl font-bold text-navy-900">Bonjour{profil?.prenom ? ` ${profil.prenom}` : ""}</h1>
      {ecole?.nom && <p className="sr-only">{ecole.nom}</p>}
    </div>
  );
  const cadre = "mx-auto max-w-2xl space-y-4 p-4 sm:p-6";

  if (d === undefined) return <div className={cadre}>{entete}<div role="status" aria-label="Chargement de votre journée"><SkeletonListe lignes={3} /></div></div>;
  if (d === null) {
    return (
      <div className={cadre}>
        {entete}
        <Alerte ton="erreur">{erreur}</Alerte>
        {!erreur && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-navy-900">
            Votre compte n&apos;est pas encore relié à votre fiche enseignant : vos classes ne peuvent pas s&apos;afficher.
            Demandez à la direction votre code, depuis <b>Enseignants → Donner les accès</b>.
          </p>
        )}
      </div>
    );
  }

  const cours = coursDuJourEnseignant(d.creneaux, now);
  const appel = classesAppel({ cours, mesClasses: d.mesClasses, absencesJour: d.absencesJour, valides: d.appelsValides });
  const principale = appelEnTete(appel, cours);
  const notes = notesASaisir({ affectations: d.affectations, evaluations: d.evaluations, notesParEval: d.notesParEval, now });
  const lienNotes = (x) => `/notes?classe=${x.classe_id}&matiere=${x.matiere_id || ""}&periode=${d.periode?.id || ""}`;
  const aSaisir = [
    ...notes.sansNotes.map((e) => ({
      cle: e.id, to: lienNotes(e), action: "Saisir",
      titre: `${TYPES[e.type] || "Évaluation"}${e.libelle ? ` — ${e.libelle}` : ""}`,
      detail: [e.classe, e.matiere, `du ${fmtDate(e.date)}`].filter(Boolean).join(" · "),
    })),
    ...notes.sansEvaluation.map((a) => ({
      cle: `${a.classe_id}|${a.matiere_id}`, to: lienNotes(a), action: "Créer",
      titre: a.matiere, detail: `${a.classe} · pas encore d'évaluation`,
    })),
  ];
  const autresClasses = appel.filter((c) => c.id !== principale?.id);
  const suite = cours.filter((c) => c.moment !== "passe");
  const secondaires = [
    ouvert("emploi") && ["/emploi-du-temps", "emploi", "Emploi du temps"],
    ouvert("eleves") && ["/eleves", "eleves", "Mes élèves"],
    ouvert("acquis") && ["/acquis", "acquis", "Suivi des acquis"],
    ouvert("bulletins") && ["/bulletins", "bulletins", "Bulletins"],
  ].filter(Boolean);

  return (
    <div className={cadre}>
      {entete}

      {ouvert("appel") && (
        <Link to={principale ? `/appel?classe=${principale.id}` : "/appel"}
          className="flex min-h-[6.5rem] items-center gap-3.5 rounded-3xl bg-navy-900 p-4 text-creme transition active:scale-[.98]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Icone name="appel" className="h-8 w-8" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-bold">Faire l&apos;appel</span>
            <span className="block text-sm">{principale ? resumeAppel(principale) : "Aucune classe affectée"}</span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {ouvert("notes") && (
          <Link to={aSaisir[0]?.to || "/notes"} className="flex min-h-[6.5rem] flex-col gap-2 rounded-2xl bg-sky-50 p-3.5 text-navy-900 transition active:scale-[.98]">
            <Icone name="notes" className="h-7 w-7 text-sky-700" />
            <span>
              <span className="block text-sm font-bold">Saisir des notes</span>
              {notes.sansNotes.length > 0 && <span className="block text-xs text-navy-900/70">{pl(notes.sansNotes.length, "évaluation")} sans note</span>}
            </span>
          </Link>
        )}
        {ouvert("cahier") && (
          <Link to="/cahier-textes" className="flex min-h-[6.5rem] flex-col gap-2 rounded-2xl bg-emerald-50 p-3.5 text-navy-900 transition active:scale-[.98]">
            <Icone name="cahier" className="h-7 w-7 text-emerald-700" />
            <span className="text-sm font-bold">Cahier de textes</span>
          </Link>
        )}
      </div>

      {(suite.length > 0 || autresClasses.length > 0 || aSaisir.length > 0) && (
        <section aria-labelledby="titre-jour" className="space-y-2">
          <h2 id="titre-jour" className="font-display text-lg font-bold text-navy-900">Aujourd&apos;hui</h2>
          {suite.map((c) => (
            <div key={c.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 rounded-2xl bg-white p-3 text-sm ring-1 ring-inset ring-navy-900/10">
              <b className="tabular-nums text-navy-900">{c.debut}</b>
              <span className="min-w-0">
                <span className="block truncate font-medium text-navy-900">{c.intitule}</span>
                <span className="block truncate text-xs text-navy-900/60">{[c.classe, c.salle].filter(Boolean).join(" · ")}</span>
              </span>
              {c.moment === "en_cours" && <span className="text-xs font-bold text-navy-900">En cours</span>}
            </div>
          ))}
          {/*  Un professeur de matière a parfois neuf classes : trois lignes
              suffisent, les autres sont au choix sur la feuille de présence. */}
          {ouvert("appel") && autresClasses.slice(0, 3).map((c) => (
            <Link key={c.id} to={`/appel?classe=${c.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-inset ring-navy-900/10">
              <span className="min-w-0 truncate text-navy-900">{resumeAppel(c)}</span>
              <span className="shrink-0 text-xs font-bold text-navy-900">Appel</span>
            </Link>
          ))}
          {ouvert("appel") && autresClasses.length > 3 && (
            <Link to="/appel" className="block min-h-10 py-2 text-sm font-semibold text-navy-700">Toutes mes classes ({appel.length})</Link>
          )}
          {ouvert("notes") && aSaisir.slice(0, 3).map((n) => (
            <Link key={n.cle} to={n.to} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-navy-900">{n.titre}</span>
                <span className="block truncate text-xs text-navy-900/70">{n.detail}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-amber-800">{n.action}</span>
            </Link>
          ))}
          {ouvert("notes") && aSaisir.length > 3 && (
            <Link to="/notes" className="block min-h-10 py-2 text-sm font-semibold text-navy-700">Voir tout ({aSaisir.length})</Link>
          )}
        </section>
      )}

      {secondaires.length > 0 && (
        <nav aria-label="Autres écrans" className="grid grid-cols-2 gap-2.5">
          {secondaires.map(([to, icone, label]) => (
            <Link key={to} to={to} className="flex min-h-14 items-center gap-2.5 rounded-2xl bg-white p-3 text-sm font-bold text-navy-900 ring-1 ring-inset ring-navy-900/10">
              <Icone name={icone} className="h-5 w-5 shrink-0" />{label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
