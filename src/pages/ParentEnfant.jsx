import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  enfantNotes, enfantFactures, enfantAbsences, enfantEmploi, enfantFournitures,
  ecolePaiementInfos, declarerPaiement, enfantDeclarations,
} from "@/lib/parent.js";
import { JOURS } from "@/lib/emploi.js";
import { enfantCahier } from "@/lib/cahier.js";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";

const MODES_MOBILE = [["wave", "Wave"], ["orange_money", "Orange Money"], ["free_money", "Free Money"]];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

export default function ParentEnfant() {
  const { id } = useParams();
  const [onglet, setOnglet] = useState("notes");
  const [notes, setNotes] = useState([]);
  const [factures, setFactures] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [emploi, setEmploi] = useState([]);
  const [fournitures, setFournitures] = useState([]);
  const [infos, setInfos] = useState({});
  const [declarations, setDeclarations] = useState([]);
  const [cahier, setCahier] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    try {
      const [n, f, a, e, four, inf, decl, cah] = await Promise.all([
        enfantNotes(id), enfantFactures(id), enfantAbsences(id), enfantEmploi(id),
        enfantFournitures(id), ecolePaiementInfos(id), enfantDeclarations(id), enfantCahier(id),
      ]);
      setNotes(n); setFactures(f); setAbsences(a); setEmploi(e);
      setFournitures(four); setInfos(inf); setDeclarations(decl); setCahier(cah);
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [id]);

  useEffect(() => { setChargement(true); charger(); }, [charger]);

  return (
    <div className="space-y-5">
      <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
        {[["notes", "Notes"], ["cahier", "Cahier de textes"], ["emploi", "Emploi du temps"], ["fournitures", "Fournitures"], ["paiements", "Paiements"], ["absences", "Absences"]].map(([k, l]) => (
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
      ) : onglet === "cahier" ? (
        <Cahier entrees={cahier} />
      ) : onglet === "emploi" ? (
        <Emploi creneaux={emploi} />
      ) : onglet === "fournitures" ? (
        <Fournitures items={fournitures} />
      ) : onglet === "paiements" ? (
        <Paiements factures={factures} infos={infos} declarations={declarations} eleveId={id} onChange={charger} onErreur={setErreur} />
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

function Cahier({ entrees }) {
  if (entrees.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune entrée dans le cahier de textes.</Carte>;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "");
  return (
    <div className="space-y-3">
      {entrees.map((e, i) => (
        <Carte key={i} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-or-600">{fmtD(e.date_seance)}</span>
            {e.matiere && <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/70">{e.matiere}</span>}
          </div>
          {e.contenu && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-900/80">{e.contenu}</p>}
          {e.devoirs && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/80">
              <b className="text-or-600">📘 Devoirs :</b> {e.devoirs}
              {e.date_pour && <span className="ml-1 text-xs text-navy-900/50">(pour le {fmtD(e.date_pour)})</span>}
            </p>
          )}
        </Carte>
      ))}
    </div>
  );
}

function Fournitures({ items }) {
  if (items.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune liste de fournitures publiée.</Carte>;
  return (
    <Carte className="p-6">
      <h3 className="mb-3 font-display font-semibold text-navy-900">Liste des fournitures</h3>
      <ul className="divide-y divide-navy-900/5">
        {items.map((f, i) => (
          <li key={i} className="flex items-center justify-between py-2 text-sm">
            <span className="text-navy-900">
              <span className="font-mono text-xs text-or-600">×{f.quantite}</span>{" "}
              <span className="font-medium">{f.libelle}</span>
              {!f.obligatoire && <span className="ml-2 text-xs text-navy-900/40">(optionnel)</span>}
              {f.note && <span className="ml-2 text-xs text-navy-900/50">— {f.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function Paiements({ factures, infos, declarations, eleveId, onChange, onErreur }) {
  const [payer, setPayer] = useState(null); // facture à régler
  if (factures.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune facture.</Carte>;
  const totalReste = factures.reduce((s, f) => s + ((Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0)), 0);
  const aDesNumeros = MODES_MOBILE.some(([k]) => infos?.[k]);
  const statutLib = { en_attente: "En attente", valide: "Validé", rejete: "Rejeté" };
  const statutTon = { en_attente: "text-or-600", valide: "text-emerald-700", rejete: "text-rose-600" };

  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <p className="text-sm text-navy-900/50">Reste à payer</p>
        <p className="mt-1 font-display text-2xl font-bold text-navy-900">{fmt(totalReste)} <span className="text-sm font-normal">XOF</span></p>
      </Carte>

      <Carte className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50">
            <tr><th className="px-4 py-2 font-medium">N°</th><th className="px-4 py-2 font-medium">Échéance</th><th className="px-4 py-2 text-right font-medium">Reste</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {factures.map((f) => {
              const reste = (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0);
              return (
                <tr key={f.id} className="border-t border-navy-900/5">
                  <td className="px-4 py-2 font-mono text-xs">{f.numero}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.date_echeance || "—"}</td>
                  <td className={`px-4 py-2 text-right font-mono ${reste > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(reste)}</td>
                  <td className="px-4 py-2 text-right">
                    {reste > 0 && aDesNumeros && (
                      <button onClick={() => setPayer({ ...f, reste })} className="rounded-lg bg-navy-900 px-3 py-1 text-xs font-medium text-creme">Payer</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>

      {!aDesNumeros && (
        <p className="text-xs text-navy-900/40">Le paiement mobile n'est pas encore configuré par l'établissement.</p>
      )}

      {declarations.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-2 font-display font-semibold text-navy-900">Mes déclarations</h3>
          <ul className="space-y-1 text-sm">
            {declarations.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="text-navy-900/70">{d.numero} · {fmt(d.montant)} XOF</span>
                <span className={`text-xs font-medium ${statutTon[d.statut]}`}>{statutLib[d.statut] || d.statut}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <ModalePayer
        facture={payer} infos={infos} eleveId={eleveId}
        onFermer={() => setPayer(null)}
        onDeclare={async (data) => {
          try {
            await declarerPaiement(payer.id, data.montant, data.mode, data.reference);
            setPayer(null);
            await onChange();
          } catch (e) { onErreur(e.message); }
        }}
      />
    </div>
  );
}

function ModalePayer({ facture, infos, onFermer, onDeclare }) {
  const [mode, setMode] = useState("wave");
  const [montant, setMontant] = useState("");
  const [reference, setReference] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (facture) { setMontant(String(Math.round(facture.reste || 0))); setReference(""); setMode("wave"); }
  }, [facture]);

  if (!facture) return null;
  const numero = infos?.[mode];

  return (
    <Modale ouvert={!!facture} onFermer={onFermer} titre={`Payer la facture ${facture.numero}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-creme p-4 text-sm">
          <p className="text-navy-900/60">1. Paie depuis ton application mobile money sur le numéro de l'école :</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES_MOBILE.map(([k, label]) => infos?.[k] && (
              <button key={k} onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === k ? "bg-navy-900 text-creme" : "bg-white text-navy-900/70 border border-navy-900/15"}`}>
                {label}
              </button>
            ))}
          </div>
          {numero && (
            <p className="mt-3 font-display text-xl font-bold text-navy-900">{numero}</p>
          )}
          <p className="mt-1 text-xs text-navy-900/50">Référence à indiquer : <span className="font-mono">{facture.numero}</span></p>
        </div>

        <p className="text-sm text-navy-900/60">2. Déclare ton paiement, l'école le validera :</p>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Montant payé" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^0-9]/g, ""))} />
          <Champ label="Réf. transaction" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID Wave/OM…" />
        </div>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton
            disabled={envoi || !montant}
            onClick={async () => { setEnvoi(true); await onDeclare({ montant: Number(montant), mode, reference }); setEnvoi(false); }}
          >
            {envoi ? "…" : "Déclarer le paiement"}
          </Bouton>
        </div>
      </div>
    </Modale>
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
