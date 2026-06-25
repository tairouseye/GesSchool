import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";
import * as api from "@/lib/academique.js";

// Phase 0.5 — Structure académique : cycles → niveaux → classes + matières.
export default function Structure() {
  const { ecoleId } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [series, setSeries] = useState([]);
  const [coefficients, setCoefficients] = useState([]);
  const [config, setConfig] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [an, cy, ni, ma, se, co, cf] = await Promise.all([
        api.getAnneeCourante(ecoleId),
        api.getCycles(ecoleId),
        api.getNiveaux(ecoleId),
        api.getMatieres(ecoleId),
        api.getSeries(ecoleId),
        api.getCoefficients(ecoleId),
        api.getConfigEcole(ecoleId),
      ]);
      setAnnee(an);
      setCycles(cy);
      setNiveaux(ni);
      setMatieres(ma);
      setSeries(se);
      setCoefficients(co);
      setConfig(cf);
      setClasses(await api.getClasses(ecoleId, an?.id));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const wrap = async (fn) => {
    setErreur("");
    try {
      await fn();
      await recharger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  if (chargement) {
    return (
      <>
        <EnTete titre="Structure académique" />
        <div className="p-8 text-navy-900/50">Chargement…</div>
      </>
    );
  }

  return (
    <>
      <EnTete
        titre="Structure académique"
        sousTitre={annee ? `Année ${annee.libelle}` : "Aucune année courante"}
      />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Cycles → Niveaux → Classes */}
        <div className="space-y-5">
          {cycles.length === 0 && (
            <Carte className="p-6 text-sm text-navy-900/50">
              Aucun cycle activé. (Les cycles sont définis à la création de l'école.)
            </Carte>
          )}
          {cycles.map((cycle) => (
            <CarteCycle
              key={cycle.id}
              cycle={cycle}
              niveaux={niveaux.filter((n) => n.cycle_id === cycle.id)}
              classes={classes}
              series={series}
              annee={annee}
              onAjoutNiveau={(libelle, ordre) =>
                wrap(() => api.creerNiveau(ecoleId, cycle.id, libelle, ordre))
              }
              onSupprNiveau={(id) => wrap(() => api.supprimerNiveau(id))}
              onAjoutClasse={(niveauId, libelle, eff, serieId) =>
                wrap(() => api.creerClasse(ecoleId, niveauId, annee.id, libelle, eff, serieId))
              }
              onSupprClasse={(id) => wrap(() => api.supprimerClasse(id))}
            />
          ))}
        </div>

        {/* Matières */}
        <PanneauMatieres
          matieres={matieres}
          cycles={cycles}
          onAjout={(libelle, code, cycleId) =>
            wrap(() => api.creerMatiere(ecoleId, libelle, code, cycleId))
          }
          onSuppr={(id) => wrap(() => api.supprimerMatiere(id))}
        />

        {/* Séries (lycée) */}
        <PanneauSeries
          series={series}
          onAjout={(code, libelle) => wrap(() => api.creerSerie(ecoleId, code, libelle, series.length + 1))}
          onSuppr={(id) => wrap(() => api.supprimerSerie(id))}
          onSemer={() => wrap(() => api.semerSeriesStandard(ecoleId, series))}
        />

        {/* Grille de coefficients */}
        <PanneauCoefficients
          matieres={matieres}
          niveaux={niveaux}
          series={series}
          coefficients={coefficients}
          onDefinir={(scope) => wrap(() => api.definirCoefficient(ecoleId, scope))}
        />

        {/* Configuration du matricule */}
        <PanneauMatricule
          config={config}
          onEnregistrer={(cfg) => wrap(() => api.majConfigMatricule(ecoleId, cfg))}
        />
      </div>
    </>
  );
}

function CarteCycle({ cycle, niveaux, classes, series, annee, onAjoutNiveau, onSupprNiveau, onAjoutClasse, onSupprClasse }) {
  const [nouveauNiveau, setNouveauNiveau] = useState("");
  return (
    <Carte className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-navy-900">{cycle.libelle}</h3>
        <span className="rounded-full bg-navy-900/5 px-3 py-1 text-xs text-navy-900/50">
          {niveaux.length} niveau{niveaux.length > 1 ? "x" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {niveaux.map((niveau) => (
          <LigneNiveau
            key={niveau.id}
            niveau={niveau}
            classes={classes.filter((c) => c.niveau_id === niveau.id)}
            series={series}
            annee={annee}
            onSuppr={() => onSupprNiveau(niveau.id)}
            onAjoutClasse={(lib, eff, serieId) => onAjoutClasse(niveau.id, lib, eff, serieId)}
            onSupprClasse={onSupprClasse}
          />
        ))}
      </div>

      {/* Ajout niveau */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nouveauNiveau.trim()) return;
          onAjoutNiveau(nouveauNiveau.trim(), niveaux.length + 1);
          setNouveauNiveau("");
        }}
      >
        <input
          value={nouveauNiveau}
          onChange={(e) => setNouveauNiveau(e.target.value)}
          placeholder="Nouveau niveau (ex. 6e, CP, Seconde…)"
          className="flex-1 rounded-xl border border-navy-900/15 bg-creme px-4 py-2 text-sm outline-none focus:border-or-500"
        />
        <Bouton type="submit" variante="fantome">+ Niveau</Bouton>
      </form>
    </Carte>
  );
}

function LigneNiveau({ niveau, classes, series, annee, onSuppr, onAjoutClasse, onSupprClasse }) {
  const [classe, setClasse] = useState("");
  const [eff, setEff] = useState("");
  const [serieId, setSerieId] = useState("");
  const serieCode = (id) => series.find((s) => s.id === id)?.code;
  return (
    <div className="rounded-xl border border-navy-900/10 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-navy-900">{niveau.libelle}</span>
        <button onClick={onSuppr} className="text-xs text-rose-500 hover:underline">
          supprimer
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {classes.map((c) => (
          <span
            key={c.id}
            className="group inline-flex items-center gap-1 rounded-lg bg-navy-900/5 px-2.5 py-1 text-xs text-navy-900"
          >
            {c.libelle}
            {c.serie_id && (
              <span className="rounded bg-or-500/20 px-1 font-mono text-[10px] text-or-600">{serieCode(c.serie_id)}</span>
            )}
            <button
              onClick={() => onSupprClasse(c.id)}
              className="text-navy-900/30 hover:text-rose-500"
              title="Supprimer la classe"
            >
              ✕
            </button>
          </span>
        ))}
        {classes.length === 0 && <span className="text-xs text-navy-900/40">aucune classe</span>}
      </div>

      {/* Ajout classe */}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!classe.trim() || !annee) return;
          onAjoutClasse(classe.trim(), eff ? Number(eff) : null, serieId || null);
          setClasse("");
          setEff("");
          setSerieId("");
        }}
      >
        <input
          value={classe}
          onChange={(e) => setClasse(e.target.value)}
          placeholder={`Classe (ex. ${niveau.libelle} A)`}
          className="min-w-40 flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500"
        />
        {series.length > 0 && (
          <select
            value={serieId}
            onChange={(e) => setSerieId(e.target.value)}
            className="rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-or-500"
            title="Série (lycée)"
          >
            <option value="">Sans série</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.code}</option>
            ))}
          </select>
        )}
        <input
          value={eff}
          onChange={(e) => setEff(e.target.value.replace(/\D/g, ""))}
          placeholder="Effectif max"
          className="w-28 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500"
        />
        <Bouton type="submit" variante="or" className="px-3 py-1.5 text-xs" disabled={!annee}>
          + Classe
        </Bouton>
      </form>
    </div>
  );
}

