import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, Bouton } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/messagerie.js";
import { getEleves, getTuteursEleve } from "@/lib/eleves.js";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function Messagerie() {
  const { ecoleId, utilisateur } = useAuth();
  const toast = useToast();
  const [convs, setConvs] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [choixParents, setChoixParents] = useState(null); // { eleve, parents } quand un élève a plusieurs parents
  const [tuteurId, setTuteurId] = useState(null);
  const [selInfo, setSelInfo] = useState(null); // { nom, eleve } du parent ouvert via recherche
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const rechargerConvs = useCallback(async () => {
    try { setConvs(await api.getConversations()); }
    catch (e) { setErreur(e.message); }
  }, []);

  useEffect(() => { rechargerConvs(); }, [rechargerConvs]);
  useEffect(() => { getEleves(ecoleId).then(setEleves).catch((e) => setErreur(e.message)); }, [ecoleId]);

  // Lien profond depuis la fiche élève : /messagerie?tuteur=…&nom=…
  const [params] = useSearchParams();
  useEffect(() => {
    const t = params.get("tuteur");
    if (t) ouvrir(t, params.get("nom") || "Parent", params.get("eleve") || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } catch (er) { setErreur(er.message); toast.erreur(er.message); }
    finally { setEnvoi(false); }
  }

  // Ouvre le fil d'un parent (par son tuteur_id).
  function ouvrir(tid, nom, eleveNom) {
    setTuteurId(tid);
    setSelInfo(nom ? { nom, eleve: eleveNom } : null);
    setRecherche("");
    setChoixParents(null);
  }

  // Sélectionne un élève → retrouve ses parents avec compte.
  async function choisirEleve(el) {
    try {
      const liens = await getTuteursEleve(el.id);
      const parents = liens.map((l) => l.tuteurs).filter((t) => t && t.profil_id);
      if (parents.length === 0) { toast.erreur("Aucun parent de cet élève n'a de compte."); return; }
      if (parents.length === 1) ouvrir(parents[0].id, `${parents[0].prenom} ${parents[0].nom}`, `${el.prenom} ${el.nom}`);
      else setChoixParents({ eleve: el, parents });
    } catch (e) { toast.erreur(e.message); }
  }

  const q = recherche.trim().toLowerCase();
  const resultats = q
    ? eleves.filter((e) => `${e.prenom} ${e.nom} ${e.matricule || ""}`.toLowerCase().includes(q)).slice(0, 30)
    : [];
  const conv = convs.find((c) => c.tuteur_id === tuteurId);
  const titreFil = conv?.parent || selInfo?.nom || "Parent";

  return (
    <>
      <EnTete titre="Messagerie" sousTitre="Échanges avec les parents" />
      <div className="p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Panneau de gauche : recherche d'élève OU conversations */}
          <Carte className="flex max-h-[62vh] flex-col overflow-hidden lg:col-span-1">
            <div className="border-b border-navy-900/10 p-3">
              <input
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setChoixParents(null); }}
                placeholder="🔍 Rechercher un élève…"
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500"
              />
            </div>

            {choixParents ? (
              /* Un élève a plusieurs parents → choisir lequel */
              <div className="overflow-y-auto">
                <button onClick={() => setChoixParents(null)} className="px-4 py-2 text-xs text-navy-700 hover:text-or-500">← Retour</button>
                <p className="px-4 pb-1 text-xs text-navy-900/50">Parents de {choixParents.eleve.prenom} {choixParents.eleve.nom}</p>
                {choixParents.parents.map((p) => (
                  <button key={p.id} onClick={() => ouvrir(p.id, `${p.prenom} ${p.nom}`, `${choixParents.eleve.prenom} ${choixParents.eleve.nom}`)}
                    className="block w-full border-t border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60">
                    <p className="font-medium text-navy-900">{p.prenom} {p.nom}</p>
                    <p className="text-xs text-navy-900/50">{p.telephone || p.email || "—"}</p>
                  </button>
                ))}
              </div>
            ) : q ? (
              /* Résultats de recherche d'élèves */
              <ul className="overflow-y-auto">
                {resultats.length === 0 ? (
                  <li className="p-6 text-sm text-navy-900/40">Aucun élève trouvé.</li>
                ) : (
                  resultats.map((el) => (
                    <li key={el.id}>
                      <button onClick={() => choisirEleve(el)}
                        className="flex w-full items-center justify-between gap-2 border-b border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy-900">{el.prenom} {el.nom}</span>
                          <span className="block truncate font-mono text-xs text-navy-900/50">{el.matricule || "—"}</span>
                        </span>
                        <span className="text-navy-900/30">›</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              /* Conversations existantes */
              <ul className="overflow-y-auto">
                <li className="px-4 py-2 text-[11px] uppercase tracking-wide text-navy-900/40">Conversations</li>
                {convs.length === 0 ? (
                  <li className="px-4 pb-4 text-sm text-navy-900/40">Aucune conversation. Recherchez un élève ci‑dessus pour écrire à son parent.</li>
                ) : (
                  convs.map((c) => (
                    <li key={c.tuteur_id}>
                      <button
                        onClick={() => ouvrir(c.tuteur_id, c.parent)}
                        className={`flex w-full items-start justify-between gap-2 border-b border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60 ${c.tuteur_id === tuteurId ? "bg-creme" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy-900">{c.parent}</span>
                          <span className="block truncate text-xs text-navy-900/50">{c.dernier || "—"}</span>
                        </span>
                        {c.non_lus > 0 && (
                          <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">{c.non_lus}</span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </Carte>

          {/* Fil */}
          <Carte className="flex h-[62vh] flex-col p-0 lg:col-span-2">
            {!tuteurId ? (
              <p className="grid flex-1 place-items-center px-6 text-center text-sm text-navy-900/40">
                Recherchez un élève pour écrire à son parent, ou choisissez une conversation.
              </p>
            ) : (
              <>
                <div className="border-b border-navy-900/10 px-5 py-3">
                  <p className="font-display font-semibold text-navy-900">{titreFil}</p>
                  {(conv?.telephone || selInfo?.eleve) && (
                    <p className="text-xs text-navy-900/50">{selInfo?.eleve ? `Parent de ${selInfo.eleve}` : conv?.telephone}</p>
                  )}
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-5">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-navy-900/40">Aucun message. Écrivez le premier.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.expediteur === "ecole" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.expediteur === "ecole" ? "bg-navy-900 text-creme" : "bg-creme text-navy-900"}`}>
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
                    placeholder="Votre message…"
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
