import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte, Bouton, Modale } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import GrilleEmploi from "@/composants/GrilleEmploi.jsx";
import * as api from "@/lib/emploi.js";
import { lirePdfEmploi, classesDuTitre, estSansCours, normaliser } from "@/lib/lectureEdtPdf.js";

// GesSchool — charger l'emploi du temps d'une classe depuis son PDF
// (Mme Kane, 02/11/2026 ; mig. 222).
//
// ⚠️ LE PDF N'EST PAS CONSERVÉ. Il sert à REMPLIR la grille de l'appli, qui
// reste le seul emploi du temps en circulation (décision du promoteur,
// 02/11) : charger un nouveau PDF REMPLACE la semaine de la classe. Les
// parents voient la grille, jamais un fichier qui pourrait être périmé.
//
// La lecture n'est qu'une proposition : la matière de chaque activité se
// choisit ici (pré-remplie d'après ce que l'école a déjà rangé), la grille
// s'affiche avant d'enregistrer, et rien n'est écrit sans « Remplacer l'emploi du temps ».

const A_CHOISIR = "?";

export default function ImportEdtPdf({ ouvert, onFermer, ecoleId, annee, classes, matieres, classeId, onFini }) {
  const { ecole } = useAuth();
  const toast = useToast();
  const [lecture, setLecture] = useState(null);       // { titre, creneaux }
  const [erreurLecture, setErreurLecture] = useState("");
  const [lit, setLit] = useState(false);
  const [cibles, setCibles] = useState([]);           // classes visées
  const [choix, setChoix] = useState({});             // activité normalisée → matiere_id | "" | "?"
  const [connues, setConnues] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    setLecture(null); setErreurLecture(""); setChoix({});
    setCibles(classeId ? [classeId] : []);
    Promise.all([api.getActivitesConnues(ecoleId), api.getAffectationsAnnee(ecoleId, annee?.id)])
      .then(([c, a]) => { setConnues(c); setAffectations(a); })
      .catch(() => {});
  }, [ouvert, ecoleId, annee?.id, classeId]);

  // La matière proposée pour une activité : celle que l'école lui a déjà
  // donnée, sinon une matière du même nom, sinon « à choisir ».
  function proposer(libelle) {
    if (estSansCours(libelle)) return "";
    const n = normaliser(libelle);
    const compte = {};
    for (const c of connues) if (normaliser(c.activite) === n) compte[c.matiere_id ?? ""] = (compte[c.matiere_id ?? ""] || 0) + 1;
    const vu = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
    if (vu) return vu[0];
    const m = matieres.find((x) => normaliser(x.libelle) === n || (x.code && normaliser(x.code) === n));
    return m ? m.id : A_CHOISIR;
  }

  async function choisirFichier(f) {
    if (!f) return;
    setLecture(null); setErreurLecture(""); setLit(true);
    try {
      const r = await lirePdfEmploi(f);
      setLecture(r);
      const vises = classesDuTitre(r.titre, classes);
      if (vises.length) setCibles(vises);
      const c = {};
      for (const cr of r.creneaux) { const k = normaliser(cr.libelle); if (!(k in c)) c[k] = proposer(cr.libelle); }
      setChoix(c);
    } catch (e) {
      setErreurLecture(e.message);
    } finally { setLit(false); }
  }

  // Les activités distinctes, dans l'ordre de la semaine.
  const activites = useMemo(() => {
    const vues = new Map();
    for (const c of lecture?.creneaux || []) {
      const k = normaliser(c.libelle);
      if (!vues.has(k)) vues.set(k, { k, libelle: c.libelle, n: 0 });
      vues.get(k).n++;
    }
    return [...vues.values()];
  }, [lecture]);
  const aChoisir = activites.filter((a) => choix[a.k] === A_CHOISIR).length;
  const libMatiere = (id) => matieres.find((m) => m.id === id)?.libelle || "";

  // L'enseignant d'un cours : l'affectation de la matière dans la classe, à
  // défaut la titulaire « toutes matières » si elle est seule.
  function enseignantDe(classe, matiere) {
    if (!matiere) return null;
    const precise = affectations.find((a) => a.classe_id === classe && a.matiere_id === matiere);
    if (precise) return precise.enseignant_id;
    const toutes = affectations.filter((a) => a.classe_id === classe && !a.matiere_id);
    return toutes.length === 1 ? toutes[0].enseignant_id : null;
  }

  const creneauxPour = (classe) => (lecture?.creneaux || []).map((c) => {
    const m = choix[normaliser(c.libelle)] || null;
    const matiere_id = m && m !== A_CHOISIR ? m : null;
    return {
      jour: c.jour, heure_debut: c.heure_debut, heure_fin: c.heure_fin,
      matiere_id, enseignant_id: enseignantDe(classe, matiere_id),
      activite: c.libelle, salle: c.salle,
    };
  });

  const apercu = useMemo(() => (lecture?.creneaux || []).map((c) => {
    const m = choix[normaliser(c.libelle)];
    return api.pourGrille({ ...c, activite: c.libelle, matiere_id: m && m !== A_CHOISIR ? m : null,
      matiere: m && m !== A_CHOISIR ? libMatiere(m) : "" });
  }), [lecture, choix, matieres]); // eslint-disable-line react-hooks/exhaustive-deps

  const pret = lecture && cibles.length > 0 && aChoisir === 0;
  const nomsCibles = cibles.map((id) => classes.find((c) => c.id === id)?.libelle).filter(Boolean).join(", ");

  async function enregistrer() {
    setEnvoi(true);
    try {
      for (const id of cibles) await api.remplacerEmploiClasse(id, creneauxPour(id));
      toast.succes(`Emploi du temps remplacé : ${nomsCibles}.`);
      onFini?.();
      onFermer();
    } catch (e) {
      toast.erreur(e.message || "Une erreur est survenue.");
    } finally { setEnvoi(false); }
  }

  const basculer = (id) => setCibles((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Charger un emploi du temps (PDF)" large>
      <div className="space-y-5 text-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Fichier PDF</span>
          <input type="file" accept="application/pdf,.pdf"
            onChange={(e) => choisirFichier(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-creme" />
        </label>

        {lit && <p className="text-navy-900/50">Lecture du PDF…</p>}
        {erreurLecture && <Alerte ton="or">{erreurLecture}</Alerte>}
        {lecture && (
          <p className="text-navy-900/70">
            Lu : <b>{lecture.titre || "emploi du temps"}</b> — {lecture.creneaux.length} créneaux.
            {lecture.ignores?.length > 0 && <> Non placés : {lecture.ignores.join(" · ")}.</>}
          </p>
        )}

        {lecture && (
          <>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-navy-900/50">Classe(s) concernée(s)</legend>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <label key={c.id} className={`cursor-pointer rounded-lg border px-3 py-1.5 ${cibles.includes(c.id) ? "border-navy-900 bg-navy-900 text-creme" : "border-navy-900/15"}`}>
                    <input type="checkbox" className="sr-only" checked={cibles.includes(c.id)} onChange={() => basculer(c.id)} />
                    {c.libelle}
                  </label>
                ))}
              </div>
            </fieldset>

            <Alerte ton="or">
              L&apos;emploi du temps actuel de {nomsCibles || "la classe"} sera <b>remplacé</b> par celui-ci,
              pour l&apos;école comme pour les parents. Le PDF n&apos;est pas conservé.
            </Alerte>

            <div>
              <p className="mb-2 text-xs font-medium text-navy-900/50">
                Matière de chaque activité (le bulletin suit la matière)
                {aChoisir > 0 && <span className="ml-2 text-rose-700">· {aChoisir} à choisir</span>}
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-navy-900/10">
                {activites.map((a) => (
                  <div key={a.k} className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-900/5 px-3 py-2 last:border-0">
                    <span className="text-navy-900">{a.libelle} <span className="text-xs text-navy-900/40">×{a.n}</span></span>
                    <select value={choix[a.k] ?? A_CHOISIR} onChange={(e) => setChoix((s) => ({ ...s, [a.k]: e.target.value }))}
                      className={`rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-or-500 ${choix[a.k] === A_CHOISIR ? "border-rose-400" : "border-navy-900/15"}`}>
                      <option value={A_CHOISIR}>— À choisir —</option>
                      <option value="">Sans cours (pause, accueil…)</option>
                      {matieres.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-navy-900/10 p-3">
              <GrilleEmploi creneaux={apercu} ecole={ecole} entete={null} vide="Aucun créneau lu." />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton onClick={enregistrer} disabled={!pret || envoi || lit}>{envoi ? "Enregistrement…" : "Remplacer l'emploi du temps"}</Bouton>
        </div>
      </div>
    </Modale>
  );
}
