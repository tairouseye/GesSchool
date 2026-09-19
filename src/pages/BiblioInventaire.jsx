import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe, Kpi } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/inventaire.js";
import { getBibliotheques, getLocalisations } from "@/lib/bibliotheque.js";
import ScannerCodeBarres, { scanCameraDisponible } from "@/composants/ScannerCodeBarres.jsx";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function BiblioInventaire() {
  const { ecoleId } = useAuth();
  const [campagnes, setCampagnes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [active, setActive] = useState(null);
  const [creation, setCreation] = useState(false);

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setCampagnes(await api.getCampagnes(ecoleId)); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  if (active) {
    return <Campagne campagne={active} onRetour={() => { setActive(null); recharger(); }} />;
  }

  return (
    <>
      <EnTete titre="Inventaire" sousTitre="Récolement : comparer les rayons au catalogue"
        action={<Bouton onClick={() => setCreation(true)}>+ Nouvelle campagne</Bouton>} />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {chargement ? <SkeletonListe lignes={3} /> : campagnes.length === 0 ? (
          <EtatVide icone="📋" titre="Aucune campagne">
            Lancez une campagne pour pointer une salle, un rayon ou l'ensemble du fonds.
          </EtatVide>
        ) : (
          <div className="space-y-2">
            {campagnes.map((c) => (
              <Carte key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <button onClick={() => setActive(c)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-navy-900">{c.libelle}</p>
                  <p className="text-xs text-navy-900/55">
                    {c.biblio_localisations?.libelle || c.biblio_bibliotheques?.nom || "Tout le fonds"}
                    {" · "}ouverte le {dateFr(c.debut)}
                    {c.fin ? ` · clôturée le ${dateFr(c.fin)}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-3">
                  <Badge ton={c.statut === "en_cours" ? "info" : "neutre"}>
                    {c.statut === "en_cours" ? "En cours" : "Clôturée"}
                  </Badge>
                  <button onClick={() => setActive(c)} className="text-xs font-medium text-navy-700 hover:text-or-600">ouvrir</button>
                </div>
              </Carte>
            ))}
          </div>
        )}
      </div>

      {creation && <ModaleCampagne ecoleId={ecoleId} onFermer={() => setCreation(false)}
        onCree={(c) => { setCreation(false); setActive(c); }} />}
    </>
  );
}

function ModaleCampagne({ ecoleId, onFermer, onCree }) {
  const toast = useToast();
  const [f, setF] = useState({ libelle: "", bibliotheque_id: "", localisation_id: "", note: "" });
  const [biblios, setBiblios] = useState([]);
  const [locs, setLocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    getBibliotheques(ecoleId).then(setBiblios).catch(() => setBiblios([]));
    getLocalisations(ecoleId).then(setLocs).catch(() => setLocs([]));
  }, [ecoleId]);

  async function creer(e) {
    e.preventDefault();
    if (!f.libelle.trim()) { toast.erreur("Donnez un nom à la campagne."); return; }
    setBusy(true);
    try {
      const c = await api.creerCampagne(ecoleId, {
        libelle: f.libelle.trim(),
        bibliotheque_id: f.bibliotheque_id || null,
        localisation_id: f.localisation_id || null,
        note: f.note || null,
      });
      toast.succes("Campagne ouverte.");
      onCree(c);
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre="Nouvelle campagne d'inventaire">
      <form onSubmit={creer} className="space-y-4">
        <Champ label="Nom de la campagne" placeholder="Récolement 2026 — salle de lecture"
          value={f.libelle} onChange={maj("libelle")} required />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Bibliothèque</span>
          <select value={f.bibliotheque_id} onChange={maj("bibliotheque_id")}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">Toutes</option>
            {biblios.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Localisation précise</span>
          <select value={f.localisation_id} onChange={maj("localisation_id")}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">Toutes</option>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.libelle}</option>)}
          </select>
          <span className="mt-1 block text-xs text-navy-900/45">
            Le périmètre détermine ce qui sera considéré comme manquant.
          </span>
        </label>

        <Champ label="Note" value={f.note} onChange={maj("note")} />

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Ouvrir la campagne"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// --- Campagne ouverte : poste de scan + rapport -----------------------------
function Campagne({ campagne, onRetour }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const champRef = useRef(null);
  const [code, setCode] = useState("");
  const [journal, setJournal] = useState([]);   // derniers scans, du plus récent au plus ancien
  const [rapport, setRapport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [camera, setCamera] = useState(false);
  const ouverte = campagne.statut === "en_cours";

  const rafraichirRapport = useCallback(async () => {
    try { setRapport(await api.rapport(campagne.id)); }
    catch (e) { setErreur(e.message); }
  }, [campagne.id]);
  useEffect(() => { rafraichirRapport(); }, [rafraichirRapport]);

  // `pointer` doit rester STABLE : le scanner caméra la reçoit en dépendance
  // d'effet, et une nouvelle identité à chaque rendu relancerait la caméra en
  // boucle. D'où le verrou par ref plutôt que par état.
  const enCoursRef = useRef(false);
  const pointer = useCallback(async (valeur) => {
    const c = String(valeur || "").trim();
    if (!c || enCoursRef.current) return;
    enCoursRef.current = true;
    setBusy(true);
    try {
      const r = await api.scanner(campagne.id, c);
      setJournal((j) => [{ ...r, cle: `${Date.now()}-${c}` }, ...j].slice(0, 30));
      setCode("");
      // Le rapport se recalcule en base : on ne le sollicite que si le compte a bougé.
      if (r.resultat === "ok") rafraichirRapport();
    } catch (e) { toast.erreur(e); }
    finally {
      enCoursRef.current = false;
      setBusy(false);
    }
  }, [campagne.id, rafraichirRapport, toast]);

  function scanner() {
    pointer(code);
    champRef.current?.focus();
  }

  async function cloturer() {
    if (!(await confirmer({
      titre: "Clôturer la campagne",
      message: "Plus aucun scan ne sera possible. Le rapport reste consultable.",
      confirmer: "Clôturer", danger: false,
    }))) return;
    try { await api.cloturerCampagne(campagne.id); toast.succes("Campagne clôturée."); onRetour(); }
    catch (e) { toast.erreur(e); }
  }

  const manquants = rapport?.liste_manquants || [];

  return (
    <>
      <EnTete titre={campagne.libelle} sousTitre="Scannez les codes-barres au fil des rayons"
        action={
          <div className="flex gap-2">
            <Bouton variante="fantome" onClick={onRetour}>← Campagnes</Bouton>
            {ouverte && <Bouton onClick={cloturer}>Clôturer</Bouton>}
          </div>
        } />

      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {!ouverte && <Alerte ton="info">Campagne clôturée — le rapport ci-dessous est figé.</Alerte>}

        {/* Compteurs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Attendus au périmètre" valeur={fmt(rapport?.attendus)} chargement={!rapport} />
          <Kpi label="Pointés" valeur={fmt(rapport?.scannes)} chargement={!rapport} ton="vert" />
          <Kpi label="Manquants" valeur={fmt(rapport?.manquants)} chargement={!rapport}
            ton={Number(rapport?.manquants) > 0 ? "rouge" : "vert"}
            sous={`${fmt(rapport?.empruntes)} en prêt (normal)`} />
          <Kpi label="Anomalies de scan" valeur={fmt(Number(rapport?.inconnus || 0) + Number(rapport?.hors_perimetre || 0))}
            chargement={!rapport} ton="or"
            sous={`${fmt(rapport?.inconnus)} inconnus · ${fmt(rapport?.hors_perimetre)} hors périmètre`} />
        </div>

        {/* Poste de scan */}
        {ouverte && (
          <Carte className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              <input ref={champRef} value={code} onChange={(e) => setCode(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scanner(); } }}
                placeholder="Scanner ou saisir le code-barres, puis Entrée"
                className="min-w-56 flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-or-500" />
              <Bouton onClick={scanner} disabled={busy}>{busy ? "…" : "Pointer"}</Bouton>
              {scanCameraDisponible() && (
                <Bouton variante="fantome" onClick={() => setCamera(true)}>📷 Caméra</Bouton>
              )}
            </div>

            {journal.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-auto">
                {journal.map((s) => {
                  const r = api.RESULTATS_SCAN[s.resultat] || { label: s.resultat, ton: "neutre" };
                  return (
                    <li key={s.cle} className="flex items-center justify-between gap-3 rounded-lg border border-navy-900/10 px-3 py-1.5 text-sm">
                      <span className="min-w-0 truncate text-navy-900">
                        <span className="mr-2 font-mono text-xs text-navy-900/45">{s.code_barres}</span>
                        {s.titre || "—"}
                        {s.cote ? <span className="ml-2 font-mono text-xs text-navy-900/40">{s.cote}</span> : null}
                      </span>
                      <Badge ton={r.ton}>{r.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        )}

        {/* Manquants */}
        <Carte className="p-5">
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">
            À rechercher en rayon
            {manquants.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/50">({manquants.length} premiers)</span>}
          </h3>
          {!rapport ? <SkeletonListe lignes={3} /> : manquants.length === 0 ? (
            <p className="text-sm text-navy-900/50">
              {Number(rapport.attendus) === 0
                ? "Aucun exemplaire dans ce périmètre."
                : "Aucun manquant : tout le périmètre pointé est au complet."}
            </p>
          ) : (
            <ul className="space-y-1">
              {manquants.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy-900/10 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-navy-900">{m.titre || "Notice inconnue"}</span>
                  <span className="shrink-0 font-mono text-xs text-navy-900/45">
                    {[m.cote, m.code_barres].filter(Boolean).join(" · ") || "sans cote"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <ScannerCodeBarres ouvert={camera} onCode={pointer} onFermer={() => setCamera(false)}
        titre="Pointer au scan caméra" />
    </>
  );
}
