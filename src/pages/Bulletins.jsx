import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, Modale, EtatVide, SansAnnee } from "@/composants/ui.jsx";
import * as api from "@/lib/bulletins.js";
import SceauVerification from "@/composants/SceauVerification.jsx";
import { codeBulletin } from "@/lib/verification.js";
import { getAnneeCourante, getClasses, getMatieres, getSignataires, getNiveaux,
         getResponsablesCycle } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
import { actions as actionsCircuit, etatGlobal, etatSignatures, qualitesSignables,
         LIBELLES, EXPLICATIONS, TON } from "@/lib/circuitBulletin.js";
import { Badge } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import { GESPRO } from "@/lib/gespro.js";

// Signataire du bulletin : le responsable pédagogique en priorité, sinon le
// directeur / la directrice, sinon le premier signataire déclaré.
export function signatairePedagogique(liste) {
  const f = (re) => liste.find((s) => re.test(`${s.fonction || ""}`));
  return f(/p[ée]dagog/i) || f(/directeur|directrice|principal/i) || liste[0] || null;
}

// Phase 1 — Module 2 : bulletins (calcul + aperçu imprimable PDF).
export default function Bulletins() {
  const { ecoleId, ecole, roles, profil, utilisateur } = useAuth();
  const toutVoir = voitToutesClasses(roles);
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [resultats, setResultats] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [bulletinActif, setBulletinActif] = useState(null);
  const [pvOuvert, setPvOuvert] = useState(false);
  const [publication, setPublication] = useState("");
  const [enPublication, setEnPublication] = useState(false);
  const [notation, setNotation] = useState(api.DEFAUT_NOTATION);
  const [signataire, setSignataire] = useState(null);
  //  Circuit du bulletin et PV du conseil (mig. 166).
  const [etat, setEtat] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const confirmer = useConfirm();
  const toast = useToast();

  //  ⚠️ CE BOUTON NE PUBLIE PLUS. Il ENREGISTRE les bulletins calculés, qui
  //  naissent en brouillon — invisibles du parent (mig. 166). La diffusion
  //  est un acte distinct, plus bas. Garder l intitule « Publier » ici
  //  aurait fait croire a l ecole que les familles voient le bulletin.
  async function enregistrer() {
    if (!resultats) return;
    setErreur(""); setPublication("");
    setEnPublication(true);
    try {
      const n = await api.publierBulletins(ecoleId, classeId, periodeId, resultats);
      setPublication(`${n} bulletin(s) enregistre(s). Ils restent en brouillon : utilisez « Publier aux parents » pour les diffuser.`);
      await rechargerEtat();
    } catch (e) { setErreur(e.message); }
    finally { setEnPublication(false); }
  }

  async function rechargerEtat() {
    if (!classeId || !periodeId) { setEtat(null); return; }
    try { setEtat(await api.etatBulletins(classeId, periodeId)); }
    catch { setEtat(null); }
  }

  async function avancer(statut, label) {
    try {
      const n = await api.avancerBulletins(classeId, periodeId, statut);
      toast.succes(`${n} bulletin(s) — ${label}.`);
      await rechargerEtat();
    } catch (e) { toast.erreur(e.message); }
  }

  async function signer(qualite) {
    try {
      let id = etat?.conseilId;
      if (!id) id = await api.ouvrirConseil(ecoleId, classeId, periodeId, new Date().toISOString().slice(0, 10));
      await api.signerConseil(id, qualite);
      toast.succes("Signature apposee.");
      await rechargerEtat();
    } catch (e) { toast.erreur(e.message); }
  }

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [per, mat, cfg] = await Promise.all([
          api.getPeriodes(ecoleId, an?.id),
          getMatieres(ecoleId),
          api.getNotationConfig(ecoleId),
        ]);
        // Un enseignant n'établit les bulletins que de SES classes.
        const cls = toutVoir
          ? await getClasses(ecoleId, an?.id)
          : await getMesClasses(ecoleId, an?.id, (await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email))?.id);
        setClasses(cls);
        setPeriodes(per);
        setMatieres(mat);
        setNotation(cfg);
        if (per[0]) setPeriodeId(per[0].id);
        try { setSignataire(signatairePedagogique(await getSignataires(ecoleId))); } catch { /* facultatif */ }
        //  Pour savoir si JE suis responsable du cycle de la classe : la
        //  reponse ne se deduit pas du role (tout compte `direction` couvre
        //  l ecole entiere), elle vient de la table de designation.
        try {
          const [niv, resp] = await Promise.all([
            getNiveaux(ecoleId), getResponsablesCycle(ecoleId)]);
          setNiveaux(niv); setResponsables(resp);
        } catch { /* le circuit s affichera sans la designation */ }
      } catch (e) {
        setErreur(e.message);
      }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email, toutVoir]);

  useEffect(() => { rechargerEtat(); }, [classeId, periodeId]);

  async function calculer() {
    if (!classeId || !periodeId) return;
    setErreur("");
    setChargement(true);
    setResultats(null);
    try {
      const res = await api.calculerBulletins(ecoleId, classeId, annee.id, periodeId, matieres, notation);
      setResultats(res);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  const classe = classes.find((c) => c.id === classeId);
  const periode = periodes.find((p) => p.id === periodeId);
  //  classe -> niveau -> cycle, puis la table de designation. La base refait
  //  ce meme chemin dans `signer_conseil` : ici on ne fait que decider quoi
  //  PROPOSER, la verification qui compte est la-bas.
  const cycleDeLaClasse = niveaux.find((n) => n.id === classe?.niveau_id)?.cycle_id || null;
  const estResponsableDuCycle = Boolean(
    cycleDeLaClasse && responsables.some(
      (r) => r.cycle_id === cycleDeLaClasse && r.profil_id === profil?.id));

  return (
    <>
      <EnTete titre="Bulletins" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {!annee && <SansAnnee />}

        <div className="flex flex-wrap items-end gap-3">
          <Sel label="Classe" value={classeId} onChange={setClasseId} options={classes.map((c) => [c.id, c.libelle])} />
          <Sel label="Période" value={periodeId} onChange={setPeriodeId} options={periodes.map((p) => [p.id, p.libelle])} />
          <Bouton onClick={calculer} disabled={!classeId || !periodeId || chargement}>
            {chargement ? "Calcul…" : "Calculer les bulletins"}
          </Bouton>
        </div>

        {publication && <Alerte ton="succes">{publication}</Alerte>}

        {/*  Le circuit vit en dehors du calcul : une classe deja enregistree
             s affiche meme sans avoir recalcule (mig. 166). */}
        {etat && (etat.brouillon + etat.valide + etat.publie) > 0 && (
          <PanneauCircuit
            etat={etat}
            peutAvancer={toutVoir}
            estResponsableDuCycle={estResponsableDuCycle}
            roles={roles}
            profilId={profil?.id}
            onAvancer={avancer}
            onSigner={signer}
            onRetirerSignature={async () => {
              try { await api.retirerSignature(etat.conseilId, profil?.id); await rechargerEtat(); }
              catch (e) { toast.erreur(e.message); }
            }}
            confirmer={confirmer}
          />
        )}

        {resultats && (
          <Carte className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 px-6 py-3 text-sm text-navy-900/60">
              <span>
                {classe?.libelle} · {periode?.libelle} · {resultats.effectif} élève(s) ·{" "}
                {resultats.evaluations.length} évaluation(s)
              </span>
              {resultats.eleves.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Bouton onClick={() => setPvOuvert(true)}>🧾 Imprimer le PV</Bouton>
                  <Bouton variante="or" onClick={enregistrer} disabled={enPublication}>
                    {enPublication ? "Enregistrement…" : "💾 Enregistrer les bulletins"}
                  </Bouton>
                </div>
              )}
            </div>
            {resultats.eleves.length === 0 ? (
              <EtatVide icone="🎓" titre="Aucun élève inscrit">Aucun élève inscrit dans cette classe pour cette période.</EtatVide>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-creme text-navy-900/50">
                  <tr>
                    <th className="px-6 py-3 font-medium">Rang</th>
                    <th className="px-6 py-3 font-medium">Élève</th>
                    <th className="px-6 py-3 text-right font-medium">Moyenne</th>
                    <th className="px-6 py-3 font-medium">Mention</th>
                    <th className="px-6 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.eleves.map((r) => (
                    <tr key={r.eleve.id} className="border-t border-navy-900/5 hover:bg-creme/60">
                      <td className="px-6 py-3 font-mono text-navy-900/60">{r.rang ?? "—"}</td>
                      <td className="px-6 py-3 font-medium text-navy-900">{r.eleve.prenom} {r.eleve.nom}</td>
                      <td className="px-6 py-3 text-right font-mono font-semibold">
                        {r.moyenne != null ? r.moyenne.toFixed(2) : "—"}
                      </td>
                      <td className="px-6 py-3">{r.mention}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setBulletinActif(r)} className="text-sm text-navy-700 hover:text-or-500">
                          Bulletin →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Carte>
        )}
      </div>

      <ModaleBulletin
        resultat={bulletinActif} notation={notation}
        ecole={ecole} classe={classe} periode={periode} annee={annee}
        ecoleId={ecoleId} classeId={classeId} periodeId={periodeId} effectif={resultats?.effectif}
        signataire={signataire}
        onFermer={() => setBulletinActif(null)}
        onErreur={setErreur}
      />

      <ModalePV
        ouvert={pvOuvert} onFermer={() => setPvOuvert(false)}
        ecole={ecole} classe={classe} periode={periode} annee={annee}
        resultats={resultats} signataire={signataire}
      />
    </>
  );
}

// Procès-verbal du conseil de classe : tableau imprimable des résultats.
function ModalePV({ ouvert, onFermer, ecole, classe, periode, annee, resultats, signataire }) {
  if (!resultats) return null;
  const eleves = [...(resultats.eleves || [])].sort((a, b) => (a.rang || 999) - (b.rang || 999));
  const moys = eleves.map((r) => Number(r.moyenne)).filter((n) => !isNaN(n));
  const moyClasse = moys.length ? (moys.reduce((s, n) => s + n, 0) / moys.length).toFixed(2) : "—";
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="PV du conseil de classe" large>
      <div className="zone-impression text-navy-900">
        <div className="mb-4 flex items-center gap-3 border-b border-navy-900/15 pb-3">
          {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-12 w-12 object-contain" />}
          <div>
            <p className="font-display text-lg font-bold">{ecole?.nom}</p>
            <p className="text-xs text-navy-900/50">{[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <h1 className="text-center font-display text-xl font-bold uppercase tracking-wide">Procès-verbal du conseil de classe</h1>
        <p className="mt-1 text-center text-sm text-navy-900/60">
          Classe {classe?.libelle} · {periode?.libelle} · Année {annee?.libelle} · {resultats.effectif} élève(s) · Moyenne de classe&nbsp;: <b>{moyClasse}</b>
        </p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-navy-900/25 text-navy-900/60">
              <th className="px-2 py-2 text-left">Rang</th>
              <th className="px-2 py-2 text-left">Élève</th>
              <th className="px-2 py-2 text-right">Moyenne</th>
              <th className="px-2 py-2 text-left">Mention</th>
              <th className="px-2 py-2 text-left">Décision / Observations</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((r, i) => (
              <tr key={r.eleve.id} className="border-b border-navy-900/10">
                <td className="px-2 py-2">{r.rang ?? i + 1}</td>
                <td className="px-2 py-2 font-medium">{r.eleve.nom} {r.eleve.prenom}</td>
                <td className="px-2 py-2 text-right font-mono">{r.moyenne != null ? Number(r.moyenne).toFixed(2) : "—"}</td>
                <td className="px-2 py-2">{r.mention || ""}</td>
                <td className="px-2 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-12 flex justify-between text-sm">
          <div>Le professeur principal<br /><span className="text-navy-900/30">_____________________</span></div>
          <div className="text-right">
            {signataire?.fonction || "La Direction"}{signataire?.nom ? ` — ${signataire.nom}` : ""}<br /><br />
            <span className="text-navy-900/30">_____________________</span>
          </div>
        </div>
      </div>
      <div className="no-print mt-5 flex justify-end">
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
    </Modale>
  );
}

const DECISIONS = [
  "", "Admis(e) en classe supérieure", "Passage en classe supérieure", "Redouble la classe",
  "Félicitations", "Encouragements", "Tableau d'honneur", "Avertissement (travail)", "Blâme (conduite)",
];

function ModaleBulletin({ resultat, notation, ecole, classe, periode, annee, ecoleId, classeId, periodeId, effectif, signataire, onFermer, onErreur }) {
  const [appGen, setAppGen] = useState("");
  const [decision, setDecision] = useState("");
  const [appMat, setAppMat] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // Règle d'affichage et compteurs : lus en base, jamais déduits ici.
  const [afficheAbs, setAfficheAbs] = useState(false);
  const [abs, setAbs] = useState(null);

  useEffect(() => {
    if (resultat) { setAppGen(""); setDecision(""); setAppMat({}); setMsg(""); }
  }, [resultat]);

  useEffect(() => {
    if (!resultat || !classeId || !periodeId) { setAfficheAbs(false); setAbs(null); return; }
    let vivant = true;
    (async () => {
      try {
        const montre = await api.afficheAbsences(classeId);
        if (!vivant) return;
        setAfficheAbs(montre);
        if (!montre) { setAbs(null); return; }
        // Un seul appel pour toute la classe, même si la modale n'en affiche
        // qu'un élève : la liste est déjà en mémoire et l'on passe d'un
        // bulletin à l'autre sans relancer de requête.
        const par = await api.absencesClassePeriode(classeId, periodeId);
        if (!vivant) return;
        // `{}` = période non datée → on laisse `null`, qui veut dire
        // « on ne sait pas », et non « zéro ».
        setAbs(Object.keys(par).length ? (par[resultat.eleve.id] || { absences: 0, justifiees: 0, retards: 0 }) : null);
      } catch { if (vivant) { setAfficheAbs(false); setAbs(null); } }
    })();
    return () => { vivant = false; };
  }, [resultat, classeId, periodeId]);

  if (!resultat) return null;
  const majMat = (id, v) => setAppMat((s) => ({ ...s, [id]: v }));

  async function publier() {
    setSaving(true); setMsg(""); onErreur("");
    try {
      await api.publierUnBulletin(ecoleId, classeId, periodeId, resultat, {
        effectif, appreciation_generale: appGen, decision, appreciations: appMat,
      });
      //  ⚠️ CE MESSAGE DISAIT « visible par le parent » : c'est devenu faux.
      //  L'upsert n'envoie pas `statut` (mig. 166), donc un bulletin déjà
      //  publié RESTE publié — corriger une appréciation ne le retire pas
      //  des familles — mais un bulletin neuf naît en brouillon. Annoncer
      //  une diffusion qui n'a pas eu lieu serait le pire des messages :
      //  celui qui rassure à tort.
      setMsg("Bulletin enregistré ✓ — la diffusion aux familles se fait depuis le panneau « Circuit ».");
    } catch (e) { onErreur(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modale ouvert={!!resultat} onFermer={onFermer} titre={`Bulletin — ${resultat.eleve.prenom} ${resultat.eleve.nom}`} large>
      {/* Saisie des appréciations (non imprimée) */}
      <div className="no-print mb-5 space-y-3 rounded-xl border border-navy-900/10 bg-creme/40 p-4">
        <p className="text-sm font-medium text-navy-900/70">Appréciations par matière</p>
        <div className="space-y-1.5">
          {resultat.lignes.map((l) => (
            <div key={l.matiere_id} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-sm text-navy-900/70">{l.matiere}</span>
              <input value={appMat[l.matiere_id] || ""} onChange={(e) => majMat(l.matiere_id, e.target.value)}
                placeholder="Appréciation…"
                className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Appréciation générale</span>
            <textarea value={appGen} onChange={(e) => setAppGen(e.target.value)} rows={2}
              placeholder="Conseil de classe…"
              className="w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Décision du conseil</span>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {DECISIONS.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
            </select>
          </label>
        </div>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <div className="flex justify-end gap-2">
          <Bouton variante="or" onClick={publier} disabled={saving}>{saving ? "Enregistrement…" : "💾 Enregistrer"}</Bouton>
        </div>
      </div>

      <BulletinImprimable ecole={ecole} classe={classe} periode={periode} annee={annee}
        resultat={resultat} appGen={appGen} decision={decision} appMat={appMat} notation={notation}
        signataire={signataire} afficheAbs={afficheAbs} abs={abs} />
      <div className="no-print mt-5 flex justify-end gap-2">
        <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
    </Modale>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
      >
        <option value="">— Choisir —</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

// Document bulletin (réutilisé pour l'aperçu ET l'impression PDF).
function BulletinImprimable({ ecole, classe, periode, annee, resultat, appGen = "", decision = "", appMat = {}, notation = api.DEFAUT_NOTATION, signataire = null, afficheAbs = false, abs = null }) {
  const totalCoef = resultat.lignes.reduce((s, l) => s + l.coef, 0);
  return (
    <div className="zone-impression relative overflow-hidden rounded-xl border border-navy-900/10 bg-white p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-14 w-14 shrink-0 object-contain" />}
          <div>
            <p className="font-display text-xl font-bold text-navy-900">Bulletin scolaire</p>
            <p className="text-sm text-navy-900/50">{ecole?.nom} — {periode?.libelle} · {annee?.libelle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-navy-900">{resultat.eleve.prenom} {resultat.eleve.nom}</p>
          <p className="text-sm text-navy-900/50">Classe {classe?.libelle}</p>
          <p className="font-mono text-xs text-navy-900/40">{resultat.eleve.matricule}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-navy-900/15 text-navy-900/50">
          <tr>
            <th className="py-2 font-medium">Matière</th>
            <th className="py-2 text-center font-medium">Moyenne</th>
            <th className="py-2 text-center font-medium">Coef.</th>
            <th className="py-2 text-center font-medium">Pts</th>
            <th className="py-2 font-medium">Appréciation</th>
          </tr>
        </thead>
        <tbody>
          {resultat.lignes.map((l) => (
            <tr key={l.matiere_id} className="border-b border-navy-900/5">
              <td className="py-2 font-medium text-navy-900">{l.matiere}</td>
              <td className="py-2 text-center font-mono">{l.moyenne != null ? l.moyenne.toFixed(2) : "—"}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">{l.coef}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">
                {l.moyenne != null ? (l.moyenne * l.coef).toFixed(2) : "—"}
              </td>
              <td className="py-2 text-xs text-navy-900/70">{appMat[l.matiere_id] || ""}</td>
            </tr>
          ))}
          {resultat.lignes.length === 0 && (
            <tr><td colSpan={5} className="py-3 text-navy-900/40">Aucune note saisie.</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-navy-900 p-4 text-creme">
          <p className="text-xs text-creme/60">Moyenne générale</p>
          <p className="font-display text-2xl font-bold">
            {resultat.moyenne != null ? resultat.moyenne.toFixed(2) : "—"}<span className="text-sm font-normal">/{notation.bareme}</span>
          </p>
        </div>
        {notation.afficher_rang !== false && (
          <div className="rounded-xl bg-or-500 p-4 text-navy-900">
            <p className="text-xs text-navy-900/60">Rang</p>
            <p className="font-display text-2xl font-bold">{resultat.rang ?? "—"}</p>
          </div>
        )}
        <div className="rounded-xl border border-navy-900/15 p-4">
          <p className="text-xs text-navy-900/50">Mention</p>
          <p className="font-display text-xl font-bold text-navy-900">{resultat.mention}</p>
        </div>
      </div>

      {/* Absences : à partir du collège seulement. La règle vient de la base
          (`bulletin_affiche_absences`, mig. 163) — ce composant et celui de
          l'espace parent la consomment, aucun des deux ne la redérive.
          `abs` à null = période non datée : on le dit, on n'écrit pas 0. */}
      {afficheAbs && (
        <div className="mt-4 rounded-xl border border-navy-900/15 p-4 text-sm">
          {!abs ? (
            <p className="text-navy-900/50">
              Absences non comptabilisées : les dates de la période ne sont pas renseignées
              (Structure académique → Découpage de l&apos;année).
            </p>
          ) : (
            <p className="text-navy-900/80">
              <b className="text-navy-900/50">Absences :</b> {abs.absences}
              {abs.absences > 0 && (
                <span className="text-navy-900/55"> dont {abs.justifiees} justifiée{abs.justifiees > 1 ? "s" : ""}</span>
              )}
              {abs.retards > 0 && <span className="text-navy-900/55"> · {abs.retards} retard{abs.retards > 1 ? "s" : ""}</span>}
            </p>
          )}
        </div>
      )}

      {((notation.afficher_appreciations !== false && appGen) || (notation.afficher_decision !== false && decision)) && (
        <div className="mt-6 space-y-2 rounded-xl border border-navy-900/10 bg-creme/40 p-4 text-sm">
          {notation.afficher_appreciations !== false && appGen && <p className="text-navy-900/80"><b className="text-navy-900/50">Appréciation générale :</b> {appGen}</p>}
          {notation.afficher_decision !== false && decision && <p className="text-navy-900/80"><b className="text-navy-900/50">Décision du conseil :</b> {decision}</p>}
        </div>
      )}

      {/* Signature du responsable pédagogique (Paramètres → Signataires) */}
      <div className="mt-8 flex items-start justify-between gap-6">
        <p className="text-xs text-navy-900/40">
          Fait à {ecole?.ville || "—"}, le {new Date().toLocaleDateString("fr-FR")}
        </p>
        <div className="w-56 text-center">
          <p className="text-xs font-medium text-navy-900/60">{signataire?.fonction || "Le Responsable pédagogique"}</p>
          {signataire?.signature_url
            ? <img src={signataire.signature_url} alt="" className="mx-auto my-1 h-16 object-contain" />
            : <div className="my-1 h-16" />}
          <p className="border-t border-navy-900/20 pt-1 text-sm font-medium text-navy-900">{signataire?.nom || ""}</p>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between text-xs text-navy-900/40">
        <span>Total coefficients : <span className="font-mono">{totalCoef}</span></span>
        <span>{ecole?.nom} · {ecole?.sigle}</span>
      </div>
      <SceauVerification code={codeBulletin(resultat.eleve.id, periode?.id)} reference={periode?.libelle} />
      {GESPRO.afficherBranding && (
        <p className="mt-2 text-center text-[9px] text-navy-900/30">Solution développée par {GESPRO.nom}</p>
      )}
    </div>
  );
}

// =====================================================================
//  Le circuit du bulletin, et les deux signatures du PV (mig. 166)
//
//  Points 6 et 7 de la visite. Ce panneau répond à UNE question que
//  l'école se posait sans pouvoir y répondre : « est-ce que les parents
//  voient ce bulletin ? » Jusqu'ici, écrire un bulletin le rendait
//  aussitôt visible, sans relecture possible.
// =====================================================================
function PanneauCircuit({ etat, peutAvancer, estResponsableDuCycle, roles, profilId,
                          onAvancer, onSigner, onRetirerSignature, confirmer }) {
  const compte = { brouillon: etat.brouillon, valide: etat.valide, publie: etat.publie };
  const { etat: global, total, melange } = etatGlobal(compte);
  const actes = actionsCircuit({ compte, peutAvancer, conseilComplet: etat.conseilComplet });
  const sign = etatSignatures(etat.signatures);
  const maSignature = (etat.signatures || []).find((x) => x.profil_id === profilId);
  const signables = qualitesSignables({
    roles, estResponsableDuCycle,
    dejaSignePar: maSignature ? [maSignature.qualite] : [],
  });

  return (
    <Carte className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold text-navy-900">Circuit</h3>
          {melange ? (
            <Badge ton="warning">{total} bulletins, états mélangés</Badge>
          ) : (
            <Badge ton={TON[global] || "neutre"}>{LIBELLES[global]} — {total} bulletin(s)</Badge>
          )}
        </div>
        {etat.publie > 0 && (
          <span className="text-xs text-navy-900/50">
            {etat.consultes} consulté(s) par les familles sur {etat.publie} publié(s)
          </span>
        )}
      </div>

      {/* La seule question qui compte pour l'école : le parent le voit-il ? */}
      <p className="mt-1.5 text-sm text-navy-900/60">
        {melange
          ? "Certains bulletins de cette classe sont visibles des familles, d'autres non."
          : EXPLICATIONS[global]}
      </p>

      {melange && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-navy-900/50">
          {etat.brouillon > 0 && <span>{etat.brouillon} brouillon</span>}
          {etat.valide > 0 && <span>· {etat.valide} validé(s)</span>}
          {etat.publie > 0 && <span>· {etat.publie} publié(s)</span>}
        </div>
      )}

      {/* --- Le procès-verbal et ses deux signatures --- */}
      <div className="mt-4 rounded-xl border border-navy-900/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-navy-900/70">Procès-verbal du conseil de classe</span>
          <Badge ton={sign.complet ? "success" : "warning"}>
            {sign.complet ? "Signé" : `${sign.manquantes} signature(s) manquante(s)`}
          </Badge>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {sign.detail.map((d) => (
            <li key={d.qualite} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={d.signature ? "text-emerald-600" : "text-navy-900/30"}>
                {d.signature ? "✓" : "○"}
              </span>
              <span className="text-navy-900/60">{d.label}</span>
              {d.signature ? (
                <span className="text-navy-900/80">
                  — {d.signature.nom || "signé"}
                  <span className="ml-1 text-xs text-navy-900/40">
                    {d.signature.signe_le ? new Date(d.signature.signe_le).toLocaleDateString("fr-FR") : ""}
                  </span>
                </span>
              ) : signables.includes(d.qualite) ? (
                <button type="button" onClick={() => onSigner(d.qualite)}
                  className="rounded-full border border-or-500/50 bg-or-500/10 px-2.5 py-0.5 text-xs font-medium text-or-600 hover:bg-or-500/20">
                  Signer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {maSignature && (
          <button type="button"
            onClick={async () => {
              if (await confirmer("Retirer votre signature de ce procès-verbal ?")) onRetirerSignature();
            }}
            className="mt-2 text-xs text-rose-500 hover:underline">
            retirer ma signature
          </button>
        )}
        {!signables.length && !maSignature && !sign.complet && (
          /* ⚠️ Dire POURQUOI on ne peut pas signer. Un bouton absent sans
             explication passe pour une panne. */
          <p className="mt-2 text-xs text-navy-900/40">
            Les signatures appartiennent au responsable pédagogique du cycle de cette classe
            et au responsable de la gestion. Un responsable se désigne dans
            Structure → Responsables de cycle.
          </p>
        )}
      </div>

      {/* --- Faire avancer --- */}
      {actes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {actes.map((a) => (
            <Bouton key={a.cle}
              variante={a.cle === "publier" ? "or" : a.cle === "retirer" ? "fantome" : "primaire"}
              onClick={async () => {
                //  Un avertissement se CONFIRME : publier sans PV signé, ou
                //  retirer un bulletin que des familles ont déjà lu, ne doit
                //  pas partir sur un simple clic.
                if (a.bloque && !await confirmer(`${a.bloque}\n\nContinuer ?`)) return;
                onAvancer(a.statut, a.cle === "publier" ? "publié(s) aux parents"
                  : a.cle === "valider" ? "validé(s)" : "retiré(s) de l'espace parent");
              }}>
              {a.cle === "publier" ? "📤 " : a.cle === "retirer" ? "↩️ " : "✓ "}{a.label}
            </Bouton>
          ))}
          {actes.some((a) => a.cle === "publier" && a.bloque) && (
            <span className="text-xs text-amber-600">PV non signé</span>
          )}
        </div>
      )}
      {!peutAvancer && (
        <p className="mt-3 text-xs text-navy-900/40">
          Seule la direction arrête et diffuse les bulletins.
        </p>
      )}
    </Carte>
  );
}
