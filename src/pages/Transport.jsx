import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getEleves, getInscriptionsParEleve } from "@/lib/eleves.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { facturerAbonnements } from "@/lib/paiements.js";
import * as api from "@/lib/transport.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const auj = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisLabel = (ym) => { const [a, m] = (ym || "").split("-"); return `${MOIS[Number(m) - 1] || ""} ${a}`.trim(); };
const LIB_TRAJET = { aller_retour: "Aller-retour", aller: "Aller seul", retour: "Retour seul" };

export default function Transport() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const toast = useToast();
  const confirmer = useConfirm();
  const [onglet, setOnglet] = useState("circuits");
  const [annee, setAnnee] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [circuits, setCircuits] = useState([]);
  const [abonnes, setAbonnes] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [cir, abo, els, insc] = await Promise.all([
        api.getCircuits(ecoleId), api.getAbonnements(ecoleId), getEleves(ecoleId), getInscriptionsParEleve(ecoleId, an?.id),
      ]);
      setCircuits(cir); setAbonnes(abo); setEleves(els); setInscriptions(insc);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Erreur"); return false; }
  };
  const classe = (id) => inscriptions[id]?.classes?.libelle || "—";
  const actifs = abonnes.filter((a) => a.actif);

  async function facturer() {
    const a = actifs.filter((x) => Number(x.tarif) > 0);
    if (a.length === 0) return toast.erreur("Aucun abonné avec tarif à facturer.");
    const lib = `Transport — ${moisLabel(mois)}`;
    if (!(await confirmer(`Générer la facture « ${lib} » pour ${a.length} abonné(s) ?`))) return;
    try {
      const r = await facturerAbonnements(ecoleId, annee?.id, a.map((x) => ({ eleve_id: x.eleve_id, libelle: lib, montant: x.tarif })));
      toast.succes(`${r.crees} facture(s) créée(s)${r.ignores ? ` · ${r.ignores} déjà facturé(s)` : ""}.`);
    } catch (e) { toast.erreur(e.message); }
  }

  return (
    <>
      <EnTete titre="Transport scolaire" sousTitre="Circuits, abonnements et embarquement" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Kpi label="Circuits" valeur={String(circuits.filter((c) => c.actif).length)} />
          <Kpi label="Abonnés" valeur={String(actifs.length)} />
          <Kpi label="Places (véhicules)" valeur={String(circuits.length)} />
        </div>

        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["circuits", "Circuits"], ["abonnes", "Abonnés"], ["embarquement", "Embarquement"]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>{l}</button>
          ))}
        </div>

        {onglet === "circuits" && <Circuits ecoleId={ecoleId} circuits={circuits} wrap={wrap} confirmer={confirmer} />}
        {onglet === "abonnes" && (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <Champ label="Mois à facturer" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
              <Bouton variante="fantome" onClick={facturer}>Facturer le mois</Bouton>
            </div>
            <Abonnes ecoleId={ecoleId} abonnes={abonnes} circuits={circuits} eleves={eleves} classe={classe} devise={devise} wrap={wrap} confirmer={confirmer} />
          </>
        )}
        {onglet === "embarquement" && <Embarquement ecoleId={ecoleId} circuits={circuits} abonnes={actifs} classe={classe} toast={toast} />}
      </div>
    </>
  );
}

function Kpi({ label, valeur }) {
  return <Carte className="p-4"><p className="text-xs text-navy-900/50">{label}</p><p className="mt-1 font-display text-xl font-bold text-navy-900">{valeur}</p></Carte>;
}

