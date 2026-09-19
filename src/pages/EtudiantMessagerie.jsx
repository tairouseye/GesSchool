import { useEffect, useRef, useState, useCallback } from "react";
import { Bouton, Alerte } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { maConversation, envoyerMessage } from "@/lib/etudiant.js";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Espace étudiant — fil unique avec la scolarité.
// Pas de liste de conversations : l'étudiant n'a qu'un interlocuteur, son
// établissement. Le choisir serait une question sans réponse possible.
export default function EtudiantMessagerie() {
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const basRef = useRef(null);

  const charger = useCallback(async () => {
    try { setMessages(await maConversation()); }
    catch (e) { setErreur(e.message); setMessages([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Un fil se lit par le bas : sans cela, un nouvel arrivant atterrit sur le
  // premier message échangé il y a six mois.
  useEffect(() => {
    if (messages?.length) basRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function envoyer(e) {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setEnvoi(true);
    try {
      await envoyerMessage(t);
      setTexte("");
      await charger();
    } catch (er) { toast.erreur(er); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">✉️ Messagerie</p>
        <p className="text-sm text-creme/70">Écrivez directement à la scolarité</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex h-[58vh] flex-col overflow-hidden rounded-2xl border border-navy-900/10 bg-white shadow-sm">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages === null ? (
            <p className="text-center text-sm text-navy-900/40">Chargement…</p>
          ) : messages.length === 0 ? (
            <p className="mx-auto max-w-sm pt-8 text-center text-sm text-navy-900/45">
              Aucun message. Posez votre question à la scolarité : inscription, relevé,
              attestation, paiement… Vous serez prévenu de la réponse dans vos actualités.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.expediteur === "etudiant" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.expediteur === "etudiant" ? "bg-navy-900 text-creme" : "bg-creme text-navy-900"}`}>
                  <p className="whitespace-pre-wrap">{m.contenu}</p>
                  <p className={`mt-1 text-[10px] ${
                    m.expediteur === "etudiant" ? "text-creme/50" : "text-navy-900/40"}`}>{fmt(m.created_at)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={basRef} />
        </div>

        <form onSubmit={envoyer} className="flex gap-2 border-t border-navy-900/10 p-3">
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Votre message…"
            className="min-w-0 flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          />
          <Bouton type="submit" disabled={envoi || !texte.trim()}>Envoyer</Bouton>
        </form>
      </div>
    </div>
  );
}
