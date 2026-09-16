import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/superieur.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { resultatUE, resultatSemestre } from "@/lib/lmd.js";

const NIVEAUX = ["L1", "L2", "L3", "M1", "M2"];
const nomEleve = (i) => (i?.eleves ? `${i.eleves.nom} ${i.eleves.prenom}` : "—");
const arr2 = (n) => (n == null ? "—" : Number(n).toFixed(2));
const cleNote = (inscId, ueId, ecueId) => `${inscId}|${ueId}|${ecueId || "ue"}`;

export default function NotesLMD() {
  const { ecoleId, typeEtablissement } = useAuth();
  const toast = useToast();

  const [annee, setAnnee] = useState(null);
  const [cfg, setCfg] = useState(api.LMD_CONFIG_DEFAUT);
  const [filieres, setFilieres] = useState([]);
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("L1");
  const [semestres, setSemestres] = useState([]);
  const [semestreId, setSemestreId] = useState("");
  const [session, setSession] = useState("normale");

  const [maquette, setMaquette] = useState([]);   // UE (avec .ecues) du semestre
  const [etudiants, setEtudiants] = useState([]); // inscriptions (avec inscriptions_ue)
  const [notes, setNotes] = useState([]);         // notes_lmd de la session
  const [onglet, setOnglet] = useState("saisie");
  const [erreur, setErreur] = useState("");

  // Saisie
  const [ueSelId, setUeSelId] = useState("");
  const [ecueSelId, setEcueSelId] = useState("");   // "" = niveau UE
  const [saisie, setSaisie] = useState({});          // inscription_id -> {cc, examen}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    api.getLmdConfig(ecoleId).then(setCfg).catch(() => {});
    api.getFilieres(ecoleId).then(setFilieres).catch((e) => setErreur(e.message));
  }, [ecoleId]);

  useEffect(() => {
    if (!filiereId) { setSemestres([]); return; }
    api.getSemestres(ecoleId, filiereId).then(setSemestres).catch((e) => setErreur(e.message));
  }, [ecoleId, filiereId]);

  useEffect(() => {
    if (!semestreId) { setMaquette([]); return; }
    api.getMaquette(ecoleId, semestreId).then(setMaquette).catch((e) => setErreur(e.message));
  }, [ecoleId, semestreId]);

  useEffect(() => {
    if (!filiereId) { setEtudiants([]); return; }
    api.getInscriptions(ecoleId, { anneeId: annee?.id, filiereId, niveau: niveau || undefined })
      .then(setEtudiants).catch((e) => setErreur(e.message));
  }, [ecoleId, annee?.id, filiereId, niveau]);

  const ueIds = useMemo(() => maquette.map((u) => u.id), [maquette]);
  const rechargerNotes = useCallback(() => {
    if (ueIds.length === 0) { setNotes([]); return; }
    api.getNotesLMD(ecoleId, ueIds, session).then(setNotes).catch((e) => setErreur(e.message));
  }, [ecoleId, ueIds, session]);
  useEffect(() => { rechargerNotes(); }, [rechargerNotes]);

  // Index des notes : clé (inscription|ue|ecue) -> {cc, examen}
  const index = useMemo(() => {
    const m = {};
    for (const n of notes) m[cleNote(n.inscription_id, n.ue_id, n.ecue_id)] = { cc: n.cc, examen: n.examen };
    return m;
  }, [notes]);

  const ueSel = maquette.find((u) => u.id === ueSelId);
  // Étudiants inscrits à l'UE sélectionnée (via leur inscription pédagogique).
  const inscritsUE = useMemo(
    () => (ueSel ? etudiants.filter((i) => (i.inscriptions_ue || []).some((x) => x.ue_id === ueSel.id)) : []),
    [etudiants, ueSel]
  );

  // (Ré)initialise la grille de saisie à partir des notes existantes.
  useEffect(() => {
    if (!ueSel) { setSaisie({}); return; }
    const ecueId = ecueSelId || null;
    const init = {};
    for (const i of inscritsUE) {
      const n = index[cleNote(i.id, ueSel.id, ecueId)] || {};
      init[i.id] = { cc: n.cc ?? "", examen: n.examen ?? "" };
    }
    setSaisie(init);
  }, [ueSel, ecueSelId, inscritsUE, index]);

  const majSaisie = (inscId, champ, val) =>
    setSaisie((s) => ({ ...s, [inscId]: { ...s[inscId], [champ]: val } }));

  async function enregistrer() {
    if (!ueSel) return;
    setBusy(true); setErreur("");
    try {
      const rows = inscritsUE.map((i) => ({ inscription_id: i.id, cc: saisie[i.id]?.cc, examen: saisie[i.id]?.examen }));
      await api.enregistrerNotesUE(ecoleId, ueSel.id, ecueSelId || null, session, rows);
      toast.succes("Notes enregistrées.");
      rechargerNotes();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
    finally { setBusy(false); }
  }

  // --- Résultats calculés (moteur LMD) ---
  const resultats = useMemo(() => {
    if (onglet !== "resultats") return [];
    return etudiants.map((insc) => {
      const ueChoisies = new Set((insc.inscriptions_ue || []).map((x) => x.ue_id));
      const resUE = maquette.filter((u) => ueChoisies.has(u.id)).map((u) => {
        const mapNotes = { ue: index[cleNote(insc.id, u.id, null)] || {} };
        for (const ec of u.ecues || []) mapNotes[ec.id] = index[cleNote(insc.id, u.id, ec.id)] || {};
        return resultatUE(u, u.ecues, mapNotes, cfg);
      });
      return { insc, resUE, sem: resultatSemestre(resUE, cfg) };
    });
  }, [onglet, etudiants, maquette, index, cfg]);

  const pret = filiereId && semestreId;

  return (
    <>
      <EnTete titre="Notes (LMD)" sousTitre={`Saisie & résultats — capitalisation et compensation${annee?.libelle ? ` · ${annee.libelle}` : ""}`} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {typeEtablissement !== "superieur" && (
          <Alerte ton="info">Établissement non « Supérieur ». Activez-le dans Paramètres → Établissement.</Alerte>
        )}

        {/* Sélecteurs */}
        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <Sel label="Filière" value={filiereId} onChange={(v) => { setFiliereId(v); setSemestreId(""); setUeSelId(""); }}
            options={[["", "— Choisir —"], ...filieres.map((f) => [f.id, f.nom])]} />
          <Sel label="Niveau" value={niveau} onChange={setNiveau} options={NIVEAUX.map((n) => [n, n])} />
          <Sel label="Semestre" value={semestreId} onChange={(v) => { setSemestreId(v); setUeSelId(""); }}
            options={[["", semestres.length ? "— Choisir —" : "aucun"], ...semestres.map((s) => [s.id, s.libelle])]} />
          <Sel label="Session" value={session} onChange={setSession} options={api.SESSIONS} />
        </Carte>

        {!pret ? (
          <EtatVide icone="🎓" titre="Choisissez une filière et un semestre">La saisie et les résultats s'affichent ensuite.</EtatVide>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={() => setOnglet("saisie")} className={`rounded-lg px-4 py-2 text-sm font-medium ${onglet === "saisie" ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>Saisie des notes</button>
              <button onClick={() => setOnglet("resultats")} className={`rounded-lg px-4 py-2 text-sm font-medium ${onglet === "resultats" ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>Résultats</button>
            </div>

            {onglet === "saisie" && (
              <Carte className="p-5">
                {maquette.length === 0 ? (
                  <EtatVide icone="📘" titre="Maquette vide">Composez d'abord la maquette dans « Filières &amp; maquettes ».</EtatVide>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-end gap-3">
                      <Sel label="UE" value={ueSelId} onChange={(v) => { setUeSelId(v); setEcueSelId(""); }}
                        options={[["", "— Choisir une UE —"], ...maquette.map((u) => [u.id, `${u.code ? u.code + " · " : ""}${u.intitule}`])]} />
                      {ueSel && (ueSel.ecues?.length > 0) && (
                        <Sel label="Composante" value={ecueSelId} onChange={setEcueSelId}
                          options={ueSel.ecues.map((ec) => [ec.id, `${ec.code ? ec.code + " · " : ""}${ec.intitule}`])} />
                      )}
                      <span className="ml-auto self-center text-xs text-navy-900/45">
                        Note finale = CC × {cfg.cc} + Examen × {cfg.examen}
                      </span>
                    </div>

                    {!ueSel ? (
                      <p className="text-sm text-navy-900/50">Sélectionnez une UE pour saisir les notes.</p>
                    ) : inscritsUE.length === 0 ? (
                      <EtatVide icone="👥" titre="Aucun inscrit">Aucun étudiant n'a cette UE dans son inscription pédagogique.</EtatVide>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-navy-900/15 text-navy-900/50">
                              <tr><th className="py-2 font-medium">Étudiant</th><th className="py-2 text-center font-medium">CC /20</th><th className="py-2 text-center font-medium">Examen /20</th></tr>
                            </thead>
                            <tbody>
                              {inscritsUE.map((i) => (
                                <tr key={i.id} className="border-b border-navy-900/5">
                                  <td className="py-2 font-medium text-navy-900">{nomEleve(i)}</td>
                                  <td className="py-2 text-center"><InputNote value={saisie[i.id]?.cc ?? ""} onChange={(v) => majSaisie(i.id, "cc", v)} /></td>
                                  <td className="py-2 text-center"><InputNote value={saisie[i.id]?.examen ?? ""} onChange={(v) => majSaisie(i.id, "examen", v)} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Bouton onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer les notes"}</Bouton>
                        </div>
                      </>
                    )}
                  </>
                )}
              </Carte>
            )}

            {onglet === "resultats" && (
              <Carte className="p-5">
                {etudiants.length === 0 ? (
                  <EtatVide icone="📝" titre="Aucun étudiant">Inscrivez des étudiants (page « Inscriptions »).</EtatVide>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-navy-900/15 text-navy-900/50">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Étudiant</th>
                          {maquette.map((u) => <th key={u.id} className="px-2 py-2 text-center font-medium" title={u.intitule}>{u.code || u.intitule.slice(0, 8)}</th>)}
                          <th className="px-2 py-2 text-center font-medium">Moy.</th>
                          <th className="px-2 py-2 text-center font-medium">Crédits</th>
                          <th className="px-2 py-2 font-medium">Décision</th>
                          <th className="px-2 py-2 font-medium">Mention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.map(({ insc, resUE, sem }) => {
                          const parUe = Object.fromEntries(resUE.map((r) => [r.ue_id, r]));
                          return (
                            <tr key={insc.id} className="border-b border-navy-900/5">
                              <td className="py-2 pr-3 font-medium text-navy-900">{nomEleve(insc)}</td>
                              {maquette.map((u) => {
                                const r = parUe[u.id];
                                return (
                                  <td key={u.id} className="px-2 py-2 text-center font-mono">
                                    {!r ? <span className="text-navy-900/20">·</span>
                                      : r.moyenne == null ? <span className="text-navy-900/25">—</span>
                                      : <span className={r.acquise ? "text-emerald-700" : "text-rose-600"}>{arr2(r.moyenne)}</span>}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-2 text-center font-mono font-semibold">{arr2(sem.moyenne)}</td>
                              <td className="px-2 py-2 text-center font-mono">{sem.creditsAcquis}/{sem.creditsTotal}</td>
                              <td className="px-2 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sem.valide ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{sem.decision}</span>
                                {sem.parCompensation && <span className="ml-1 text-[10px] text-amber-600">compensation</span>}
                              </td>
                              <td className="px-2 py-2 text-navy-900/70">{sem.mention || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs text-navy-900/45">
                      Vert = UE acquise (≥ {cfg.seuil_ue}) · rouge = non acquise. Semestre validé si moyenne ≥ {cfg.seuil_semestre}
                      (compensation) — sinon seules les UE acquises capitalisent leurs crédits.
                    </p>
                  </div>
                )}
              </Carte>
            )}
          </>
        )}
      </div>
    </>
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

function InputNote({ value, onChange }) {
  return (
    <input type="number" min="0" max="20" step="0.25" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-20 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-or-500" />
  );
}
