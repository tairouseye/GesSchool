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
      { label: "Certificat de radiation / transfert", statut: "a_venir" },
      { label: "Attestation de résultats", statut: "a_venir" },
      { label: "Carte scolaire", statut: "a_venir" },
      { label: "Convocation", statut: "a_venir" },
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
      { label: "Feuille de présence", statut: "a_venir" },
      { label: "PV de conseil de classe", statut: "a_venir" },
    ],
  },
  {
    id: "finances", label: "Finances", icone: "💰",
    docs: [
      { label: "Factures", to: "/paiements", statut: "dispo" },
      { label: "Reçus de paiement", to: "/paiements", statut: "dispo" },
      { label: "Factures cantine", to: "/cantine", statut: "dispo" },
      { label: "Attestation de paiement annuelle", statut: "a_venir" },
      { label: "État des impayés", to: "/recouvrement", statut: "dispo" },
    ],
  },
  {
    id: "rh", label: "RH & Paie", icone: "🧑‍💼",
    docs: [
      { label: "Bulletins de salaire", to: "/rh", statut: "dispo" },
      { label: "Attestation de travail", statut: "a_venir" },
      { label: "Certificat de fin de contrat", statut: "a_venir" },
      { label: "Ordre de mission", statut: "a_venir" },
      { label: "État de la masse salariale", to: "/rh", statut: "dispo" },
    ],
  },
];

const STATUT = {
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  rejete: { label: "Rejeté", cls: "bg-rose-100 text-rose-700" },
};

export default function Documentation() {
  const { ecoleId, ecole } = useAuth();
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [apercu, setApercu] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    getDocuments(ecoleId).then(setDocs).catch(() => {}).finally(() => setChargement(false));
  }, [ecoleId]);

  const filtres = docs.filter((d) => {
    if (!q) return true;
    const t = `${d.titre || ""} ${d.type || ""} ${d.reference || ""} ${d.eleves?.prenom || ""} ${d.eleves?.nom || ""}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              Documents enregistrés
              {docs.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/40">({docs.length})</span>}
            </h3>
            <div className="w-full sm:w-64">
              <Champ label="" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (élève, type, référence)…" />
            </div>
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
                      {d.eleves ? `${d.eleves.prenom} ${d.eleves.nom}` : "—"}
                      {d.reference ? ` · ${d.reference}` : ""}
                      {d.date_doc ? ` · ${d.date_doc}` : ""}
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
