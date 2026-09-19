import { useEffect, useState, useCallback } from "react";
import { Bouton, Carte, Alerte, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { TYPES_DOCUMENT, demanderMonDocument, mesDemandesDocuments } from "@/lib/etudiant.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const libType = (t) => TYPES_DOCUMENT.find(([v]) => v === t)?.[1] || t;
const STATUTS = {
  en_attente: ["En attente", "warning"],
  en_cours: ["En préparation", "info"],
  pret: ["Prêt à retirer", "success"],
  rejete: ["Refusé", "danger"],
};

// Espace étudiant — demandes de documents administratifs.
// C'est LA raison pour laquelle on fait la queue au secrétariat : certificat
// de scolarité, attestation d'inscription. Le dématérialiser change le
// quotidien, côté étudiant comme côté administration.
export default function EtudiantDocuments() {
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [type, setType] = useState("scolarite");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    try { setListe(await mesDemandesDocuments()); }
    catch (e) { setErreur(e.message); setListe([]); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  async function demander(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await demanderMonDocument(type, message);
      setMessage("");
      toast.succes("Demande envoyée au secrétariat.");
      recharger();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  const enCours = (liste || []).filter((d) => d.statut === "en_attente" || d.statut === "en_cours").length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">🧾 Mes documents</p>
        <p className="text-sm text-creme/70">Demander un certificat ou une attestation</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <Carte className="p-4">
        <form onSubmit={demander} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Document souhaité</span>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {TYPES_DOCUMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
            placeholder="Précision éventuelle (motif, nombre d'exemplaires…)"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-navy-900/45">
              {enCours >= 5 ? "Vous avez atteint 5 demandes en cours." : `${enCours} demande(s) en cours · 5 maximum.`}
            </span>
            <Bouton type="submit" disabled={busy || enCours >= 5}>{busy ? "…" : "Envoyer la demande"}</Bouton>
          </div>
        </form>
      </Carte>

      {liste === null ? <SkeletonListe lignes={3} /> : liste.length === 0 ? (
        <EtatVide icone="🧾" titre="Aucune demande">Vos demandes et leur avancement apparaîtront ici.</EtatVide>
      ) : (
        <div className="space-y-2">
          {liste.map((d) => {
            const [lib, ton] = STATUTS[d.statut] || [d.statut, "neutre"];
            return (
              <Carte key={d.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{libType(d.type)}</p>
                    <p className="text-xs text-navy-900/55">
                      Demandé le {dateFr(d.created_at)}
                      {d.traite_le ? ` · traité le ${dateFr(d.traite_le)}` : ""}
                    </p>
                  </div>
                  <Badge ton={ton}>{lib}</Badge>
                </div>
                {d.message && <p className="mt-2 text-sm text-navy-900/60">« {d.message} »</p>}
                {d.reponse && (
                  <p className="mt-2 rounded-lg bg-creme px-3 py-2 text-xs text-navy-900/70">
                    Réponse du secrétariat : {d.reponse}
                  </p>
                )}
              </Carte>
            );
          })}
        </div>
      )}
    </div>
  );
}
