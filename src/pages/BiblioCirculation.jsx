import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, EtatVide, Badge, SkeletonListe, Modale } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/bibliotheque.js";
import { nbPages, joursRetard } from "@/lib/biblio.regles.js";
import ScannerCodeBarres, { scanCameraDisponible } from "@/composants/ScannerCodeBarres.jsx";

const TAILLE = 20;
const auj = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const nomEmprunteur = (e) =>
  e?.profils ? `${e.profils.prenom || ""} ${e.profils.nom || ""}`.trim()
  : e?.eleves ? `${e.eleves.prenom || ""} ${e.eleves.nom || ""}`.trim()
  : "—";
// Le rôle sert à retrouver la règle de prêt applicable (quota, durée, pénalité).
const roleDe = (emp) => (emp?.emprunteur_eleve_id ? "etudiant" : "enseignant");

export default function BiblioCirculation() {
  const { ecoleId, utilisateur, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const toast = useToast();
  const confirmer = useConfirm();

  const [onglet, setOnglet] = useState("pret");     // pret | retour | penalites
  const [page, setPage] = useState(0);
  const [enRetard, setEnRetard] = useState(false);
  const [liste, setListe] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [reglesOuvert, setReglesOuvert] = useState(false);

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setListe(await api.getEmprunts(ecoleId, { statut: "en_cours", enRetard, page, taille: TAILLE })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, enRetard, page]);
  useEffect(() => { recharger(); }, [recharger]);

  // Retour + proposition de pénalité : on n'en crée jamais sans un « oui ».
  async function rendre(emp) {
    try {
      const p = await api.rendre(emp.id, { ecoleId, emprunt: emp, role: roleDe(emp) });
      toast.succes("Retour enregistré.");
      recharger();
      if (p) await proposerPenalite(emp, p);
    } catch (e) { toast.erreur(e); }
  }

  async function proposerPenalite(emp, p) {
    const ok = await confirmer({
      titre: "Pénalité de retard",
      message: `Retard de ${p.jours} jour(s) — enregistrer une pénalité de ${fmt(p.montant)} ${devise} pour ${nomEmprunteur(emp)} ?`,
      confirmer: "Enregistrer", danger: false,
    });
    if (!ok) return;
    try {
      await api.creerPenalite(ecoleId, { emprunt_id: emp.id, type: "retard", montant: p.montant,
        note: `Retard de ${p.jours} jour(s)` });
      toast.succes("Pénalité enregistrée.");
    } catch (e) { toast.erreur(e); }
  }

  async function renouveler(emp) {
    const role = roleDe(emp);
    try {
      const d = await api.renouveler(ecoleId, emp, role);
      toast.succes(`Renouvelé jusqu'au ${dateFr(d)}.`);
      recharger();
    } catch (e) { toast.erreur(e); }
  }

  const pages = nbPages(liste.total, TAILLE);

  return (
    <>
      <EnTete titre="Prêts & retours" sousTitre="Poste de circulation — saisie ou lecture du code-barres"
        action={<Bouton variante="fantome" onClick={() => setReglesOuvert(true)}>⚙️ Règles de prêt</Bouton>} />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="flex gap-2">
          <button onClick={() => setOnglet("pret")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${onglet === "pret" ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>
            📕 Nouveau prêt
          </button>
          <button onClick={() => setOnglet("retour")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${onglet === "retour" ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>
            📗 Retour
          </button>
          <button onClick={() => setOnglet("penalites")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${onglet === "penalites" ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>
            💰 Pénalités
          </button>
        </div>

        {onglet === "pret" && <PanneauPret ecoleId={ecoleId} agentId={utilisateur?.id} devise={devise} onFait={recharger} />}
        {onglet === "retour" && <PanneauRetour ecoleId={ecoleId} onFait={recharger} onPenalite={proposerPenalite} />}
        {onglet === "penalites" && <PanneauPenalites ecoleId={ecoleId} devise={devise} />}

        {/* Emprunts en cours */}
        <Carte className={`p-5 ${onglet === "penalites" ? "hidden" : ""}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              Emprunts en cours <span className="text-sm font-normal text-navy-900/50">({liste.total})</span>
            </h3>
            <label className="flex items-center gap-2 text-sm text-navy-900/70">
              <input type="checkbox" checked={enRetard} onChange={(e) => { setEnRetard(e.target.checked); setPage(0); }}
                className="h-4 w-4 accent-or-500" />
              En retard uniquement
            </label>
          </div>

          {chargement ? <SkeletonListe lignes={5} /> : liste.lignes.length === 0 ? (
            <EtatVide icone="📚" titre="Aucun emprunt en cours">
              {enRetard ? "Aucun retard — tout est à jour." : "Les prêts enregistrés apparaîtront ici."}
            </EtatVide>
          ) : (
            <div className="space-y-2">
              {liste.lignes.map((e) => {
                const retard = joursRetard(e.date_echeance, auj());
                return (
                  <div key={e.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${retard > 0 ? "border-rose-300 bg-rose-50/50" : "border-navy-900/10"}`}>
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900">
                        {e.biblio_exemplaires?.biblio_ressources?.titre || "Ouvrage"}
                        <span className="ml-2 font-mono text-xs text-navy-900/45">{e.biblio_exemplaires?.code_barres || ""}</span>
                      </p>
                      <p className="text-xs text-navy-900/55">
                        {nomEmprunteur(e)} · échéance {dateFr(e.date_echeance)}
                        {e.renouvellements > 0 ? ` · ${e.renouvellements} renouv.` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {retard > 0 && <Badge ton="danger">{retard} j de retard</Badge>}
                      <button onClick={() => renouveler(e)} className="text-navy-700 hover:text-or-600">renouveler</button>
                      <Bouton variante="fantome" onClick={() => rendre(e)}>Retour</Bouton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
              <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
              <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
            </div>
          )}
        </Carte>
      </div>

      <ModaleRegles ouvert={reglesOuvert} ecoleId={ecoleId} onFermer={() => setReglesOuvert(false)} />
    </>
  );
}

// --- Règles de prêt (configurables par rôle) --------------------------------
const ROLES_PRET = [
  ["etudiant", "Étudiant", { max_emprunts: 5, duree_jours: 14, renouvellements_max: 1 }],
  ["enseignant", "Enseignant", { max_emprunts: 10, duree_jours: 30, renouvellements_max: 2 }],
  ["chercheur", "Chercheur", { max_emprunts: 20, duree_jours: 60, renouvellements_max: 2 }],
  ["personnel", "Personnel", { max_emprunts: 5, duree_jours: 21, renouvellements_max: 1 }],
];

function ModaleRegles({ ouvert, ecoleId, onFermer }) {
  const toast = useToast();
  const [regles, setRegles] = useState([]);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    if (!ecoleId) return;
    try {
      const existantes = await api.getRegles(ecoleId);
      // Une ligne par rôle : celle en base, sinon une proposition par défaut.
      setRegles(ROLES_PRET.map(([role, libelle, defauts]) => {
        const e = existantes.find((x) => x.role === role);
        return e
          ? { ...e, libelle, existe: true }
          : { role, libelle, ...defauts, penalite_jour: 0, penalites_actives: false, actif: false, existe: false };
      }));
    } catch (e) { toast.erreur(e); }
  }, [ecoleId, toast]);
  useEffect(() => { if (ouvert) charger(); }, [ouvert, charger]);

  const maj = (role, champ, valeur) =>
    setRegles((s) => s.map((r) => (r.role === role ? { ...r, [champ]: valeur } : r)));

  async function enregistrer() {
    setBusy(true);
    try {
      for (const r of regles) {
        await api.enregistrerRegle(ecoleId, {
          role: r.role,
          max_emprunts: Number(r.max_emprunts) || 0,
          duree_jours: Number(r.duree_jours) || 0,
          renouvellements_max: Number(r.renouvellements_max) || 0,
          penalite_jour: Number(r.penalite_jour) || 0,
          penalites_actives: !!r.penalites_actives,
          actif: !!r.actif,
        });
      }
      toast.succes("Règles enregistrées.");
      onFermer();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Règles de prêt" large>
      <div className="space-y-4">
        <p className="text-sm text-navy-900/60">
          Activez un profil pour autoriser ses emprunts. Un prêt est refusé si le profil est inactif,
          si le quota est atteint ou si l'usager a un retard en cours.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-900/15 text-xs uppercase tracking-wide text-navy-900/50">
              <tr>
                <th className="py-2">Profil</th><th className="px-2 py-2 text-center">Actif</th>
                <th className="px-2 py-2 text-center">Max</th><th className="px-2 py-2 text-center">Jours</th>
                <th className="px-2 py-2 text-center">Renouv.</th><th className="px-2 py-2 text-center">Pénalité/j</th>
              </tr>
            </thead>
            <tbody>
              {regles.map((r) => (
                <tr key={r.role} className="border-b border-navy-900/5">
                  <td className="py-2 font-medium text-navy-900">{r.libelle}</td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={!!r.actif} onChange={(e) => maj(r.role, "actif", e.target.checked)}
                      className="h-4 w-4 accent-or-500" />
                  </td>
                  {["max_emprunts", "duree_jours", "renouvellements_max"].map((c) => (
                    <td key={c} className="px-2 py-2 text-center">
                      <input type="number" min="0" value={r[c] ?? 0} onChange={(e) => maj(r.role, c, e.target.value)}
                        className="w-16 rounded-lg border border-navy-900/15 px-2 py-1 text-center font-mono text-sm outline-none focus:border-or-500" />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <input type="number" min="0" value={r.penalite_jour ?? 0} onChange={(e) => maj(r.role, "penalite_jour", e.target.value)}
                        disabled={!r.penalites_actives}
                        className="w-20 rounded-lg border border-navy-900/15 px-2 py-1 text-center font-mono text-sm outline-none focus:border-or-500 disabled:bg-navy-900/5" />
                      <input type="checkbox" checked={!!r.penalites_actives} title="Activer les pénalités"
                        onChange={(e) => maj(r.role, "penalites_actives", e.target.checked)}
                        className="h-4 w-4 accent-or-500" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-navy-900/45">Les pénalités sont désactivées par défaut : cochez la case pour les appliquer.</p>
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</Bouton>
        </div>
      </div>
    </Modale>
  );
}

// --- Prêt -------------------------------------------------------------------
function PanneauPret({ ecoleId, agentId, devise, onFait }) {
  const toast = useToast();
  const [type, setType] = useState("etudiant");     // etudiant | personnel
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState([]);
  const [emprunteur, setEmprunteur] = useState(null);
  const [dette, setDette] = useState(0);
  const [code, setCode] = useState("");
  const [exemplaire, setExemplaire] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);

  // Recherche serveur, déclenchée à partir de 2 caractères.
  useEffect(() => {
    let vivant = true;
    const t = setTimeout(async () => {
      try {
        const r = type === "etudiant"
          ? await api.chercherEtudiants(ecoleId, q)
          : await api.chercherPersonnels(ecoleId, q);
        if (vivant) setResultats(r);
      } catch { if (vivant) setResultats([]); }
    }, 250);
    return () => { vivant = false; clearTimeout(t); };
  }, [ecoleId, q, type]);

  // Dette de pénalités de l'emprunteur : information de guichet, jamais bloquante
  // (c'est le bibliothécaire qui décide de prêter ou non).
  useEffect(() => {
    if (!emprunteur) { setDette(0); return; }
    let vivant = true;
    const cible = type === "etudiant"
      ? { eleveId: emprunteur.id }
      : { profilId: emprunteur.profil_id };
    if (!cible.eleveId && !cible.profilId) { setDette(0); return; }
    api.penalitesDues(ecoleId, cible)
      .then((d) => { if (vivant) setDette(d); })
      .catch(() => { if (vivant) setDette(0); });
    return () => { vivant = false; };
  }, [ecoleId, emprunteur, type]);

  // Stable : passée en dépendance d'effet au scanner caméra.
  const chercherCode = useCallback(async (valeur) => {
    const c = String(valeur || "").trim();
    setMsg("");
    if (!c) return;
    setCode(c);
    try {
      const ex = await api.exemplaireParCode(ecoleId, c);
      if (!ex) { setExemplaire(null); setMsg("Aucun exemplaire avec ce code-barres."); return; }
      setExemplaire(ex);
      if (ex.statut !== "disponible") setMsg(`Cet exemplaire est « ${api.STATUTS_EXEMPLAIRE[ex.statut] || ex.statut} ».`);
    } catch (e) { setMsg(e.message); }
  }, [ecoleId]);

  const chercherExemplaire = () => chercherCode(code);

  async function preter() {
    if (!emprunteur || !exemplaire) return;
    setBusy(true); setMsg("");
    try {
      const est = type === "etudiant";
      const emp = await api.emprunter(ecoleId, {
        exemplaireId: exemplaire.id,
        profilId: est ? (emprunteur.profil_id || null) : (emprunteur.profil_id || null),
        eleveId: est ? emprunteur.id : null,
        role: est ? "etudiant" : "enseignant",
        agentId,
      });
      toast.succes(`Prêt enregistré — à rendre le ${dateFr(emp.date_echeance)}.`);
      setExemplaire(null); setCode(""); setMsg("");
      onFait?.();
    } catch (e) {
      // Message métier explicite (quota atteint, retard en cours, règle absente…)
      setMsg(e.message);
      toast.erreur(e);
    } finally { setBusy(false); }
  }

  const pretPossible = emprunteur && exemplaire && exemplaire.statut === "disponible";

  return (
    <Carte className="space-y-4 p-5">
      <div className="flex gap-2 text-sm">
        {[["etudiant", "Étudiant"], ["personnel", "Personnel"]].map(([v, l]) => (
          <button key={v} onClick={() => { setType(v); setEmprunteur(null); setResultats([]); setQ(""); }}
            className={`rounded-lg px-3 py-1.5 font-medium ${type === v ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>{l}</button>
        ))}
      </div>

      {/* 1. Emprunteur */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-900/45">1 · Emprunteur</span>
        {emprunteur ? (
          <div className="flex items-center justify-between rounded-xl border border-or-500/40 bg-or-500/5 px-3 py-2 text-sm">
            <span className="font-medium text-navy-900">
              {emprunteur.nom} {emprunteur.prenom}
              {emprunteur.matricule ? <span className="ml-2 font-mono text-xs text-navy-900/50">{emprunteur.matricule}</span> : null}
              {emprunteur.fonction ? <span className="ml-2 text-xs text-navy-900/50">{emprunteur.fonction}</span> : null}
            </span>
            <button onClick={() => setEmprunteur(null)} className="text-xs text-navy-900/50 hover:text-navy-900">changer</button>
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={type === "etudiant" ? "Nom, prénom ou matricule…" : "Nom ou prénom…"}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
            {resultats.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {resultats.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => { setEmprunteur(p); setResultats([]); setQ(""); }}
                      className="w-full rounded-lg border border-navy-900/10 px-3 py-2 text-left text-sm hover:border-or-500">
                      {p.nom} {p.prenom}
                      {p.matricule ? <span className="ml-2 font-mono text-xs text-navy-900/50">{p.matricule}</span> : null}
                      {p.fonction ? <span className="ml-2 text-xs text-navy-900/50">{p.fonction}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {dette > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ Pénalités impayées : <b>{fmt(dette)} {devise}</b>.
          </p>
        )}
      </div>

      {/* 2. Exemplaire */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-900/45">2 · Exemplaire (code-barres)</span>
        <div className="flex flex-wrap gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); chercherExemplaire(); } }}
            placeholder="Scanner ou saisir le code-barres, puis Entrée"
            className="min-w-56 flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-or-500" />
          <Bouton variante="fantome" onClick={chercherExemplaire}>Chercher</Bouton>
          {scanCameraDisponible() && (
            <Bouton variante="fantome" onClick={() => setCamera(true)}>📷</Bouton>
          )}
        </div>
        {exemplaire && (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-navy-900/10 px-3 py-2 text-sm">
            <span className="font-medium text-navy-900">{exemplaire.biblio_ressources?.titre || "Ouvrage"}</span>
            <Badge ton={exemplaire.statut === "disponible" ? "success" : "warning"}>
              {api.STATUTS_EXEMPLAIRE[exemplaire.statut] || exemplaire.statut}
            </Badge>
          </div>
        )}
      </div>

      {msg && <Alerte ton="or">{msg}</Alerte>}

      <div className="flex justify-end">
        <Bouton onClick={preter} disabled={!pretPossible || busy}>{busy ? "…" : "Enregistrer le prêt"}</Bouton>
      </div>

      <ScannerCodeBarres ouvert={camera} onCode={chercherCode}
        onFermer={() => setCamera(false)} titre="Scanner l'exemplaire" />
    </Carte>
  );
}

// --- Retour -----------------------------------------------------------------
function PanneauRetour({ ecoleId, onFait, onPenalite }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [emprunt, setEmprunt] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);

  // Stable : passée en dépendance d'effet au scanner caméra.
  const chercherCode = useCallback(async (valeur) => {
    const c = String(valeur || "").trim();
    setMsg(""); setEmprunt(null);
    if (!c) return;
    setCode(c);
    try {
      const ex = await api.exemplaireParCode(ecoleId, c);
      if (!ex) { setMsg("Aucun exemplaire avec ce code-barres."); return; }
      const emp = await api.empruntActifParExemplaire(ecoleId, ex.id);
      if (!emp) { setMsg("Cet exemplaire n'est pas actuellement emprunté."); return; }
      setEmprunt({ ...emp, titre: ex.biblio_ressources?.titre });
    } catch (e) { setMsg(e.message); }
  }, [ecoleId]);

  const chercher = () => chercherCode(code);

  async function rendre() {
    setBusy(true);
    const emp = emprunt;
    try {
      const p = await api.rendre(emp.id, { ecoleId, emprunt: emp, role: roleDe(emp) });
      toast.succes("Retour enregistré.");
      setEmprunt(null); setCode(""); onFait?.();
      if (p) await onPenalite?.(emp, p);
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  const retard = emprunt ? joursRetard(emprunt.date_echeance, auj()) : 0;

  return (
    <Carte className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); chercher(); } }}
          placeholder="Scanner ou saisir le code-barres, puis Entrée"
          className="min-w-56 flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-or-500" />
        <Bouton variante="fantome" onClick={chercher}>Chercher</Bouton>
        {scanCameraDisponible() && (
          <Bouton variante="fantome" onClick={() => setCamera(true)}>📷</Bouton>
        )}
      </div>

      {msg && <Alerte ton="or">{msg}</Alerte>}

      {emprunt && (
        <div className="space-y-3 rounded-xl border border-navy-900/10 p-4">
          <p className="font-medium text-navy-900">{emprunt.titre || "Ouvrage"}</p>
          <p className="text-sm text-navy-900/60">
            Emprunté par <b>{nomEmprunteur(emprunt)}</b> · échéance {dateFr(emprunt.date_echeance)}
          </p>
          {retard > 0 && <Alerte ton="erreur">{`Retard de ${retard} jour(s).`}</Alerte>}
          <div className="flex justify-end">
            <Bouton onClick={rendre} disabled={busy}>{busy ? "…" : "Enregistrer le retour"}</Bouton>
          </div>
        </div>
      )}

      <ScannerCodeBarres ouvert={camera} onCode={chercherCode}
        onFermer={() => setCamera(false)} titre="Scanner l'exemplaire à rendre" />
    </Carte>
  );
}

// --- Pénalités ---------------------------------------------------------------
const STATUTS_PEN = { due: ["À payer", "danger"], payee: ["Payée", "success"], annulee: ["Annulée", "neutre"] };
const TYPES_PEN = { retard: "Retard", perte: "Perte", dommage: "Dommage" };

function PanneauPenalites({ ecoleId, devise }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [statut, setStatut] = useState("due");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setRes(await api.getPenalites(ecoleId, { statut: statut || undefined, page, taille: TAILLE })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, statut, page]);
  useEffect(() => { recharger(); }, [recharger]);

  async function changer(p, vers, libelle) {
    if (!(await confirmer({ titre: libelle, message: `${libelle} cette pénalité de ${fmt(p.montant)} ${devise} ?`,
      confirmer: libelle, danger: vers === "annulee" }))) return;
    try { await api.changerStatutPenalite(p.id, vers); toast.succes("Pénalité mise à jour."); recharger(); }
    catch (e) { toast.erreur(e); }
  }

  const pages = nbPages(res.total, TAILLE);
  const totalDu = res.lignes.filter((p) => p.statut === "due").reduce((s, p) => s + (Number(p.montant) || 0), 0);

  return (
    <Carte className="space-y-4 p-5">
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex flex-wrap items-center gap-1.5">
        {[["due", "À payer"], ["payee", "Payées"], ["annulee", "Annulées"], ["", "Toutes"]].map(([v, l]) => (
          <button key={v || "tous"} onClick={() => { setStatut(v); setPage(0); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statut === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"}`}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-sm text-navy-900/60">
          {res.total} pénalité{res.total > 1 ? "s" : ""}
          {statut === "due" && totalDu > 0 ? ` · ${fmt(totalDu)} ${devise} sur cette page` : ""}
        </span>
      </div>

      {chargement ? <SkeletonListe lignes={4} /> : res.lignes.length === 0 ? (
        <EtatVide icone="💰" titre="Aucune pénalité">
          {statut === "due" ? "Rien à recouvrer." : "Aucune pénalité dans cette catégorie."}
        </EtatVide>
      ) : (
        <ul className="space-y-2">
          {res.lignes.map((p) => {
            const [lib, ton] = STATUTS_PEN[p.statut] || [p.statut, "neutre"];
            const emp = p.biblio_emprunts;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900">
                    {nomEmprunteur(emp)} — {fmt(p.montant)} {devise}
                  </p>
                  <p className="text-xs text-navy-900/55">
                    {TYPES_PEN[p.type] || p.type}
                    {emp?.date_echeance ? ` · échéance ${dateFr(emp.date_echeance)}` : ""}
                    {emp?.date_retour ? ` · rendu ${dateFr(emp.date_retour)}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge ton={ton}>{lib}</Badge>
                  {p.statut === "due" && (
                    <>
                      <Bouton variante="fantome" onClick={() => changer(p, "payee", "Marquer payée")}>Payée</Bouton>
                      <Bouton variante="fantome" onClick={() => changer(p, "annulee", "Annuler")}>Annuler</Bouton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
          <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
        </div>
      )}
    </Carte>
  );
}
