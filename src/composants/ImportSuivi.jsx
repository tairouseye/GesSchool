import { useEffect, useMemo, useState } from "react";
import { Alerte, Bouton, Modale } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { grilleMensualites, encaisserMoisSuivi, MODES } from "@/lib/paiements.js";
import { lireSuivi, confronter } from "@/lib/suiviFichier.js";

// GesSchool — charger le fichier « Suivi des mensualités » de l'école et le
// confronter à l'appli (Mme Kane, 02/11/2026 ; mig. 222).
//
// Rien n'est écrit sans validation : l'écran liste les écarts, coche par
// défaut les paiements que le fichier connaît et que l'appli n'a pas, et
// n'enregistre que ceux qui restent cochés. Les autres écarts (tarif,
// élève absent, mois payé dans l'appli seulement) sont SIGNALÉS : les
// corriger relève d'une décision, pas d'un import.

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const nomMois = (k) => (k ? `${MOIS_LONG[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : "Inscription");
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const INFOS = [
  ["appli_plus", "Payé dans l'appli, pas (ou moins) dans le fichier"],
  ["mensualite", "Mensualité différente"],
  ["hors_echeancier", "Mois payé dans le fichier, hors échéancier de l'élève"],
  ["absent_appli", "Dans le fichier, introuvable dans l'appli (matricule)"],
  ["absent_fichier", "Inscrit dans l'appli, absent du fichier"],
];

export default function ImportSuivi({ ouvert, onFermer, annee, devise = "XOF", onFini }) {
  const toast = useToast();
  const [ecarts, setEcarts] = useState(null);
  const [resume, setResume] = useState(null);
  const [erreur, setErreur] = useState("");
  const [lit, setLit] = useState(false);
  const [coches, setCoches] = useState(() => new Set());
  const [mode, setMode] = useState("especes");
  const [date, setDate] = useState(aujourdhui());
  const [envoi, setEnvoi] = useState(false);
  const [rapport, setRapport] = useState(null); // { ok, echecs: [{ e, message }] }

  useEffect(() => {
    if (!ouvert) return;
    setEcarts(null); setResume(null); setErreur(""); setCoches(new Set()); setRapport(null);
    setMode("especes"); setDate(aujourdhui());
  }, [ouvert]);

  async function charger(f) {
    if (!f) return;
    setLit(true); setErreur(""); setEcarts(null); setRapport(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
      // TOUTE l'école, pas la classe filtrée : sinon les élèves des autres
      // classes passeraient pour « introuvables ».
      const grille = await grilleMensualites(annee.id, null);
      const moisAnnee = [...new Set(grille.flatMap((g) => Object.keys(g.mois || {})))].sort();
      const { eleves } = lireSuivi(lignes, moisAnnee.length ? moisAnnee : moisDeLAnnee(annee));
      const e = confronter(eleves, grille).map((x, i) => ({ ...x, id: i }));
      setEcarts(e);
      setResume({ fichier: eleves.length, appli: grille.length, nom: f.name });
      setCoches(new Set(e.filter((x) => x.type === "a_encaisser").map((x) => x.id)));
    } catch (e) {
      setErreur(e.message || "Fichier illisible.");
    } finally { setLit(false); }
  }

  const aEncaisser = useMemo(() => (ecarts || []).filter((x) => x.type === "a_encaisser"), [ecarts]);
  const choisis = aEncaisser.filter((x) => coches.has(x.id));
  const total = choisis.reduce((s, x) => s + x.montant, 0);

  async function enregistrer() {
    setEnvoi(true);
    let ok = 0;
    const echecs = [];
    // Un par un : un mois refusé (déjà réglé entre-temps) n'empêche pas les autres.
    for (const x of choisis) {
      try {
        await encaisserMoisSuivi(x.eleve_id, x.mois, x.montant, { mode, date, reference: "Fichier de suivi" });
        ok++;
      } catch (e) { echecs.push({ e: x, message: e.message }); }
    }
    setEnvoi(false);
    setRapport({ ok, echecs });
    if (ok) { toast.succes(`${ok} paiement${ok > 1 ? "s" : ""} enregistré${ok > 1 ? "s" : ""}.`); onFini?.(); }
    setCoches(new Set(echecs.map((x) => x.e.id)));
    setEcarts((prev) => prev.filter((x) => x.type !== "a_encaisser" || echecs.some((f) => f.e.id === x.id)));
  }

  const basculer = (id) => setCoches((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const tout = (oui) => setCoches(oui ? new Set(aEncaisser.map((x) => x.id)) : new Set());

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Confronter le fichier de suivi des mensualités" large>
      <div className="space-y-5 text-sm">
        <p className="text-navy-900/60">
          Chargez votre fichier Excel (colonnes Matricule, Nom, Prénom, Classe, Montant mensualité, Inscription, puis un mois par colonne).
          L&apos;appli le compare élève par élève, par matricule, et vous propose d&apos;enregistrer les paiements qu&apos;elle n&apos;a pas.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => charger(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-creme" />
        {lit && <p className="text-navy-900/50">Lecture et comparaison…</p>}
        <Alerte>{erreur}</Alerte>

        {rapport && rapport.echecs.length > 0 && (
          <Alerte ton="or">
            {rapport.echecs.length} paiement{rapport.echecs.length > 1 ? "s" : ""} non enregistré{rapport.echecs.length > 1 ? "s" : ""} :
            <ul className="mt-1 list-disc pl-5">
              {rapport.echecs.map(({ e, message }) => <li key={e.id}>{e.eleve} — {nomMois(e.mois)} : {message}</li>)}
            </ul>
          </Alerte>
        )}

        {ecarts && (
          <>
            <p className="text-navy-900/70">
              <b>{resume.nom}</b> : {resume.fichier} élèves dans le fichier, {resume.appli} inscrits dans l&apos;appli.
              {ecarts.length === 0 && <b className="text-emerald-700"> Le fichier et l&apos;appli concordent.</b>}
            </p>

            {aEncaisser.length > 0 && (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-navy-900">À enregistrer dans l&apos;appli ({aEncaisser.length})</h3>
                  <span className="text-xs">
                    <button type="button" className="text-navy-700 hover:text-or-500" onClick={() => tout(true)}>tout cocher</button>
                    {" · "}
                    <button type="button" className="text-navy-700 hover:text-or-500" onClick={() => tout(false)}>tout décocher</button>
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-navy-900/10">
                  {aEncaisser.map((x) => (
                    <label key={x.id} className="flex cursor-pointer items-center gap-3 border-b border-navy-900/5 px-3 py-2 last:border-0 hover:bg-navy-900/[0.02]">
                      <input type="checkbox" checked={coches.has(x.id)} onChange={() => basculer(x.id)} />
                      <span className="flex-1">
                        <span className="font-medium text-navy-900">{x.eleve}</span>
                        <span className="text-navy-900/50"> · {x.matricule} · {nomMois(x.mois)}</span>
                      </span>
                      <span className="text-right font-mono tabular-nums text-navy-900">
                        {fmt(x.montant)}
                        {x.appli > 0 && <span className="block text-xs text-navy-900/45">fichier {fmt(x.fichier)} − appli {fmt(x.appli)}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-navy-900/50">Mode de paiement</span>
                    <select value={mode} onChange={(e) => setMode(e.target.value)}
                      className="rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
                      {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-navy-900/50">Date de paiement</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
                  </label>
                  <Bouton className="ml-auto" onClick={enregistrer} disabled={envoi || choisis.length === 0}>
                    {envoi ? "Enregistrement…" : `Enregistrer ${choisis.length} paiement${choisis.length > 1 ? "s" : ""} · ${fmt(total)} ${devise}`}
                  </Bouton>
                </div>
                <p className="text-xs text-navy-900/45">Les parents ne reçoivent pas de notification : ce sont des paiements déjà faits au guichet.</p>
              </section>
            )}

            {INFOS.map(([type, titre]) => {
              const l = ecarts.filter((x) => x.type === type);
              if (!l.length) return null;
              return (
                <details key={type} className="rounded-xl border border-navy-900/10 px-3 py-2">
                  <summary className="cursor-pointer font-medium text-navy-900">{titre} ({l.length})</summary>
                  <ul className="mt-2 space-y-1 text-navy-900/70">
                    {l.map((x) => (
                      <li key={x.id}>
                        {x.eleve} <span className="text-navy-900/45">· {x.matricule}{x.mois ? ` · ${nomMois(x.mois)}` : ""}</span>
                        {(x.fichier != null || x.appli != null) && (
                          <span className="text-navy-900/45"> — fichier : {typeof x.fichier === "number" ? fmt(x.fichier) : x.fichier || "—"}, appli : {typeof x.appli === "number" ? fmt(x.appli) : x.appli || "—"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </>
        )}

        <div className="flex justify-end">
          <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
        </div>
      </div>
    </Modale>
  );
}

// Les mois de l'année scolaire, si aucun élève n'a encore d'échéancier.
function moisDeLAnnee(annee) {
  const out = [];
  if (!annee?.date_debut || !annee?.date_fin) return out;
  const d = new Date(`${annee.date_debut.slice(0, 7)}-01T00:00:00`);
  const fin = annee.date_fin.slice(0, 7);
  while (out.length < 24) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push(k);
    if (k >= fin) break;
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
