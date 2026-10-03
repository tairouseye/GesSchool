import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, SkeletonListe, Badge } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { getAnneeCourante } from "@/lib/academique.js";
import { getFilieres, getSemestres } from "@/lib/superieur.js";
import { getSeances } from "@/lib/emploiSup.js";
import { etudiantsSeance, getAbsencesSeance, enregistrerAppelSeance } from "@/lib/viescolaire.js";

// GesSchool — la présence par SÉANCE, au supérieur (mig. 171).
//
// Précisé par l'école : « la présence est journalière pour le préscolaire et
// l'élémentaire, et par séance — c'est-à-dire par matière — pour le
// supérieur. »
//
// ⚠️ CE N'EST PAS UN SECOND ÉCRAN D'APPEL, C'EST UNE CLÉ DIFFÉRENTE. À
// l'école on pointe un élève pour une JOURNÉE ; ici, pour UNE SÉANCE. Un
// étudiant peut manquer le TD de 8 h et assister au CM de 14 h — confondre
// les deux fausserait tous les comptes d'assiduité. Le diff est le même
// (éprouvé par 12 épreuves, dont celle qui garde les justifications), seul
// le rattachement change.

const ETATS = [
  ["present", "Présent", "bg-emerald-500 text-white", "text-emerald-700"],
  ["absence", "Absent", "bg-rose-500 text-white", "text-rose-600"],
  ["retard", "Retard", "bg-or-500 text-navy-900", "text-or-600"],
];
const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const auj = () => new Date().toISOString().slice(0, 10);
//  getDay() rend 0 pour dimanche ; `emplois_sup.jour` va de 1 (lundi) à 7.
const jourDe = (iso) => { const d = new Date(`${iso}T12:00:00`).getDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => String(t || "").slice(0, 5);

export default function AppelSup() {
  const { ecoleId, utilisateur } = useAuth();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [filieres, setFilieres] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [filiereId, setFiliereId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [date, setDate] = useState(auj());
  const [seances, setSeances] = useState([]);
  const [seanceId, setSeanceId] = useState("");
  const [etudiants, setEtudiants] = useState([]);
  const [etats, setEtats] = useState({});   // eleve_id -> etat
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    getFilieres(ecoleId)
      .then((f) => { setFilieres(f); setFiliereId((c) => c || f[0]?.id || ""); })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, [ecoleId]);

  useEffect(() => {
    if (!ecoleId || !filiereId) { setSemestres([]); setSemestreId(""); return; }
    getSemestres(ecoleId, filiereId)
      .then((s) => { setSemestres(s); setSemestreId((c) => (s.some((x) => x.id === c) ? c : (s[0]?.id || ""))); })
      .catch((e) => setErreur(e.message));
  }, [ecoleId, filiereId]);

  useEffect(() => {
    if (!ecoleId || !semestreId) { setSeances([]); return; }
    getSeances(ecoleId, semestreId, annee?.id).then(setSeances).catch((e) => setErreur(e.message));
  }, [ecoleId, semestreId, annee?.id]);

  //  Les séances du jour choisi : c'est la question que se pose
  //  l'enseignant en entrant en salle, pas « toutes les séances du
  //  semestre ».
  const duJour = useMemo(
    () => seances.filter((s) => s.jour === jourDe(date)),
    [seances, date]);

  useEffect(() => {
    setSeanceId((c) => (duJour.some((s) => s.id === c) ? c : (duJour[0]?.id || "")));
  }, [duJour]);

  const charger = useCallback(async () => {
    if (!seanceId) { setEtudiants([]); setEtats({}); return; }
    setErreur(""); setInfo("");
    try {
      const [liste, deja] = await Promise.all([
        etudiantsSeance(seanceId),
        getAbsencesSeance(ecoleId, seanceId, date),
      ]);
      setEtudiants(liste);
      //  ⚠️ Tout le monde est PRÉSENT par défaut, et l'on ne marque que les
      //  exceptions. L'inverse — tout absent jusqu'à preuve du contraire —
      //  produirait une classe entière d'absents dès qu'on ouvre l'écran
      //  sans rien valider.
      const m = {};
      for (const e of liste) m[e.eleve_id] = "present";
      for (const a of deja) m[a.eleve_id] = a.type;
      setEtats(m);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, seanceId, date]);

  useEffect(() => { charger(); }, [charger]);

  async function enregistrer() {
    if (!seanceId) return;
    setEnCours(true); setErreur(""); setInfo("");
    try {
      const entries = etudiants.map((e) => ({ eleve_id: e.eleve_id, etat: etats[e.eleve_id] || "present" }));
      const r = await enregistrerAppelSeance(ecoleId, seanceId, date, entries, utilisateur?.id);
      setInfo(`Appel enregistré — ${r.ajoutees} ajout(s), ${r.modifiees} correction(s), ${r.supprimees} retrait(s).`);
    } catch (e) { toast.erreur(e.message || "Enregistrement impossible."); }
    finally { setEnCours(false); }
  }

  const seance = duJour.find((s) => s.id === seanceId);
  const compte = useMemo(() => {
    const c = { present: 0, absence: 0, retard: 0 };
    for (const e of etudiants) c[etats[e.eleve_id] || "present"] += 1;
    return c;
  }, [etudiants, etats]);

  if (chargement) {
    return (<><EnTete titre="Présence par séance" /><div className="p-8"><SkeletonListe lignes={4} /></div></>);
  }

  return (
    <>
      <EnTete titre="Présence par séance" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-4 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {info && <Alerte ton="succes">{info}</Alerte>}

        {filieres.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            Aucune filière. Créez-les dans <b>Filières &amp; maquettes</b>.
          </Carte>
        ) : (
          <>
            <Carte className="flex flex-wrap items-end gap-3 p-4">
              <Sel label="Filière" value={filiereId} onChange={setFiliereId}
                options={filieres.map((f) => [f.id, f.intitule || f.code])} />
              <Sel label="Semestre" value={semestreId} onChange={setSemestreId}
                options={semestres.map((s) => [s.id, s.libelle])} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
              </label>
              <span className="pb-2 text-xs text-navy-900/45">{JOURS[jourDe(date)]}</span>
            </Carte>

            {duJour.length === 0 ? (
              <EtatVide icone="🗓️" titre={`Aucune séance le ${JOURS[jourDe(date)].toLowerCase()}`}>
                L&apos;emploi du temps de ce semestre ne prévoit pas de séance ce jour-là.
              </EtatVide>
            ) : (
              <>
                {/* Choisir SA séance : c'est la question de l'enseignant qui
                    entre en salle. */}
                <div className="flex flex-wrap gap-1.5">
                  {duJour.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSeanceId(s.id)}
                      className={`rounded-xl px-3 py-2 text-left text-xs font-medium transition ${seanceId === s.id
                        ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70 hover:bg-navy-900/10"}`}>
                      <span className="block font-mono">{hhmm(s.heure_debut)}–{hhmm(s.heure_fin)}</span>
                      <span className="block">{s.ue?.code || s.ecue?.intitule || "—"} · {s.type_seance}</span>
                    </button>
                  ))}
                </div>

                {seance && (
                  <Carte className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <span className="font-display font-semibold text-navy-900">
                        {seance.ue?.intitule || seance.ue?.code || seance.ecue?.intitule || "Séance"}
                      </span>
                      <span className="ml-2 text-xs text-navy-900/50">
                        {seance.type_seance} · {hhmm(seance.heure_debut)}–{hhmm(seance.heure_fin)}
                        {seance.salle ? ` · ${seance.salle}` : ""}
                        {seance.enseignants ? ` · ${seance.enseignants.prenom} ${seance.enseignants.nom}` : ""}
                      </span>
                      {/* ⚠️ Une séance sans UE convoque TOUTE la filière : on
                          le dit, car le compte d'assiduité en dépend. */}
                      {!seance.ue_id && (
                        <p className="mt-1 text-xs text-amber-600">
                          Cette séance n&apos;est rattachée à aucune UE : toute la filière est convoquée.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge ton="success">{compte.present} présent(s)</Badge>
                      {compte.absence > 0 && <Badge ton="danger">{compte.absence} absent(s)</Badge>}
                      {compte.retard > 0 && <Badge ton="warning">{compte.retard} retard(s)</Badge>}
                      <Bouton onClick={enregistrer} disabled={enCours || !etudiants.length}>
                        {enCours ? "Enregistrement…" : "Enregistrer l'appel"}
                      </Bouton>
                    </div>
                  </Carte>
                )}

                {etudiants.length === 0 ? (
                  <EtatVide icone="🎓" titre="Aucun étudiant convoqué">
                    {seance?.ue_id
                      ? "Aucun étudiant n'est inscrit à cette UE pour cette filière et cette année."
                      : "Aucune inscription active dans cette filière pour cette année."}
                  </EtatVide>
                ) : (
                  <Carte className="divide-y divide-navy-900/5 p-0">
                    {etudiants.map((e, i) => (
                      <div key={e.eleve_id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <span className="mr-2 font-mono text-xs text-navy-900/35">{i + 1}</span>
                          <span className="font-medium text-navy-900">{e.nom} {e.prenom}</span>
                          <span className="ml-2 font-mono text-xs text-navy-900/40">
                            {e.matricule || "—"}{e.niveau ? ` · ${e.niveau}` : ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {ETATS.map(([cle, lib, actif, repos]) => (
                            <button key={cle} type="button"
                              onClick={() => setEtats((s) => ({ ...s, [e.eleve_id]: cle }))}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                (etats[e.eleve_id] || "present") === cle
                                  ? actif : `bg-navy-900/5 ${repos} hover:bg-navy-900/10`}`}>
                              {lib}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Carte>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
        {options.length === 0 && <option value="">—</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
