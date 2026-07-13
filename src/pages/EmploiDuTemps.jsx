import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/emploi.js";
import { genererEDT } from "@/lib/generateurEDT.js";
import { getAnneeCourante, getClasses, getMatieres, getNiveaux } from "@/lib/academique.js";
import { getEnseignants } from "@/lib/enseignants.js";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";

const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
const ONGLETS = [
  ["emplois", "Emplois du temps"], ["grille", "Grille horaire"],
  ["volumes", "Volumes"], ["salles", "Salles"], ["generer", "⚡ Générer"],
];

export default function EmploiDuTemps() {
  const { ecoleId } = useAuth();
  const [onglet, setOnglet] = useState("emplois");
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [grille, setGrille] = useState([]);
  const [salles, setSalles] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [erreur, setErreur] = useState("");

  const rechargerBase = useCallback(async () => {
    setErreur("");
    const an = await getAnneeCourante(ecoleId);
    setAnnee(an);
    const [cls, niv, mat, ens, gr, sa, vol] = await Promise.all([
      getClasses(ecoleId, an?.id), getNiveaux(ecoleId), getMatieres(ecoleId), getEnseignants(ecoleId),
      api.getGrille(ecoleId), api.getSalles(ecoleId), api.getVolumes(ecoleId),
    ]);
    setClasses(cls); setNiveaux(niv); setMatieres(mat); setEnseignants(ens);
    setGrille(gr); setSalles(sa); setVolumes(vol);
  }, [ecoleId]);

  useEffect(() => { rechargerBase().catch((e) => setErreur(e.message)); }, [rechargerBase]);

  return (
    <>
      <EnTete titre="Emploi du temps" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-navy-900/5 p-1">
          {ONGLETS.map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {onglet === "emplois" && <PanneauEmplois ecoleId={ecoleId} classes={classes} matieres={matieres} enseignants={enseignants} salles={salles} />}
        {onglet === "grille" && <PanneauGrille ecoleId={ecoleId} grille={grille} onChange={rechargerBase} onErreur={setErreur} />}
        {onglet === "volumes" && <PanneauVolumes ecoleId={ecoleId} niveaux={niveaux} matieres={matieres} volumes={volumes} onChange={rechargerBase} onErreur={setErreur} />}
        {onglet === "salles" && <PanneauSalles ecoleId={ecoleId} salles={salles} onChange={rechargerBase} onErreur={setErreur} />}
        {onglet === "generer" && (
          <PanneauGenerer ecoleId={ecoleId} annee={annee} classes={classes} niveaux={niveaux}
            matieres={matieres} enseignants={enseignants} grille={grille} salles={salles} volumes={volumes} />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet 1 — Emplois du temps (consultation / retouche manuelle)     */
/* ------------------------------------------------------------------ */
function PanneauEmplois({ ecoleId, classes, matieres, enseignants, salles }) {
  const toast = useToast();
  const [classeId, setClasseId] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [modale, setModale] = useState(null);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    if (!classeId) { setCreneaux([]); return; }
    try { setCreneaux(await api.getCreneaux(ecoleId, classeId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId]);
  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => { try { await fn(); await recharger(); if (msg) toast.succes(msg); } catch (e) { toast.erreur(e.message); } };

  return (
    <div className="space-y-5">
      <Alerte ton="erreur">{erreur}</Alerte>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Classe</span>
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
          className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
          <option value="">— Choisir —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
        </select>
      </label>

      {classeId && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {api.JOURS.map(([j, label]) => {
            const items = creneaux.filter((c) => c.jour === j);
            return (
              <Carte key={j} className="flex flex-col p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display font-semibold text-navy-900">{label}</h3>
                  <button onClick={() => setModale(j)} className="text-xs text-navy-700 hover:text-or-500">+ Ajouter</button>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-navy-900/30">Libre</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((c) => (
                      <li key={c.id} className="rounded-xl border border-navy-900/10 p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-mono text-xs text-or-600">{hhmm(c.heure_debut)} – {hhmm(c.heure_fin)}</p>
                            <p className="font-medium text-navy-900">{c.matieres?.libelle || "—"}</p>
                            <p className="text-xs text-navy-900/50">
                              {c.enseignants ? `${c.enseignants.prenom} ${c.enseignants.nom}` : ""}
                              {c.salle ? ` · ${c.salle}` : ""}
                            </p>
                          </div>
                          <button onClick={() => wrap(() => api.supprimerCreneau(c.id))} className="text-navy-900/30 hover:text-rose-500">✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Carte>
            );
          })}
        </div>
      )}

      <ModaleCreneau
        jour={modale} onFermer={() => setModale(null)} matieres={matieres} enseignants={enseignants} salles={salles}
        onCreer={(data) => wrap(async () => {
          await api.creerCreneau(ecoleId, { ...data, enseignant_id: data.enseignant_id || null, salle: data.salle || null, classe_id: classeId, jour: modale });
          setModale(null);
        })}
      />
    </div>
  );
}

function ModaleCreneau({ jour, onFermer, matieres, enseignants, salles, onCreer }) {
  const [f, setF] = useState({ heure_debut: "08:00", heure_fin: "09:00", matiere_id: "", enseignant_id: "", salle: "" });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const label = (api.JOURS.find((x) => x[0] === jour) || [])[1];
  return (
    <Modale ouvert={jour != null} onFermer={onFermer} titre={`Créneau — ${label || ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.matiere_id) return; onCreer(f); }}>
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Début" type="time" value={f.heure_debut} onChange={(e) => maj("heure_debut", e.target.value)} />
          <Champ label="Fin" type="time" value={f.heure_fin} onChange={(e) => maj("heure_fin", e.target.value)} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Matière *</span>
          <select value={f.matiere_id} onChange={(e) => maj("matiere_id", e.target.value)} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {matieres.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Enseignant</span>
          <select value={f.enseignant_id} onChange={(e) => maj("enseignant_id", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">—</option>
            {enseignants.map((en) => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Salle</span>
          <input list="salles-dispo" value={f.salle} onChange={(e) => maj("salle", e.target.value)} placeholder="Salle 3…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
          <datalist id="salles-dispo">{salles.map((s) => <option key={s.id} value={s.nom} />)}</datalist>
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.matiere_id}>Ajouter</Bouton>
        </div>
      </form>
    </Modale>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet 2 — Grille horaire (jour par jour)                          */
/* ------------------------------------------------------------------ */
function PanneauGrille({ ecoleId, grille, onChange, onErreur }) {
  const toast = useToast();
  const [jour, setJour] = useState(1);
  const [lignes, setLignes] = useState([]);

  useEffect(() => {
    setLignes(grille.filter((c) => c.jour === jour).map((c) => ({ heure_debut: hhmm(c.heure_debut), heure_fin: hhmm(c.heure_fin), pause: c.pause })));
  }, [grille, jour]);

  const maj = (i, k, v) => setLignes((s) => s.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const ajouter = () => setLignes((s) => [...s, { heure_debut: s.length ? s[s.length - 1].heure_fin : "08:00", heure_fin: "", pause: false }]);
  const retirer = (i) => setLignes((s) => s.filter((_, j) => j !== i));

  const enregistrer = async () => {
    try {
      const valides = lignes.filter((l) => l.heure_debut && l.heure_fin);
      await api.sauverGrilleJour(ecoleId, jour, valides);
      await onChange();
      toast.succes("Grille du jour enregistrée.");
    } catch (e) { onErreur(e.message); }
  };

  // Copie la grille du jour courant vers les autres jours ouvrés.
  const copierPartout = async () => {
    try {
      const valides = lignes.filter((l) => l.heure_debut && l.heure_fin);
      for (const [j] of api.JOURS) if (j !== jour) await api.sauverGrilleJour(ecoleId, j, valides);
      await onChange();
      toast.succes("Grille copiée sur tous les jours.");
    } catch (e) { onErreur(e.message); }
  };

  return (
    <Carte className="max-w-2xl p-6">
      <p className="mb-4 text-sm text-navy-900/50">
        Définissez les créneaux type de chaque jour. Cochez « pause » pour une récréation ou une pause déjeuner
        (elle n'est pas planifiable). Le générateur ne place les cours que dans les créneaux non-pause.
      </p>
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl bg-navy-900/5 p-1">
        {api.JOURS.map(([j, l]) => (
          <button key={j} onClick={() => setJour(j)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${jour === j ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {lignes.length === 0 && <p className="text-sm text-navy-900/40">Aucun créneau ce jour.</p>}
        {lignes.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-900/10 p-2">
            <input type="time" value={l.heure_debut} onChange={(e) => maj(i, "heure_debut", e.target.value)}
              className="rounded-lg border border-navy-900/15 px-2 py-1.5 text-sm" />
            <span className="text-navy-900/30">→</span>
            <input type="time" value={l.heure_fin} onChange={(e) => maj(i, "heure_fin", e.target.value)}
              className="rounded-lg border border-navy-900/15 px-2 py-1.5 text-sm" />
            <label className="ml-2 flex items-center gap-1.5 text-sm text-navy-900/60">
              <input type="checkbox" checked={l.pause} onChange={(e) => maj(i, "pause", e.target.checked)} /> pause
            </label>
            <button onClick={() => retirer(i)} className="ml-auto text-navy-900/30 hover:text-rose-500">✕</button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Bouton variante="fantome" onClick={ajouter}>+ Créneau</Bouton>
        <Bouton onClick={enregistrer}>Enregistrer {(api.JOURS.find((x) => x[0] === jour) || [])[1]}</Bouton>
        <button onClick={copierPartout} className="text-xs text-navy-700 hover:text-or-600">Copier sur tous les jours →</button>
      </div>
    </Carte>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet 3 — Volumes horaires (par niveau)                           */
/* ------------------------------------------------------------------ */
function PanneauVolumes({ ecoleId, niveaux, matieres, volumes, onChange, onErreur }) {
  const toast = useToast();
  const [niveauId, setNiveauId] = useState(niveaux[0]?.id || "");
  useEffect(() => { if (!niveauId && niveaux[0]) setNiveauId(niveaux[0].id); }, [niveaux, niveauId]);

  const volDe = (mid) => volumes.find((v) => v.niveau_id === niveauId && v.matiere_id === mid)?.heures ?? 0;
  const total = matieres.reduce((s, m) => s + volDe(m.id), 0);

  const setVol = async (mid, val) => {
    try { await api.sauverVolume(ecoleId, niveauId, mid, val); await onChange(); }
    catch (e) { onErreur(e.message); }
  };

  if (niveaux.length === 0) return <Carte className="p-6 text-sm text-navy-900/50">Créez d'abord des niveaux dans « Structure ».</Carte>;

  return (
    <Carte className="max-w-2xl p-6">
      <p className="mb-4 text-sm text-navy-900/50">
        Nombre de séances par semaine pour chaque matière, à ce niveau. Ces volumes s'appliquent à toutes les classes du niveau.
      </p>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Niveau</span>
        <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)}
          className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
          {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle}</option>)}
        </select>
      </label>

      {matieres.length === 0 ? (
        <p className="text-sm text-navy-900/40">Aucune matière. Ajoutez-en dans « Structure ».</p>
      ) : (
        <ul className="divide-y divide-navy-900/5">
          {matieres.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-navy-900">{m.libelle}</span>
              <input type="number" min="0" max="20" defaultValue={volDe(m.id)}
                onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== volDe(m.id)) setVol(m.id, v); }}
                className="w-20 rounded-lg border border-navy-900/15 px-3 py-1.5 text-right text-sm outline-none focus:border-or-500" />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-right text-sm text-navy-900/60">Total : <b className="text-navy-900">{total} h/semaine</b></p>
    </Carte>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet 4 — Salles                                                  */
/* ------------------------------------------------------------------ */
function PanneauSalles({ ecoleId, salles, onChange, onErreur }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [nom, setNom] = useState("");
  const [cap, setCap] = useState("");

  const ajouter = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    try { await api.creerSalle(ecoleId, nom.trim(), cap ? Number(cap) : null); setNom(""); setCap(""); await onChange(); toast.succes("Salle ajoutée."); }
    catch (er) { onErreur(er.message); }
  };
  const supprimer = async (s) => {
    if (!(await confirmer(`Supprimer la salle « ${s.nom} » ?`))) return;
    try { await api.supprimerSalle(s.id); await onChange(); } catch (e) { onErreur(e.message); }
  };

  return (
    <Carte className="max-w-xl p-6">
      <p className="mb-4 text-sm text-navy-900/50">
        Les salles servent à éviter qu'une même salle soit affectée à deux classes sur le même créneau lors de la génération.
      </p>
      <ul className="divide-y divide-navy-900/5">
        {salles.length === 0 && <p className="text-sm text-navy-900/40">Aucune salle.</p>}
        {salles.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-navy-900">{s.nom}{s.capacite ? <span className="ml-2 text-xs text-navy-900/40">{s.capacite} places</span> : ""}</span>
            <button onClick={() => supprimer(s)} className="text-navy-900/30 hover:text-rose-500">✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={ajouter} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1"><Champ label="Nom de la salle" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Salle 1, Labo…" /></div>
        <div className="w-28"><Champ label="Capacité" value={cap} onChange={(e) => setCap(e.target.value.replace(/[^0-9]/g, ""))} /></div>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet 5 — Génération automatique                                  */
/* ------------------------------------------------------------------ */
function PanneauGenerer({ ecoleId, annee, classes, niveaux, matieres, enseignants, grille, salles, volumes }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [selection, setSelection] = useState(() => new Set());
  const [resultat, setResultat] = useState(null); // { creneaux, nonPlaces }
  const [apercuClasse, setApercuClasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const niveauLibelle = Object.fromEntries(niveaux.map((n) => [n.id, n.libelle]));
  const matiereLibelle = Object.fromEntries(matieres.map((m) => [m.id, m.libelle]));
  const ensLibelle = Object.fromEntries(enseignants.map((e) => [e.id, `${e.prenom} ${e.nom}`]));
  const creneauxCours = grille.filter((c) => !c.pause);

  const toggle = (id) => setSelection((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toutes = () => setSelection((s) => (s.size === classes.length ? new Set() : new Set(classes.map((c) => c.id))));

  async function generer() {
    setErreur(""); setResultat(null);
    const cibles = classes.filter((c) => selection.has(c.id));
    if (cibles.length === 0) { setErreur("Sélectionnez au moins une classe."); return; }
    if (creneauxCours.length === 0) { setErreur("Configurez d'abord la grille horaire (onglet « Grille horaire »)."); return; }
    setOccupe(true);
    try {
      const [affectationMap, emploisExistants] = await Promise.all([
        api.getAffectationMap(ecoleId, annee?.id),
        api.getTousEmplois(ecoleId),
      ]);
      const volumesParNiveau = {};
      for (const v of volumes) (volumesParNiveau[v.niveau_id] ||= []).push({ matiere_id: v.matiere_id, heures: v.heures });
      const res = genererEDT({
        classes: cibles, grille, volumesParNiveau, matiereLibelle, affectationMap, salles, emploisExistants,
      });
      setResultat(res);
      setApercuClasse(cibles[0]?.id || "");
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(false); }
  }

  async function appliquer() {
    if (!resultat) return;
    const cibles = classes.filter((c) => selection.has(c.id));
    if (!(await confirmer({
      titre: "Appliquer l'emploi du temps",
      message: `Remplacer l'emploi du temps de ${cibles.length} classe(s) par la version générée ? L'emploi du temps actuel de ces classes sera écrasé.`,
      confirmer: "Appliquer",
    }))) return;
    setOccupe(true);
    try {
      await api.appliquerGeneration(ecoleId, cibles.map((c) => c.id), resultat.creneaux);
      toast.succes("Emploi du temps appliqué.");
      setResultat(null); setSelection(new Set());
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(false); }
  }

  // Compteur de séances par classe (placées vs attendues).
  const attenduParClasse = (cl) => (volumes.filter((v) => v.niveau_id === cl.niveau_id).reduce((s, v) => s + (v.heures || 0), 0));

  const apercu = resultat && apercuClasse
    ? resultat.creneaux.filter((c) => c.classe_id === apercuClasse)
    : [];

  return (
    <div className="space-y-5">
      <Alerte ton="erreur">{erreur}</Alerte>

      <Carte className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-navy-900">Classes à générer</h3>
          <button onClick={toutes} className="text-xs font-medium text-navy-700 hover:text-or-600">
            {selection.size === classes.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        {classes.length === 0 ? (
          <p className="mt-3 text-sm text-navy-900/40">Aucune classe pour l'année en cours.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {classes.map((c) => {
              const att = attenduParClasse(c);
              return (
                <label key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selection.has(c.id) ? "border-or-500 bg-or-500/5" : "border-navy-900/10"}`}>
                  <input type="checkbox" checked={selection.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="truncate">
                    <span className="font-medium text-navy-900">{c.libelle}</span>
                    <span className="ml-1 block text-[11px] text-navy-900/40">{att ? `${att} h/sem` : "aucun volume"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Bouton onClick={generer} disabled={occupe || selection.size === 0}>{occupe ? "Génération…" : "⚡ Générer l'aperçu"}</Bouton>
          <span className="text-xs text-navy-900/40">
            {creneauxCours.length} créneau(x) · {salles.length} salle(s) · grille jour par jour
          </span>
        </div>
      </Carte>

      {resultat && (
        <>
          {/* Rapport */}
          <Carte className={`p-6 ${resultat.nonPlaces.length ? "border-l-4 border-l-rose-400" : "border-l-4 border-l-emerald-400"}`}>
            <h3 className="font-display text-lg font-semibold text-navy-900">
              {resultat.creneaux.length} séance(s) placée(s)
              {resultat.nonPlaces.length > 0 && <span className="ml-2 text-rose-600">· {resultat.nonPlaces.length} non placée(s)</span>}
            </h3>
            {resultat.nonPlaces.length > 0 && (
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-navy-900/60">Heures non placées (grille trop petite, prof déjà occupé ou salle indisponible) :</p>
                <ul className="mt-1 max-h-40 overflow-auto rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {resultat.nonPlaces.map((np, i) => (
                    <li key={i}>{np.classe} — {np.matiere}{np.sansProf ? " (aucun enseignant affecté)" : ""}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Bouton onClick={appliquer} disabled={occupe}>Appliquer</Bouton>
              <Bouton variante="fantome" onClick={() => setResultat(null)}>Annuler</Bouton>
            </div>
          </Carte>

          {/* Aperçu par classe */}
          <Carte className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-lg font-semibold text-navy-900">Aperçu</h3>
              <select value={apercuClasse} onChange={(e) => setApercuClasse(e.target.value)}
                className="rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500">
                {classes.filter((c) => selection.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {api.JOURS.map(([j, label]) => {
                const items = apercu.filter((c) => c.jour === j).sort((a, b) => String(a.heure_debut).localeCompare(String(b.heure_debut)));
                return (
                  <div key={j} className="rounded-xl border border-navy-900/10 p-4">
                    <h4 className="mb-2 font-display font-semibold text-navy-900">{label}</h4>
                    {items.length === 0 ? <p className="text-sm text-navy-900/30">Libre</p> : (
                      <ul className="space-y-1.5">
                        {items.map((c, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-mono text-xs text-or-600">{hhmm(c.heure_debut)}</span>{" "}
                            <span className="font-medium text-navy-900">{matiereLibelle[c.matiere_id] || "—"}</span>
                            <span className="block text-[11px] text-navy-900/50">
                              {c.enseignant_id ? ensLibelle[c.enseignant_id] : "—"}{c.salle ? ` · ${c.salle}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}
