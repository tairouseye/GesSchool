import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import * as api from "@/lib/viescolaire.js";
import { getElevesClasse } from "@/lib/bulletins.js";
import { getEleves } from "@/lib/eleves.js";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";

const aujourdHui = () => new Date().toISOString().slice(0, 10);
const TYPES_INCIDENT = [
  ["observation", "Observation"],
  ["sanction", "Sanction"],
  ["felicitation", "Félicitation"],
];

export default function VieScolaire() {
  const { ecoleId, roles, profil, utilisateur } = useAuth();
  const toutVoir = voitToutesClasses(roles);
  const [onglet, setOnglet] = useState("appel");
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        // L'enseignant ne suit l'assiduité et les incidents que de ses classes.
        setClasses(toutVoir
          ? await getClasses(ecoleId, an?.id)
          : await getMesClasses(ecoleId, an?.id, (await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email))?.id));
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email, toutVoir]);

  return (
    <>
      <EnTete titre="Vie scolaire" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["appel", "Appel & absences"], ["incidents", "Incidents"]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {onglet === "appel"
          ? <Appel ecoleId={ecoleId} annee={annee} classes={classes} onErreur={setErreur} />
          : <Incidents ecoleId={ecoleId} onErreur={setErreur} />}
      </div>
    </>
  );
}

