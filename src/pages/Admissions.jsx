import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/admissions.js";
import { getFilieres } from "@/lib/superieur.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { nbPages } from "@/lib/pagination.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const TAILLE = 25;

// Gestion des admissions : campagnes, dossiers reçus, décisions, et la
// transformation d'un admis en étudiant inscrit.
export default function Admissions() {
  const { ecoleId } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();

  const [annee, setAnnee] = useState(null);
  const [campagnes, setCampagnes] = useState([]);
  const [campagneId, setCampagneId] = useState("");
  const [filieres, setFilieres] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [total, setTotal] = useState(0);
  const [compte, setCompte] = useState({});
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [qDiffere, setQDiffere] = useState("");
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [editeCampagne, setEditeCampagne] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [motifDemande, setMotifDemande] = useState(null); // { candidature, statut }

  const chargerCampagnes = useCallback(async () => {
    if (!ecoleId) return;
    try {
      const c = await api.getCampagnes(ecoleId);
      setCampagnes(c);
      setCampagneId((cur) => (c.some((x) => x.id === cur) ? cur : (c[0]?.id || "")));
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    getFilieres(ecoleId).then(setFilieres).catch(() => {});
    chargerCampagnes().finally(() => setChargement(false));
  }, [ecoleId, chargerCampagnes]);

  // Anti-rebond sur la recherche : sans lui, chaque caractère tapé relance
  // une requête de liste.
  useEffect(() => {
    const t = setTimeout(() => setQDiffere(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const charger = useCallback(async () => {
    if (!ecoleId) return;
    try {
      const r = await api.getCandidatures(ecoleId, {
        campagneId: campagneId || null, statut, q: qDiffere, page, taille: TAILLE,
      });
      setLignes(r.lignes); setTotal(r.total);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, campagneId, statut, qDiffere, page]);
  useEffect(() => { charger(); }, [charger]);

  // Les compteurs ne dépendent NI de la recherche NI de la page : les
  // recalculer à chaque frappe ferait sept requêtes par caractère.
  const compter = useCallback(async () => {
    if (!ecoleId) return;
    try { setCompte(await api.compterParStatut(ecoleId, campagneId || null)); }
    catch { /* l'absence de compteur ne doit pas masquer la liste */ }
  }, [ecoleId, campagneId]);
  useEffect(() => { compter(); }, [compter]);

  // Changer de filtre doit ramener en page 1 : sinon on tombe sur une page
  // vide et la liste paraît cassée.
  useEffect(() => { setPage(0); }, [campagneId, statut, qDiffere]);

  // Refus et demande de complément portent un texte QUE LE CANDIDAT LIRA sur
  // sa page de suivi : il mérite un vrai champ, pas une invite du navigateur.
  async function decider(c, s) {
    if (s === "refusee" || s === "complement") { setMotifDemande({ candidature: c, statut: s }); return; }
    await appliquer(c, s, null);
  }

  async function appliquer(c, s, motif) {
    try {
      await api.decider(c.id, s, motif);
      toast.succes("Décision enregistrée.");
      setMotifDemande(null);
      setDossier((d) => (d && d.id === c.id ? { ...d, statut: s, motif } : d));
      charger(); compter();
    } catch (e) { toast.erreur(e); }
  }

  async function inscrire(c) {
    if (!(await confirmer({
      titre: "Inscrire ce candidat",
      message: `${c.prenom} ${c.nom} deviendra un étudiant inscrit${annee?.libelle ? ` en ${annee.libelle}` : ""}, sans ressaisie. Continuer ?`,
      confirmer: "Inscrire", danger: false,
    }))) return;
    try {
      await api.convertir(c.id, annee?.id || null);
      toast.succes("Candidat inscrit : sa fiche étudiant est créée.");
      charger(); compter();
      setDossier(null);
    } catch (e) { toast.erreur(e); }
  }

  const campagne = campagnes.find((x) => x.id === campagneId);
  const pages = nbPages(total, TAILLE);
  const lien = `${window.location.origin}${window.location.pathname}#/candidature?ecole=${ecoleId}`;

  return (
    <>
      <EnTete titre="Admissions" sousTitre="Campagnes, dossiers reçus et décisions"
        action={<Bouton onClick={() => setEditeCampagne({})}>+ Nouvelle campagne</Bouton>} />

      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {chargement ? <SkeletonListe lignes={4} /> : campagnes.length === 0 ? (
          <EtatVide icone="📨" titre="Aucune campagne d'admission"
            action={<Bouton onClick={() => setEditeCampagne({})}>Créer une campagne</Bouton>}>
            Une campagne ouvre le dépôt de dossiers en ligne. Les candidats postulent
            sans créer de compte et suivent leur dossier avec un code.
          </EtatVide>
        ) : (
          <>
            <Carte className="space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Campagne</span>
                  <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)}
                    className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                    {campagnes.map((c) => (
                      <option key={c.id} value={c.id}>{c.libelle}{c.ouverte ? "" : " (fermée)"}</option>
                    ))}
                  </select>
                </label>
                {campagne && (
                  <>
                    <Badge ton={campagne.ouverte ? "success" : "neutre"}>
                      {campagne.ouverte ? "Ouverte" : "Fermée"}
                    </Badge>
                    <span className="text-sm text-navy-900/50">
                      {campagne.niveau ? `${campagne.niveau} · ` : ""}
                      clôture {dateFr(campagne.date_cloture)}
                    </span>
                    <button onClick={() => setEditeCampagne(campagne)}
                      className="text-sm text-navy-900/50 underline hover:text-navy-900">modifier</button>
                  </>
                )}
              </div>

              {/* Le lien public : sans lui la campagne est ouverte mais introuvable. */}
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-creme/70 px-3 py-2 text-xs">
                <span className="font-medium text-navy-900/60">Lien de candidature :</span>
                <code className="min-w-0 flex-1 truncate font-mono text-navy-900/70">{lien}</code>
                <button onClick={() => { navigator.clipboard?.writeText(lien); toast.succes("Lien copié."); }}
                  className="shrink-0 rounded-lg border border-navy-900/15 bg-white px-2 py-1 font-medium hover:border-or-500">
                  Copier
                </button>
              </div>
            </Carte>

            {/* Compteurs : cliquer filtre, recliquer enlève le filtre. */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatut("")}
                className={`rounded-full px-3 py-1.5 text-sm transition ${statut === "" ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/60 hover:text-navy-900"}`}>
                Tous
              </button>
              {api.STATUTS.map(([v, l]) => (
                <button key={v} onClick={() => setStatut(statut === v ? "" : v)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${statut === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/60 hover:text-navy-900"}`}>
                  {l} <span className="ml-1 font-semibold">{compte[v] ?? 0}</span>
                </button>
              ))}
            </div>

            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Nom, numéro de dossier ou e-mail…"
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500 sm:max-w-md" />

            {lignes.length === 0 ? (
              <EtatVide icone="📭" titre="Aucun dossier">
                {q || statut ? "Aucun dossier ne correspond à ce filtre." : "Les candidatures déposées en ligne apparaîtront ici."}
              </EtatVide>
            ) : (
              <div className="space-y-2">
                {lignes.map((c) => (
                  <Carte key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <button onClick={() => setDossier(c)} className="min-w-0 flex-1 text-left">
                      <p className="font-medium text-navy-900">
                        {c.prenom} {c.nom}
                        <span className="ml-2 font-mono text-xs text-navy-900/45">{c.numero}</span>
                      </p>
                      <p className="truncate text-xs text-navy-900/55">
                        {[c.filieres?.nom, c.dernier_diplome, dateFr(c.created_at)].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge ton={api.tonStatut(c.statut)}>{api.libStatut(c.statut)}</Badge>
                      {c.statut === "admise" && (
                        <Bouton variante="or" onClick={() => inscrire(c)}>Inscrire</Bouton>
                      )}
                    </div>
                  </Carte>
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <Bouton variante="fantome" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</Bouton>
                <span className="text-navy-900/50">Page {page + 1} / {pages} · {total} dossiers</span>
                <Bouton variante="fantome" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Bouton>
              </div>
            )}
          </>
        )}
      </div>

      {editeCampagne && (
        <ModaleCampagne campagne={editeCampagne} ecoleId={ecoleId} anneeId={annee?.id}
          onFermer={() => setEditeCampagne(null)}
          onEnregistre={() => { setEditeCampagne(null); chargerCampagnes(); }} />
      )}

      {dossier && (
        <ModaleDossier dossier={dossier} filieres={filieres}
          onFermer={() => setDossier(null)}
          onDecider={(s) => decider(dossier, s)}
          onInscrire={() => inscrire(dossier)} />
      )}

      {motifDemande && (
        <ModaleMotif demande={motifDemande}
          onFermer={() => setMotifDemande(null)}
          onValider={(m) => appliquer(motifDemande.candidature, motifDemande.statut, m)} />
      )}
    </>
  );
}

function ModaleMotif({ demande, onFermer, onValider }) {
  const refus = demande.statut === "refusee";
  const [texte, setTexte] = useState("");
  return (
    <Modale ouvert onFermer={onFermer} titre={refus ? "Motif du refus" : "Complément demandé"}>
      <form onSubmit={(e) => { e.preventDefault(); onValider(texte.trim() || null); }} className="space-y-4">
        <p className="text-sm text-navy-900/60">
          {demande.candidature.prenom} {demande.candidature.nom} lira ce texte sur sa page de suivi.
        </p>
        <textarea rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus
          placeholder={refus ? "Dossier incomplet, moyenne inférieure au seuil…" : "Relevé de notes du baccalauréat, acte de naissance…"}
          className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" variante={refus ? "danger" : "primaire"}>Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleCampagne({ campagne, ecoleId, anneeId, onFermer, onEnregistre }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [f, setF] = useState({
    libelle: campagne.libelle || "", niveau: campagne.niveau || "L1",
    ouverte: campagne.ouverte ?? false,
    date_ouverture: campagne.date_ouverture || "", date_cloture: campagne.date_cloture || "",
    frais_dossier: campagne.frais_dossier ?? "", message_accueil: campagne.message_accueil || "",
  });
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.libelle.trim()) { toast.erreur("Donnez un intitulé à la campagne."); return; }
    setBusy(true);
    try {
      await api.enregistrerCampagne(ecoleId, {
        ...(campagne.id ? { id: campagne.id } : { annee_id: anneeId || null }),
        libelle: f.libelle.trim(), niveau: f.niveau.trim() || null, ouverte: f.ouverte,
        date_ouverture: f.date_ouverture || null, date_cloture: f.date_cloture || null,
        frais_dossier: f.frais_dossier === "" ? null : Number(f.frais_dossier),
        message_accueil: f.message_accueil.trim() || null,
      });
      toast.succes("Campagne enregistrée.");
      onEnregistre();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  async function supprimer() {
    if (!(await confirmer("Supprimer cette campagne ET tous ses dossiers ?"))) return;
    try { await api.supprimerCampagne(campagne.id); toast.succes("Campagne supprimée."); onEnregistre(); }
    catch (e) { toast.erreur(e); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre={campagne.id ? "Modifier la campagne" : "Nouvelle campagne"}>
      <form onSubmit={enregistrer} className="space-y-4">
        <Champ label="Intitulé" value={f.libelle} onChange={maj("libelle")}
          placeholder="Admission Licence 1 — 2026-2027" required />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Niveau recruté" value={f.niveau} onChange={maj("niveau")} placeholder="L1" />
          <Champ label="Ouverture" type="date" value={f.date_ouverture} onChange={maj("date_ouverture")} />
          <Champ label="Clôture" type="date" value={f.date_cloture} onChange={maj("date_cloture")} />
        </div>

        <Champ label="Frais de dossier" type="number" min="0" step="any"
          value={f.frais_dossier} onChange={maj("frais_dossier")} placeholder="Laisser vide si gratuit" />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Message d&apos;accueil</span>
          <textarea rows={3} value={f.message_accueil} onChange={maj("message_accueil")}
            placeholder="Pièces à prévoir, dates de concours, contact de la scolarité…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-creme/70 px-3 py-2.5 text-sm">
          <input type="checkbox" checked={f.ouverte}
            onChange={(e) => setF((x) => ({ ...x, ouverte: e.target.checked }))} />
          <span className="text-navy-900/75">
            Campagne ouverte — <b>tant que cette case est décochée, aucun dossier ne peut être déposé.</b>
          </span>
        </label>

        <div className="flex justify-between gap-2">
          {campagne.id
            ? <Bouton type="button" variante="danger" onClick={supprimer}>Supprimer</Bouton>
            : <span />}
          <div className="flex gap-2">
            <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
            <Bouton type="submit" disabled={busy}>{busy ? "…" : "Enregistrer"}</Bouton>
          </div>
        </div>
      </form>
    </Modale>
  );
}

function Ligne({ label, valeur }) {
  if (valeur == null || valeur === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-navy-900/5 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-navy-900/50">{label}</span>
      <span className="text-right font-medium text-navy-900">{valeur}</span>
    </div>
  );
}

function ModaleDossier({ dossier: c, filieres, onFermer, onDecider, onInscrire }) {
  const nomFiliere = (id) => filieres.find((f) => f.id === id)?.nom || null;
  return (
    <Modale ouvert onFermer={onFermer} titre={`${c.prenom} ${c.nom}`} large>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge ton={api.tonStatut(c.statut)}>{api.libStatut(c.statut)}</Badge>
          <span className="font-mono text-xs text-navy-900/45">{c.numero}</span>
          <span className="text-xs text-navy-900/45">déposé le {dateFr(c.created_at)}</span>
        </div>

        {c.motif && (
          <Alerte ton="info"><b>Motif enregistré :</b> {c.motif}</Alerte>
        )}

        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">État civil</p>
            <Ligne label="Sexe" valeur={c.sexe === "M" ? "Masculin" : c.sexe === "F" ? "Féminin" : null} />
            <Ligne label="Naissance" valeur={[dateFr(c.date_naissance), c.lieu_naissance].filter((x) => x && x !== "—").join(" à ")} />
            <Ligne label="Nationalité" valeur={c.nationalite} />
            <Ligne label="Téléphone" valeur={c.telephone} />
            <Ligne label="E-mail" valeur={c.email} />
            <Ligne label="Adresse" valeur={c.adresse} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">Vœux et parcours</p>
            <Ligne label="1er vœu" valeur={c.filieres?.nom || nomFiliere(c.filiere_id)} />
            <Ligne label="2e vœu" valeur={nomFiliere(c.filiere_2_id)} />
            <Ligne label="Dernier diplôme" valeur={c.dernier_diplome} />
            <Ligne label="Année" valeur={c.annee_diplome} />
            <Ligne label="Établissement" valeur={c.etablissement_origine} />
            <Ligne label="Mention" valeur={c.mention} />
            <Ligne label="Moyenne" valeur={c.moyenne} />
          </div>
        </div>

        {c.motivation && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">Motivation</p>
            <p className="whitespace-pre-line rounded-xl bg-creme/70 px-4 py-3 text-sm text-navy-900/75">{c.motivation}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-900/10 pt-4">
          <div className="flex flex-wrap gap-2">
            {c.statut !== "inscrite" && api.DECISIONS.map((s) => (
              <button key={s} onClick={() => onDecider(s)} disabled={c.statut === s}
                className="rounded-full border border-navy-900/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-900/70 transition hover:border-or-500 hover:text-navy-900 disabled:opacity-40">
                {api.libStatut(s)}
              </button>
            ))}
          </div>
          {c.statut === "admise" && <Bouton variante="or" onClick={onInscrire}>Inscrire</Bouton>}
          {c.statut === "inscrite" && (
            <span className="text-xs text-navy-900/50">Dossier transformé en inscription.</span>
          )}
        </div>
      </div>
    </Modale>
  );
}
