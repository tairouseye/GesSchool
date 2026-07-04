import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/emploi.js";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";
import { getEnseignants } from "@/lib/enseignants.js";
import { useToast } from "@/composants/Feedback.jsx";

const hhmm = (t) => (t ? t.slice(0, 5) : "");

export default function EmploiDuTemps() {
  const { ecoleId } = useAuth();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(null); // null | jour(number)

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [cls, mat, ens] = await Promise.all([
          getClasses(ecoleId, an?.id), getMatieres(ecoleId), getEnseignants(ecoleId),
        ]);
        setClasses(cls); setMatieres(mat); setEnseignants(ens);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId]);

  const recharger = useCallback(async () => {
    if (!classeId) { setCreneaux([]); return; }
    setErreur("");
    try { setCreneaux(await api.getCreneaux(ecoleId, classeId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => { try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; } catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; } };

  return (
    <>
      <EnTete titre="Emploi du temps" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Classe</span>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </label>

        {classeId && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {api.JOURS.map(([j, label]) => {
              const items = creneaux.filter((c) => c.jour === j);
              return (
                <Carte key={j} className="flex flex-col p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display font-semibold text-navy-900">{label}</h3>
                    <button onClick={() => setModale(j)} className="text-xs text-navy-700 hover:text-or-500">+ Ajouter</button>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-navy-900/30">Libre</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((c) => (
                        <li key={c.id} className="rounded-xl border border-navy-900/10 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-mono text-xs text-or-600">{hhmm(c.heure_debut)} – {hhmm(c.heure_fin)}</p>
                              <p className="font-medium text-navy-900">{c.matieres?.libelle || "—"}</p>
                              <p className="text-xs text-navy-900/50">
                                {c.enseignants ? `${c.enseignants.prenom} ${c.enseignants.nom}` : ""}
                                {c.salle ? ` · ${c.salle}` : ""}
                              </p>
                            </div>
                            <button onClick={() => wrap(() => api.supprimerCreneau(c.id))} className="text-navy-900/30 hover:text-rose-500">✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Carte>
              );
            })}
          </div>
        )}
      </div>

      <ModaleCreneau
        jour={modale}
        onFermer={() => setModale(null)}
        matieres={matieres} enseignants={enseignants}
        onCreer={(data) => wrap(async () => {
          await api.creerCreneau(ecoleId, {
            ...data,
            enseignant_id: data.enseignant_id || null,
            salle: data.salle || null,
            classe_id: classeId,
            jour: modale,
          });
          setModale(null);
        })}
      />
    </>
  );
}

function ModaleCreneau({ jour, onFermer, matieres, enseignants, onCreer }) {
  const [f, setF] = useState({ heure_debut: "08:00", heure_fin: "09:00", matiere_id: "", enseignant_id: "", salle: "" });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const label = (api.JOURS.find((x) => x[0] === jour) || [])[1];
  return (
    <Modale ouvert={jour != null} onFermer={onFermer} titre={`Créneau — ${label || ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.matiere_id) return; onCreer(f); }}>
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Début" type="time" value={f.heure_debut} onChange={(e) => maj("heure_debut", e.target.value)} />
          <Champ label="Fin" type="time" value={f.heure_fin} onChange={(e) => maj("heure_fin", e.target.value)} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Matière *</span>
          <select value={f.matiere_id} onChange={(e) => maj("matiere_id", e.target.value)} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {matieres.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Enseignant</span>
          <select value={f.enseignant_id} onChange={(e) => maj("enseignant_id", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">—</option>
            {enseignants.map((en) => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
          </select>
        </label>
        <Champ label="Salle" value={f.salle} onChange={(e) => maj("salle", e.target.value)} placeholder="Salle 3…" />
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.matiere_id}>Ajouter</Bouton>
        </div>
      </form>
    </Modale>
  );
}
