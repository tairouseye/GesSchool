import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, Onglets } from "@/composants/ui.jsx";
import { HYPOTHESES_DEFAUT, calculerGrille, totalFixes, getHypotheses, setHypotheses, appliquerTarifs } from "@/lib/tarification.js";
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
  const [onglet, setOnglet] = useState("ecoles");

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
  const jours = (d) => (d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null);
  const activesRecent = ecoles.filter((e) => jours(e.derniere_activite) !== null && jours(e.derniere_activite) <= 30).length;
  const fmtActivite = (d) => {
    const j = jours(d);
    if (j === null) return "jamais";
    if (j === 0) return "aujourd'hui";
    if (j === 1) return "hier";
    return `il y a ${j} j`;
  };

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

        <Onglets actif={onglet} onChange={setOnglet}
          items={[["ecoles", "Écoles clientes"], ["tarification", "💰 Tarification"]]} />

        {onglet === "tarification" ? (
          <Tarification nbEcolesReel={ecoles.length} onErreur={setErreur} />
        ) : (
        <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi label="Écoles clientes" valeur={String(ecoles.length)} />
          <Kpi label="Abonnements actifs" valeur={String(actives)} ton="vert" />
          <Kpi label="Actives (30 j)" valeur={String(activesRecent)} ton="vert" />
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
                <th className="px-5 py-3 font-medium">Activité</th>
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
                  <td className="px-5 py-3 text-navy-900/70">
                    <span className="font-mono">{e.nb_personnel ?? "—"}</span>
                    {e.nb_enseignants > 0 && <span className="ml-1 text-xs text-navy-900/40">· {e.nb_enseignants} ens.</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-navy-900/70">{e.nb_parents ?? "—"}</td>
                  <td className="px-5 py-3 text-xs">
                    <span className={jours(e.derniere_activite) !== null && jours(e.derniere_activite) <= 30 ? "text-emerald-700" : "text-navy-900/40"}>
                      {fmtActivite(e.derniere_activite)}
                    </span>
                  </td>
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
                <tr><td colSpan={9} className="px-5 py-8 text-center text-sm text-navy-900/40">Aucune école.</td></tr>
              )}
            </tbody>
          </table>
        </Carte>
        </div>
        )}
      </div>

      <ModaleEcole
        ecole={edit} plans={plans} onFermer={() => setEdit(null)}
        onAbonnement={(planId, statut, fin) => wrap(async () => { await api.definirAbonnement(edit.ecole_id, planId, statut, fin); setEdit(null); }, "Abonnement mis à jour.")}
        onModules={(mods) => wrap(async () => { await api.definirModules(edit.ecole_id, mods); setEdit(null); }, "Modules mis à jour.")}
      />
    </div>
  );
}

