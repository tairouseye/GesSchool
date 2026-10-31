import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { enfantFactures, enfantNotes, enfantAbsences, enfantEmploi, enfantFournitures, alertesEnfant } from "@/lib/parent.js";
import { enfantCahier } from "@/lib/cahier.js";
import { annoncesEnfant } from "@/lib/annonces.js";
import {
  coursDuJour, devoirsAVenir, dernieresNotes, absencesAJustifier, aRegler, aVenir, pourQuand, tonNote, fmtNote,
} from "@/lib/apercuEnfant.js";
import { Skeleton } from "@/composants/ui.jsx";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const TYPES_EVAL = { devoir: "devoir", composition: "composition", examen: "examen", interro: "interrogation", tp: "TP", oral: "oral", projet: "projet" };
const TON_NOTE = { rouge: "text-rose-700", or: "text-or-600", vert: "text-emerald-700" };

//  Lecture de ce qu'il faut pour l'aperçu d'un enfant. Chaque source est
//  indépendante (`allSettled`) : une rubrique refusée ou en panne laisse son
//  bloc vide sans faire tomber les autres. Une réponse arrivée après un
//  changement d'enfant est ignorée.
//  `deja` : données déjà chargées par la page (factures, alertes…), pour ne
//  pas les relire.
export function useApercuEnfant(eleveId, deja = {}) {
  const [d, setD] = useState(null);
  const courant = useRef(eleveId);
  useEffect(() => {
    courant.current = eleveId;
    setD(null);
    if (!eleveId) return;
    const pour = eleveId;
    const lire = (cle, fn) => (deja[cle] !== undefined ? Promise.resolve(deja[cle]) : fn(pour));
    Promise.allSettled([
      lire("factures", enfantFactures), enfantNotes(pour), enfantAbsences(pour), enfantCahier(pour),
      enfantEmploi(pour), enfantFournitures(pour), annoncesEnfant(pour), lire("alertes", alertesEnfant),
    ]).then(([f, n, a, c, e, fo, an, al]) => {
      if (courant.current !== pour) return;
      const v = (r) => (r.status === "fulfilled" ? r.value ?? [] : undefined);
      setD({ factures: v(f), notes: v(n), absences: v(a), cahier: v(c), emploi: v(e), fournitures: v(fo), annonces: v(an), alertes: v(al) || {} });
    });
    // `deja` est volontairement hors des dépendances : on ne relit pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveId]);
  return d;
}

// L'aperçu de l'accueil parent (maquette, téléphone 1) : aujourd'hui, quatre
// blocs, dernières notes, à venir. Chaque bloc mène à sa rubrique.
export default function ApercuEnfant({ enfant, devise = "XOF" }) {
  const d = useApercuEnfant(enfant?.eleve_id);
  const lien = (rub) => `/parent/enfant/${enfant.eleve_id}${rub ? `/${rub}` : ""}`;
  if (!enfant) return null;
  if (!d) {
    return (
      <div className="space-y-3" role="status" aria-label="Chargement de l'aperçu">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
      </div>
    );
  }

  const cours = d.emploi ? coursDuJour(d.emploi) : null;
  const regler = d.factures ? aRegler(d.factures) : null;
  const derniere = d.notes ? dernieresNotes(d.notes, 1)[0] : null;
  const aJustifier = d.absences ? absencesAJustifier(d.absences).length : null;
  const devoirs = d.cahier ? devoirsAVenir(d.cahier) : null;
  const notes = d.notes ? dernieresNotes(d.notes, 3) : [];
  const prochains = aVenir({ factures: d.factures || [], cahier: d.cahier || [] });

  return (
    <div className="space-y-3">
      {/* Aujourd'hui : le cours en cours ou le prochain */}
      {cours?.premier && (
        <Link to={lien("emploi")} className="block rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 p-4 text-creme">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-or-400">
            {cours.premier.enCours ? "En ce moment" : "Prochain cours"}{enfant.classe ? ` · ${enfant.classe}` : ""}
          </p>
          <p className="mt-1 font-semibold">{cours.premier.debut} – {cours.premier.fin} · {cours.premier.matiere || cours.premier.activite || "Cours"}</p>
          {cours.suivants.length > 0 && (
            <p className="text-xs text-creme/65">Ensuite : {cours.suivants.map((s) => `${s.debut} ${s.matiere || s.activite || ""}`.trim()).join(" · ")}</p>
          )}
        </Link>
      )}

      {/* Quatre blocs */}
      <div className="grid grid-cols-2 gap-3">
        <Tuile to={lien("paiements")} label="À régler">
          {regler == null ? <Vide /> : regler.reste > 0 ? (
            <>
              <p className="mt-1 font-display text-lg font-bold text-rose-700">{fmt(regler.reste)}</p>
              <p className="text-[11px] text-navy-900/60">{devise}{regler.enRetard ? " · en retard" : regler.echeance ? ` · ${pourQuand(regler.echeance).replace("pour ", "avant ")}` : ""}</p>
              <span className="mt-2 inline-block rounded-lg bg-navy-900 px-3 py-1 text-xs font-semibold text-creme">Payer</span>
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-lg font-bold text-emerald-700">Réglé ✓</p>
              <p className="text-[11px] text-navy-900/60">{regler.facture > 0 ? "Rien à payer pour l'instant" : "Aucune facture"}</p>
            </>
          )}
        </Tuile>
        <Tuile to={lien("notes")} label="Dernière note">
          {derniere ? (
            <>
              <p className={`mt-1 font-display text-lg font-bold ${TON_NOTE[tonNote(derniere.valeur, derniere.bareme)]}`}>
                {fmtNote(derniere.valeur)}<span className="text-xs font-normal text-navy-900/40">/{fmtNote(derniere.bareme)}</span>
              </p>
              <p className="truncate text-[11px] text-navy-900/60">{derniere.matiere}</p>
              {Number(d.alertes?.note) > 0 && <p className="text-[11px] font-semibold text-or-600">{d.alertes.note} nouvelle{d.alertes.note > 1 ? "s" : ""}</p>}
            </>
          ) : <Vide texte={d.notes ? "Pas encore de note" : null} />}
        </Tuile>
        <Tuile to={lien("absences")} label="Absences">
          {aJustifier == null ? <Vide /> : (
            <>
              <p className="mt-1 font-display text-lg font-bold text-navy-900">{d.absences.length}</p>
              <p className={`text-[11px] ${aJustifier > 0 ? "font-semibold text-or-600" : "text-navy-900/60"}`}>
                {aJustifier > 0 ? `${aJustifier} à justifier` : "cette année"}
              </p>
            </>
          )}
        </Tuile>
        <Tuile to={lien("cahier")} label="Devoirs">
          {devoirs == null ? <Vide /> : (
            <>
              <p className="mt-1 font-display text-lg font-bold text-navy-900">{devoirs.length}</p>
              <p className="text-[11px] text-navy-900/60">{devoirs.length ? pourQuand(devoirs[0].date_pour) : "rien à faire"}</p>
            </>
          )}
        </Tuile>
      </div>

      {/* Dernières notes */}
      {notes.length > 0 && (
        <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <div className="flex items-center">
            <p className="text-sm font-semibold text-navy-900">Dernières notes</p>
            <Link to={lien("notes")} className="ml-auto text-xs font-medium text-navy-700">Tout voir</Link>
          </div>
          <ul className="mt-2 divide-y divide-navy-900/5 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="flex items-center py-2">
                <span className="min-w-0 flex-1 truncate text-navy-900">{n.matiere}<span className="text-navy-900/50"> · {TYPES_EVAL[n.type] || n.type}</span></span>
                <b className={TON_NOTE[tonNote(n.valeur, n.bareme)]}>{fmtNote(n.valeur)}/{fmtNote(n.bareme)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* À venir */}
      {prochains.length > 0 && (
        <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <p className="text-sm font-semibold text-navy-900">À venir</p>
          <ul className="mt-2 space-y-2 text-sm">
            {prochains.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={`w-14 shrink-0 rounded-md py-0.5 text-center text-xs font-bold ${p.ton === "rouge" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>
                  {new Date(`${p.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "")}
                </span>
                <span className="text-navy-900">{p.titre}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to={lien(null)} className="flex min-h-11 items-center justify-center rounded-xl border border-navy-900/15 bg-white text-sm font-semibold text-navy-900 hover:border-or-500">
        Toutes les rubriques {/^[aeiouyhàâéèêëîïôöûü]/i.test(enfant.prenom || "") ? "d’" : "de "}{enfant.prenom} →
      </Link>
    </div>
  );
}

function Tuile({ to, label, children }) {
  return (
    <Link to={to} className="block rounded-2xl border border-navy-900/10 bg-white p-3 transition hover:border-or-500/60 active:scale-[.98]">
      <p className="text-[11px] font-medium text-navy-900/60">{label}</p>
      {children}
    </Link>
  );
}

function Vide({ texte = null }) {
  return <p className="mt-1 text-sm text-navy-900/40">{texte || "—"}</p>;
}
