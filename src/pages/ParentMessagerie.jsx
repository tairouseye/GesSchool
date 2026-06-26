import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { mesConversations, conversationMessages, parentEnvoyer } from "@/lib/parent.js";
import { Carte, Alerte, Bouton } from "@/composants/ui.jsx";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function ParentMessagerie() {
  const [convs, setConvs] = useState([]);
  const [tuteurId, setTuteurId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await mesConversations();
        setConvs(c);
        if (c.length === 1) setTuteurId(c[0].tuteur_id);
      } catch (e) { setErreur(e.message); }
    })();
  }, []);

  const charger = useCallback(async () => {
    if (!tuteurId) return;
    try { setMessages(await conversationMessages(tuteurId)); }
    catch (e) { setErreur(e.message); }
  }, [tuteurId]);

  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !tuteurId) return;
    setEnvoi(true);
    try {
      await parentEnvoyer(tuteurId, texte.trim());
      setTexte("");
      await charger();
    } catch (er) { setErreur(er.message); }
    finally { setEnvoi(false); }
  }

  const conv = convs.find((c) => c.tuteur_id === tuteurId);

  return (
    <div className="space-y-5">
      <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      <Alerte ton="erreur">{erreur}</Alerte>

      <h1 className="font-display text-2xl font-bold text-navy-900">Messagerie</h1>

      {/* Choix d'établissement si plusieurs */}
      {convs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {convs.map((c) => (
            <button key={c.tuteur_id} onClick={() => setTuteurId(c.tuteur_id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${c.tuteur_id === tuteurId ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70"}`}>
              {c.ecole}{c.non_lus > 0 ? ` (${c.non_lus})` : ""}
            </button>
          ))}
        </div>
      )}

      {!tuteurId ? (
        <Carte className="p-8 text-sm text-navy-900/50">Aucune conversation.</Carte>
      ) : (
        <Carte className="flex h-[60vh] flex-col p-0">
          <div className="border-b border-navy-900/10 px-5 py-3">
            <p className="font-display font-semibold text-navy-900">{conv?.ecole || "École"}</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-navy-900/40">Démarrez la conversation avec l'établissement.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.expediteur === "parent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    m.expediteur === "parent" ? "bg-navy-900 text-creme" : "bg-creme text-navy-900"
                  }`}>
                    <p className="whitespace-pre-wrap">{m.contenu}</p>
                    <p className={`mt-1 text-[10px] ${m.expediteur === "parent" ? "text-creme/50" : "text-navy-900/40"}`}>{fmt(m.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={envoyer} className="flex gap-2 border-t border-navy-900/10 p-3">
            <input
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Votre message…"
              className="flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            />
            <Bouton type="submit" disabled={envoi || !texte.trim()}>Envoyer</Bouton>
          </form>
        </Carte>
      )}
    </div>
  );
}
