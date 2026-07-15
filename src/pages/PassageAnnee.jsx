import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getAnnees, ouvrirAnnee, proposerPromotions, appliquerPromotions } from "@/lib/annee.js";
import { getClasses } from "@/lib/academique.js";

const anneeSuivante = () => {
  const a = new Date().getFullYear();
  return `${a}-${a + 1}`;
};

export default function PassageAnnee() {
  const { ecoleId, rafraichirProfil } = useAuth();
  const toast = useToast();
  const [annees, setAnnees] = useState([]);
  const [modale, setModale] = useState(false);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    try { setAnnees(await getAnnees(ecoleId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  const courante = annees.find((a) => a.courante);

  return (
    <>
      <EnTete titre="Passage d'année scolaire" sousTitre="Ouvrir une nouvelle année et promouvoir les élèves" />
      <div className="max-w-4xl space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Années */}
        <Carte className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-navy-900">Années scolaires</h3>
            <Bouton onClick={() => setModale(true)}>+ Nouvelle année</Bouton>
          </div>
          <ul className="mt-4 divide-y divide-navy-900/5">
            {annees.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-navy-900">
                  {a.libelle}
                  {a.courante && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">courante</span>}
                </span>
                <span className="font-mono text-xs text-navy-900/40">{a.date_debut} → {a.date_fin}</span>
              </li>
            ))}
            {annees.length === 0 && <p className="text-sm text-navy-900/40">Aucune année.</p>}
          </ul>
        </Carte>

        {/* Promotion */}
        <PanneauPromotion ecoleId={ecoleId} annees={annees} courante={courante} onErreur={setErreur} />
      </div>

      <ModaleNouvelleAnnee
        ouvert={modale} onFermer={() => setModale(false)} defautLibelle={anneeSuivante()}
        onCreer={async (libelle, debut, fin, opts) => {
          try {
            await ouvrirAnnee(libelle, debut, fin, opts);
            await rafraichirProfil?.();
            await recharger();
            setModale(false);
            toast.succes(`Année ${libelle} ouverte et rendue courante.`);
          } catch (e) { setErreur(e.message); }
        }}
      />
    </>
  );
}

function ModaleNouvelleAnnee({ ouvert, onFermer, defautLibelle, onCreer }) {
  const an = new Date().getFullYear();
  const [f, setF] = useState({
    libelle: defautLibelle, debut: `${an}-10-01`, fin: `${an + 1}-07-31`,
    classes: true, affectations: true, frais: true, edt: true,
  });
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => { if (ouvert) setF((s) => ({ ...s, libelle: defautLibelle })); }, [ouvert, defautLibelle]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const Case = ({ k, label, aide }) => (
    <label className="flex items-start gap-2 rounded-xl border border-navy-900/10 p-3 text-sm">
      <input type="checkbox" checked={f[k]} onChange={(e) => maj(k, e.target.checked)} className="mt-0.5" />
      <span><span className="font-medium text-navy-900">{label}</span><span className="block text-xs text-navy-900/45">{aide}</span></span>
    </label>
  );

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle année scolaire" large>
      <div className="space-y-4">
        <p className="text-sm text-navy-900/55">
          La nouvelle année devient <b>courante</b> ; l'année précédente reste <b>archivée et consultable</b>.
          Choisissez ce qui est recopié depuis l'année en cours (tout reste modifiable ensuite).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Libellé" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="2026-2027" />
          <Champ label="Début" type="date" value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
          <Champ label="Fin" type="date" value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Case k="classes" label="Structure (classes)" aide="mêmes niveaux/sections, effectif remis à zéro" />
          <Case k="affectations" label="Affectations profs" aide="prof ↔ classe ↔ matière" />
          <Case k="frais" label="Grille tarifaire" aide="frais de l'année (montants ajustables)" />
          <Case k="edt" label="Emplois du temps" aide="créneaux des classes équivalentes" />
        </div>
        <p className="text-xs text-navy-900/40">
          Les élèves ne sont pas réinscrits ici : utilisez « Promotion des élèves » ci-dessous après avoir ouvert l'année.
        </p>
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={envoi || !f.libelle.trim()}
            onClick={async () => { setEnvoi(true); await onCreer(f.libelle.trim(), f.debut, f.fin, f); setEnvoi(false); }}>
            {envoi ? "Ouverture…" : "Ouvrir l'année"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

function PanneauPromotion({ ecoleId, annees, courante, onErreur }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [sourceId, setSourceId] = useState("");
  const [props, setProps] = useState(null);
  const [classesCible, setClassesCible] = useState([]);
  const [calc, setCalc] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const sources = annees.filter((a) => !a.courante);
  useEffect(() => { if (!sourceId && sources[0]) setSourceId(sources[0].id); }, [sources, sourceId]);

  async function calculer() {
    if (!sourceId || !courante) return;
    setCalc(true); setProps(null);
    try {
      const [p, cls] = await Promise.all([
        proposerPromotions(ecoleId, sourceId, courante.id),
        getClasses(ecoleId, courante.id),
      ]);
      setClassesCible(cls);
      setProps(p);
    } catch (e) { onErreur(e.message); }
    finally { setCalc(false); }
  }

  const majLigne = (idx, patch) => setProps((s) => s.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const decision = (p) => (!p.inclure ? "sort" : p.redoublant ? "redouble" : "passe");
  const setDecision = (idx, val) => majLigne(idx, { inclure: val !== "sort", redoublant: val === "redouble" });

  const aReinscrire = props ? props.filter((p) => p.inclure && p.cible_classe_id).length : 0;

  async function appliquer() {
    if (!aReinscrire) return;
    if (!(await confirmer({
      titre: "Confirmer les réinscriptions",
      message: `Réinscrire ${aReinscrire} élève(s) dans l'année ${courante.libelle} ? (Relançable sans créer de doublon.)`,
      confirmer: "Réinscrire",
    }))) return;
    setEnvoi(true);
    try {
      const r = await appliquerPromotions(ecoleId, courante.id, props);
      toast.succes(`${r.reinscrits} élève(s) réinscrit(s).`);
    } catch (e) { onErreur(e.message); }
    finally { setEnvoi(false); }
  }

  if (!courante) return null;
  if (sources.length === 0) {
    return (
      <Carte className="p-6 text-sm text-navy-900/50">
        La promotion des élèves sera disponible une fois qu'une <b>nouvelle année</b> aura été ouverte
        (il faut une année source et une année cible).
      </Carte>
    );
  }

  // Regroupe l'aperçu par classe source.
  const groupes = {};
  if (props) for (let i = 0; i < props.length; i++) { const g = (groupes[props[i].classe_source] ||= []); g.push(i); }

  return (
    <Carte className="p-6">
      <h3 className="font-display text-lg font-semibold text-navy-900">Promotion des élèves</h3>
      <p className="mt-1 text-sm text-navy-900/55">
        Réinscrit les élèves de l'année source au niveau supérieur dans <b>{courante.libelle}</b> (année courante).
        Ajustez chaque cas : passe, redouble ou sort.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Année source</span>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {sources.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
        </label>
        <Bouton variante="fantome" onClick={calculer} disabled={calc || !sourceId}>{calc ? "Calcul…" : "Calculer les propositions"}</Bouton>
      </div>

      {props && (
        <>
          {props.length === 0 ? (
            <p className="mt-4 text-sm text-navy-900/40">Aucun élève inscrit dans l'année source.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {Object.entries(groupes).map(([classe, idxs]) => (
                <div key={classe}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">{classe}</p>
                  <div className="overflow-x-auto rounded-xl border border-navy-900/10">
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {idxs.map((i) => {
                          const p = props[i];
                          return (
                            <tr key={p.eleve_id} className="border-b border-navy-900/5 last:border-0">
                              <td className="px-3 py-2">
                                <span className="font-medium text-navy-900">{p.nom}</span>
                                <span className="ml-2 font-mono text-[11px] text-navy-900/40">{p.matricule}</span>
                              </td>
                              <td className="px-3 py-2">
                                <select value={decision(p)} onChange={(e) => setDecision(i, e.target.value)}
                                  className="rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-or-500">
                                  <option value="passe">Passe{p.niveau_cible ? ` en ${p.niveau_cible}` : ""}</option>
                                  <option value="redouble">Redouble</option>
                                  <option value="sort">Sort de l'école</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select value={p.cible_classe_id} disabled={!p.inclure}
                                  onChange={(e) => majLigne(i, { cible_classe_id: e.target.value })}
                                  className="w-40 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-or-500 disabled:opacity-40">
                                  <option value="">— classe cible —</option>
                                  {classesCible.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-900/10 pt-4">
                <span className="text-sm text-navy-900/60">{aReinscrire} élève(s) à réinscrire</span>
                <Bouton onClick={appliquer} disabled={envoi || aReinscrire === 0}>
                  {envoi ? "Réinscription…" : `Réinscrire ${aReinscrire} élève(s)`}
                </Bouton>
              </div>
              {classesCible.length === 0 && (
                <p className="text-xs text-rose-600">Aucune classe dans l'année courante : ouvrez d'abord l'année en recopiant la structure.</p>
              )}
            </div>
          )}
        </>
      )}
    </Carte>
  );
}
