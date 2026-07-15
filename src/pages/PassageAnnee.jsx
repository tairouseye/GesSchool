import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getAnnees, ouvrirAnnee, proposerPromotions, appliquerPromotions, resumeSource, supprimerAnnee, inscriptionsParAnnee } from "@/lib/annee.js";
import { getClasses, getNiveaux } from "@/lib/academique.js";

const anneeSuivante = () => {
  const a = new Date().getFullYear();
  return `${a}-${a + 1}`;
};

export default function PassageAnnee() {
  const { ecoleId, rafraichirProfil } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [annees, setAnnees] = useState([]);
  const [nbInsc, setNbInsc] = useState({});
  const [modale, setModale] = useState(false);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    try {
      const list = await getAnnees(ecoleId);
      setAnnees(list);
      setNbInsc(await inscriptionsParAnnee(ecoleId, list.map((a) => a.id)));
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  const courante = annees.find((a) => a.courante);

  async function supprimer(a) {
    const insc = nbInsc[a.id] || 0;
    if (insc > 0) {
      toast.erreur(`${a.libelle} contient ${insc} inscription(s) : suppression impossible.`);
      return;
    }
    if (!(await confirmer({
      titre: `Supprimer l'année ${a.libelle}`,
      message: `Supprimer définitivement cette année et tout ce qu'elle contient (classes, affectations, frais, emplois du temps) ? ${a.courante ? "L'année précédente redeviendra courante. " : ""}Cette action est irréversible.`,
      confirmer: "Supprimer",
    }))) return;
    try {
      await supprimerAnnee(a.id);
      await rafraichirProfil?.();
      await recharger();
      toast.succes(`Année ${a.libelle} supprimée.`);
    } catch (e) { setErreur(e.message); }
  }

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
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-navy-900">
                  {a.libelle}
                  {a.courante && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">courante</span>}
                  <span className="ml-2 text-xs text-navy-900/40">· {nbInsc[a.id] || 0} inscrit(s)</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-navy-900/40">{a.date_debut} → {a.date_fin}</span>
                  {(nbInsc[a.id] || 0) === 0 && annees.length > 1 && (
                    <button onClick={() => supprimer(a)} title="Supprimer cette année (vide)"
                      className="rounded-lg px-2 py-1 text-xs text-navy-900/40 hover:bg-rose-50 hover:text-rose-600">
                      Supprimer
                    </button>
                  )}
                </div>
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
        ecoleId={ecoleId} source={courante}
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

function ModaleNouvelleAnnee({ ouvert, onFermer, defautLibelle, ecoleId, source, onCreer }) {
  const an = new Date().getFullYear();
  const confirmer = useConfirm();
  const [f, setF] = useState({
    libelle: defautLibelle, debut: `${an}-10-01`, fin: `${an + 1}-07-31`,
    classes: true, affectations: true, frais: true, edt: true,
  });
  const [resume, setResume] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    setF((s) => ({ ...s, libelle: defautLibelle }));
    setResume(null);
    if (source?.id) resumeSource(ecoleId, source.id).then(setResume).catch(() => setResume(null));
  }, [ouvert, defautLibelle, ecoleId, source]);

  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const Case = ({ k, label, aide, n }) => (
    <label className="flex items-start gap-2 rounded-xl border border-navy-900/10 p-3 text-sm">
      <input type="checkbox" checked={f[k]} onChange={(e) => maj(k, e.target.checked)} className="mt-0.5" />
      <span>
        <span className="font-medium text-navy-900">{label}</span>
        {resume != null && <span className="ml-1.5 rounded bg-navy-900/5 px-1.5 text-xs text-navy-900/60">{f[k] ? n : 0}</span>}
        <span className="block text-xs text-navy-900/45">{aide}</span>
      </span>
    </label>
  );

  async function soumettre() {
    if (!f.libelle.trim()) return;
    // Récapitulatif de confirmation
    const lignes = [];
    if (resume) {
      if (f.classes) lignes.push(`${resume.classes} classe(s)`);
      if (f.affectations) lignes.push(`${resume.affectations} affectation(s)`);
      if (f.frais) lignes.push(`${resume.frais} frais`);
      if (f.edt) lignes.push(`${resume.creneaux} créneau(x) d'emploi du temps`);
    }
    const detail = lignes.length ? ` Seront recopiés : ${lignes.join(", ")}.` : "";
    const ok = await confirmer({
      titre: `Ouvrir l'année ${f.libelle.trim()} ?`,
      message: `Cette année deviendra courante (l'actuelle sera archivée).${detail} Les élèves ne sont pas réinscrits ici.`,
      confirmer: "Ouvrir l'année", danger: false,
    });
    if (!ok) return;
    setEnvoi(true);
    await onCreer(f.libelle.trim(), f.debut, f.fin, f);
    setEnvoi(false);
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle année scolaire" large>
      <div className="space-y-4">
        <p className="text-sm text-navy-900/55">
          La nouvelle année devient <b>courante</b> ; l'année précédente reste <b>archivée et consultable</b>.
          Choisissez ce qui est recopié depuis l'année en cours (les compteurs indiquent le volume ; tout reste modifiable ensuite).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Libellé" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="2026-2027" />
          <Champ label="Début" type="date" value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
          <Champ label="Fin" type="date" value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Case k="classes" label="Structure (classes)" aide="mêmes niveaux/sections, effectif remis à zéro" n={resume?.classes} />
          <Case k="affectations" label="Affectations profs" aide="prof ↔ classe ↔ matière" n={resume?.affectations} />
          <Case k="frais" label="Grille tarifaire" aide="frais de l'année (montants ajustables)" n={resume?.frais} />
          <Case k="edt" label="Emplois du temps" aide="créneaux des classes équivalentes" n={resume?.creneaux} />
        </div>
        <p className="text-xs text-navy-900/40">
          Les élèves ne sont pas réinscrits ici : utilisez « Promotion des élèves » ci-dessous après avoir ouvert l'année.
        </p>
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={envoi || !f.libelle.trim()} onClick={soumettre}>
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

  const [niveaux, setNiveaux] = useState([]);
  const sources = annees.filter((a) => !a.courante);
  useEffect(() => { if (!sourceId && sources[0]) setSourceId(sources[0].id); }, [sources, sourceId]);
  useEffect(() => { getNiveaux(ecoleId).then((n) => setNiveaux([...n].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)))).catch(() => {}); }, [ecoleId]);

  // Contrôle de l'ordre des niveaux (base de la promotion « niveau +1 »).
  const ordres = niveaux.map((n) => n.ordre);
  const ordreIncoherent = new Set(ordres).size !== ordres.length; // doublons d'ordre

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

      {niveaux.length > 0 && (
        <div className="mt-3 rounded-xl border border-navy-900/10 bg-creme/50 p-3">
          <p className="text-xs font-medium text-navy-900/60">Enchaînement des niveaux (base de la promotion) :</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-navy-900">
            {niveaux.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1.5">
                <span className="rounded bg-white px-2 py-0.5 font-medium">{n.libelle}</span>
                {i < niveaux.length - 1 && <span className="text-navy-900/30">→</span>}
              </span>
            ))}
            <span className="ml-1 text-xs text-navy-900/40">(le dernier = sortants)</span>
          </p>
          {ordreIncoherent && (
            <p className="mt-2 text-xs font-medium text-rose-600">
              ⚠️ Des niveaux ont le même ordre : la promotion pourrait viser le mauvais niveau. Corrigez l'ordre dans « Structure ».
            </p>
          )}
        </div>
      )}

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
