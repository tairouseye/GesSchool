import { useEffect, useMemo, useState } from "react";
import { Carte, Alerte, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { monEmploi, parJour, heure, chevauchements } from "@/lib/emploiSup.js";

const AUJOURDHUI = () => {
  const d = new Date().getDay();          // 0 = dimanche côté JS
  return d === 0 ? 7 : d;                 // 7 = dimanche côté base (migration 138)
};

// Espace étudiant — emploi du temps de la semaine, en lecture seule.
// Les séances viennent du RPC `mon_emploi_sup` : les tables de la maquette
// sont fermées à l'étudiant, c'est la fonction qui résout son inscription.
export default function EtudiantEmploi() {
  const [seances, setSeances] = useState(null);
  const [semestre, setSemestre] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    monEmploi()
      .then(setSeances)
      .catch((e) => { setErreur(e.message); setSeances([]); });
  }, []);

  // Le RPC renvoie TOUS les semestres du niveau de l'étudiant (L1 = S1 + S2).
  // Les afficher dans la même semaine serait faux : les semestres se suivent,
  // ils ne se superposent pas — et deux cours du lundi matin, un par semestre,
  // se liraient comme un conflit d'horaire qui n'existe pas.
  const semestres = useMemo(
    () => [...new Set((seances || []).map((s) => s.semestre).filter(Boolean))].sort(),
    [seances]
  );
  const actif = semestre && semestres.includes(semestre) ? semestre : semestres[0] || "";

  const visibles = useMemo(
    () => (seances || []).filter((s) => !actif || s.semestre === actif),
    [seances, actif]
  );
  const jours = useMemo(() => parJour(visibles), [visibles]);
  const conflits = useMemo(() => chevauchements(visibles), [visibles]);
  const jourCourant = AUJOURDHUI();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">🗓️ Emploi du temps</p>
        <p className="text-sm text-creme/70">Vos cours de la semaine</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      {semestres.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {semestres.map((s) => (
            <button key={s} type="button" onClick={() => setSemestre(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                s === actif
                  ? "bg-navy-900 text-creme"
                  : "border border-navy-900/15 bg-white text-navy-900/60 hover:text-navy-900"}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {conflits.size > 0 && (
        <Alerte ton="or">
          Deux séances se chevauchent dans votre semaine. Signalez-le à votre scolarité.
        </Alerte>
      )}

      {seances === null ? <SkeletonListe lignes={4} /> : jours.length === 0 ? (
        <EtatVide icone="🗓️" titre="Aucune séance planifiée">
          Votre emploi du temps n&apos;a pas encore été publié par l&apos;établissement.
          Il apparaîtra ici dès qu&apos;il le sera.
        </EtatVide>
      ) : (
        <div className="space-y-3">
          {jours.map((j) => (
            <Carte key={j.jour} className={`p-4 ${j.jour === jourCourant ? "border-or-500/50 bg-or-500/5" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-navy-900">{j.libelle}</h2>
                {j.jour === jourCourant && <Badge ton="or">aujourd&apos;hui</Badge>}
              </div>
              <div className="space-y-2">
                {j.seances.map((s) => (
                  <div key={s.id}
                    className={`rounded-xl border p-3 ${
                      conflits.has(s.id) ? "border-rose-300 bg-rose-50/60" : "border-navy-900/10"}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-mono text-sm font-medium text-navy-900">
                        {heure(s.heure_debut)}–{heure(s.heure_fin)}
                      </p>
                      <Badge ton={s.type_seance === "CM" ? "navy" : s.type_seance === "TP" ? "or" : "neutre"}>
                        {s.type_seance}
                      </Badge>
                    </div>
                    <p className="mt-1 font-medium text-navy-900">
                      {s.ue_code ? <span className="mr-2 font-mono text-xs text-navy-900/45">{s.ue_code}</span> : null}
                      {s.ecue_intitule || s.ue_intitule || "Séance"}
                    </p>
                    <p className="text-xs text-navy-900/55">
                      {/* Le semestre n'est répété ici que s'il n'y a pas de
                          sélecteur au-dessus pour le rappeler. */}
                      {[s.enseignant, s.salle ? `salle ${s.salle}` : null,
                        semestres.length > 1 ? null : s.semestre]
                        .filter(Boolean).join(" · ") || "Lieu à préciser"}
                    </p>
                  </div>
                ))}
              </div>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
