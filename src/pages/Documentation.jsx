import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Bouton, Champ, Modale } from "@/composants/ui.jsx";
import DocumentOfficiel from "@/composants/DocumentOfficiel.jsx";
import { getDocuments } from "@/lib/documents.js";

// Documentation (Pilotage) — hub central de tous les documents de l'école.
// Phase 1 : catalogue par famille (accès rapide aux générateurs) + liste des
// documents déjà enregistrés (certificats/attestations) avec aperçu.
// L'archivage automatique des autres types (factures, bulletins, paie…) sera
// branché en Phase 2 et viendra remplir la section « Documents enregistrés ».

const FAMILLES = [
  {
    id: "scolarite", label: "Scolarité & administratif", icone: "🎓",
    docs: [
      { label: "Certificat de scolarité", to: "/certificats", statut: "dispo" },
      { label: "Attestation d'inscription", to: "/certificats", statut: "dispo" },
      { label: "Attestation de fréquentation", to: "/certificats", statut: "dispo" },
      { label: "Certificat de radiation / transfert", to: "/certificats", statut: "dispo" },
      { label: "Attestation de résultats", to: "/certificats", statut: "dispo" },
      { label: "Carte scolaire", to: "/eleves", statut: "dispo" },
      { label: "Convocation", to: "/certificats", statut: "dispo" },
      { label: "Registre / liste d'élèves", to: "/eleves", statut: "dispo" },
    ],
  },
  {
    id: "pedagogie", label: "Pédagogie", icone: "📚",
    docs: [
      { label: "Bulletins de notes", to: "/bulletins", statut: "dispo" },
      { label: "Bulletin annuel / relevé", statut: "a_venir" },
      { label: "Classement / palmarès", to: "/classement", statut: "dispo" },
      { label: "Emploi du temps", to: "/emploi-du-temps", statut: "dispo" },
      { label: "Feuille de présence", to: "/eleves", statut: "dispo" },
      { label: "PV de conseil de classe", to: "/bulletins", statut: "dispo" },
    ],
  },
  {
    id: "finances", label: "Finances", icone: "💰",
    docs: [
      { label: "Factures", to: "/paiements", statut: "dispo" },
      { label: "Reçus de paiement", to: "/paiements", statut: "dispo" },
      { label: "Factures cantine", to: "/cantine", statut: "dispo" },
      { label: "Attestation de paiement", to: "/certificats", statut: "dispo" },
      { label: "État des impayés", to: "/recouvrement", statut: "dispo" },
    ],
  },
  {
    id: "rh", label: "RH & Paie", icone: "🧑‍💼",
    docs: [
      { label: "Bulletins de salaire", to: "/rh", statut: "dispo" },
      { label: "Attestation de travail", to: "/rh", statut: "dispo" },
      { label: "Certificat de fin de contrat", to: "/rh", statut: "dispo" },
      { label: "Ordre de mission", to: "/rh", statut: "dispo" },
      { label: "État de la masse salariale", to: "/rh", statut: "dispo" },
    ],
  },
];

const STATUT = {
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  rejete: { label: "Rejeté", cls: "bg-rose-100 text-rose-700" },
  archive: { label: "Archivé", cls: "bg-navy-900/10 text-navy-900/60" },
  genere: { label: "Généré", cls: "bg-navy-900/10 text-navy-900/60" },
};

// Famille d'un document enregistré (colonne `famille`, sinon déduite du type).
const TYPE_FAMILLE = {
  facture: "finances", recu: "finances", bulletin: "pedagogie", classement: "pedagogie",
  paie: "rh", salaire: "rh", scolarite: "scolarite", inscription: "scolarite", frequentation: "scolarite",
};
const familleDe = (d) => d.famille || TYPE_FAMILLE[d.type] || "scolarite";
const FAMILLE_LABEL = { scolarite: "Scolarité", pedagogie: "Pédagogie", finances: "Finances", rh: "RH & Paie" };