function PanneauMatieres({ matieres, cycles, onAjout, onSuppr }) {
  const [libelle, setLibelle] = useState("");
  const [code, setCode] = useState("");
  const [cycleId, setCycleId] = useState("");
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Matières</h3>

      <div className="flex flex-wrap gap-2">
        {matieres.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-900/10 bg-creme px-3 py-1.5 text-sm"
          >
            {m.code && <span className="font-mono text-xs text-or-500">{m.code}</span>}
            {m.libelle}
            <button onClick={() => onSuppr(m.id)} className="text-navy-900/30 hover:text-rose-500">
              ✕
            </button>
          </span>
        ))}
        {matieres.length === 0 && <span className="text-sm text-navy-900/40">aucune matière</span>}
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!libelle.trim()) return;
          onAjout(libelle.trim(), code.trim(), cycleId || null);
          setLibelle("");
          setCode("");
          setCycleId("");
        }}
      >
        <div className="min-w-48 flex-1">
          <Champ
            label="Matière"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Mathématiques"
          />
        </div>
        <div className="w-28">
          <Champ label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MATH" />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Cycle (optionnel)</span>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          >
            <option value="">Tous</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}

// --- Séries (lycée) : L, S2, G… ---
function PanneauSeries({ series, onAjout, onSuppr, onSemer }) {
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  return (
    <Carte className="p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy-900">Séries (lycée)</h3>
        <button onClick={onSemer} className="text-xs text-navy-700 hover:text-or-500">
          + Pré-remplir les séries standard
        </button>
      </div>
      <p className="mb-4 text-xs text-navy-900/40">
        Les séries servent à définir des coefficients différents (ex. Maths coef 6 en S2).
        À rattacher à une classe de lycée.
      </p>

      <div className="flex flex-wrap gap-2">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-navy-900/10 bg-creme px-3 py-1.5 text-sm">
            <span className="font-mono text-xs text-or-600">{s.code}</span>
            {s.libelle}
            <button onClick={() => onSuppr(s.id)} className="text-navy-900/30 hover:text-rose-500">✕</button>
          </span>
        ))}
        {series.length === 0 && <span className="text-sm text-navy-900/40">aucune série</span>}
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim() || !libelle.trim()) return;
          onAjout(code.trim().toUpperCase(), libelle.trim());
          setCode("");
          setLibelle("");
        }}
      >
        <div className="w-28">
          <Champ label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="S2" />
        </div>
        <div className="min-w-48 flex-1">
          <Champ label="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Scientifique 2" />
        </div>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}

