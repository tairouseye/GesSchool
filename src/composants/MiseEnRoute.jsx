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
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

export default function MiseEnRoute({ ecoleId, ecole, modulesActifs, compacte = false }) {
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  //  Repli mémorisé par école : le fil peut rester ouvert des semaines (tant
  //  que la moitié des parents n'est pas reliée) ; on ne l'impose pas chaque
  //  matin en haut de l'accueil.
  //  Sans choix mémorisé, l'accueil la replie sur UNE LIGNE dès 5 étapes
  //  faites (test du 09/11/2026 : dépliée, elle remplissait tout le premier
  //  écran d'un portable, et les chiffres du jour passaient sous le pli).
  const cleRepli = `mise_en_route_repliee_${ecoleId}`;
  const [choix, setChoix] = useState(() => { try { return localStorage.getItem(cleRepli); } catch { return null; } });

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
  const faites = etapes.length - restants;
  const replie = choix != null ? choix === "1" : compacte && faites >= 5;
  const basculerRepli = () => {
    const v = replie ? "0" : "1";
    try { localStorage.setItem(cleRepli, v); } catch { /* ignoré */ }
    setChoix(v);
  };

  async function structureType() {
    setEnCours(true);
    try {
      const r = await appliquerStructureType();
      const total = (r.niveaux || 0) + (r.matieres || 0) + (r.periodes || 0);
      if (total === 0) toast.succes("Rien à créer : votre structure est déjà en place.");
      else toast.succes(`Créé : ${pl(r.niveaux || 0, "niveau", "niveaux")}, ${pl(r.classes || 0, "classe")}, ${pl(r.matieres || 0, "matière")}${r.periodes ? `, ${pl(r.periodes, "période datée", "périodes datées")}` : ""}. Tout reste modifiable.`);
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
  const barre = (
    <div className="h-1.5 overflow-hidden rounded-full bg-navy-900/10">
      <div className="h-full rounded-full bg-or-500" style={{ width: `${Math.round((faites / etapes.length) * 100)}%` }} />
    </div>
  );
  if (replie) return (
    <Carte className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-l-or-500 px-5 py-3">
      <p className="text-sm font-semibold text-navy-900">Mise en route {faites} / {etapes.length}</p>
      <div className="min-w-24 flex-1">{barre}</div>
      <p className="min-w-0 text-sm text-navy-900/60">Prochaine étape : <b className="text-navy-900">{prochaine.label}</b></p>
      <Link to={prochaine.to} className="text-sm font-semibold text-navy-700 hover:text-or-600">{prochaine.action} →</Link>
      <button type="button" onClick={basculerRepli} aria-expanded="false"
        className="min-h-10 text-xs font-medium text-navy-900/50 underline-offset-2 hover:text-navy-900 hover:underline">
        Voir les étapes
      </button>
    </Carte>
  );
  return (
    <Carte className="border-l-4 border-l-or-500 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy-900">Mise en route — {ecole?.nom}</h3>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-or-600">{faites} / {etapes.length} étapes</span>
          <button type="button" onClick={basculerRepli} aria-expanded="true"
            className="min-h-10 text-xs font-medium text-navy-900/50 underline-offset-2 hover:text-navy-900 hover:underline">
            Replier
          </button>
        </span>
      </div>
      <div className="mt-2">{barre}</div>
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
    </Carte>
  );
}
