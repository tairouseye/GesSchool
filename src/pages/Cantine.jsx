import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Onglets } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getEleves, getInscriptionsParEleve } from "@/lib/eleves.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { facturerAbonnements } from "@/lib/paiements.js";
import * as api from "@/lib/cantine.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const auj = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisLabel = (ym) => { const [a, m] = (ym || "").split("-"); return `${MOIS[Number(m) - 1] || ""} ${a}`.trim(); };
const JOURS = [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"]];
function lundiDe(d) { const x = new Date(d); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return x.toISOString().slice(0, 10); }

export default function Cantine() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const toast = useToast();
  const confirmer = useConfirm();
  const [onglet, setOnglet] = useState("abonnes");
  const [annee, setAnnee] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [abonnes, setAbonnes] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(null);
  const [recharge, setRecharge] = useState(null);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [abo, els, insc] = await Promise.all([
        api.getAbonnements(ecoleId), getEleves(ecoleId), getInscriptionsParEleve(ecoleId, an?.id),
      ]);
      setAbonnes(abo); setEleves(els); setInscriptions(insc);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Erreur"); return false; }
  };

  const classe = (id) => inscriptions[id]?.classes?.libelle || "—";
  const actifs = abonnes.filter((a) => a.actif);
  const totalSolde = abonnes.filter((a) => a.formule === "prepaye").reduce((s, a) => s + Number(a.solde || 0), 0);

  async function facturer() {
    const mensuels = actifs.filter((a) => a.formule === "mensuel" && Number(a.tarif) > 0);
    if (mensuels.length === 0) return toast.erreur("Aucun abonné mensuel avec tarif à facturer.");
    const lib = `Cantine — ${moisLabel(mois)}`;
    if (!(await confirmer(`Générer la facture « ${lib} » pour ${mensuels.length} abonné(s) mensuel(s) ?`))) return;
    try {
      const r = await facturerAbonnements(ecoleId, annee?.id, mensuels.map((a) => ({ eleve_id: a.eleve_id, libelle: lib, montant: a.tarif })));
      toast.succes(`${r.crees} facture(s) créée(s)${r.ignores ? ` · ${r.ignores} déjà facturé(s)` : ""}.`);
    } catch (e) { toast.erreur(e.message); }
  }

  return (
    <>
      <EnTete titre="Cantine" sousTitre="Abonnements, repas et menu" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Kpi label="Abonnés" valeur={String(actifs.length)} />
          <Kpi label="Prépayé (solde total)" valeur={`${fmt(totalSolde)} ${devise}`} />
          <Kpi label="Mensuel / Prépayé" valeur={`${actifs.filter((a) => a.formule === "mensuel").length} / ${actifs.filter((a) => a.formule === "prepaye").length}`} />
        </div>

        <Onglets actif={onglet} onChange={setOnglet}
          items={[["abonnes", "Abonnés"], ["pointage", "Pointage du jour"], ["menu", "Menu"]]} />

        {onglet === "abonnes" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <Champ label="Mois à facturer" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
                <Bouton variante="fantome" onClick={facturer}>Facturer le mois</Bouton>
              </div>
              <Bouton onClick={() => setModale({})}>+ Nouvel abonné</Bouton>
            </div>
            {abonnes.length === 0 ? (
              <EtatVide icone="🍽️" titre="Aucun abonné"
                action={<Bouton onClick={() => setModale({})}>+ Nouvel abonné</Bouton>}>
                Inscrivez un élève à la cantine (formule mensuelle ou prépayée).
              </EtatVide>
            ) : (
              <Carte className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-creme text-navy-900/50">
                    <tr><th className="px-5 py-3 font-medium">Élève</th><th className="px-5 py-3 font-medium">Classe</th><th className="px-5 py-3 font-medium">Formule</th><th className="px-5 py-3 font-medium">Régime</th><th className="px-5 py-3 font-medium">Tarif / Solde</th><th className="px-5 py-3"></th></tr>
                  </thead>
                  <tbody>
                    {abonnes.map((a) => (
                      <tr key={a.id} className="border-t border-navy-900/5">
                        <td className="px-5 py-3 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}{!a.actif && <span className="ml-2 text-xs text-navy-900/40">(inactif)</span>}</td>
                        <td className="px-5 py-3 text-navy-900/60">{classe(a.eleve_id)}</td>
                        <td className="px-5 py-3">{a.formule === "prepaye" ? "Prépayé" : "Mensuel"}</td>
                        <td className="px-5 py-3 text-xs text-navy-900/60">{a.regime || "—"}</td>
                        <td className="px-5 py-3 font-mono text-navy-900/70">
                          {a.formule === "prepaye" ? `solde ${fmt(a.solde)} ${devise}` : `${fmt(a.tarif)} ${devise}/mois`}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {a.formule === "prepaye" && (
                            <button onClick={() => setRecharge(a)} className="text-xs text-emerald-700 hover:underline">+ recharger</button>
                          )}
                          <button onClick={() => setModale(a)} className="ml-3 text-xs text-navy-700 hover:text-or-500">modifier</button>
                          <button onClick={async () => { if (await confirmer("Supprimer cet abonné ?")) wrap(() => api.supprimerAbonnement(a.id), "Abonné supprimé."); }}
                            className="ml-3 text-xs text-rose-500 hover:underline">suppr.</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Carte>
            )}
          </>
        )}

        {onglet === "pointage" && <Pointage ecoleId={ecoleId} abonnes={actifs} classe={classe} devise={devise} toast={toast} />}
        {onglet === "menu" && <Menu ecoleId={ecoleId} toast={toast} />}
      </div>

      <ModaleAbonne ouvert={!!modale} abo={modale} eleves={eleves} abonnes={abonnes} classe={classe} devise={devise}
        onFermer={() => setModale(null)}
        onValider={(a) => wrap(async () => { await api.enregistrerAbonnement(ecoleId, a); setModale(null); }, "Abonné enregistré.")} />

      <ModaleRecharge abo={recharge} devise={devise} onFermer={() => setRecharge(null)}
        onValider={(m) => wrap(async () => { await api.rechargerSolde(recharge.id, recharge.solde, m); setRecharge(null); }, "Solde rechargé.")} />
    </>
  );
}

function ModaleRecharge({ abo, devise, onFermer, onValider }) {
  const [montant, setMontant] = useState("");
  useEffect(() => { setMontant(""); }, [abo]);
  if (!abo) return null;
  return (
    <Modale ouvert={!!abo} onFermer={onFermer} titre="Recharger le solde">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!Number(montant)) return; onValider(Number(montant)); }}>
        <p className="text-sm text-navy-900/60">{abo.eleves?.prenom} {abo.eleves?.nom} — solde actuel <b>{fmt(abo.solde)} {devise}</b></p>
        <Champ label={`Montant à ajouter (${devise})`} type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!Number(montant)}>Recharger</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function Kpi({ label, valeur }) {
  return <Carte className="p-4"><p className="text-xs text-navy-900/50">{label}</p><p className="mt-1 font-display text-xl font-bold text-navy-900">{valeur}</p></Carte>;
}