// Simulateur de tarification : construit les offres à partir des coûts réels.
// Aucun prix n'est deviné — tout découle des hypothèses saisies ici.
function Tarification({ nbEcolesReel, onErreur }) {
  const toast = useToast();
  const [h, setH] = useState(HYPOTHESES_DEFAUT);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    getHypotheses().then(setH).catch((e) => onErreur(e.message)).finally(() => setChargement(false));
  }, [onErreur]);

  const grille = calculerGrille(h);
  const F = totalFixes(h);
  const majFixe = (k, v) => setH((s) => ({ ...s, fixes: { ...s.fixes, [k]: Number(v) || 0 } }));
  const maj = (k, v) => setH((s) => ({ ...s, [k]: v }));
  const majPalier = (i, k, v) =>
    setH((s) => ({ ...s, paliers: s.paliers.map((p, j) => (j === i ? { ...p, [k]: Number(v) || 0 } : p)) }));

  const enregistrer = async () => {
    setEnvoi(true);
    try { await setHypotheses(h); toast.succes("Hypothèses enregistrées."); }
    catch (e) { toast.erreur(e.message); }
    finally { setEnvoi(false); }
  };
  const appliquer = async () => {
    setEnvoi(true);
    try { await appliquerTarifs(grille); toast.succes("Tarifs appliqués aux plans d'abonnement."); }
    catch (e) { toast.erreur(e.message); }
    finally { setEnvoi(false); }
  };

  if (chargement) return <Carte className="p-8 text-sm text-navy-900/50">Chargement…</Carte>;

  return (
    <div className="space-y-5">
      <Carte className="p-6">
        <h3 className="font-display text-lg font-semibold text-navy-900">Pourquoi pas « par élève »</h3>
        <p className="mt-1 text-sm text-navy-900/60">
          Facturer au prorata de l'effectif revient à indexer le prix sur une variable qui ne
          pilote pas tes coûts : une école de plus ne coûte presque rien en serveur. Ton coût
          dominant est le <b>temps humain</b> (onboarding + support). Le palier d'effectif sert
          d'approximation de cette charge — d'où un forfait, prévisible pour le client.
        </p>
        <p className="mt-2 font-mono text-xs text-navy-900/45">
          Prix = ( Fixes / N + Variable + Onboarding / 12 ) ÷ (1 − marge)
        </p>
      </Carte>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte className="p-6">
          <h3 className="mb-3 font-display text-base font-semibold text-navy-900">Coûts fixes mensuels</h3>
          <div className="space-y-2">
            {[["supabase", "Supabase (Pro, sauvegardes)"], ["domaine", "Domaine + DNS"],
              ["email", "E-mail transactionnel"], ["outils", "Outils (IA, design, supervision)"]].map(([k, lib]) => (
              <label key={k} className="flex items-center justify-between gap-3">
                <span className="text-sm text-navy-900/70">{lib}</span>
                <input type="number" value={h.fixes[k] ?? 0} onChange={(e) => majFixe(k, e.target.value)}
                  className="w-32 rounded-lg border border-navy-900/15 px-3 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500" />
              </label>
            ))}
          </div>
          <p className="mt-3 border-t border-navy-900/10 pt-2 text-right text-sm">
            Total <b className="font-mono text-navy-900">{fmtX(F)} XOF</b> / mois
          </p>
        </Carte>

        <Carte className="p-6">
          <h3 className="mb-3 font-display text-base font-semibold text-navy-900">Pilotage</h3>
          <div className="space-y-3">
            <Curseur label="Marge visée" valeur={h.margeVisee} min={0} max={0.9} pas={0.05}
              affichage={`${Math.round(h.margeVisee * 100)} %`} onChange={(v) => maj("margeVisee", v)} />
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-navy-900/70">Taux horaire (XOF/h)</span>
              <input type="number" value={h.tauxHoraire} onChange={(e) => maj("tauxHoraire", Number(e.target.value) || 0)}
                className="w-32 rounded-lg border border-navy-900/15 px-3 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-navy-900/70">
                Écoles clientes visées
                <span className="ml-1 text-xs text-navy-900/40">(actuel : {nbEcolesReel})</span>
              </span>
              <input type="number" min="1" value={h.nbEcoles} onChange={(e) => maj("nbEcoles", Number(e.target.value) || 1)}
                className="w-32 rounded-lg border border-navy-900/15 px-3 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500" />
            </label>
          </div>
          <p className="mt-3 text-xs text-navy-900/45">
            Plus tu as d'écoles, plus les frais fixes se diluent et plus le prix baisse.
            À marge 0 %, le prix affiché est ton coût de revient exact.
          </p>
        </Carte>
      </div>

      <Carte className="overflow-hidden">
        <div className="border-b border-navy-900/10 px-5 py-3 text-sm font-medium text-navy-900/70">
          Charge par palier &amp; prix obtenu
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50">
            <tr>
              <th className="px-4 py-2.5 font-medium">Palier</th>
              <th className="px-4 py-2.5 font-medium">Max élèves</th>
              <th className="px-4 py-2.5 font-medium">Support (h/mois)</th>
              <th className="px-4 py-2.5 font-medium">Onboarding (h)</th>
              <th className="px-4 py-2.5 text-right font-medium">Coût de revient</th>
              <th className="px-4 py-2.5 text-right font-medium">Prix / mois</th>
              <th className="px-4 py-2.5 text-right font-medium">Prix / an</th>
              <th className="px-4 py-2.5 text-right font-medium">Seuil</th>
            </tr>
          </thead>
          <tbody>
            {grille.map((l, i) => (
              <tr key={l.code} className="border-t border-navy-900/5">
                <td className="px-4 py-2.5 font-medium text-navy-900">{l.libelle}</td>
                <td className="px-4 py-2.5">
                  <input type="number" value={l.maxEleves} onChange={(e) => majPalier(i, "maxEleves", e.target.value)}
                    className="w-20 rounded-lg border border-navy-900/15 px-2 py-1 text-right font-mono text-xs outline-none focus:border-or-500" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" step="0.5" value={l.supportHeures} onChange={(e) => majPalier(i, "supportHeures", e.target.value)}
                    className="w-20 rounded-lg border border-navy-900/15 px-2 py-1 text-right font-mono text-xs outline-none focus:border-or-500" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" value={l.onboardingHeures} onChange={(e) => majPalier(i, "onboardingHeures", e.target.value)}
                    className="w-20 rounded-lg border border-navy-900/15 px-2 py-1 text-right font-mono text-xs outline-none focus:border-or-500" />
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-navy-900/60">{fmtX(l.coutRevient)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-navy-900">{fmtX(l.prixMensuel)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-or-600">{fmtX(l.prixAnnuel)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-navy-900/50">
                  {l.seuilEcoles ? `${l.seuilEcoles} écoles` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-navy-900/10 px-5 py-3 text-xs text-navy-900/45">
          <b>Seuil</b> = nombre d'écoles sur ce palier nécessaire pour couvrir tes frais fixes.
          Les prix appliqués sont arrondis au millier de francs.
        </p>
      </Carte>

      <div className="flex flex-wrap justify-end gap-2">
        <Bouton variante="fantome" onClick={() => setH(HYPOTHESES_DEFAUT)}>Réinitialiser</Bouton>
        <Bouton variante="fantome" onClick={enregistrer} disabled={envoi}>Enregistrer les hypothèses</Bouton>
        <Bouton variante="or" onClick={appliquer} disabled={envoi}>Appliquer ces prix aux plans</Bouton>
      </div>
    </div>
  );
}

function Curseur({ label, valeur, min, max, pas, affichage, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm text-navy-900/70">
        {label} <b className="font-mono text-navy-900">{affichage}</b>
      </span>
      <input type="range" min={min} max={max} step={pas} value={valeur}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-or-500" />
    </label>
  );
}

const fmtX = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

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