function Appel({ ecoleId, annee, classes, onErreur }) {
  const { utilisateur } = useAuth();
  const [classeId, setClasseId] = useState("");
  const [date, setDate] = useState(aujourdHui());
  const [eleves, setEleves] = useState([]);
  const [etats, setEtats] = useState({}); // eleve_id -> {etat, motif}
  const [recents, setRecents] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  const chargerAppel = useCallback(async () => {
    if (!classeId || !annee) { setEleves([]); return; }
    setChargement(true);
    setEnregistre(false);
    try {
      const [els, abs] = await Promise.all([
        getElevesClasse(ecoleId, classeId, annee.id),
        api.getAbsencesJour(ecoleId, classeId, date),
      ]);
      setEleves(els);
      const map = {};
      for (const e of els) map[e.id] = { etat: "present", motif: "" };
      for (const a of abs) map[a.eleve_id] = { etat: a.type, motif: a.motif || "" };
      setEtats(map);
    } catch (e) { onErreur(e.message); } finally { setChargement(false); }
  }, [ecoleId, classeId, annee, date, onErreur]);

  const chargerRecents = useCallback(async () => {
    try { setRecents(await api.getAbsencesRecentes(ecoleId, 50)); } catch (e) { onErreur(e.message); }
  }, [ecoleId, onErreur]);

  useEffect(() => { chargerAppel(); }, [chargerAppel]);
  useEffect(() => { chargerRecents(); }, [chargerRecents]);

  const set = (id, patch) => setEtats((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  async function enregistrer() {
    onErreur("");
    try {
      const entries = eleves.map((e) => ({ eleve_id: e.id, etat: etats[e.id]?.etat || "present", motif: etats[e.id]?.motif }));
      await api.enregistrerAppel(ecoleId, classeId, date, entries, utilisateur?.id);
      setEnregistre(true);
      chargerRecents();
    } catch (e) { onErreur(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Classe</span>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </label>
        <div className="w-44"><Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {classeId && eleves.length > 0 && (
          <div className="flex items-center gap-3">
            {enregistre && <span className="text-xs text-emerald-600">✓ Appel enregistré</span>}
            <Bouton onClick={enregistrer}>Enregistrer l'appel</Bouton>
          </div>
        )}
      </div>

      {classeId && (
        <Carte className="overflow-hidden">
          {chargement ? (
            <div className="p-4"><SkeletonListe lignes={4} /></div>
          ) : eleves.length === 0 ? (
            <EtatVide icone="📋" titre="Aucun élève inscrit">Aucun élève inscrit dans cette classe.</EtatVide>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr><th className="px-5 py-2 font-medium">Élève</th><th className="px-5 py-2 font-medium">Statut</th><th className="px-5 py-2 font-medium">Motif</th></tr>
              </thead>
              <tbody>
                {eleves.map((e) => {
                  const st = etats[e.id] || { etat: "present" };
                  return (
                    <tr key={e.id} className="border-t border-navy-900/5">
                      <td className="px-5 py-2 font-medium text-navy-900">{e.prenom} {e.nom}</td>
                      <td className="px-5 py-2">
                        <div className="inline-flex gap-1">
                          {[["present", "Présent", "vert"], ["absence", "Absent", "rouge"], ["retard", "Retard", "or"]].map(([v, l, ton]) => (
                            <button key={v} onClick={() => set(e.id, { etat: v })}
                              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                                st.etat === v
                                  ? ton === "vert" ? "bg-emerald-500 text-white" : ton === "rouge" ? "bg-rose-500 text-white" : "bg-or-500 text-navy-900"
                                  : "bg-navy-900/5 text-navy-900/50 hover:bg-navy-900/10"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-2">
                        <input
                          value={st.motif || ""} onChange={(ev) => set(e.id, { motif: ev.target.value })}
                          disabled={st.etat === "present"} placeholder={st.etat === "present" ? "" : "Motif…"}
                          className="w-48 rounded-lg border border-navy-900/15 bg-white px-3 py-1 text-sm outline-none focus:border-or-500 disabled:bg-creme" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Carte>
      )}

      {/* Suivi des absences récentes */}
      <Carte className="overflow-hidden">
        <div className="border-b border-navy-900/10 px-6 py-3 text-sm font-medium text-navy-900/70">Suivi des absences</div>
        {recents.length === 0 ? (
          <p className="p-6 text-sm text-navy-900/40">Aucune absence enregistrée.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50">
              <tr><th className="px-6 py-2 font-medium">Date</th><th className="px-6 py-2 font-medium">Élève</th><th className="px-6 py-2 font-medium">Classe</th><th className="px-6 py-2 font-medium">Type</th><th className="px-6 py-2 font-medium">Justif. parent</th><th className="px-6 py-2 font-medium">Statut</th></tr>
            </thead>
            <tbody>
              {recents.map((a) => (
                  <tr key={a.id} className={`border-t border-navy-900/5 ${a.statut === "en_attente" ? "bg-or-500/5" : ""}`}>
                    <td className="px-6 py-2 font-mono text-xs">{a.date_abs}</td>
                    <td className="px-6 py-2 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}</td>
                    <td className="px-6 py-2 text-navy-900/60">{a.classes?.libelle}</td>
                    <td className="px-6 py-2 capitalize">{a.type === "retard" ? "Retard" : "Absence"}</td>
                    <td className="px-6 py-2 text-navy-900/70">
                      {a.justification ? <span title={a.justification}>« {a.justification.length > 40 ? a.justification.slice(0, 40) + "…" : a.justification} »</span> : <span className="text-navy-900/30">—</span>}
                    </td>
                    <td className="px-6 py-2">
                      <select value={a.statut} onChange={async (e) => { try { await api.justifierAbsence(a.id, e.target.value); chargerRecents(); } catch (er) { onErreur(er.message); } }}
                        className="rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-xs outline-none focus:border-or-500">
                        {Object.entries(api.STATUTS_JUSTIF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        )}
      </Carte>
    </div>
  );
}

function Incidents({ ecoleId, onErreur }) {
  const { utilisateur } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [modale, setModale] = useState(false);

  const recharger = useCallback(async () => {
    try {
      const [inc, els] = await Promise.all([api.getIncidents(ecoleId), getEleves(ecoleId)]);
      setIncidents(inc); setEleves(els);
    } catch (e) { onErreur(e.message); }
  }, [ecoleId, onErreur]);

  useEffect(() => { recharger(); }, [recharger]);

  const couleur = (t) => t === "felicitation" ? "text-emerald-600" : t === "sanction" ? "text-rose-600" : "text-navy-900/70";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Bouton onClick={() => setModale(true)} disabled={eleves.length === 0}>+ Nouvel incident</Bouton>
      </div>
      <Carte className="overflow-hidden">
        {incidents.length === 0 ? (
          <p className="p-6 text-sm text-navy-900/40">Aucun incident enregistré.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50">
              <tr><th className="px-6 py-2 font-medium">Date</th><th className="px-6 py-2 font-medium">Élève</th><th className="px-6 py-2 font-medium">Type</th><th className="px-6 py-2 font-medium">Description</th><th></th></tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-t border-navy-900/5">
                  <td className="px-6 py-2 font-mono text-xs">{i.date_incident}</td>
                  <td className="px-6 py-2 font-medium text-navy-900">{i.eleves?.prenom} {i.eleves?.nom}</td>
                  <td className={`px-6 py-2 font-medium capitalize ${couleur(i.type)}`}>{(TYPES_INCIDENT.find((t) => t[0] === i.type) || [])[1] || i.type}</td>
                  <td className="px-6 py-2 text-navy-900/70">{i.description}</td>
                  <td className="px-6 py-2 text-right">
                    <button onClick={async () => { try { await api.supprimerIncident(i.id); recharger(); } catch (e) { onErreur(e.message); } }}
                      className="text-xs text-rose-500 hover:underline">supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Carte>

      <ModaleIncident
        ouvert={modale} onFermer={() => setModale(false)} eleves={eleves}
        onCreer={async (inc) => { try { await api.creerIncident(ecoleId, inc, utilisateur?.id); setModale(false); recharger(); } catch (e) { onErreur(e.message); } }}
      />
    </div>
  );
}

function ModaleIncident({ ouvert, onFermer, eleves, onCreer }) {
  const [f, setF] = useState({ eleve_id: "", type: "observation", gravite: "", description: "", date_incident: aujourdHui() });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvel incident">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.eleve_id || !f.description.trim()) return; onCreer({ eleve_id: f.eleve_id, type: f.type, gravite: f.gravite ? Number(f.gravite) : null, description: f.description.trim(), date_incident: f.date_incident }); }}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élève *</span>
          <select value={f.eleve_id} onChange={(e) => maj("eleve_id", e.target.value)} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {eleves.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
            <select value={f.type} onChange={(e) => maj("type", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {TYPES_INCIDENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <Champ label="Date" type="date" value={f.date_incident} onChange={(e) => maj("date_incident", e.target.value)} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Description *</span>
          <textarea value={f.description} onChange={(e) => maj("description", e.target.value)} rows={3} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.eleve_id || !f.description.trim()}>Créer</Bouton>
        </div>
      </form>
    </Modale>
  );
}