export default function Documentation() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [fam, setFam] = useState("");
  const [typeF, setTypeF] = useState("");
  const [statutF, setStatutF] = useState("");
  const [dateDe, setDateDe] = useState("");
  const [dateA, setDateA] = useState("");
  const [apercu, setApercu] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    getDocuments(ecoleId).then(setDocs).catch(() => {}).finally(() => setChargement(false));
  }, [ecoleId]);

  const dateDoc = (d) => (d.date_doc || d.created_at || "").toString().slice(0, 10);
  const typesPresents = [...new Set(docs.map((d) => d.type).filter(Boolean))].sort();

  const filtres = docs.filter((d) => {
    if (fam && familleDe(d) !== fam) return false;
    if (typeF && d.type !== typeF) return false;
    if (statutF && d.statut !== statutF) return false;
    const dd = dateDoc(d);
    if (dateDe && dd < dateDe) return false;
    if (dateA && dd > dateA) return false;
    if (!q) return true;
    const t = `${d.titre || ""} ${d.type || ""} ${d.reference || ""} ${d.cible_libelle || ""} ${d.eleves?.prenom || ""} ${d.eleves?.nom || ""}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  async function exporterExcel() {
    if (!filtres.length) return;
    setExportEnCours(true);
    try {
      const XLSX = await import("xlsx");
      const lignes = filtres.map((d) => ({
        Date: dateDoc(d),
        Famille: FAMILLE_LABEL[familleDe(d)] || "",
        Type: d.type || "",
        Titre: d.titre || "",
        Cible: d.eleves ? `${d.eleves.nom} ${d.eleves.prenom}` : (d.cible_libelle || ""),
        "Référence": d.reference || "",
        Montant: d.montant != null ? Number(d.montant) : "",
        Statut: STATUT[d.statut]?.label || d.statut || "",
      }));
      const ws = XLSX.utils.json_to_sheet(lignes);
      ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Documents");
      XLSX.writeFile(wb, `documents-${ecole?.sigle || "ecole"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExportEnCours(false); }
  }

  return (
    <>
      <EnTete titre="Documentation" sousTitre="Tous les documents officiels de l'école, au même endroit" />
      <div className="space-y-6 p-4 sm:p-8">
        <p className="rounded-xl bg-creme/60 px-4 py-2.5 text-xs text-navy-900/60">
          Retrouvez ici tous les documents de l'établissement, classés par famille. Cliquez sur un type pour le générer.
          Les documents validés s'affichent dans « Documents enregistrés » ci-dessous ; l'archivage automatique des
          factures, bulletins et fiches de paie arrive prochainement.
        </p>

        {/* Catalogue par famille */}
        <div className="grid gap-5 lg:grid-cols-2">
          {FAMILLES.map((f) => (
            <Carte key={f.id} className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">
                <span className="mr-2">{f.icone}</span>{f.label}
              </h3>
              <div className="flex flex-wrap gap-2">
                {f.docs.map((d) =>
                  d.to && d.statut === "dispo" ? (
                    <Link
                      key={d.label}
                      to={d.to}
                      className="group inline-flex items-center gap-1.5 rounded-lg border border-navy-900/10 bg-white px-3 py-1.5 text-sm text-navy-900 hover:border-or-500 hover:text-or-600"
                    >
                      {d.label}
                      <span className="text-navy-900/30 group-hover:text-or-500">→</span>
                    </Link>
                  ) : (
                    <span
                      key={d.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-navy-900/10 bg-navy-900/[0.02] px-3 py-1.5 text-sm text-navy-900/40"
                      title="Bientôt disponible"
                    >
                      {d.label}
                      <span className="rounded bg-navy-900/5 px-1 text-[10px] uppercase tracking-wide">à venir</span>
                    </span>
                  )
                )}
              </div>
            </Carte>
          ))}
        </div>

        {/* Documents enregistrés */}
        <Carte className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              Documents enregistrés
              {docs.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/40">({filtres.length}/{docs.length})</span>}
            </h3>
            <Bouton variante="fantome" onClick={exporterExcel} disabled={exportEnCours || filtres.length === 0}>
              {exportEnCours ? "Export…" : "⬇️ Exporter (Excel)"}
            </Bouton>
          </div>
          {/* Filtres avancés */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select value={fam} onChange={(e) => setFam(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Toutes familles</option>
              {Object.entries(FAMILLE_LABEL).map(([id, lib]) => <option key={id} value={id}>{lib}</option>)}
            </select>
            <select value={typeF} onChange={(e) => setTypeF(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Tous types</option>
              {typesPresents.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statutF} onChange={(e) => setStatutF(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Tous statuts</option>
              {Object.entries(STATUT).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
            <input type="date" value={dateDe} onChange={(e) => setDateDe(e.target.value)} title="Du"
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <input type="date" value={dateA} onChange={(e) => setDateA(e.target.value)} title="Au"
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
              className="rounded-xl border border-navy-900/15 bg-creme px-3 py-2 text-sm outline-none focus:border-or-500" />
          </div>

          {chargement ? (
            <p className="py-6 text-sm text-navy-900/40">Chargement…</p>
          ) : filtres.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-900/10 px-4 py-8 text-center text-sm text-navy-900/40">
              {docs.length === 0
                ? "Aucun document enregistré pour l'instant. Générez un certificat ou une attestation, et il apparaîtra ici."
                : "Aucun document ne correspond à la recherche."}
            </p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {filtres.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{d.titre || d.type}</p>
                    <p className="text-xs text-navy-900/50">
                      <span className="rounded bg-navy-900/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{FAMILLE_LABEL[familleDe(d)]}</span>
                      {" · "}
                      {d.eleves ? `${d.eleves.prenom} ${d.eleves.nom}` : (d.cible_libelle || "—")}
                      {d.reference ? ` · ${d.reference}` : ""}
                      {d.montant != null ? ` · ${Number(d.montant).toLocaleString("fr-FR")} ${devise}` : ""}
                      {` · ${(d.date_doc || d.created_at || "").toString().slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {STATUT[d.statut] && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT[d.statut].cls}`}>
                        {STATUT[d.statut].label}
                      </span>
                    )}
                    <button onClick={() => setApercu(d)} className="text-xs font-medium text-navy-700 hover:text-or-500">
                      Aperçu
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* Aperçu d'un document */}
      <Modale ouvert={!!apercu} onFermer={() => setApercu(null)} titre={apercu?.titre || "Document"} large>
        {apercu && (
          <>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-navy-900/10">
              {apercu.corps ? (
                <DocumentOfficiel
                  ecole={ecole}
                  titre={apercu.titre}
                  corps={apercu.corps}
                  signataire={apercu.signataire_nom}
                  signatureUrl={apercu.signature_url}
                  ville={apercu.ville}
                  date={apercu.date_doc}
                  reference={apercu.reference}
                  signature={apercu.statut === "valide"}
                />
              ) : (
                <div className="p-5">
                  <p className="font-display text-lg font-semibold text-navy-900">{apercu.titre}</p>
                  <p className="mb-3 text-xs text-navy-900/50">
                    {(apercu.eleves ? `${apercu.eleves.prenom} ${apercu.eleves.nom}` : (apercu.cible_libelle || ""))}
                    {apercu.reference ? ` · ${apercu.reference}` : ""}
                    {` · ${(apercu.date_doc || apercu.created_at || "").toString().slice(0, 10)}`}
                  </p>
                  {apercu.donnees?.lignes?.length > 0 && (
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-navy-900/5">
                        {apercu.donnees.lignes.map((l, i) => (
                          <tr key={i}>
                            <td className="py-1.5 text-navy-900">{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</td>
                            <td className="py-1.5 text-right font-mono text-navy-900">{Number(l.montant).toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-navy-900/10 pt-3">
                    <span className="text-sm text-navy-900/60">
                      {apercu.donnees?.mode ? `Mode : ${apercu.donnees.mode}` : (apercu.donnees?.echeance ? `Échéance : ${apercu.donnees.echeance}` : "")}
                    </span>
                    <span className="font-display text-lg font-bold text-navy-900">
                      {Number(apercu.montant ?? apercu.donnees?.montant ?? apercu.donnees?.montant_total ?? 0).toLocaleString("fr-FR")} {devise}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-navy-900/40">
                    Instantané archivé. Pour le document détaillé imprimable, ouvrez-le depuis la page{" "}
                    <Link to="/paiements" className="text-navy-700 hover:text-or-500">Paiements</Link>.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 text-right">
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>
    </>
  );
}
