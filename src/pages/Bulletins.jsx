import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import * as api from "@/lib/bulletins.js";
import { getAnneeCourante, getClasses, getMatieres, getSignataires } from "@/lib/academique.js";

// Signataire du bulletin : le responsable pédagogique en priorité, sinon le
// directeur / la directrice, sinon le premier signataire déclaré.
export function signatairePedagogique(liste) {
  const f = (re) => liste.find((s) => re.test(`${s.fonction || ""}`));
  return f(/p[ée]dagog/i) || f(/directeur|directrice|principal/i) || liste[0] || null;
}

// Phase 1 — Module 2 : bulletins (calcul + aperçu imprimable PDF).
export default function Bulletins() {
  const { ecoleId, ecole } = useAuth();
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
  const [publication, setPublication] = useState("");
  const [enPublication, setEnPublication] = useState(false);
  const [notation, setNotation] = useState(api.DEFAUT_NOTATION);
  const [signataire, setSignataire] = useState(null);

  async function publier() {
    if (!resultats) return;
    setErreur(""); setPublication("");
    setEnPublication(true);
    try {
      const n = await api.publierBulletins(ecoleId, classeId, periodeId, resultats);
      setPublication(`${n} bulletin(s) publié(s) — visibles par les parents.`);
    } catch (e) { setErreur(e.message); }
    finally { setEnPublication(false); }
  }

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [cls, per, mat, cfg] = await Promise.all([
          getClasses(ecoleId, an?.id),
          api.getPeriodes(ecoleId, an?.id),
          getMatieres(ecoleId),
          api.getNotationConfig(ecoleId),
        ]);
        setClasses(cls);
        setPeriodes(per);
        setMatieres(mat);
        setNotation(cfg);
        if (per[0]) setPeriodeId(per[0].id);
        try { setSignataire(signatairePedagogique(await getSignataires(ecoleId))); } catch { /* facultatif */ }
      } catch (e) {
        setErreur(e.message);
      }
    })();
  }, [ecoleId]);

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

  return (
    <>
      <EnTete titre="Bulletins" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="flex flex-wrap items-end gap-3">
          <Sel label="Classe" value={classeId} onChange={setClasseId} options={classes.map((c) => [c.id, c.libelle])} />
          <Sel label="Période" value={periodeId} onChange={setPeriodeId} options={periodes.map((p) => [p.id, p.libelle])} />
          <Bouton onClick={calculer} disabled={!classeId || !periodeId || chargement}>
            {chargement ? "Calcul…" : "Calculer les bulletins"}
          </Bouton>
        </div>

        {publication && <Alerte ton="succes">{publication}</Alerte>}

        {resultats && (
          <Carte className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 px-6 py-3 text-sm text-navy-900/60">
              <span>
                {classe?.libelle} · {periode?.libelle} · {resultats.effectif} élève(s) ·{" "}
                {resultats.evaluations.length} évaluation(s)
              </span>
              {resultats.eleves.length > 0 && (
                <Bouton variante="or" onClick={publier} disabled={enPublication}>
                  {enPublication ? "Publication…" : "📤 Publier aux parents"}
                </Bouton>
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
    </>
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

  useEffect(() => {
    if (resultat) { setAppGen(""); setDecision(""); setAppMat({}); setMsg(""); }
  }, [resultat]);

  if (!resultat) return null;
  const majMat = (id, v) => setAppMat((s) => ({ ...s, [id]: v }));

  async function publier() {
    setSaving(true); setMsg(""); onErreur("");
    try {
      await api.publierUnBulletin(ecoleId, classeId, periodeId, resultat, {
        effectif, appreciation_generale: appGen, decision, appreciations: appMat,
      });
      setMsg("Bulletin publié ✓ — visible par le parent.");
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
          <Bouton variante="or" onClick={publier} disabled={saving}>{saving ? "Publication…" : "📤 Enregistrer & publier"}</Bouton>
        </div>
      </div>

      <BulletinImprimable ecole={ecole} classe={classe} periode={periode} annee={annee}
        resultat={resultat} appGen={appGen} decision={decision} appMat={appMat} notation={notation}
        signataire={signataire} />
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
function BulletinImprimable({ ecole, classe, periode, annee, resultat, appGen = "", decision = "", appMat = {}, notation = api.DEFAUT_NOTATION, signataire = null }) {
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
    </div>
  );
}
