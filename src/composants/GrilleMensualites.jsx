import { useEffect, useMemo, useState } from "react";
import { Alerte, Bouton, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { grilleMensualites } from "@/lib/paiements.js";
import { etat as etatPaiement } from "@/lib/paiementStatut.js";

// GesSchool — le suivi des mensualités, à l'image du fichier Excel tenu à la
// main par l'école (Tut'Tank, « Suivi mensualités 2026-2027.xlsx ») :
// N° · Matricule · Nom · Prénom · Niveau · Classe · Mensualité · Inscription,
// puis une colonne par mois, et en pied les totaux, le nombre d'élèves ayant
// payé et le pourcentage. Exportable en Excel et en PDF (impression).
//
// ⚠️ LECTURE SEULE (RPC `grille_mensualites`, mig. 213) : mêmes droits et même
// périmètre que la liste de la situation des paiements.
//
// Les couleurs reprennent l'état de chaque mois (payé / partiel / en retard),
// et le nom celui de l'élève — jamais la couleur seule : le montant est écrit.

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const MOIS_COURT = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const MOIS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const nomMois = (k, long = false) => (long ? MOIS_LONG : MOIS_COURT)[Number(k.slice(5, 7)) - 1] || k;

const FOND = {
  paye: "bg-emerald-50 text-emerald-800",
  partiel: "bg-amber-50 text-amber-800",
  en_retard: "bg-rose-50 text-rose-700",
  a_venir: "",
};

// Une cellule de mois : ce qui est payé, ou rien.
const payeMois = (l, k) => Number(l.mois?.[k]?.paye) || 0;

export default function GrilleMensualites({ annee, classeId, ecole }) {
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [export_, setExport] = useState(false);

  useEffect(() => {
    if (!annee?.id) return undefined;
    let vivant = true;
    setChargement(true);
    grilleMensualites(annee.id, classeId)
      .then((l) => { if (vivant) { setLignes(l); setErreur(""); } })
      .catch((e) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [annee?.id, classeId]);

  // Les mois de l'année, dans l'ordre (ceux de l'échéancier de chacun).
  const mois = useMemo(() => {
    const s = new Set();
    lignes.forEach((l) => Object.keys(l.mois || {}).forEach((k) => s.add(k)));
    return [...s].sort();
  }, [lignes]);

  const n = lignes.length;
  const pied = useMemo(() => {
    const parMois = Object.fromEntries(mois.map((k) => [k, {
      total: lignes.reduce((s, l) => s + payeMois(l, k), 0),
      payes: lignes.filter((l) => payeMois(l, k) > 0).length,
    }]));
    return {
      mensualite: lignes.reduce((s, l) => s + (Number(l.mensualite) || 0), 0),
      inscription: lignes.reduce((s, l) => s + (Number(l.inscription_paye) || 0), 0),
      inscrits: lignes.filter((l) => Number(l.inscription_paye) > 0).length,
      total: lignes.reduce((s, l) => s + (Number(l.total_paye) || 0), 0),
      du: lignes.reduce((s, l) => s + (Number(l.du) || 0), 0),
      parMois,
    };
  }, [lignes, mois]);

  const pct = (x) => (n ? `${Math.round((x / n) * 100)} %` : "—");
  const titre = `${(ecole?.nom || "École").toUpperCase()} — SUIVI DES MENSUALITÉS ${annee?.libelle || ""}`.trim();

  // Inscription : le montant payé ; « Non » s'il reste dû ; « Exonéré ».
  const cellInscription = (l) => {
    if (l.exonere) return "Exonéré";
    if (l.inscription_montant == null) return "";
    return Number(l.inscription_paye) > 0 ? Number(l.inscription_paye) : "Non";
  };

  async function exporterExcel() {
    setExport(true);
    try {
      const XLSX = await import("xlsx");
      const entete = ["N°", "Matricule", "Nom", "Prénom", "Niveau", "Classe", "Mensualité", "Inscription",
        ...mois.map((k) => nomMois(k, true)), "Total payé", "Reste dû (échu)", "Statut"];
      const aoa = [
        [titre],
        [`Édité le ${new Date().toLocaleDateString("fr-FR")} — montants en ${devise}`],
        entete,
        ...lignes.map((l, i) => [
          i + 1, l.matricule || "", l.nom || "", l.prenom || "", l.niveau || "", l.classe || "",
          l.mensualite == null ? null : Number(l.mensualite), cellInscription(l) || null,
          ...mois.map((k) => payeMois(l, k) || null),
          Number(l.total_paye) || 0, Number(l.du) || 0, etatPaiement(l.statut).label,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Pied : formules, comme dans le fichier de l'école (recalculées si
      // l'on corrige une cellule à la main).
      const d = 4, f = 3 + n; // première et dernière ligne de données (1-indexées)
      const col = (c) => XLSX.utils.encode_col(c);
      const nbCols = entete.length;
      const r1 = f + 1, r2 = f + 2, r3 = f + 3;
      ws[XLSX.utils.encode_cell({ r: r1 - 1, c: 0 })] = { t: "s", v: "Total" };
      ws[XLSX.utils.encode_cell({ r: r2 - 1, c: 0 })] = { t: "s", v: "Nombre d'élèves ayant payé" };
      ws[XLSX.utils.encode_cell({ r: r3 - 1, c: 0 })] = { t: "s", v: "Pourcentage" };
      for (let c = 6; c < nbCols - 1; c++) {
        const plage = `${col(c)}${d}:${col(c)}${f}`;
        ws[XLSX.utils.encode_cell({ r: r1 - 1, c })] = { t: "n", f: `SUM(${plage})`, z: "#,##0" };
        if (c >= 7 && c < 8 + mois.length) {
          ws[XLSX.utils.encode_cell({ r: r2 - 1, c })] = { t: "s", f: `COUNT(${plage})&" / ${n}"` };
          ws[XLSX.utils.encode_cell({ r: r3 - 1, c })] = { t: "n", f: `COUNT(${plage})/${n || 1}`, z: "0%" };
        }
      }
      for (let r = d - 1; r < f; r++) {
        for (let c = 6; c < nbCols - 1; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.t === "n") cell.z = "#,##0";
        }
      }
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r3 - 1, c: nbCols - 1 } });
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: nbCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: nbCols - 1 } },
        { s: { r: r1 - 1, c: 0 }, e: { r: r1 - 1, c: 5 } },
        { s: { r: r2 - 1, c: 0 }, e: { r: r2 - 1, c: 5 } },
        { s: { r: r3 - 1, c: 0 }, e: { r: r3 - 1, c: 5 } },
      ];
      ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 8 }, { wch: 12 },
        { wch: 11 }, { wch: 11 }, ...mois.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 13 }, { wch: 11 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Suivi mensualités");
      XLSX.writeFile(wb, `suivi-mensualites-${ecole?.sigle || "ecole"}-${annee?.libelle || ""}.xlsx`.replace(/\s+/g, "-"));
    } catch (e) { toast.erreur(e.message || "Export impossible."); }
    finally { setExport(false); }
  }

  if (chargement) return <div className="p-4"><SkeletonListe lignes={8} /></div>;
  if (erreur) return <div className="p-4"><Alerte ton="erreur">{erreur}</Alerte></div>;
  if (n === 0) return <EtatVide icone="📋" titre="Aucun élève">Aucun élève inscrit dans cette sélection.</EtatVide>;

  const th = "border border-navy-900/15 px-1.5 py-1.5 font-semibold";
  const td = "border border-navy-900/10 px-1.5 py-1";
  return (
    <>
      {/* Paysage pour l'impression : 17 colonnes ne tiennent pas en portrait. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-navy-900/10 p-4">
        <Bouton onClick={exporterExcel} disabled={export_}>{export_ ? "…" : "📊 Exporter en Excel"}</Bouton>
        <Bouton variante="fantome" onClick={() => window.print()}>🖨️ Imprimer / PDF</Bouton>
        <span className="text-xs text-navy-900/45">
          Montant payé par mois · <span className="rounded bg-emerald-50 px-1 text-emerald-800">payé</span>{" "}
          <span className="rounded bg-amber-50 px-1 text-amber-800">acompte</span>{" "}
          <span className="rounded bg-rose-50 px-1 text-rose-700">en retard</span>
        </span>
      </div>

      <div className="zone-impression overflow-x-auto p-4 text-navy-900 print:overflow-visible print:p-0"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <div className="mb-2 hidden items-center gap-3 print:flex">
          {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-10 w-10 object-contain" />}
          <p className="flex-1 font-display text-sm font-bold">{titre}</p>
          <p className="text-[10px] text-navy-900/60">Édité le {new Date().toLocaleDateString("fr-FR")} · {devise}</p>
        </div>
        <table className="w-full min-w-[1100px] border-collapse text-xs print:min-w-0 print:text-[8.5px]">
          <thead>
            <tr className="bg-[#1F4E78] text-white">
              <th className={th}>N°</th>
              <th className={`${th} text-left`}>Matricule</th>
              <th className={`${th} text-left`}>Nom</th>
              <th className={`${th} text-left`}>Prénom</th>
              <th className={th}>Niveau</th>
              <th className={th}>Classe</th>
              <th className={`${th} text-right`}>Mensualité</th>
              <th className={`${th} text-right`}>Inscription</th>
              {mois.map((k) => <th key={k} className={`${th} text-right`}>{nomMois(k)}</th>)}
              <th className={`${th} text-right`}>Total payé</th>
              <th className={`${th} text-right`}>Reste dû</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const e = etatPaiement(l.statut);
              const insc = cellInscription(l);
              return (
                <tr key={l.eleve_id} className={i % 2 ? "bg-[#EAF1F8]/60" : ""}>
                  <td className={`${td} text-center text-navy-900/50`}>{i + 1}</td>
                  <td className={`${td} font-mono text-[11px] print:text-[8px]`}>{l.matricule}</td>
                  <td className={`${td} font-semibold ${e.texte || ""}`} title={e.label}>{l.nom}</td>
                  <td className={`${td} ${e.texte || ""}`}>{l.prenom}</td>
                  <td className={`${td} text-center`}>{l.niveau}</td>
                  <td className={`${td} text-center`}>{l.classe}</td>
                  <td className={`${td} text-right font-mono`}>{l.mensualite == null ? "" : fmt(l.mensualite)}</td>
                  <td className={`${td} text-right font-mono ${insc === "Non" ? FOND.en_retard : typeof insc === "number" ? FOND.paye : "text-navy-900/50"}`}>
                    {typeof insc === "number" ? fmt(insc) : insc}
                  </td>
                  {mois.map((k) => {
                    const m = l.mois?.[k];
                    const p = payeMois(l, k);
                    const et = m ? (m.etat === "paye" ? "paye" : p > 0 ? "partiel" : m.etat) : "a_venir";
                    return (
                      <td key={k} className={`${td} text-right font-mono ${FOND[et] || ""}`}
                        title={m ? `${nomMois(k, true)} : ${fmt(p)} / ${fmt(m.montant)} ${devise}` : ""}>
                        {p > 0 ? fmt(p) : ""}
                      </td>
                    );
                  })}
                  <td className={`${td} text-right font-mono font-semibold`}>{fmt(l.total_paye)}</td>
                  <td className={`${td} text-right font-mono ${Number(l.du) > 0 ? "font-semibold text-rose-700" : "text-navy-900/40"}`}>
                    {Number(l.du) > 0 ? fmt(l.du) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-semibold">
            <tr className="bg-[#1F4E78]/10">
              <td className={td} colSpan={6}>Total ({n} élève{n > 1 ? "s" : ""})</td>
              <td className={`${td} text-right font-mono`}>{fmt(pied.mensualite)}</td>
              <td className={`${td} text-right font-mono`}>{fmt(pied.inscription)}</td>
              {mois.map((k) => <td key={k} className={`${td} text-right font-mono`}>{fmt(pied.parMois[k].total)}</td>)}
              <td className={`${td} text-right font-mono`}>{fmt(pied.total)}</td>
              <td className={`${td} text-right font-mono text-rose-700`}>{fmt(pied.du)}</td>
            </tr>
            <tr>
              <td className={td} colSpan={7}>Nombre d'élèves ayant payé</td>
              <td className={`${td} text-right`}>{pied.inscrits} / {n}</td>
              {mois.map((k) => <td key={k} className={`${td} text-right`}>{pied.parMois[k].payes} / {n}</td>)}
              <td className={td} colSpan={2} />
            </tr>
            <tr>
              <td className={td} colSpan={7}>Pourcentage</td>
              <td className={`${td} text-right`}>{pct(pied.inscrits)}</td>
              {mois.map((k) => <td key={k} className={`${td} text-right`}>{pct(pied.parMois[k].payes)}</td>)}
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