// ---- Circuits & arrêts ----
function Circuits({ ecoleId, circuits, wrap, confirmer }) {
  const [modale, setModale] = useState(null);
  return (
    <>
      <div className="flex justify-end"><Bouton onClick={() => setModale({})}>+ Nouveau circuit</Bouton></div>
      {circuits.length === 0 ? (
        <EtatVide icone="🚌" titre="Aucun circuit" action={<Bouton onClick={() => setModale({})}>+ Nouveau circuit</Bouton>}>Créez un circuit (véhicule, chauffeur, arrêts).</EtatVide>
      ) : (
        <div className="space-y-3">
          {circuits.map((c) => (
            <Carte key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold text-navy-900">{c.nom}{!c.actif && <span className="ml-2 text-xs text-navy-900/40">(inactif)</span>}</p>
                  <p className="text-sm text-navy-900/60">
                    {[c.vehicule, c.chauffeur, c.chauffeur_tel, c.heure_depart && `départ ${c.heure_depart}`].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Bouton variante="fantome" className="!py-1.5 text-xs" onClick={() => setModale(c)}>Modifier</Bouton>
                  <Bouton variante="fantome" className="!py-1.5 text-xs text-rose-600" onClick={async () => { if (await confirmer("Supprimer ce circuit ?")) wrap(() => api.supprimerCircuit(c.id), "Circuit supprimé."); }}>Suppr.</Bouton>
                </div>
              </div>
              <Arrets ecoleId={ecoleId} circuit={c} wrap={wrap} confirmer={confirmer} />
            </Carte>
          ))}
        </div>
      )}
      <ModaleCircuit ouvert={!!modale} circuit={modale} onFermer={() => setModale(null)}
        onValider={(c) => wrap(async () => { await api.enregistrerCircuit(ecoleId, c); setModale(null); }, "Circuit enregistré.")} />
    </>
  );
}

function Arrets({ ecoleId, circuit, wrap, confirmer }) {
  const [ajout, setAjout] = useState({ libelle: "", heure: "" });
  const [edit, setEdit] = useState(null); // { id, libelle, heure }

  async function enregistrerEdit(e) {
    e.preventDefault();
    if (!edit.libelle.trim()) return;
    if (await wrap(() => api.modifierArret(edit.id, edit), "Arrêt modifié.")) setEdit(null);
  }

  return (
    <div className="mt-4 border-t border-navy-900/10 pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-900/40">Arrêts <span className="normal-case text-navy-900/30">(triés par heure)</span></p>
      {circuit.arrets.length === 0 ? <p className="text-sm text-navy-900/40">Aucun arrêt.</p> : (
        <ul className="space-y-1">
          {circuit.arrets.map((a) => (
            <li key={a.id} className="text-sm">
              {edit?.id === a.id ? (
                <form onSubmit={enregistrerEdit} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]"><Champ label="Arrêt" value={edit.libelle} onChange={(e) => setEdit((s) => ({ ...s, libelle: e.target.value }))} /></div>
                  <div className="w-28"><Champ label="Heure" type="time" value={edit.heure} onChange={(e) => setEdit((s) => ({ ...s, heure: e.target.value }))} /></div>
                  <Bouton type="submit" className="!py-2 text-xs">Enregistrer</Bouton>
                  <Bouton type="button" variante="fantome" className="!py-2 text-xs" onClick={() => setEdit(null)}>Annuler</Bouton>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-navy-900/80">📍 {a.libelle}{a.heure ? ` — ${a.heure}` : ""}</span>
                  <span className="shrink-0 whitespace-nowrap">
                    <button onClick={() => setEdit({ id: a.id, libelle: a.libelle, heure: a.heure || "" })} className="text-xs text-navy-700 hover:text-or-500">modifier</button>
                    <button onClick={async () => { if (await confirmer("Supprimer cet arrêt ?")) wrap(() => api.supprimerArret(a.id), "Arrêt supprimé."); }} className="ml-3 text-xs text-rose-500 hover:underline">retirer</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!ajout.libelle.trim()) return; wrap(() => api.ajouterArret(ecoleId, circuit.id, { ...ajout, ordre: circuit.arrets.length + 1 }), "Arrêt ajouté.").then(() => setAjout({ libelle: "", heure: "" })); }}>
        <div className="flex-1 min-w-[140px]"><Champ label="Arrêt" value={ajout.libelle} onChange={(e) => setAjout((s) => ({ ...s, libelle: e.target.value }))} placeholder="Sacré-Cœur" /></div>
        <div className="w-28"><Champ label="Heure" type="time" value={ajout.heure} onChange={(e) => setAjout((s) => ({ ...s, heure: e.target.value }))} /></div>
        <Bouton type="submit" variante="fantome" className="!py-2 text-xs">+ Ajouter</Bouton>
      </form>
    </div>
  );
}

function ModaleCircuit({ ouvert, circuit, onFermer, onValider }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(circuit?.id ? { ...circuit } : { nom: "", vehicule: "", chauffeur: "", chauffeur_tel: "", heure_depart: "", actif: true }); }, [circuit, ouvert]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={circuit?.id ? "Modifier le circuit" : "Nouveau circuit"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.nom?.trim()) return; onValider(f); }}>
        <Champ label="Nom du circuit *" value={f.nom || ""} onChange={(e) => maj("nom", e.target.value)} placeholder="Circuit A — Nord" required />
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Véhicule" value={f.vehicule || ""} onChange={(e) => maj("vehicule", e.target.value)} placeholder="Bus 1 (30 pl.)" />
          <Champ label="Heure de départ" value={f.heure_depart || ""} onChange={(e) => maj("heure_depart", e.target.value)} placeholder="06:30" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Chauffeur" value={f.chauffeur || ""} onChange={(e) => maj("chauffeur", e.target.value)} />
          <Champ label="Tél. chauffeur" type="tel" value={f.chauffeur_tel || ""} onChange={(e) => maj("chauffeur_tel", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-900/70"><input type="checkbox" checked={!!f.actif} onChange={(e) => maj("actif", e.target.checked)} /> Circuit actif</label>
        <div className="flex justify-end gap-2"><Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton><Bouton type="submit">Enregistrer</Bouton></div>
      </form>
    </Modale>
  );
}

// ---- Abonnés ----
function Abonnes({ ecoleId, abonnes, circuits, eleves, classe, devise, wrap, confirmer }) {
  const [modale, setModale] = useState(null);
  return (
    <>
      <div className="flex justify-end"><Bouton onClick={() => setModale({})} disabled={circuits.length === 0}>+ Nouvel abonné</Bouton></div>
      {circuits.length === 0 ? (
        <EtatVide icone="🚌" titre="Créez d'abord un circuit">Ajoutez un circuit avant d'abonner des élèves.</EtatVide>
      ) : abonnes.length === 0 ? (
        <EtatVide icone="👤" titre="Aucun abonné" action={<Bouton onClick={() => setModale({})}>+ Nouvel abonné</Bouton>}>Abonnez un élève à un circuit et un arrêt.</EtatVide>
      ) : (
        <Carte className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50"><tr><th className="px-5 py-3 font-medium">Élève</th><th className="px-5 py-3 font-medium">Classe</th><th className="px-5 py-3 font-medium">Circuit</th><th className="px-5 py-3 font-medium">Arrêt</th><th className="px-5 py-3 font-medium">Trajet</th><th className="px-5 py-3 font-medium">Tarif</th><th className="px-5 py-3"></th></tr></thead>
            <tbody>
              {abonnes.map((a) => (
                <tr key={a.id} className="border-t border-navy-900/5">
                  <td className="px-5 py-3 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}{!a.actif && <span className="ml-2 text-xs text-navy-900/40">(inactif)</span>}</td>
                  <td className="px-5 py-3 text-navy-900/60">{classe(a.eleve_id)}</td>
                  <td className="px-5 py-3">{a.transport_circuits?.nom || "—"}</td>
                  <td className="px-5 py-3 text-navy-900/60">{a.transport_arrets?.libelle || "—"}</td>
                  <td className="px-5 py-3 text-xs">{LIB_TRAJET[a.trajet]}</td>
                  <td className="px-5 py-3 font-mono text-navy-900/70">{fmt(a.tarif)} {devise}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setModale(a)} className="text-xs text-navy-700 hover:text-or-500">modifier</button>
                    <button onClick={async () => { if (await confirmer("Supprimer cet abonné ?")) wrap(() => api.supprimerAbonnement(a.id), "Abonné supprimé."); }} className="ml-3 text-xs text-rose-500 hover:underline">suppr.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      )}
      <ModaleAbonne ouvert={!!modale} abo={modale} eleves={eleves} abonnes={abonnes} circuits={circuits} classe={classe} devise={devise}
        onFermer={() => setModale(null)} onValider={(a) => wrap(async () => { await api.enregistrerAbonnement(ecoleId, a); setModale(null); }, "Abonné enregistré.")} />
    </>
  );
}

function ModaleAbonne({ ouvert, abo, eleves, abonnes, circuits, classe, devise, onFermer, onValider }) {
  const [f, setF] = useState({});
  useEffect(() => {
    setF(abo?.id
      ? { id: abo.id, eleve_id: abo.eleve_id, circuit_id: abo.circuit_id || "", arret_id: abo.arret_id || "", trajet: abo.trajet, tarif: String(abo.tarif ?? ""), actif: abo.actif }
      : { eleve_id: "", circuit_id: circuits[0]?.id || "", arret_id: "", trajet: "aller_retour", tarif: "", actif: true });
  }, [abo, ouvert, circuits]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const dejaAbo = new Set(abonnes.filter((a) => a.id !== abo?.id).map((a) => a.eleve_id));
  const dispo = eleves.filter((e) => !dejaAbo.has(e.id));
  const arrets = circuits.find((c) => c.id === f.circuit_id)?.arrets || [];

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={abo?.id ? "Modifier l'abonné" : "Nouvel abonné transport"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.eleve_id || !f.circuit_id) return; onValider(f); }}>
        {abo?.id ? (
          <p className="text-sm font-medium text-navy-900">{abo.eleves?.prenom} {abo.eleves?.nom} <span className="text-navy-900/50">· {classe(abo.eleve_id)}</span></p>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élève *</span>
            <select value={f.eleve_id} onChange={(e) => maj("eleve_id", e.target.value)} required className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {dispo.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.matricule || classe(e.id)}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Circuit *</span>
            <select value={f.circuit_id} onChange={(e) => { maj("circuit_id", e.target.value); maj("arret_id", ""); }} required className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {circuits.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Arrêt</span>
            <select value={f.arret_id} onChange={(e) => maj("arret_id", e.target.value)} className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {arrets.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Trajet</span>
            <select value={f.trajet} onChange={(e) => maj("trajet", e.target.value)} className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="aller_retour">Aller-retour</option><option value="aller">Aller seul</option><option value="retour">Retour seul</option>
            </select>
          </label>
          <Champ label={`Tarif (${devise})`} type="number" value={f.tarif} onChange={(e) => maj("tarif", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-900/70"><input type="checkbox" checked={!!f.actif} onChange={(e) => maj("actif", e.target.checked)} /> Abonnement actif</label>
        <div className="flex justify-end gap-2"><Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton><Bouton type="submit" disabled={!f.eleve_id || !f.circuit_id}>Enregistrer</Bouton></div>
      </form>
    </Modale>
  );
}

// ---- Embarquement ----
function Embarquement({ ecoleId, circuits, abonnes, classe, toast }) {
  const [circuitId, setCircuitId] = useState(circuits[0]?.id || "");
  const [sens, setSens] = useState("aller");
  const [date, setDate] = useState(auj());
  const [pts, setPts] = useState({});
  useEffect(() => { if (!circuitId && circuits[0]) setCircuitId(circuits[0].id); }, [circuits, circuitId]);
  const recharger = useCallback(async () => { if (!circuitId) return; try { setPts(await api.getPointages(ecoleId, circuitId, date, sens)); } catch { /* */ } }, [ecoleId, circuitId, date, sens]);
  useEffect(() => { recharger(); }, [recharger]);

  const liste = abonnes.filter((a) => a.circuit_id === circuitId);
  async function toggle(eleveId, champ) {
    try {
      const cur = pts[eleveId] || { embarque: false, debarque: false };
      await api.setPointage(ecoleId, circuitId, eleveId, date, sens, { ...cur, [champ]: !cur[champ] });
      await recharger();
    } catch (e) { toast.erreur(e.message); }
  }

  if (circuits.length === 0) return <EtatVide icone="🚌" titre="Aucun circuit">Créez un circuit et des abonnés pour pointer l'embarquement.</EtatVide>;
  return (
    <Carte className="overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b border-navy-900/10 p-4">
        <label className="block"><span className="mb-1.5 block text-xs text-navy-900/50">Circuit</span>
          <select value={circuitId} onChange={(e) => setCircuitId(e.target.value)} className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
            {circuits.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1.5 block text-xs text-navy-900/50">Sens</span>
          <select value={sens} onChange={(e) => setSens(e.target.value)} className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
            <option value="aller">Matin (aller)</option><option value="retour">Soir (retour)</option>
          </select>
        </label>
        <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="ml-auto text-sm text-navy-900/60">Embarqués : <b>{liste.filter((a) => pts[a.eleve_id]?.embarque).length} / {liste.length}</b></p>
      </div>
      {liste.length === 0 ? <p className="p-6 text-sm text-navy-900/40">Aucun abonné sur ce circuit.</p> : (
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50"><tr><th className="px-5 py-2 font-medium">Élève</th><th className="px-5 py-2 font-medium">Classe</th><th className="px-5 py-2 font-medium">Arrêt</th><th className="px-5 py-2 text-center font-medium">Embarqué</th><th className="px-5 py-2 text-center font-medium">Débarqué</th></tr></thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.id} className="border-t border-navy-900/5">
                <td className="px-5 py-2.5 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}</td>
                <td className="px-5 py-2.5 text-navy-900/60">{classe(a.eleve_id)}</td>
                <td className="px-5 py-2.5 text-navy-900/60">{a.transport_arrets?.libelle || "—"}</td>
                {["embarque", "debarque"].map((ch) => (
                  <td key={ch} className="px-5 py-2.5 text-center">
                    <button onClick={() => toggle(a.eleve_id, ch)} aria-label={ch}
                      className={`grid h-6 w-6 place-items-center rounded-md border-2 ${pts[a.eleve_id]?.[ch] ? "border-or-500 bg-or-500 text-navy-900" : "border-navy-900/20 text-transparent"}`}>✓</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Carte>
  );
}
