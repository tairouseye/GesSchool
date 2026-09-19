import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, Bouton } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/messagerie.js";
import { getEleves, getTuteursEleve, chercherEleves } from "@/lib/eleves.js";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function Messagerie() {
  const { ecoleId, utilisateur, typeEtablissement } = useAuth();
  const sup = typeEtablissement === "superieur";
  const toast = useToast();

  // Au supérieur, l'étudiant est majeur et écrit lui-même : c'est l'onglet
  // par défaut. Les parents restent joignables, mais ce n'est plus le canal
  // principal. À l'école, aucun onglet : la page ne change pas.
  const [onglet, setOnglet] = useState(sup ? "etudiants" : "parents");
  useEffect(() => { setOnglet(sup ? "etudiants" : "parents"); }, [sup]);

  const [erreur, setErreur] = useState("");
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // --- Fils PARENTS (existant) ---
  const [convs, setConvs] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [choixParents, setChoixParents] = useState(null); // { eleve, parents } si plusieurs
  const [tuteurId, setTuteurId] = useState(null);
  const [selInfo, setSelInfo] = useState(null);

  // --- Fils ÉTUDIANTS (migration 139) ---
  const [convsEt, setConvsEt] = useState([]);
  const [rechercheEt, setRechercheEt] = useState("");
  const [resultatsEt, setResultatsEt] = useState([]);
  const [eleveId, setEleveId] = useState(null);
  const [selEleve, setSelEleve] = useState(null);

  const [messages, setMessages] = useState([]);

  const rechargerConvs = useCallback(async () => {
    try { setConvs(await api.getConversations()); }
    catch (e) { setErreur(e.message); }
  }, []);
  const rechargerConvsEt = useCallback(async () => {
    if (!sup) return;
    try { setConvsEt(await api.getConversationsEtudiants()); }
    catch (e) { setErreur(e.message); }
  }, [sup]);

  useEffect(() => { rechargerConvs(); }, [rechargerConvs]);
  useEffect(() => { rechargerConvsEt(); }, [rechargerConvsEt]);
  useEffect(() => { getEleves(ecoleId).then(setEleves).catch((e) => setErreur(e.message)); }, [ecoleId]);

  // Recherche d'étudiant CÔTÉ SERVEUR (au plus 8 résultats) : la liste
  // complète chargée pour l'onglet parent ne passerait pas à l'échelle.
  useEffect(() => {
    const q = rechercheEt.trim();
    if (q.length < 2) { setResultatsEt([]); return undefined; }
    let vivant = true;
    const t = setTimeout(async () => {
      try {
        const r = await chercherEleves(ecoleId, q, { limite: 8 });
        if (vivant) setResultatsEt(r);
      } catch { if (vivant) setResultatsEt([]); }
    }, 250);
    return () => { vivant = false; clearTimeout(t); };
  }, [ecoleId, rechercheEt]);

  // Lien profond depuis la fiche élève : /messagerie?tuteur=…&nom=…
  const [params] = useSearchParams();
  useEffect(() => {
    const t = params.get("tuteur");
    if (t) { setOnglet("parents"); ouvrir(t, params.get("nom") || "Parent", params.get("eleve") || undefined); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chargerThread = useCallback(async () => {
    try {
      if (onglet === "etudiants") setMessages(eleveId ? await api.getThreadEtudiant(eleveId) : []);
      else setMessages(tuteurId ? await api.getThread(tuteurId) : []);
    } catch (e) { setErreur(e.message); }
  }, [onglet, tuteurId, eleveId]);
  useEffect(() => { chargerThread(); }, [chargerThread]);

  async function envoyer(e) {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setEnvoi(true);
    try {
      if (onglet === "etudiants") {
        if (!eleveId) return;
        await api.envoyerEcoleEtudiant(ecoleId, eleveId, t, utilisateur?.id);
      } else {
        if (!tuteurId) return;
        await api.envoyerEcole(ecoleId, tuteurId, t, utilisateur?.id);
      }
      setTexte("");
      await chargerThread();
      await (onglet === "etudiants" ? rechargerConvsEt() : rechargerConvs());
    } catch (er) { setErreur(er.message); toast.erreur(er); }
    finally { setEnvoi(false); }
  }

  function ouvrir(tid, nom, eleveNom) {
    setTuteurId(tid);
    setSelInfo(nom ? { nom, eleve: eleveNom } : null);
    setRecherche("");
    setChoixParents(null);
  }
  function ouvrirEtudiant(el) {
    setEleveId(el.id ?? el.eleve_id);
    setSelEleve(el);
    setRechercheEt("");
    setResultatsEt([]);
  }
  function changerOnglet(o) {
    setOnglet(o);
    setTexte("");
    setErreur("");
  }

  // --- Onglet parents : recherche en mémoire (liste déjà chargée) ---
  const q = recherche.trim().toLowerCase();
  const resultats = q
    ? eleves.filter((e) => `${e.prenom} ${e.nom} ${e.matricule || ""}`.toLowerCase().includes(q)).slice(0, 30)
    : [];

  async function choisirEleve(el) {
    try {
      const liens = await getTuteursEleve(el.id);
      const parents = liens.map((l) => l.tuteurs).filter((t) => t && t.profil_id);
      if (parents.length === 0) { toast.erreur("Aucun parent de cet élève n'a de compte."); return; }
      if (parents.length === 1) ouvrir(parents[0].id, `${parents[0].prenom} ${parents[0].nom}`, `${el.prenom} ${el.nom}`);
      else setChoixParents({ eleve: el, parents });
    } catch (e) { toast.erreur(e.message); }
  }

  const etudiants = onglet === "etudiants";
  const conv = convs.find((c) => c.tuteur_id === tuteurId);
  const convEt = convsEt.find((c) => c.eleve_id === eleveId);
  const ouvert = etudiants ? eleveId : tuteurId;
  const titreFil = etudiants
    ? (convEt?.etudiant || (selEleve ? `${selEleve.prenom} ${selEleve.nom}` : "Étudiant"))
    : (conv?.parent || selInfo?.nom || "Parent");
  const sousTitreFil = etudiants
    ? (convEt?.matricule || selEleve?.matricule || null)
    : (selInfo?.eleve ? `Parent de ${selInfo.eleve}` : conv?.telephone || null);

  return (
    <>
      <EnTete
        titre="Messagerie"
        sousTitre={sup ? "Échanges avec les étudiants et les familles" : "Échanges avec les parents"}
      />
      <div className="p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {sup && (
          <div className="mb-4 flex gap-2">
            {[["etudiants", "Étudiants"], ["parents", "Parents"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => changerOnglet(v)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  onglet === v ? "bg-navy-900 text-creme"
                               : "border border-navy-900/15 bg-white text-navy-900/60 hover:text-navy-900"}`}>
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Panneau de gauche */}
          <Carte className="flex max-h-[62vh] flex-col overflow-hidden lg:col-span-1">
            <div className="border-b border-navy-900/10 p-3">
              <input
                value={etudiants ? rechercheEt : recherche}
                onChange={(e) => {
                  if (etudiants) setRechercheEt(e.target.value);
                  else { setRecherche(e.target.value); setChoixParents(null); }
                }}
                placeholder={etudiants ? "🔍 Rechercher un étudiant…" : "🔍 Rechercher un élève…"}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500"
              />
            </div>

            {etudiants ? (
              rechercheEt.trim().length >= 2 ? (
                <ul className="overflow-y-auto">
                  {resultatsEt.length === 0 ? (
                    <li className="p-6 text-sm text-navy-900/40">Aucun étudiant trouvé.</li>
                  ) : resultatsEt.map((el) => (
                    <li key={el.id}>
                      <button onClick={() => ouvrirEtudiant(el)}
                        className="flex w-full items-center justify-between gap-2 border-b border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy-900">{el.prenom} {el.nom}</span>
                          <span className="block truncate font-mono text-xs text-navy-900/50">
                            {el.matricule || "—"}{el.profil_id ? "" : " · sans compte"}
                          </span>
                        </span>
                        <span className="text-navy-900/30">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="overflow-y-auto">
                  <li className="px-4 py-2 text-[11px] uppercase tracking-wide text-navy-900/40">Conversations</li>
                  {convsEt.length === 0 ? (
                    <li className="px-4 pb-4 text-sm text-navy-900/40">
                      Aucune conversation. Recherchez un étudiant ci-dessus pour lui écrire.
                    </li>
                  ) : convsEt.map((c) => (
                    <li key={c.eleve_id}>
                      <button onClick={() => ouvrirEtudiant(c)}
                        className={`flex w-full items-start justify-between gap-2 border-b border-navy-900/5 px-4 py-3 text-left hover:bg-creme/60 ${c.eleve_id === eleveId ? "bg-creme" : ""}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy-900">{c.etudiant}</span>
                          <span className="block truncate text-xs text-navy-900/50">{c.dernier || "—"}</span>
                        </span>
                        {c.non_lus > 0 && (
                          <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-or-500 px-1 text-[10px] font-bold text-navy-900">{c.non_lus}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : choixParents ? (
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
            {!ouvert ? (
              <p className="grid flex-1 place-items-center px-6 text-center text-sm text-navy-900/40">
                {etudiants
                  ? "Recherchez un étudiant pour lui écrire, ou choisissez une conversation."
                  : "Recherchez un élève pour écrire à son parent, ou choisissez une conversation."}
              </p>
            ) : (
              <>
                <div className="border-b border-navy-900/10 px-5 py-3">
                  <p className="font-display font-semibold text-navy-900">{titreFil}</p>
                  {sousTitreFil && <p className="text-xs text-navy-900/50">{sousTitreFil}</p>}
                  {/* Écrire à un étudiant sans compte revient à parler à un mur :
                      le message est enregistré, mais personne ne le lira. */}
                  {etudiants && selEleve && !selEleve.profil_id && !convEt && (
                    <p className="mt-1 text-xs text-or-600">
                      Cet étudiant n&apos;a pas encore activé son compte : il ne verra pas ce message.
                    </p>
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
                    className="min-w-0 flex-1 rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
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
