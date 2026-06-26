import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { enfantNotes, enfantFactures, enfantAbsences, enfantEmploi } from "@/lib/parent.js";
import { JOURS } from "@/lib/emploi.js";
import { Carte, Alerte } from "@/composants/ui.jsx";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

export default function ParentEnfant() {
  const { id } = useParams();
  const [onglet, setOnglet] = useState("notes");
  const [notes, setNotes] = useState([]);
  const [factures, setFactures] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [emploi, setEmploi] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      setChargement(true);
      try {
        const [n, f, a, e] = await Promise.all([
          enfantNotes(id), enfantFactures(id), enfantAbsences(id), enfantEmploi(id),
        ]);
        setNotes(n); setFactures(f); setAbsences(a); setEmploi(e);
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, [id]);

  return (
    <div className="space-y-5">
      <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
        {[["notes", "Notes"], ["emploi", "Emploi du temps"], ["paiements", "Paiements"], ["absences", "Absences"]].map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
            {l}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="text-sm text-navy-900/50">Chargement…</p>
      ) : onglet === "notes" ? (
        <Notes notes={notes} />
      ) : onglet === "emploi" ? (
        <Emploi creneaux={emploi} />
      ) : onglet === "paiements" ? (
        <Paiements factures={factures} />
      ) : (
        <Absences absences={absences} />
      )}
    </div>
  );
}

function Notes({ notes }) {
  if (notes.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune note pour l'instant.</Carte>;
  // Regroupe par période puis matière ; calcule la moyenne par matière (pondérée par coef d'éval, sur /20)
  const parPeriode = {};
  for (const n of notes) {
    const p = (parPeriode[n.periode] ||= { ordre: n.ordre, matieres: {} });
    const m = (p.matieres[n.matiere] ||= { sN: 0, sC: 0, notes: [] });
    const note20 = (Number(n.valeur) / (Number(n.bareme) || 20)) * 20;
    const c = Number(n.coefficient) || 1;
    m.sN += note20 * c; m.sC += c;
    m.notes.push({ type: n.type, valeur: n.valeur, bareme: n.bareme });
  }
  const periodes = Object.entries(parPeriode).sort((a, b) => a[1].ordre - b[1].ordre);

  return (
    <div className="space-y-5">
      {periodes.map(([periode, p]) => {
        const matieres = Object.entries(p.matieres);
        const moyGen = matieres.reduce((s, [, m]) => s + (m.sC ? m.sN / m.sC : 0), 0) / (matieres.length || 1);
        return (
          <Carte key={periode} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-3">
              <h3 className="font-display font-semibold text-navy-900">{periode}</h3>
              <span className="text-sm text-navy-900/60">Moyenne : <span className="font-mono font-bold text-navy-900">{moyGen.toFixed(2)}</span>/20</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr><th className="px-6 py-2 font-medium">Matière</th><th className="px-6 py-2 font-medium">Notes</th><th className="px-6 py-2 text-right font-medium">Moyenne</th></tr>
              </thead>
              <tbody>
                {matieres.map(([matiere, m]) => (
                  <tr key={matiere} className="border-t border-navy-900/5">
                    <td className="px-6 py-2 font-medium text-navy-900">{matiere}</td>
                    <td className="px-6 py-2 font-mono text-xs text-navy-900/60">
                      {m.notes.map((x, i) => `${x.valeur}/${x.bareme}`).join(" · ")}
                    </td>
                    <td className="px-6 py-2 text-right font-mono">{m.sC ? (m.sN / m.sC).toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        );
      })}
    </div>
  );
}

function Emploi({ creneaux }) {
  if (creneaux.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/40">Aucun emploi du temps disponible.</Carte>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {JOURS.map(([j, label]) => {
        const items = creneaux.filter((c) => c.jour === j);
        if (items.length === 0) return null;
        return (
          <Carte key={j} className="p-5">
            <h3 className="mb-3 font-display font-semibold text-navy-900">{label}</h3>
            <ul className="space-y-2">
              {items.map((c, i) => (
                <li key={i} className="rounded-xl border border-navy-900/10 p-3">
                  <p className="font-mono text-xs text-or-600">{hhmm(c.heure_debut)} – {hhmm(c.heure_fin)}</p>
                  <p className="font-medium text-navy-900">{c.matiere || "—"}</p>
                  <p className="text-xs text-navy-900/50">
                    {c.enseignant || ""}{c.salle ? ` · ${c.salle}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Carte>
        );
      })}
    </div>
  );
}

function Paiements({ factures }) {
  if (factures.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune facture.</Carte>;
  const totalReste = factures.reduce((s, f) => s + ((Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0)), 0);
  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <p className="text-sm text-navy-900/50">Reste à payer</p>
        <p className="mt-1 font-display text-2xl font-bold text-navy-900">{fmt(totalReste)} <span className="text-sm font-normal">XOF</span></p>
      </Carte>
      <Carte className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50">
            <tr><th className="px-6 py-2 font-medium">N°</th><th className="px-6 py-2 font-medium">Échéance</th><th className="px-6 py-2 text-right font-medium">Total</th><th className="px-6 py-2 text-right font-medium">Payé</th><th className="px-6 py-2 text-right font-medium">Reste</th></tr>
          </thead>
          <tbody>
            {factures.map((f, i) => {
              const reste = (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0);
              return (
                <tr key={i} className="border-t border-navy-900/5">
                  <td className="px-6 py-2 font-mono text-xs">{f.numero}</td>
                  <td className="px-6 py-2 font-mono text-xs">{f.date_echeance || "—"}</td>
                  <td className="px-6 py-2 text-right font-mono">{fmt(f.montant_total)}</td>
                  <td className="px-6 py-2 text-right font-mono">{fmt(f.montant_paye)}</td>
                  <td className={`px-6 py-2 text-right font-mono ${reste > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(reste)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>
    </div>
  );
}

function Absences({ absences }) {
  if (absences.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune absence enregistrée 🎉</Carte>;
  const lib = { non_justifie: "Non justifié", en_attente: "En attente", justifie: "Justifié" };
  return (
    <Carte className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50">
          <tr><th className="px-6 py-2 font-medium">Date</th><th className="px-6 py-2 font-medium">Type</th><th className="px-6 py-2 font-medium">Motif</th><th className="px-6 py-2 font-medium">Statut</th></tr>
        </thead>
        <tbody>
          {absences.map((a, i) => (
            <tr key={i} className="border-t border-navy-900/5">
              <td className="px-6 py-2 font-mono text-xs">{a.date_abs}</td>
              <td className="px-6 py-2 capitalize">{a.type === "retard" ? "Retard" : "Absence"}</td>
              <td className="px-6 py-2 text-navy-900/60">{a.motif || "—"}</td>
              <td className="px-6 py-2">{lib[a.statut] || a.statut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Carte>
  );
}
