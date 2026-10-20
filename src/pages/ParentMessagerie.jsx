import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { mesConversations, conversationMessages, parentEnvoyer } from "@/lib/parent.js";
import { Carte, Alerte, Bouton, Skeleton } from "@/composants/ui.jsx";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Squelette de fil : annoncé comme chargement, jamais comme un fil vide.
function ChargementFil({ label }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="ml-auto h-9 w-1/2" />
      <Skeleton className="h-9 w-3/5" />
    </div>
  );
}

export default function ParentMessagerie() {
  const [convs, setConvs] = useState([]);
  //  ⚠️ « Aucune conversation » N'EST AFFICHÉ QU'APRÈS UNE RÉPONSE RÉUSSIE.
  //  Avant, `ecoleId` valait `null` au premier rendu et la page annonçait déjà
  //  « Aucune conversation. » pendant que `mesConversations()` tournait encore :
  //  un parent sur une connexion lente lisait un résultat définitif et repartait.
  const [chargement, setChargement] = useState(true);
  // La cle du fil est l'ECOLE, plus la fiche tuteur (migration 158).
  const [ecoleId, setEcoleId] = useState(null);
  // Le fil retient l'école à laquelle il appartient : tant qu'il ne correspond
  // pas à l'école choisie, on affiche un chargement — pas « Démarrez la
  // conversation », ni les messages de l'école précédente.
  const [fil, setFil] = useState({ ecoleId: null, messages: [], echec: false });
  const ecoleCourante = useRef(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await mesConversations();
        setConvs(c);
        if (c.length === 1) setEcoleId(c[0].ecole_id);
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, []);

  const charger = useCallback(async () => {
    ecoleCourante.current = ecoleId;
    if (!ecoleId) return;
    try {
      const m = await conversationMessages(ecoleId);
      // Réponse tardive d'une école qu'on a quittée entre-temps : ignorée.
      if (ecoleCourante.current === ecoleId) { setFil({ ecoleId, messages: m, echec: false }); setErreur(""); }
    } catch (e) {
      setErreur(e.message);
      if (ecoleCourante.current === ecoleId) setFil({ ecoleId, messages: [], echec: true });
    }
  }, [ecoleId]);

  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !ecoleId) return;
    setEnvoi(true);
    try {
      await parentEnvoyer(ecoleId, texte.trim());
      setTexte("");
      await charger();
    } catch (er) { setErreur(er.message); }
    finally { setEnvoi(false); }
  }

  const conv = convs.find((c) => c.ecole_id === ecoleId);
  const filPret = fil.ecoleId === ecoleId;
  const messages = filPret ? fil.messages : [];

  return (
    <div className="space-y-5">
      <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      <Alerte ton="erreur">{erreur}</Alerte>

      <h1 className="font-display text-2xl font-bold text-navy-900">Messagerie</h1>

      {/* Choix d'établissement si plusieurs */}
      {convs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {convs.map((c) => (
            <button key={c.ecole_id} onClick={() => setEcoleId(c.ecole_id)}
              aria-pressed={c.ecole_id === ecoleId}
              className={`rounded-lg px-3 py-1.5 text-sm ${c.ecole_id === ecoleId ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70"}`}>
              {c.ecole}{c.non_lus > 0 ? ` (${c.non_lus})` : ""}
            </button>
          ))}
        </div>
      )}

      {chargement ? (
        <Carte className="p-8"><ChargementFil label="Chargement des conversations" /></Carte>
      ) : !ecoleId ? (
        // Échec du chargement : le bandeau d'erreur suffit, pas de faux « vide ».
        erreur && convs.length === 0 ? null : (
          <Carte className="p-8 text-sm text-navy-900/70">
            {convs.length > 1 ? "Choisissez un établissement ci-dessus." : "Aucune conversation."}
          </Carte>
        )
      ) : (
        <Carte className="flex h-[60vh] flex-col p-0">
          <div className="border-b border-navy-900/10 px-5 py-3">
            <p className="font-display font-semibold text-navy-900">{conv?.ecole || "École"}</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-5">
            {!filPret ? (
              <ChargementFil label="Chargement des messages" />
            ) : fil.echec ? (
              <div className="text-center text-sm text-navy-900/70">
                <p>Les messages n&apos;ont pas pu être affichés.</p>
                <Bouton className="mt-3" variante="fantome"
                  onClick={() => { setFil({ ecoleId: null, messages: [], echec: false }); charger(); }}>
                  Réessayer
                </Bouton>
              </div>
            ) : messages.length === 0 ? (
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
              aria-label="Votre message"
              className="flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            />
            <Bouton type="submit" disabled={envoi || !texte.trim()}>Envoyer</Bouton>
          </form>
        </Carte>
      )}
    </div>
  );
}
