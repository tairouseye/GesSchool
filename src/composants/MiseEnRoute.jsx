import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bouton, Carte } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { getAnneeCourante, etatMiseEnRoute, appliquerStructureType } from "@/lib/academique.js";
import { moduleActif } from "@/lib/modules.js";
import { etapesMiseEnRoute } from "@/lib/miseEnRoute.js";

// GesSchool — le fil de mise en route (prise en main, lot 2, 03/11/2026).
//
// 🔴 POURQUOI ICI, ET POUR LA DIRECTION AUSSI. La liste ne vivait que dans
// Pilotage, donc pour le promoteur seul ; la direction invitée pour
// paramétrer l'école ne la voyait jamais. Elle s'arrêtait en outre aux
// élèves inscrits : Tut'Tank l'avait « terminée » avec aucun enseignant
// relié et 4 parents sur 145.
//
// `compacte` : sur les accueils Gestion et Pédagogie, elle disparaît une fois
// terminée (Pilotage, lui, affiche « Mise en route terminée »).
export default function MiseEnRoute({ ecoleId, ecole, modulesActifs, compacte = false }) {
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  //  Repli mémorisé par école : le fil peut rester ouvert des semaines (tant
  //  que la moitié des parents n'est pas reliée) ; on ne l'impose pas chaque
  //  matin en haut de l'accueil.
  const cleRepli = `mise_en_route_repliee_${ecoleId}`;
  const [replie, setReplie] = useState(() => { try { return localStorage.getItem(cleRepli) === "1"; } catch { return false; } });
  const basculerRepli = () => setReplie((r) => { try { localStorage.setItem(cleRepli, r ? "0" : "1"); } catch { /* ignoré */ } return !r; });

  const charger = useCallback(async () => {
    try {
      const an = await getAnneeCourante(ecoleId);
      setEtat(await etatMiseEnRoute(ecoleId, an?.id));
    } catch { setEtat(null); }
  }, [ecoleId]);
  useEffect(() => { charger(); }, [charger]);

  if (!etat) return null;
  const etapes = etapesMiseEnRoute(etat, { paiements: moduleActif(modulesActifs, "paiements") });
  const restants = etapes.filter((e) => !e.ok).length;

  async function structureType() {
    setEnCours(true);
    try {
      const r = await appliquerStructureType();
      const total = (r.niveaux || 0) + (r.matieres || 0) + (r.periodes || 0);
      if (total === 0) toast.succes("Rien à créer : votre structure est déjà en place.");
      else toast.succes(`Créé : ${r.niveaux || 0} niveau(x), ${r.classes || 0} classe(s), ${r.matieres || 0} matière(s)${r.periodes ? `, ${r.periodes} période(s) datée(s)` : ""}. Tout reste modifiable.`);
      await charger();
    } catch (e) {
      toast.erreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  if (restants === 0) {
    if (compacte) return null;
    return (
      <Carte className="flex items-center gap-3 border-l-4 border-l-emerald-400 p-4">
        <span className="text-lg" aria-hidden>✅</span>
        <p className="text-sm text-navy-900/70"><b className="text-navy-900">Mise en route terminée</b> — {ecole?.nom} est entièrement paramétrée.</p>
      </Carte>
    );
  }

  const prochaine = etapes.find((e) => !e.ok);
  return (
    <Carte className="border-l-4 border-l-or-500 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy-900">Mise en route — {ecole?.nom}</h3>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-or-600">{etapes.length - restants} / {etapes.length} étapes</span>
          <button type="button" onClick={basculerRepli} aria-expanded={!replie}
            className="text-xs font-medium text-navy-900/50 underline-offset-2 hover:text-navy-900 hover:underline">
            {replie ? "Déplier" : "Replier"}
          </button>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-900/10">
        <div className="h-full rounded-full bg-or-500" style={{ width: `${Math.round(((etapes.length - restants) / etapes.length) * 100)}%` }} />
      </div>
      {!replie && (<>
      <p className="mt-3 text-sm text-navy-900/60">
        Prochaine étape : <b className="text-navy-900">{prochaine.label}</b> — {prochaine.aide}
      </p>
      {etat.niveaux === 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-or-500/10 p-3">
          <p className="min-w-0 flex-1 text-sm text-navy-900/80">
            <b>Gagnez une heure :</b> créez d&apos;un clic les niveaux officiels, une classe par niveau, les matières
            du programme et les dates des trimestres. Tout reste modifiable ensuite.
          </p>
          <Bouton variante="or" onClick={structureType} disabled={enCours}>{enCours ? "Création…" : "Créer la structure type"}</Bouton>
        </div>
      )}
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {etapes.map((e, i) => (
          <li key={e.id} className={`flex items-center gap-3 rounded-xl border p-3 ${e.ok ? "border-navy-900/10" : "border-or-500/40 bg-or-500/5"}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${e.ok ? "bg-emerald-500/15 text-emerald-700" : "bg-or-500/20 text-or-600"}`} aria-hidden>
              {e.ok ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-900">{e.label}</p>
              <p className="text-xs text-navy-900/50">{e.detail}</p>
            </div>
            {!e.ok && <Link to={e.to} className="shrink-0 text-xs font-medium text-navy-700 hover:text-or-600">{e.action} →</Link>}
          </li>
        ))}
      </ol>
      </>)}
    </Carte>
  );
}
