import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, Modale } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import Cachet from "@/composants/Cachet.jsx";
import SceauVerification from "@/composants/SceauVerification.jsx";
import { codeReleve } from "@/lib/verification.js";
import * as api from "@/lib/superieur.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { resultatUE, resultatSemestre } from "@/lib/lmd.js";

const NIVEAUX = ["L1", "L2", "L3", "M1", "M2"];
const nomEleve = (x) => (x?.eleves ? `${x.eleves.nom} ${x.eleves.prenom}` : "—");
const arr2 = (n) => (n == null ? "—" : Number(n).toFixed(2));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const cleNote = (inscId, ueId, ecueId) => `${inscId}|${ueId}|${ecueId || "ue"}`;
const libSession = (s) => (s === "rattrapage" ? "Rattrapage" : "Session normale");

export default function Deliberations() {
  const { ecoleId, ecole, typeEtablissement } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();

  const [annee, setAnnee] = useState(null);
  const [cfg, setCfg] = useState(api.LMD_CONFIG_DEFAUT);
  const [filieres, setFilieres] = useState([]);
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("L1");
  const [semestres, setSemestres] = useState([]);
  const [semestreId, setSemestreId] = useState("");
  const [session, setSession] = useState("normale");

  const [maquette, setMaquette] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [notes, setNotes] = useState([]);
  const [delibs, setDelibs] = useState([]);
  const [delibSel, setDelibSel] = useState(null);
  const [releves, setReleves] = useState([]);
  const [releveDoc, setReleveDoc] = useState(null); // relevé à imprimer
  const [pvOuvert, setPvOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    api.getLmdConfig(ecoleId).then(setCfg).catch(() => {});
    api.getFilieres(ecoleId).then(setFilieres).catch((e) => setErreur(e.message));
  }, [ecoleId]);

  useEffect(() => { if (filiereId) api.getSemestres(ecoleId, filiereId).then(setSemestres).catch((e) => setErreur(e.message)); else setSemestres([]); }, [ecoleId, filiereId]);
  useEffect(() => { if (semestreId) api.getMaquette(ecoleId, semestreId).then(setMaquette).catch((e) => setErreur(e.message)); else setMaquette([]); }, [ecoleId, semestreId]);
  useEffect(() => { if (filiereId) api.getInscriptions(ecoleId, { anneeId: annee?.id, filiereId, niveau: niveau || undefined }).then(setEtudiants).catch((e) => setErreur(e.message)); else setEtudiants([]); }, [ecoleId, annee?.id, filiereId, niveau]);

  const ueIds = useMemo(() => maquette.map((u) => u.id), [maquette]);
  useEffect(() => { if (ueIds.length) api.getNotesLMD(ecoleId, ueIds, session).then(setNotes).catch((e) => setErreur(e.message)); else setNotes([]); }, [ecoleId, ueIds, session]);

  const rechargerDelibs = useCallback(() => {
    if (!filiereId || !semestreId) { setDelibs([]); return; }
    api.getDeliberations(ecoleId, { filiereId, niveau: niveau || undefined, semestreId, session, anneeId: annee?.id })
      .then(setDelibs).catch((e) => setErreur(e.message));
  }, [ecoleId, filiereId, niveau, semestreId, session, annee?.id]);
  useEffect(() => { rechargerDelibs(); setDelibSel(null); setReleves([]); }, [rechargerDelibs]);

  const index = useMemo(() => {
    const m = {};
    for (const n of notes) m[cleNote(n.inscription_id, n.ue_id, n.ecue_id)] = { cc: n.cc, examen: n.examen };
    return m;
  }, [notes]);

  // Résultats calculés (moteur) pour la cohorte.
  const resultats = useMemo(() => etudiants.map((insc) => {
    const choisies = new Set((insc.inscriptions_ue || []).map((x) => x.ue_id));
    const resUE = maquette.filter((u) => choisies.has(u.id)).map((u) => {
      const mapNotes = { ue: index[cleNote(insc.id, u.id, null)] || {} };
      for (const ec of u.ecues || []) mapNotes[ec.id] = index[cleNote(insc.id, u.id, ec.id)] || {};
      const r = resultatUE(u, u.ecues, mapNotes, cfg);
      return { ...r, code: u.code || null };
    });
    return { insc, resUE, sem: resultatSemestre(resUE, cfg) };
  }), [etudiants, maquette, index, cfg]);

  async function arreter() {
    if (resultats.length === 0) return;
    if (!(await confirmer("Arrêter les résultats et générer les relevés ? Une délibération non verrouillée existante sera remplacée."))) return;
    setBusy(true); setErreur("");
    try {
      const rows = resultats.map(({ insc, resUE, sem }) => ({
        inscription_id: insc.id, eleve_id: insc.eleve_id,
        moyenne: sem.moyenne, credits_acquis: sem.creditsAcquis, credits_total: sem.creditsTotal,
        decision: sem.decision, mention: sem.mention, valide: sem.valide,
        details: resUE.map((r) => ({ code: r.code, intitule: r.intitule, moyenne: r.moyenne, credits: r.credits, acquise: r.acquise })),
      }));
      await api.arreterResultats(ecoleId, { filiereId, niveau, semestreId, session, anneeId: annee?.id }, rows);
      toast.succes("Délibération enregistrée — relevés générés.");
      rechargerDelibs();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
    finally { setBusy(false); }
  }

  async function ouvrirDelib(d) {
    setDelibSel(d);
    try { setReleves(await api.getReleves(d.id)); }
    catch (e) { setErreur(e.message); }
  }
  async function verrouiller(d) {
    try { await api.verrouillerDeliberation(d.id, !d.verrouillee); rechargerDelibs(); if (delibSel?.id === d.id) setDelibSel({ ...d, verrouillee: !d.verrouillee }); }
    catch (e) { toast.erreur(e.message); }
  }
  async function supprimerDelib(d) {
    if (!(await confirmer("Supprimer cette délibération et ses relevés ?"))) return;
    try { await api.supprimerDeliberation(d.id); toast.succes("Supprimée."); if (delibSel?.id === d.id) { setDelibSel(null); setReleves([]); } rechargerDelibs(); }
    catch (e) { toast.erreur(e.message); }
  }

  const semestre = semestres.find((s) => s.id === semestreId);
  const pret = filiereId && semestreId;
  const filiere = filieres.find((f) => f.id === filiereId);

  return (
    <>
      <EnTete titre="Délibérations & relevés" sousTitre={`Arrêté des résultats et relevés de notes${annee?.libelle ? ` · ${annee.libelle}` : ""}`} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {typeEtablissement !== "superieur" && <Alerte ton="info">Établissement non « Supérieur ». Activez-le dans Paramètres → Établissement.</Alerte>}

        <Carte className="flex flex-wrap items-end gap-3 p-4 no-print">
          <Sel label="Filière" value={filiereId} onChange={(v) => { setFiliereId(v); setSemestreId(""); }} options={[["", "— Choisir —"], ...filieres.map((f) => [f.id, f.nom])]} />
          <Sel label="Niveau" value={niveau} onChange={setNiveau} options={NIVEAUX.map((n) => [n, n])} />
          <Sel label="Semestre" value={semestreId} onChange={setSemestreId} options={[["", semestres.length ? "— Choisir —" : "aucun"], ...semestres.map((s) => [s.id, s.libelle])]} />
          <Sel label="Session" value={session} onChange={setSession} options={api.SESSIONS} />
        </Carte>

        {!pret ? (
          <EtatVide icone="⚖️" titre="Choisissez une filière et un semestre">Les résultats à délibérer s'affichent ensuite.</EtatVide>
        ) : (
          <>
            {/* Résultats calculés + arrêté */}
            <Carte className="p-5 no-print">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-navy-900">Résultats calculés — {resultats.length} étudiant{resultats.length > 1 ? "s" : ""}</h3>
                <Bouton onClick={arreter} disabled={busy || resultats.length === 0}>{busy ? "…" : "⚖️ Arrêter les résultats & générer les relevés"}</Bouton>
              </div>
              {resultats.length === 0 ? (
                <EtatVide icone="📝" titre="Aucun étudiant">Inscrivez des étudiants (page « Inscriptions »).</EtatVide>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-navy-900/15 text-navy-900/50">
                      <tr><th className="py-2 font-medium">Étudiant</th><th className="px-2 py-2 text-center font-medium">Moy.</th><th className="px-2 py-2 text-center font-medium">Crédits</th><th className="px-2 py-2 font-medium">Décision</th><th className="px-2 py-2 font-medium">Mention</th></tr>
                    </thead>
                    <tbody>
                      {resultats.map(({ insc, sem }) => (
                        <tr key={insc.id} className="border-b border-navy-900/5">
                          <td className="py-2 font-medium text-navy-900">{nomEleve(insc)}</td>
                          <td className="px-2 py-2 text-center font-mono font-semibold">{arr2(sem.moyenne)}</td>
                          <td className="px-2 py-2 text-center font-mono">{sem.creditsAcquis}/{sem.creditsTotal}</td>
                          <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sem.valide ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{sem.decision}</span></td>
                          <td className="px-2 py-2 text-navy-900/70">{sem.mention || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Carte>

            {/* Délibérations enregistrées */}
            {delibs.length > 0 && (
              <Carte className="p-5 no-print">
                <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Délibérations enregistrées</h3>
                <div className="space-y-2">
                  {delibs.map((d) => (
                    <div key={d.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${delibSel?.id === d.id ? "border-or-500" : "border-navy-900/10"}`}>
                      <div className="text-sm">
                        <span className="font-medium text-navy-900">{dateFr(d.date_delib)}</span>
                        <span className="ml-2 text-navy-900/50">{libSession(d.session)}</span>
                        {d.verrouillee && <span className="ml-2 rounded-full bg-navy-900/10 px-2 py-0.5 text-xs text-navy-900/60">🔒 verrouillée</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <button onClick={() => ouvrirDelib(d)} className="font-medium text-navy-700 hover:text-or-600">ouvrir</button>
                        <button onClick={() => verrouiller(d)} className="text-navy-900/50 hover:text-navy-900">{d.verrouillee ? "déverrouiller" : "verrouiller"}</button>
                        {!d.verrouillee && <button onClick={() => supprimerDelib(d)} className="text-rose-500 hover:underline">suppr.</button>}
                      </div>
                    </div>
                  ))}
                </div>

                {delibSel && (
                  <div className="mt-4 border-t border-navy-900/10 pt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy-900/70">Relevés — {releves.length} étudiant{releves.length > 1 ? "s" : ""}</p>
                      <Bouton variante="fantome" onClick={() => setPvOuvert(true)} disabled={releves.length === 0}>🖨️ PV de délibération</Bouton>
                    </div>
                    <ul className="space-y-1.5">
                      {releves.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
                          <span className="font-medium text-navy-900">{nomEleve(r)}</span>
                          <span className="flex items-center gap-3">
                            <span className="font-mono text-navy-900/60">{arr2(r.moyenne)} · {r.credits_acquis}/{r.credits_total} cr.</span>
                            <span className={r.valide ? "text-emerald-700" : "text-rose-600"}>{r.decision}</span>
                            <button onClick={() => setReleveDoc({ releve: r, delib: delibSel })} className="font-medium text-navy-700 hover:text-or-600">relevé</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Carte>
            )}
          </>
        )}
      </div>

      {/* Relevé imprimable (avec QR) */}
      <Modale ouvert={!!releveDoc} onFermer={() => setReleveDoc(null)} titre="Relevé de notes" large>
        {releveDoc && (
          <>
            <ReleveImprimable ecole={ecole} filiere={filiere} semestre={semestre} niveau={niveau} annee={annee} releve={releveDoc.releve} delib={releveDoc.delib} />
            <div className="no-print mt-4 flex justify-end gap-2">
              <Bouton variante="fantome" onClick={() => setReleveDoc(null)}>Fermer</Bouton>
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>

      {/* PV de délibération imprimable */}
      <Modale ouvert={pvOuvert} onFermer={() => setPvOuvert(false)} titre="PV de délibération" large>
        <PVImprimable ecole={ecole} filiere={filiere} semestre={semestre} niveau={niveau} annee={annee} delib={delibSel} releves={releves} />
        <div className="no-print mt-4 flex justify-end gap-2">
          <Bouton variante="fantome" onClick={() => setPvOuvert(false)}>Fermer</Bouton>
          <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
        </div>
      </Modale>
    </>
  );
}

function EnTeteEcole({ ecole }) {
  return (
    <div className="flex items-center gap-3 border-b border-navy-900/10 pb-4">
      {ecole?.logo_url ? <img src={ecole.logo_url} alt="" className="h-12 w-12 object-contain" /> : <Cachet size={48} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
      <div>
        <p className="font-display text-lg font-bold text-navy-900">{ecole?.nom}</p>
        <p className="text-xs text-navy-900/50">{[ecole?.adresse, ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

function ReleveImprimable({ ecole, filiere, semestre, niveau, annee, releve, delib }) {
  const lignes = Array.isArray(releve.details) ? releve.details : [];
  return (
    <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-8 text-navy-900">
      <EnTeteEcole ecole={ecole} />
      <h1 className="mt-5 text-center font-display text-xl font-bold uppercase tracking-wide">Relevé de notes</h1>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p><span className="text-navy-900/50">Étudiant :</span> <b>{nomEleve(releve)}</b></p>
        <p><span className="text-navy-900/50">Matricule :</span> {releve.eleves?.matricule || "—"}</p>
        <p><span className="text-navy-900/50">Filière :</span> {filiere?.nom || "—"}</p>
        <p><span className="text-navy-900/50">Niveau :</span> {niveau || delib?.niveau || "—"}</p>
        <p><span className="text-navy-900/50">Semestre :</span> {semestre?.libelle || "—"}</p>
        <p><span className="text-navy-900/50">Session :</span> {libSession(delib?.session)}{annee?.libelle ? ` · ${annee.libelle}` : ""}</p>
      </div>

      <table className="mt-5 w-full text-left text-sm">
        <thead className="border-b border-navy-900/15 text-navy-900/50">
          <tr><th className="py-2 font-medium">Unité d'enseignement</th><th className="py-2 text-center font-medium">Moyenne</th><th className="py-2 text-center font-medium">Crédits</th><th className="py-2 text-center font-medium">Résultat</th></tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-navy-900/5">
              <td className="py-2">{l.code ? <span className="mr-2 font-mono text-xs text-navy-900/40">{l.code}</span> : null}{l.intitule}</td>
              <td className="py-2 text-center font-mono">{arr2(l.moyenne)}</td>
              <td className="py-2 text-center font-mono">{Number(l.credits)}</td>
              <td className="py-2 text-center">{l.acquise ? <span className="text-emerald-700">Acquise</span> : <span className="text-rose-600">Non acquise</span>}</td>
            </tr>
          ))}
          {lignes.length === 0 && <tr><td colSpan={4} className="py-3 text-navy-900/40">—</td></tr>}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-navy-900 p-4 text-creme"><p className="text-xs text-creme/60">Moyenne générale</p><p className="font-display text-2xl font-bold">{arr2(releve.moyenne)}<span className="text-sm font-normal">/20</span></p></div>
        <div className="rounded-xl bg-or-500 p-4 text-navy-900"><p className="text-xs text-navy-900/60">Crédits acquis</p><p className="font-display text-2xl font-bold">{releve.credits_acquis}<span className="text-sm font-normal">/{releve.credits_total}</span></p></div>
        <div className="rounded-xl border border-navy-900/15 p-4"><p className="text-xs text-navy-900/50">Décision · Mention</p><p className="font-display text-lg font-bold text-navy-900">{releve.decision}</p><p className="text-sm text-navy-900/60">{releve.mention || "—"}</p></div>
      </div>

      <div className="mt-8 flex items-end justify-between text-xs text-navy-900/50">
        <span>Fait à {ecole?.ville || "—"}, le {dateFr(delib?.date_delib)}</span>
        <span className="text-right">Le Chef d'établissement<br /><br />Signature &amp; cachet</span>
      </div>
      <SceauVerification code={codeReleve(releve.id)} reference={semestre?.libelle} />
    </div>
  );
}

function PVImprimable({ ecole, filiere, semestre, niveau, annee, delib, releves }) {
  const admis = releves.filter((r) => r.valide).length;
  return (
    <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-8 text-navy-900">
      <EnTeteEcole ecole={ecole} />
      <h1 className="mt-5 text-center font-display text-xl font-bold uppercase tracking-wide">Procès-verbal de délibération</h1>
      <p className="mt-1 text-center text-sm text-navy-900/60">
        {filiere?.nom} · {niveau || delib?.niveau} · {semestre?.libelle} · {libSession(delib?.session)}{annee?.libelle ? ` · ${annee.libelle}` : ""} — {dateFr(delib?.date_delib)}
      </p>
      <p className="mt-1 text-center text-xs text-navy-900/50">{releves.length} étudiant(s) · {admis} admis</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-navy-900/25 text-navy-900/60">
            <th className="px-2 py-2 text-left">N°</th><th className="px-2 py-2 text-left">Étudiant</th>
            <th className="px-2 py-2 text-right">Moyenne</th><th className="px-2 py-2 text-center">Crédits</th>
            <th className="px-2 py-2 text-left">Décision</th><th className="px-2 py-2 text-left">Mention</th>
          </tr>
        </thead>
        <tbody>
          {releves.map((r, i) => (
            <tr key={r.id} className="border-b border-navy-900/10">
              <td className="px-2 py-1.5">{i + 1}</td>
              <td className="px-2 py-1.5 font-medium">{nomEleve(r)}</td>
              <td className="px-2 py-1.5 text-right font-mono">{arr2(r.moyenne)}</td>
              <td className="px-2 py-1.5 text-center font-mono">{r.credits_acquis}/{r.credits_total}</td>
              <td className="px-2 py-1.5">{r.decision}</td>
              <td className="px-2 py-1.5">{r.mention || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-12 flex justify-between text-sm">
        <div>Le Président du jury<br /><span className="text-navy-900/30">_____________________</span></div>
        <div className="text-right">Les membres<br /><br /><span className="text-navy-900/30">_____________________</span></div>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
