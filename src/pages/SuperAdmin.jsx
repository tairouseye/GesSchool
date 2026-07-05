import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/superadmin.js";
import { MODULES } from "@/lib/modules.js";
import { useToast } from "@/composants/Feedback.jsx";

const TONS = {
  actif: "bg-emerald-500/10 text-emerald-700",
  essai: "bg-or-500/15 text-or-600",
  suspendu: "bg-rose-500/10 text-rose-700",
  expire: "bg-navy-900/10 text-navy-900/60",
  annule: "bg-navy-900/10 text-navy-900/50",
};

export default function SuperAdmin() {
  const { profil, deconnexion } = useAuth();
  const toast = useToast();
  const [ecoles, setEcoles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [erreur, setErreur] = useState("");
  const [edit, setEdit] = useState(null);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [ec, pl] = await Promise.all([api.getEcoles(), api.getPlans()]);
      setEcoles(ec); setPlans(pl);
    } catch (e) { setErreur(e.message); }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
  };

  const totalEleves = ecoles.reduce((s, e) => s + Number(e.effectif || 0), 0);
  const totalPersonnel = ecoles.reduce((s, e) => s + Number(e.nb_personnel || 0), 0);
  const totalParents = ecoles.reduce((s, e) => s + Number(e.nb_parents || 0), 0);
  const actives = ecoles.filter((e) => e.statut === "actif").length;
  const nf = new Intl.NumberFormat("fr-FR");

  return (
    <div className="min-h-full bg-creme">
      <header className="flex items-center justify-between border-b border-navy-900/10 bg-navy-900 px-6 py-4 text-creme">
        <div className="flex items-center gap-3">
          <Cachet size={36} className="text-or-500" />
          <span className="font-display text-lg font-bold">GesSchool · <span className="text-or-500">Super-admin</span></span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/" className="text-creme/70 hover:text-creme">← Mon école</Link>
          <span className="hidden text-creme/60 sm:inline">{profil ? `${profil.prenom} ${profil.nom}` : ""}</span>
          <button onClick={deconnexion} className="rounded-lg border border-creme/20 px-3 py-1.5 text-xs text-creme/80 hover:bg-navy-800">Déconnexion</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Écoles clientes" valeur={String(ecoles.length)} />
          <Kpi label="Abonnements actifs" valeur={String(actives)} ton="vert" />
          <Kpi label="Élèves (toutes écoles)" valeur={nf.format(totalEleves)} />
          <Kpi label="Comptes (personnel + parents)" valeur={nf.format(totalPersonnel + totalParents)} />
        </div>

        <Carte className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50">
              <tr>
                <th className="px-5 py-3 font-medium">École</th>
                <th className="px-5 py-3 font-medium">Élèves</th>
                <th className="px-5 py-3 font-medium">Personnel</th>
                <th className="px-5 py-3 font-medium">Parents</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Échéance</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ecoles.map((e) => (
                <tr key={e.ecole_id} className="border-t border-navy-900/5">
                  <td className="px-5 py-3 font-medium text-navy-900">{e.nom} <span className="text-xs text-navy-900/40">{e.sigle}</span></td>
                  <td className="px-5 py-3 font-mono text-navy-900/70">{e.effectif}</td>
                  <td className="px-5 py-3 font-mono text-navy-900/70">{e.nb_personnel ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-navy-900/70">{e.nb_parents ?? "—"}</td>
                  <td className="px-5 py-3">{e.plan_libelle || <span className="text-navy-900/30">—</span>}</td>
                  <td className="px-5 py-3">
                    {e.statut
                      ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[e.statut] || TONS.expire}`}>{e.statut}</span>
                      : <span className="text-xs text-navy-900/30">aucun</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{e.fin || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setEdit(e)} className="text-xs font-medium text-navy-700 hover:text-or-500">gérer</button>
                  </td>
                </tr>
              ))}
              {ecoles.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-navy-900/40">Aucune école.</td></tr>
              )}
            </tbody>
          </table>
        </Carte>
      </div>

      <ModaleEcole
        ecole={edit} plans={plans} onFermer={() => setEdit(null)}
        onAbonnement={(planId, statut, fin) => wrap(async () => { await api.definirAbonnement(edit.ecole_id, planId, statut, fin); setEdit(null); }, "Abonnement mis à jour.")}
        onModules={(mods) => wrap(async () => { await api.definirModules(edit.ecole_id, mods); setEdit(null); }, "Modules mis à jour.")}
      />
    </div>
  );
}

function Kpi({ label, valeur, ton }) {
  const tons = { navy: "text-navy-900", vert: "text-emerald-700" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tons[ton] || tons.navy}`}>{valeur}</p>
    </Carte>
  );
}

function ModaleEcole({ ecole, plans, onFermer, onAbonnement, onModules }) {
  const [planId, setPlanId] = useState("");
  const [statut, setStatut] = useState("actif");
  const [fin, setFin] = useState("");
  const [mods, setMods] = useState(new Set());

  useEffect(() => {
    if (!ecole) return;
    const p = plans.find((x) => x.code === ecole.plan_code);
    setPlanId(p?.id || plans[0]?.id || "");
    setStatut(ecole.statut || "actif");
    setFin(ecole.fin || "");
    setMods(new Set(ecole.modules || MODULES.map((m) => m.id)));
  }, [ecole, plans]);

  if (!ecole) return null;
  const toggle = (id) => setMods((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Modale ouvert={!!ecole} onFermer={onFermer} titre={ecole.nom} large>
      <div className="space-y-5">
        {/* Abonnement */}
        <div>
          <p className="mb-2 text-sm font-medium text-navy-900/70">Abonnement</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-navy-900/50">Plan</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                {plans.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-navy-900/50">Statut</span>
              <select value={statut} onChange={(e) => setStatut(e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                {api.STATUTS_ABO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <Champ label="Échéance" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-navy-900/40">Appliquer un plan active automatiquement ses modules.</p>
          <div className="mt-2 flex justify-end">
            <Bouton onClick={() => onAbonnement(planId, statut, fin)}>Appliquer le plan</Bouton>
          </div>
        </div>

        {/* Modules (override fin) */}
        <div className="border-t border-navy-900/10 pt-4">
          <p className="mb-2 text-sm font-medium text-navy-900/70">Modules (ajustement fin)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULES.map((m) => (
              <label key={m.id} className="flex items-center justify-between rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
                <span>{m.label}</span>
                <input type="checkbox" checked={mods.has(m.id)} onChange={() => toggle(m.id)} />
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
            <Bouton variante="or" onClick={() => onModules([...mods])}>Enregistrer les modules</Bouton>
          </div>
        </div>
      </div>
    </Modale>
  );
}
