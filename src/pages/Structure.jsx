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
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [an, cy, ni, ma] = await Promise.all([
        api.getAnneeCourante(ecoleId),
        api.getCycles(ecoleId),
        api.getNiveaux(ecoleId),
        api.getMatieres(ecoleId),
      ]);
      setAnnee(an);
      setCycles(cy);
      setNiveaux(ni);
      setMatieres(ma);
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
              annee={annee}
              onAjoutNiveau={(libelle, ordre) =>
                wrap(() => api.creerNiveau(ecoleId, cycle.id, libelle, ordre))
              }
              onSupprNiveau={(id) => wrap(() => api.supprimerNiveau(id))}
              onAjoutClasse={(niveauId, libelle, eff) =>
                wrap(() => api.creerClasse(ecoleId, niveauId, annee.id, libelle, eff))
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
      </div>
    </>
  );
}

function CarteCycle({ cycle, niveaux, classes, annee, onAjoutNiveau, onSupprNiveau, onAjoutClasse, onSupprClasse }) {
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
            annee={annee}
            onSuppr={() => onSupprNiveau(niveau.id)}
            onAjoutClasse={(lib, eff) => onAjoutClasse(niveau.id, lib, eff)}
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

function LigneNiveau({ niveau, classes, annee, onSuppr, onAjoutClasse, onSupprClasse }) {
  const [classe, setClasse] = useState("");
  const [eff, setEff] = useState("");
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
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!classe.trim() || !annee) return;
          onAjoutClasse(classe.trim(), eff ? Number(eff) : null);
          setClasse("");
          setEff("");
        }}
      >
        <input
          value={classe}
          onChange={(e) => setClasse(e.target.value)}
          placeholder={`Classe (ex. ${niveau.libelle} A)`}
          className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500"
        />
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
