import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import * as api from "@/lib/bulletins.js";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";

function distinction(m) {
  if (m == null) return null;
  if (m >= 16) return "Félicitations";
  if (m >= 14) return "Tableau d'honneur";
  if (m >= 12) return "Encouragements";
  return null;
}
const TON_DIST = { "Félicitations": "bg-emerald-500/15 text-emerald-700", "Tableau d'honneur": "bg-or-500/20 text-or-600", "Encouragements": "bg-navy-900/5 text-navy-900/60" };

export default function Classement() {
  const { ecoleId, ecole } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [resultats, setResultats] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [cls, per, mat] = await Promise.all([getClasses(ecoleId, an?.id), api.getPeriodes(ecoleId, an?.id), getMatieres(ecoleId)]);
        setClasses(cls); setPeriodes(per); setMatieres(mat);
        if (per[0]) setPeriodeId(per[0].id);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId]);

  async function calculer() {
    if (!classeId || !periodeId) return;
    setErreur(""); setChargement(true); setResultats(null);
    try { setResultats(await api.calculerBulletins(ecoleId, classeId, annee.id, periodeId, matieres)); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }

  const classe = classes.find((c) => c.id === classeId);
  const periode = periodes.find((p) => p.id === periodeId);
  const classes_ = resultats?.eleves || [];
  const honneur = classes_.filter((r) => distinction(r.moyenne));

  return (
    <>
      <EnTete titre="Classement & tableau d'honneur" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="no-print flex flex-wrap items-end gap-3">
          <Sel label="Classe" value={classeId} onChange={setClasseId} options={classes.map((c) => [c.id, c.libelle])} />
          <Sel label="Période" value={periodeId} onChange={setPeriodeId} options={periodes.map((p) => [p.id, p.libelle])} />
          <Bouton onClick={calculer} disabled={!classeId || !periodeId || chargement}>{chargement ? "Calcul…" : "Calculer le classement"}</Bouton>
        </div>

        {resultats && (
          <>
            {/* Classement complet (écran) */}
            <Carte className="no-print overflow-hidden">
              <div className="border-b border-navy-900/10 px-6 py-3 text-sm text-navy-900/60">{classe?.libelle} · {periode?.libelle} · {classes_.length} élève(s)</div>
              <table className="w-full text-left text-sm">
                <thead className="bg-creme text-navy-900/50">
                  <tr><th className="px-6 py-3 font-medium">Rang</th><th className="px-6 py-3 font-medium">Élève</th><th className="px-6 py-3 text-right font-medium">Moyenne</th><th className="px-6 py-3 font-medium">Distinction</th></tr>
                </thead>
                <tbody>
                  {classes_.map((r) => {
                    const dist = distinction(r.moyenne);
                    return (
                      <tr key={r.eleve.id} className="border-t border-navy-900/5">
                        <td className="px-6 py-2.5 font-mono text-navy-900/60">{r.rang ?? "—"}</td>
                        <td className="px-6 py-2.5 font-medium text-navy-900">{r.eleve.prenom} {r.eleve.nom}</td>
                        <td className="px-6 py-2.5 text-right font-mono font-semibold">{r.moyenne != null ? r.moyenne.toFixed(2) : "—"}</td>
                        <td className="px-6 py-2.5">{dist && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TON_DIST[dist]}`}>{dist}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Carte>

            <div className="no-print flex justify-end">
              <Bouton onClick={() => window.print()} disabled={honneur.length === 0}>🖨️ Imprimer le tableau d'honneur</Bouton>
            </div>

            {/* Tableau d'honneur (imprimable) */}
            <div className="zone-impression relative overflow-hidden rounded-xl border border-navy-900/10 bg-white p-8">
              <Cachet size={220} sigle={ecole?.sigle || "GS"} className="pointer-events-none absolute -right-10 -top-10 text-or-500/10" />
              <div className="flex items-center gap-4 border-b border-navy-900/10 pb-4">
                {ecole?.logo_url
                  ? <img src={ecole.logo_url} alt="" className="h-14 w-14 shrink-0 object-contain" />
                  : <Cachet size={52} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
                <div>
                  <p className="font-display text-xl font-bold text-navy-900">{ecole?.nom}</p>
                  <p className="text-xs text-navy-900/50">Tableau d'honneur · {classe?.libelle} · {periode?.libelle} · {annee?.libelle}</p>
                </div>
              </div>
              {honneur.length === 0 ? (
                <EtatVide icone="🏆" titre="Aucun classement" className="mt-6">Lancez le calcul pour établir le classement de la période.</EtatVide>
              ) : (
                <table className="mt-6 w-full text-left text-sm">
                  <thead className="border-b border-navy-900/15 text-navy-900/50">
                    <tr><th className="py-2 font-medium">Rang</th><th className="py-2 font-medium">Élève</th><th className="py-2 text-right font-medium">Moyenne</th><th className="py-2 font-medium">Distinction</th></tr>
                  </thead>
                  <tbody>
                    {honneur.map((r) => (
                      <tr key={r.eleve.id} className="border-b border-navy-900/5">
                        <td className="py-2 font-mono text-navy-900/60">{r.rang}</td>
                        <td className="py-2 font-medium text-navy-900">{r.eleve.prenom} {r.eleve.nom}</td>
                        <td className="py-2 text-right font-mono font-semibold">{r.moyenne.toFixed(2)}</td>
                        <td className="py-2 font-medium text-navy-900/80">{distinction(r.moyenne)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-8 text-right text-sm text-navy-900/50">Le Directeur · Signature et cachet</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
        <option value="">— Choisir —</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