function Pointage({ ecoleId, abonnes, classe, devise, toast }) {
  const [date, setDate] = useState(auj());
  const [pris, setPris] = useState(new Set());
  const recharger = useCallback(async () => { try { setPris(await api.getRepas(ecoleId, date)); } catch { /* */ } }, [ecoleId, date]);
  useEffect(() => { recharger(); }, [recharger]);

  async function basculer(a) {
    try {
      if (pris.has(a.eleve_id)) { await api.annulerRepas(ecoleId, a, date); }
      else { await api.marquerRepas(ecoleId, a, date); }
      await recharger();
    } catch (e) { toast.erreur(e.message); }
  }

  if (abonnes.length === 0) return <EtatVide icone="✅" titre="Aucun abonné actif">Ajoutez des abonnés pour pointer les repas.</EtatVide>;
  return (
    <Carte className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-navy-900/10 p-4">
        <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="text-sm text-navy-900/60">Repas servis : <b>{[...pris].filter((id) => abonnes.some((a) => a.eleve_id === id)).length} / {abonnes.length}</b></p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50"><tr><th className="px-5 py-2 font-medium">Élève</th><th className="px-5 py-2 font-medium">Classe</th><th className="px-5 py-2 font-medium">Formule</th><th className="px-5 py-2 text-center font-medium">A mangé</th></tr></thead>
        <tbody>
          {abonnes.map((a) => (
            <tr key={a.id} className="border-t border-navy-900/5">
              <td className="px-5 py-2.5 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}</td>
              <td className="px-5 py-2.5 text-navy-900/60">{classe(a.eleve_id)}</td>
              <td className="px-5 py-2.5 text-xs text-navy-900/60">{a.formule === "prepaye" ? `prépayé (${fmt(a.tarif)} ${devise}, solde ${fmt(a.solde)})` : "mensuel"}</td>
              <td className="px-5 py-2.5 text-center">
                <button onClick={() => basculer(a)} aria-label="A mangé"
                  className={`grid h-6 w-6 place-items-center rounded-md border-2 ${pris.has(a.eleve_id) ? "border-or-500 bg-or-500 text-navy-900" : "border-navy-900/20 text-transparent"}`}>✓</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Carte>
  );
}

function Menu({ ecoleId, toast }) {
  const [semaine, setSemaine] = useState(lundiDe(auj()));
  const [plats, setPlats] = useState({});
  const recharger = useCallback(async () => { try { setPlats(await api.getMenu(ecoleId, semaine)); } catch { /* */ } }, [ecoleId, semaine]);
  useEffect(() => { recharger(); }, [recharger]);

  async function sauver(jour, valeur) {
    try { await api.setMenuJour(ecoleId, semaine, jour, valeur); toast.succes("Menu enregistré."); }
    catch (e) { toast.erreur(e.message); }
  }

  return (
    <Carte className="p-6">
      <div className="mb-4 max-w-xs">
        <Champ label="Semaine (lundi)" type="date" value={semaine} onChange={(e) => setSemaine(lundiDe(e.target.value))} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {JOURS.map(([j, lib]) => (
          <div key={j} className="rounded-xl border border-navy-900/10">
            <div className="border-b border-navy-900/10 bg-creme px-3 py-2 text-sm font-semibold text-navy-900">{lib}</div>
            <textarea defaultValue={plats[j] || ""} onBlur={(e) => sauver(j, e.target.value)} rows={3} placeholder="Plats…"
              className="w-full resize-none rounded-b-xl border-0 bg-white p-3 text-sm outline-none focus:ring-1 focus:ring-or-500" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy-900/40">Le menu s'enregistre automatiquement en quittant une case.</p>
    </Carte>
  );
}

function ModaleAbonne({ ouvert, abo, eleves, abonnes, classe, devise, onFermer, onValider }) {
  const [f, setF] = useState({});
  useEffect(() => {
    setF(abo?.id
      ? { id: abo.id, eleve_id: abo.eleve_id, formule: abo.formule, tarif: String(abo.tarif ?? ""), regime: abo.regime || "", actif: abo.actif, solde: String(abo.solde ?? "") }
      : { eleve_id: "", formule: "mensuel", tarif: "", regime: "", actif: true, solde: "" });
  }, [abo, ouvert]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const dejaAbo = new Set(abonnes.filter((a) => a.id !== abo?.id).map((a) => a.eleve_id));
  const dispo = eleves.filter((e) => !dejaAbo.has(e.id));

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={abo?.id ? "Modifier l'abonné" : "Nouvel abonné cantine"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.eleve_id) return; onValider(f); }}>
        {abo?.id ? (
          <p className="text-sm font-medium text-navy-900">{abo.eleves?.prenom} {abo.eleves?.nom} <span className="text-navy-900/50">· {classe(abo.eleve_id)}</span></p>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élève *</span>
            <select value={f.eleve_id} onChange={(e) => maj("eleve_id", e.target.value)} required
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {dispo.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.matricule || classe(e.id)}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Formule</span>
            <select value={f.formule} onChange={(e) => maj("formule", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="mensuel">Mensuel</option>
              <option value="prepaye">Prépayé (au repas)</option>
            </select>
          </label>
          <Champ label={f.formule === "prepaye" ? `Prix du repas (${devise})` : `Tarif mensuel (${devise})`} type="number"
            value={f.tarif} onChange={(e) => maj("tarif", e.target.value)} />
        </div>
        {!abo?.id && f.formule === "prepaye" && (
          <Champ label={`Solde initial (${devise})`} type="number" value={f.solde} onChange={(e) => maj("solde", e.target.value)} />
        )}
        <Champ label="Régime / allergies" value={f.regime} onChange={(e) => maj("regime", e.target.value)} placeholder="ex. sans porc, allergie arachide" />
        <label className="flex items-center gap-2 text-sm text-navy-900/70">
          <input type="checkbox" checked={!!f.actif} onChange={(e) => maj("actif", e.target.checked)} /> Abonnement actif
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.eleve_id}>Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}
