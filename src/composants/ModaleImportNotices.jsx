import { useState } from "react";
import { Bouton, Alerte, Modale } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as imp from "@/lib/biblio.import.js";
import { importerNotices } from "@/lib/bibliotheque.js";

// Import en masse de notices — trois temps : lire le fichier, vérifier la
// correspondance des colonnes, importer.
//
// Rien n'est écrit avant que l'utilisateur ait vu ce qui sera créé ET ce qui
// sera écarté : un import de 5 000 lignes ne se rattrape pas à la main.
export default function ModaleImportNotices({ ecoleId, onFermer, onFini }) {
  const toast = useToast();
  const [entetes, setEntetes] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [ignorerExistants, setIgnorer] = useState(true);
  const [erreur, setErreur] = useState("");
  const [progres, setProgres] = useState(null);
  const [busy, setBusy] = useState(false);

  async function lire(file) {
    if (!file) return;
    setErreur(""); setProgres(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const lignes = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (lignes.length === 0) { setErreur("Fichier vide."); return; }
      const cols = Object.keys(lignes[0]);
      setEntetes(cols);
      setRows(lignes);
      setMapping(imp.devinerMapping(cols));
    } catch (e) { setErreur("Lecture impossible : " + e.message); }
  }

  const analyse = rows.length > 0 ? imp.analyser(rows, mapping) : null;

  async function importer() {
    if (!analyse || analyse.valides.length === 0) return;
    setBusy(true); setErreur(""); setProgres({ fait: 0, total: analyse.valides.length });
    try {
      const r = await importerNotices(ecoleId, analyse.valides, {
        ignorerExistants,
        onProgres: (fait, total) => setProgres({ fait, total }),
      });
      toast.succes(
        `${r.crees} notice(s) créée(s)` +
        (r.exemplaires ? `, ${r.exemplaires} exemplaire(s)` : "") +
        (r.ignores ? `, ${r.ignores} déjà au catalogue` : "") + "."
      );
      onFini();
    } catch (e) { setErreur(e.message); toast.erreur(e); }
    finally { setBusy(false); }
  }

  const nomAuteur = (a) => [a.prenom, a.nom].filter(Boolean).join(" ");

  return (
    <Modale ouvert onFermer={busy ? () => {} : onFermer} titre="Importer des notices" large>
      <div className="space-y-4">
        <Alerte ton="erreur">{erreur}</Alerte>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-navy-900/70">
              Choisissez un fichier Excel ou CSV dont la <b>première ligne contient les en-têtes</b>.
              Seul le <b>titre</b> est obligatoire ; les colonnes sont reconnues automatiquement et
              restent modifiables ensuite.
            </p>
            <input type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => lire(e.target.files?.[0])}
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:text-creme" />
            <p className="text-xs text-navy-900/45">
              Colonnes reconnues : {imp.CHAMPS_IMPORT.map(([, l]) => l).join(", ")}. Une colonne
              « nombre d&apos;exemplaires » crée directement les exemplaires physiques.
            </p>
          </div>
        ) : (
          <>
            {/* Correspondance des colonnes */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-900/45">
                Correspondance des colonnes
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {imp.CHAMPS_IMPORT.map(([cle, libelle]) => (
                  <label key={cle} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-navy-900/70">{libelle}{cle === "titre" ? " *" : ""}</span>
                    <select value={mapping[cle] || ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [cle]: e.target.value }))}
                      className="min-w-32 max-w-44 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-or-500">
                      <option value="">— ignorer —</option>
                      {entetes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            {/* Ce qui va se passer */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="font-display text-2xl font-bold text-emerald-700">{analyse.valides.length}</p>
                <p className="text-xs text-emerald-700/80">à importer</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="font-display text-2xl font-bold text-amber-700">{analyse.doublons.length}</p>
                <p className="text-xs text-amber-700/80">doublons dans le fichier</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="font-display text-2xl font-bold text-rose-700">{analyse.rejets.length}</p>
                <p className="text-xs text-rose-700/80">lignes écartées</p>
              </div>
            </div>

            {!mapping.titre && (
              <Alerte ton="or">Associez la colonne <b>Titre</b> : sans elle, rien ne peut être importé.</Alerte>
            )}

            {(analyse.rejets.length > 0 || analyse.doublons.length > 0) && (
              <details className="rounded-xl border border-navy-900/10 p-3 text-sm">
                <summary className="cursor-pointer text-navy-900/70">Voir le détail des lignes écartées</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-navy-900/60">
                  {analyse.rejets.slice(0, 50).map((r) => (
                    <li key={`r${r.ligne}`}>Ligne {r.ligne} — {r.motif}</li>
                  ))}
                  {analyse.doublons.slice(0, 50).map((d) => (
                    <li key={`d${d.ligne}`}>Ligne {d.ligne} — ISBN {d.isbn} déjà vu ligne {d.premiere}</li>
                  ))}
                </ul>
              </details>
            )}

            {/* Aperçu */}
            {analyse.valides.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-navy-900/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-creme/70 text-navy-900/60">
                    <tr>
                      <th className="px-3 py-2">Titre</th>
                      <th className="px-3 py-2">Auteur(s)</th>
                      <th className="px-3 py-2">Année</th>
                      <th className="px-3 py-2">Ex.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyse.valides.slice(0, 5).map((n, i) => (
                      <tr key={i} className="border-t border-navy-900/5">
                        <td className="px-3 py-1.5 text-navy-900">{n.titre}</td>
                        <td className="px-3 py-1.5 text-navy-900/60">
                          {(n.auteurs || []).map(nomAuteur).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-navy-900/60">{n.annee_pub ?? "—"}</td>
                        <td className="px-3 py-1.5 tabular-nums text-navy-900/60">{n.quantite || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analyse.valides.length > 5 && (
                  <p className="px-3 py-1.5 text-xs text-navy-900/45">
                    … et {analyse.valides.length - 5} autre(s).
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-wrap items-center gap-2 text-sm text-navy-900/70">
              <input type="checkbox" checked={ignorerExistants} onChange={(e) => setIgnorer(e.target.checked)}
                className="h-4 w-4 accent-or-500" />
              Ignorer les ISBN déjà présents au catalogue
              <span className="text-xs text-navy-900/45">(évite de tout dupliquer si le fichier est réimporté)</span>
            </label>

            {progres && (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-navy-900/10">
                  <div className="h-full bg-or-500 transition-all"
                    style={{ width: `${Math.round((progres.fait / Math.max(1, progres.total)) * 100)}%` }} />
                </div>
                <p className="text-xs text-navy-900/50">{progres.fait} / {progres.total} notices traitées…</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Bouton variante="fantome" onClick={onFermer} disabled={busy}>Annuler</Bouton>
              <Bouton onClick={importer} disabled={busy || !mapping.titre || analyse.valides.length === 0}>
                {busy ? "Import en cours…" : `Importer ${analyse.valides.length} notice(s)`}
              </Bouton>
            </div>
          </>
        )}
      </div>
    </Modale>
  );
}
