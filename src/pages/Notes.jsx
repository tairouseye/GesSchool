import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import * as api from "@/lib/bulletins.js";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";

const TYPES = ["devoir", "composition", "examen", "interro", "tp", "oral", "projet"];

// Phase 1 — Module 2 : saisie des notes.
export default function Notes() {
  const { ecoleId } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [matiereId, setMatiereId] = useState("");
  const [evaluations, setEvaluations] = useState([]);
  const [evalActive, setEvalActive] = useState(null);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [cls, per, mat] = await Promise.all([
          getClasses(ecoleId, an?.id),
          api.getPeriodes(ecoleId, an?.id),
          getMatieres(ecoleId),
        ]);
        setClasses(cls);
        setPeriodes(per);
        setMatieres(mat);
        if (per[0]) setPeriodeId(per[0].id);
      } catch (e) {
        setErreur(e.message);
      }
    })();
  }, [ecoleId]);

  const chargerEvals = useCallback(async () => {
    if (!classeId || !periodeId || !matiereId) {
      setEvaluations([]);
      return;
    }
    setErreur("");
    try {
      setEvaluations(await api.getEvaluations(ecoleId, classeId, periodeId, matiereId));
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId, classeId, periodeId, matiereId]);

  useEffect(() => {
    setEvalActive(null);
    chargerEvals();
  }, [chargerEvals]);

  const pret = classeId && periodeId && matiereId;

  return (
    <>
      <EnTete titre="Saisie des notes" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Sélecteurs */}
        <div className="flex flex-wrap gap-3">
          <Selecteur label="Classe" value={classeId} onChange={setClasseId} options={classes.map((c) => [c.id, c.libelle])} />
          <Selecteur label="Période" value={periodeId} onChange={setPeriodeId} options={periodes.map((p) => [p.id, p.libelle])} />
          <Selecteur label="Matière" value={matiereId} onChange={setMatiereId} options={matieres.map((m) => [m.id, m.libelle])} />
        </div>

        {!pret ? (
          <Carte className="p-8 text-sm text-navy-900/50">
            Choisissez une classe, une période et une matière.
            {classes.length === 0 && " (Aucune classe — créez-en dans « Niveaux & classes ».)"}
            {matieres.length === 0 && " (Aucune matière — ajoutez-en dans « Niveaux & classes ».)"}
          </Carte>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Évaluations */}
            <Carte className="p-5 lg:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display font-semibold text-navy-900">Évaluations</h3>
                <Bouton variante="fantome" className="px-3 py-1.5 text-xs" onClick={() => setModale(true)}>
                  + Ajouter
                </Bouton>
              </div>
              {evaluations.length === 0 ? (
                <p className="text-sm text-navy-900/40">Aucune évaluation.</p>
              ) : (
                <ul className="space-y-2">
                  {evaluations.map((ev) => (
                    <li key={ev.id}>
                      <button
                        onClick={() => setEvalActive(ev)}
                        className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                          evalActive?.id === ev.id ? "border-or-500 bg-or-500/10" : "border-navy-900/10 hover:border-navy-900/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize text-navy-900">{ev.type}</span>
                          <span className="font-mono text-xs text-navy-900/50">/{ev.bareme} · coef {ev.coefficient}</span>
                        </div>
                        {ev.libelle && <p className="text-xs text-navy-900/50">{ev.libelle}</p>}
                        {ev.date_eval && <p className="font-mono text-[11px] text-navy-900/40">{ev.date_eval}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            {/* Grille de notes */}
            <div className="lg:col-span-2">
              {evalActive ? (
                <GrilleNotes
                  ecoleId={ecoleId}
                  classeId={classeId}
                  anneeId={annee.id}
                  evaluation={evalActive}
                  onErreur={setErreur}
                />
              ) : (
                <Carte className="grid h-full place-items-center p-10 text-sm text-navy-900/40">
                  Sélectionnez une évaluation pour saisir les notes.
                </Carte>
              )}
            </div>
          </div>
        )}
      </div>

      <ModaleEvaluation
        ouvert={modale}
        onFermer={() => setModale(false)}
        onCreer={async (ev) => {
          setErreur("");
          try {
            await api.creerEvaluation(ecoleId, { ...ev, classe_id: classeId, periode_id: periodeId, matiere_id: matiereId });
            setModale(false);
            chargerEvals();
          } catch (e) {
            setErreur(e.message);
          }
        }}
      />
    </>
  );
}

function Selecteur({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
      >
        <option value="">— Choisir —</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function GrilleNotes({ ecoleId, classeId, anneeId, evaluation, onErreur }) {
  const [eleves, setEleves] = useState([]);
  const [valeurs, setValeurs] = useState({}); // eleve_id -> {valeur, absent}
  const [chargement, setChargement] = useState(true);
  const [enregistre, setEnregistre] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      setChargement(true);
      setEnregistre(false);
      try {
        const els = await api.getElevesClasse(ecoleId, classeId, anneeId);
        const notes = await api.getNotesEvaluation(evaluation.id);
        setEleves(els);
        const v = {};
        for (const n of notes) v[n.eleve_id] = { valeur: n.valeur ?? "", absent: n.absent };
        setValeurs(v);
      } catch (e) {
        onErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId, classeId, anneeId, evaluation.id, onErreur]);

  const maj = (eleveId, patch) =>
    setValeurs((s) => ({ ...s, [eleveId]: { ...s[eleveId], ...patch } }));

  async function enregistrer() {
    setEnCours(true);
    onErreur("");
    try {
      const notes = eleves.map((e) => {
        const v = valeurs[e.id] || {};
        return {
          eleve_id: e.id,
          absent: !!v.absent,
          valeur: v.valeur === "" || v.valeur == null ? null : Number(v.valeur),
        };
      });
      await api.enregistrerNotes(ecoleId, evaluation.id, notes);
      setEnregistre(true);
    } catch (e) {
      onErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <Carte className="p-8 text-sm text-navy-900/50">Chargement…</Carte>;

  return (
    <Carte className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-navy-900/10 px-5 py-3">
        <p className="text-sm font-medium text-navy-900">
          {eleves.length} élève(s) · barème /{evaluation.bareme}
        </p>
        <div className="flex items-center gap-3">
          {enregistre && <span className="text-xs text-emerald-600">✓ Enregistré</span>}
          <Bouton onClick={enregistrer} disabled={enCours}>{enCours ? "…" : "Enregistrer"}</Bouton>
        </div>
      </div>
      {eleves.length === 0 ? (
        <EtatVide icone="✎" titre="Aucun élève inscrit">Inscrivez des élèves dans cette classe pour saisir les notes.</EtatVide>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50">
            <tr>
              <th className="px-5 py-2 font-medium">Élève</th>
              <th className="px-5 py-2 text-center font-medium">Absent</th>
              <th className="px-5 py-2 text-right font-medium">Note /{evaluation.bareme}</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((e) => {
              const v = valeurs[e.id] || {};
              return (
                <tr key={e.id} className="border-t border-navy-900/5">
                  <td className="px-5 py-2 font-medium text-navy-900">{e.prenom} {e.nom}</td>
                  <td className="px-5 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!v.absent}
                      onChange={(ev) => maj(e.id, { absent: ev.target.checked })}
                    />
                  </td>
                  <td className="px-5 py-2 text-right">
                    <input
                      inputMode="decimal"
                      disabled={v.absent}
                      value={v.absent ? "" : v.valeur ?? ""}
                      onChange={(ev) => maj(e.id, { valeur: ev.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })}
                      placeholder="—"
                      className="w-20 rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-right font-mono text-sm outline-none focus:border-or-500 disabled:bg-creme"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Carte>
  );
}

function ModaleEvaluation({ ouvert, onFermer, onCreer }) {
  const [f, setF] = useState({ type: "devoir", libelle: "", bareme: "20", coefficient: "1", date_eval: "" });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle évaluation">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCreer({
            type: f.type,
            libelle: f.libelle.trim() || null,
            bareme: Number(f.bareme) || 20,
            coefficient: Number(f.coefficient) || 1,
            date_eval: f.date_eval || null,
          });
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
          <select
            value={f.type} onChange={(e) => maj("type", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm capitalize outline-none focus:border-or-500"
          >
            {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </label>
        <Champ label="Libellé (optionnel)" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="Devoir n°1" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Champ label="Barème" value={f.bareme} onChange={(e) => maj("bareme", e.target.value.replace(/[^0-9]/g, ""))} />
          <Champ label="Coefficient" value={f.coefficient} onChange={(e) => maj("coefficient", e.target.value.replace(/[^0-9.]/g, ""))} />
          <Champ label="Date" type="date" value={f.date_eval} onChange={(e) => maj("date_eval", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Créer</Bouton>
        </div>
      </form>
    </Modale>
  );
}