// --- Grille de coefficients (matière × portée série/niveau) ---
function PanneauCoefficients({ matieres, niveaux, series, coefficients, onDefinir }) {
  // Portée sélectionnée encodée "serie:<id>" ou "niveau:<id>".
  const [portee, setPortee] = useState("");
  const [valeurs, setValeurs] = useState({}); // matiere_id -> string

  const [type, id] = portee ? portee.split(":") : [];

  // Re-synchronise les valeurs affichées quand la portée ou la grille change.
  useEffect(() => {
    if (!portee) {
      setValeurs({});
      return;
    }
    const map = {};
    for (const c of coefficients) {
      const match = type === "serie" ? c.serie_id === id : c.niveau_id === id;
      if (match) map[c.matiere_id] = String(c.coefficient);
    }
    setValeurs(map);
  }, [portee, coefficients, type, id]);

  const commit = (matiereId, valeur) => {
    const scope = type === "serie" ? { serieId: id } : { niveauId: id };
    onDefinir({ matiereId, ...scope, coefficient: valeur });
  };

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Grille de coefficients</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Saisis une fois les coefficients d'une série (ou d'un niveau) : ils s'appliquent
        automatiquement à toutes les classes concernées. Laisse vide (ou 0) pour ne pas compter une matière.
      </p>

      <label className="block max-w-sm">
        <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Portée</span>
        <select
          value={portee}
          onChange={(e) => setPortee(e.target.value)}
          className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
        >
          <option value="">— Choisir une série ou un niveau —</option>
          {series.length > 0 && (
            <optgroup label="Séries (lycée)">
              {series.map((s) => (
                <option key={s.id} value={`serie:${s.id}`}>{s.code} — {s.libelle}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="Niveaux">
            {niveaux.map((n) => (
              <option key={n.id} value={`niveau:${n.id}`}>{n.libelle}</option>
            ))}
          </optgroup>
        </select>
      </label>

      {portee && (
        <div className="mt-5 space-y-2">
          {matieres.length === 0 && <p className="text-sm text-navy-900/40">Ajoute d'abord des matières.</p>}
          {matieres.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy-900/10 px-3 py-2">
              <span className="text-sm text-navy-900">
                {m.code && <span className="mr-2 font-mono text-xs text-or-600">{m.code}</span>}
                {m.libelle}
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={valeurs[m.id] ?? ""}
                onChange={(e) => setValeurs((s) => ({ ...s, [m.id]: e.target.value }))}
                onBlur={(e) => commit(m.id, e.target.value)}
                placeholder="—"
                className="w-24 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-right text-sm font-mono outline-none focus:border-or-500"
              />
            </div>
          ))}
        </div>
      )}
    </Carte>
  );
}

// --- Configuration du matricule élève ---
function PanneauMatricule({ config, onEnregistrer }) {
  const [prefixe, setPrefixe] = useState("");
  const [separateur, setSeparateur] = useState("-");
  const [longueur, setLongueur] = useState(4);

  useEffect(() => {
    if (!config) return;
    setPrefixe(config.matricule_prefixe ?? "");
    setSeparateur(config.matricule_separateur ?? "-");
    setLongueur(config.matricule_longueur ?? 4);
  }, [config]);

  const aa = String(new Date().getFullYear() % 100).padStart(2, "0");
  const seq = "1".padStart(Math.max(1, Number(longueur) || 4), "0");
  const apercu = (prefixe ? prefixe + (separateur || "-") : "") + aa + (separateur || "-") + seq;

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Matricule des élèves</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Format : <span className="font-mono">{"{PRÉFIXE}{SÉP}{AA}{SÉP}{SÉQUENCE}"}</span>.
        La séquence repart à 1 chaque année. Généré automatiquement à l'inscription.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Champ label="Préfixe" value={prefixe} onChange={(e) => setPrefixe(e.target.value.toUpperCase())} placeholder="GS" />
        <Champ label="Séparateur" value={separateur} onChange={(e) => setSeparateur(e.target.value.slice(0, 1))} placeholder="-" />
        <Champ
          label="Chiffres de séquence"
          type="number"
          min="1"
          max="8"
          value={longueur}
          onChange={(e) => setLongueur(e.target.value.replace(/\D/g, ""))}
          placeholder="4"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-900/60">
          Aperçu : <span className="font-mono text-base font-semibold text-navy-900">{apercu}</span>
        </p>
        <Bouton onClick={() => onEnregistrer({ prefixe, separateur, longueur })}>Enregistrer</Bouton>
      </div>
    </Carte>
  );
}
