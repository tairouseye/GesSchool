import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte } from "@/composants/ui.jsx";
import * as api from "@/lib/demandes.js";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const TONS = { or: "bg-or-500/15 text-or-600", navy: "bg-navy-900/5 text-navy-900/60", vert: "bg-emerald-500/10 text-emerald-700", rouge: "bg-rose-500/10 text-rose-700" };

export default function Demandes() {
  const { ecoleId } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [filtre, setFiltre] = useState("a_traiter");
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try { setDemandes(await api.getDemandes(ecoleId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const liste = demandes.filter((d) =>
    filtre === "a_traiter" ? (d.statut === "en_attente" || d.statut === "en_cours") : true
  );
  const enAttente = demandes.filter((d) => d.statut === "en_attente" || d.statut === "en_cours").length;

  return (
    <>
      <EnTete titre="Demandes de documents" sousTitre={enAttente ? `${enAttente} à traiter` : "Tout est à jour"} />
      <div className="space-y-4 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["a_traiter", "À traiter"], ["toutes", "Toutes"]].map(([k, l]) => (
            <button key={k} onClick={() => setFiltre(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filtre === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {liste.length === 0 ? (
          <Carte className="p-8 text-sm text-navy-900/50">Aucune demande{filtre === "a_traiter" ? " à traiter" : ""}.</Carte>
        ) : (
          liste.map((d) => (
            <LigneDemande key={d.id} d={d} onTraite={(statut, reponse) => api.traiterDemande(d.id, statut, reponse).then(recharger).catch((e) => setErreur(e.message))} />
          ))
        )}
      </div>
    </>
  );
}

function LigneDemande({ d, onTraite }) {
  const [reponse, setReponse] = useState(d.reponse || "");
  const s = api.STATUTS[d.statut] || api.STATUTS.en_attente;
  return (
    <Carte className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold text-navy-900">{api.TYPES[d.type] || d.type}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[s.ton]}`}>{s.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-navy-900/70">
            {d.eleves?.prenom} {d.eleves?.nom} <span className="font-mono text-xs text-navy-900/40">{d.eleves?.matricule}</span>
          </p>
          <p className="text-xs text-navy-900/50">
            Demandé par {d.tuteurs?.prenom} {d.tuteurs?.nom}{d.tuteurs?.telephone ? ` · ${d.tuteurs.telephone}` : ""} · {fmt(d.created_at)}
          </p>
          {d.message && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-900/70">« {d.message} »</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-navy-900/5 pt-3">
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs text-navy-900/50">Réponse / instructions (optionnel)</span>
          <input value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="À retirer au secrétariat…"
            className="w-full rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-or-500" />
        </label>
        <Bouton variante="fantome" onClick={() => onTraite("en_cours", reponse)}>En cours</Bouton>
        <Bouton variante="or" onClick={() => onTraite("pret", reponse)}>Marquer prêt</Bouton>
        <button onClick={() => onTraite("rejete", reponse)} className="px-2 py-2 text-xs text-rose-500 hover:underline">Rejeter</button>
      </div>
    </Carte>
  );
}
