import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, Bouton } from "@/composants/ui.jsx";
import * as api from "@/lib/messagerie.js";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function Messagerie() {
  const { ecoleId, utilisateur } = useAuth();
  const [convs, setConvs] = useState([]);
  const [tuteurId, setTuteurId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const rechargerConvs = useCallback(async () => {
    try { setConvs(await api.getConversations()); }
    catch (e) { setErreur(e.message); }
  }, []);

  useEffect(() => { rechargerConvs(); }, [rechargerConvs]);

  const chargerThread = useCallback(async () => {
    if (!tuteurId) { setMessages([]); return; }
    try { setMessages(await api.getThread(tuteurId)); }
    catch (e) { setErreur(e.message); }
  }, [tuteurId]);

  useEffect(() => { chargerThread(); }, [chargerThread]);

  async function envoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !tuteurId) return;
    setEnvoi(true);
    try {
      await api.envoyerEcole(ecoleId, tuteurId, texte, utilisateur?.id);
      setTexte("");
      await chargerThread();
      await rechargerConvs();
    } catch (er) { setErreur(er.message); }
    finally { setEnvoi(false); }
  }

  const conv = convs.find((c) => c.tuteur_id === tuteurId);

  return (
    <>
      <EnTete titre="Messagerie" sousTitre="Échanges avec les parents" />
      <div className="p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Liste des conversations */}
          <Carte className="overflow-hidden lg:col-span-1">
            <div className="border-b border-navy-900/10 px-4 py-3 text-sm font-medium text-navy-900/60">Parents</div>
            {convs.length === 0 ? (
              <p className="p-6 text-sm text-navy-900/40">Aucun parent avec un compte.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {convs.map((c) => (
                  <li key={c.tuteur_id}>
                    <button
                      onClick={() => setTuteurId(c.tuteur_id)}
                      className={`flex w-full items-start justify-between gap-2 border-b border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60 ${
                        c.tuteur_id === tuteurId ? "bg-creme" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy-900">{c.parent}</p>
                        <p className="truncate text-xs text-navy-900/50">{c.dernier || "—"}</p>
                      </div>
                      {c.non_lus > 0 && (
                        <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">
                          {c.non_lus}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          {/* Fil */}
          <Carte className="flex h-[60vh] flex-col p-0 lg:col-span-2">
            {!tuteurId ? (
              <p className="grid flex-1 place-items-center text-sm text-navy-900/40">Sélectionnez un parent.</p>
            ) : (
              <>
                <div className="border-b border-navy-900/10 px-5 py-3">
                  <p className="font-display font-semibold text-navy-900">{conv?.parent || "Parent"}</p>
                  {conv?.telephone && <p className="text-xs text-navy-900/50">{conv.telephone}</p>}
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-5">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-navy-900/40">Aucun message. Écrivez le premier.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.expediteur === "ecole" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          m.expediteur === "ecole" ? "bg-navy-900 text-creme" : "bg-creme text-navy-900"
                        }`}>
                          <p className="whitespace-pre-wrap">{m.contenu}</p>
                          <p className={`mt-1 text-[10px] ${m.expediteur === "ecole" ? "text-creme/50" : "text-navy-900/40"}`}>{fmt(m.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={envoyer} className="flex gap-2 border-t border-navy-900/10 p-3">
                  <input
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    placeholder="Votre réponse…"
                    className="flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
                  />
                  <Bouton type="submit" disabled={envoi || !texte.trim()}>Envoyer</Bouton>
                </form>
              </>
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}
