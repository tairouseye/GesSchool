import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";
import { getPeriodes } from "@/lib/bulletins.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/progression.js";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");

export default function Progression() {
  const { ecoleId, utilisateur, profil, roles } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [enseignant, setEnseignant] = useState(null);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [etapes, setEtapes] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [mat, per] = await Promise.all([getMatieres(ecoleId), getPeriodes(ecoleId, an?.id)]);
        setMatieres(mat); setPeriodes(per);
        const ens = await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        setEnseignant(ens);
        const cls = voitToutesClasses(roles)
          ? await getClasses(ecoleId, an?.id)
          : await getMesClasses(ecoleId, an?.id, ens?.id);
        setClasses(cls);
        if (cls.length) setClasseId(cls[0].id);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email]);

  const recharger = useCallback(async () => {
    if (!classeId) { setEtapes([]); return; }
    setErreur("");
    try { setEtapes(await api.getProgressions(ecoleId, classeId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn) => { setErreur(""); try { await fn(); await recharger(); } catch (e) { setErreur(e.message); } };

  const compteurs = etapes.reduce((a, e) => { a[e.statut] = (a[e.statut] || 0) + 1; return a; }, {});

  return (
    <>
      <EnTete
        titre="Cahier de progression"
        sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={classes.length > 0 && (
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        )}
      />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {classes.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            Aucune classe à afficher. {enseignant ? "Aucune classe attribuée." : "Ton compte n'est pas relié à une fiche enseignant."}
          </Carte>
        ) : (
          <>
            <FormEtape
              matieres={matieres} periodes={periodes}
              onAjout={(data) => wrap(() => api.creerEtape(ecoleId, { ...data, classe_id: classeId, enseignant_id: enseignant?.id }))}
            />

            <Carte className="flex flex-wrap items-center gap-4 p-4 text-sm">
              {api.STATUTS.map(([k, label]) => (
                <span key={k} className="text-navy-900/60">{label} : <b>{compteurs[k] || 0}</b></span>
              ))}
              <span className="ml-auto text-xs text-navy-900/40">{etapes.length} leçon(s) planifiée(s)</span>
            </Carte>

            {etapes.length === 0 ? (
              <Carte className="p-6 text-sm text-navy-900/40">Aucune leçon planifiée pour cette classe.</Carte>
            ) : (
              <div className="space-y-2">
                {etapes.map((e) => (
                  <Carte key={e.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy-900">{e.titre}</span>
                          {e.matieres?.libelle && <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-xs text-navy-900/60">{e.matieres.libelle}</span>}
                          {e.periodes?.libelle && <span className="text-xs text-navy-900/40">{e.periodes.libelle}</span>}
                          {e.date_prevue && <span className="font-mono text-xs text-or-600">→ {fmt(e.date_prevue)}</span>}
                        </div>
                        {e.description && <p className="mt-1 whitespace-pre-wrap text-sm text-navy-900/60">{e.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex gap-1">
                          {api.STATUTS.map(([v, label, actif]) => (
                            <button key={v} onClick={() => wrap(() => api.majStatut(e.id, v))}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${e.statut === v ? actif : "bg-navy-900/5 text-navy-900/40"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <button onClick={async () => { if (await confirmer("Supprimer cette leçon ?")) { await wrap(() => api.supprimerEtape(e.id)); toast.succes("Leçon supprimée."); } }}
                          className="text-xs text-rose-500 hover:underline">✕</button>
                      </div>
                    </div>
                  </Carte>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FormEtape({ matieres, periodes, onAjout }) {
  const vide = { titre: "", matiere_id: "", periode_id: "", date_prevue: "", description: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Planifier une leçon</h3>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.titre.trim()) return; onAjout(f); setF(vide); }}>
        <Champ label="Chapitre / leçon *" value={f.titre} onChange={(e) => maj("titre", e.target.value)} placeholder="Les fractions" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Matière</span>
            <select value={f.matiere_id} onChange={(e) => maj("matiere_id", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Période</span>
            <select value={f.periode_id} onChange={(e) => maj("periode_id", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </label>
          <Champ label="Date prévue" type="date" value={f.date_prevue} onChange={(e) => maj("date_prevue", e.target.value)} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Détails (optionnel)</span>
          <textarea value={f.description} onChange={(e) => maj("description", e.target.value)} rows={2}
            placeholder="Objectifs, supports…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <div className="flex justify-end">
          <Bouton type="submit">+ Ajouter</Bouton>
        </div>
      </form>
    </Carte>
  );
}
