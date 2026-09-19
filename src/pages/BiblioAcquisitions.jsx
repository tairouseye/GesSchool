import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/acquisitions.js";
import { getRessources } from "@/lib/bibliotheque.js";
import { nbPages } from "@/lib/biblio.regles.js";

const TAILLE = 20;
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function BiblioAcquisitions() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [vue, setVue] = useState("commandes");

  return (
    <>
      <EnTete titre="Acquisitions" sousTitre="Commandes d'ouvrages, fournisseurs et suggestions d'achat" />
      <div className="space-y-5 p-4 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {[["commandes", "🧾 Commandes"], ["fournisseurs", "🏢 Fournisseurs"], ["suggestions", "💡 Suggestions"]].map(([v, l]) => (
            <button key={v} onClick={() => setVue(v)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${vue === v ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>
              {l}
            </button>
          ))}
        </div>

        {vue === "commandes" && <Commandes ecoleId={ecoleId} devise={devise} />}
        {vue === "fournisseurs" && <Fournisseurs ecoleId={ecoleId} />}
        {vue === "suggestions" && <Suggestions ecoleId={ecoleId} />}
      </div>
    </>
  );
}

// =====================================================================
//  Commandes
// =====================================================================
function Commandes({ ecoleId, devise }) {
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);
  const [creation, setCreation] = useState(false);

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setRes(await api.getCommandes(ecoleId, { statut: statut || undefined, page, taille: TAILLE })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, statut, page]);
  useEffect(() => { recharger(); }, [recharger]);

  const pages = nbPages(res.total, TAILLE);

  return (
    <div className="space-y-4">
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex flex-wrap items-center gap-1.5">
        {[["", "Toutes"], ["brouillon", "Brouillons"], ["commandee", "En cours"], ["partielle", "Partielles"], ["recue", "Reçues"]].map(([v, l]) => (
          <button key={v || "tous"} onClick={() => { setStatut(v); setPage(0); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statut === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"}`}>
            {l}
          </button>
        ))}
        <Bouton className="ml-auto" onClick={() => setCreation(true)}>+ Nouvelle commande</Bouton>
      </div>

      {chargement ? <SkeletonListe lignes={4} /> : res.lignes.length === 0 ? (
        <EtatVide icone="🧾" titre="Aucune commande">Créez une commande pour suivre vos achats d'ouvrages.</EtatVide>
      ) : (
        <div className="space-y-2">
          {res.lignes.map((c) => {
            const s = api.STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: "neutre" };
            const lignes = c.biblio_acquisitions_lignes || [];
            const recues = lignes.reduce((n, l) => n + (Number(l.quantite_recue) || 0), 0);
            const attendues = lignes.reduce((n, l) => n + (Number(l.quantite) || 0), 0);
            return (
              <Carte key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <button onClick={() => setOuvert(c.id)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-navy-900">
                    {c.reference || "Commande sans référence"}
                    {c.biblio_fournisseurs?.nom ? <span className="text-navy-900/50"> — {c.biblio_fournisseurs.nom}</span> : null}
                  </p>
                  <p className="text-xs text-navy-900/55">
                    {lignes.length} titre(s) · {recues}/{attendues} exemplaire(s) reçu(s)
                    {c.date_commande ? ` · commandée le ${dateFr(c.date_commande)}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums text-navy-900">{fmt(api.totalCommande(lignes))} {devise}</span>
                  <Badge ton={s.ton}>{s.label}</Badge>
                  <button onClick={() => setOuvert(c.id)} className="text-xs font-medium text-navy-700 hover:text-or-600">ouvrir</button>
                </div>
              </Carte>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
          <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
        </div>
      )}

      {creation && <ModaleNouvelleCommande ecoleId={ecoleId} onFermer={() => setCreation(false)}
        onCree={(id) => { setCreation(false); recharger(); setOuvert(id); }} />}
      <ModaleCommande id={ouvert} ecoleId={ecoleId} devise={devise}
        onFermer={() => setOuvert(null)} onChange={recharger} />
    </div>
  );
}

function ModaleNouvelleCommande({ ecoleId, onFermer, onCree }) {
  const toast = useToast();
  const [f, setF] = useState({ reference: "", fournisseur_id: "", date_commande: "", note: "" });
  const [fournisseurs, setFournisseurs] = useState([]);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    api.getFournisseurs(ecoleId, { actifsSeuls: true }).then(setFournisseurs).catch(() => setFournisseurs([]));
  }, [ecoleId]);

  async function creer(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api.creerCommande(ecoleId, {
        reference: f.reference.trim() || null,
        fournisseur_id: f.fournisseur_id || null,
        date_commande: f.date_commande || null,
        note: f.note || null,
      });
      toast.succes("Commande créée.");
      onCree(c.id);
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre="Nouvelle commande">
      <form onSubmit={creer} className="space-y-4">
        <Champ label="Référence" placeholder="BC-2026-001" value={f.reference} onChange={maj("reference")} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Fournisseur</span>
          <select value={f.fournisseur_id} onChange={maj("fournisseur_id")}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— À préciser —</option>
            {fournisseurs.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </select>
          {fournisseurs.length === 0 && (
            <span className="mt-1 block text-xs text-navy-900/45">Aucun fournisseur enregistré — onglet « Fournisseurs ».</span>
          )}
        </label>
        <Champ label="Date de commande" type="date" value={f.date_commande} onChange={maj("date_commande")} />
        <Champ label="Note" value={f.note} onChange={maj("note")} />
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Créer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleCommande({ id, ecoleId, devise, onFermer, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    if (!id) { setC(null); return; }
    try { setC(await api.getCommande(id)); } catch (e) { toast.erreur(e); }
  }, [id, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function changerStatut(statut, libelle) {
    if (!(await confirmer({ titre: libelle, message: `${libelle} cette commande ?`,
      confirmer: libelle, danger: statut === "annulee" }))) return;
    setBusy(true);
    try {
      await api.modifierCommande(id, statut === "commandee"
        ? { statut, date_commande: c.date_commande || new Date().toISOString().slice(0, 10) }
        : { statut });
      toast.succes("Commande mise à jour.");
      charger(); onChange?.();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  async function recevoir(l) {
    const reste = api.resteARecevoir(l);
    if (!l.ressource_id) {
      toast.erreur("Rattachez d'abord cette ligne à une notice du catalogue.");
      return;
    }
    if (!(await confirmer({
      titre: "Réception",
      message: `Réceptionner ${reste} exemplaire(s) de « ${l.titre} » ? Ils seront créés au catalogue, disponibles et à l'état neuf.`,
      confirmer: "Réceptionner", danger: false,
    }))) return;
    setBusy(true);
    try {
      const n = await api.receptionner(l.id);
      toast.succes(`${n} exemplaire(s) créé(s).`);
      charger(); onChange?.();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  async function supprimerLigne(l) {
    if (!(await confirmer("Retirer cette ligne ?"))) return;
    try { await api.supprimerLigne(l.id); charger(); onChange?.(); } catch (e) { toast.erreur(e); }
  }

  async function supprimer() {
    if (!(await confirmer({ titre: "Supprimer la commande", message: "La commande et ses lignes seront supprimées.", confirmer: "Supprimer", danger: true }))) return;
    try { await api.supprimerCommande(id); toast.succes("Commande supprimée."); onFermer(); onChange?.(); }
    catch (e) { toast.erreur(e); }
  }

  if (!id) return null;
  const lignes = c?.biblio_acquisitions_lignes || [];
  const s = c ? (api.STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: "neutre" }) : null;
  const modifiable = c && c.statut !== "recue" && c.statut !== "annulee";

  return (
    <Modale ouvert={!!id} onFermer={onFermer} titre={c?.reference || "Commande"} large>
      {!c ? <p className="text-sm text-navy-900/50">Chargement…</p> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-creme/60 p-4 text-sm">
            <span className="text-navy-900">
              {c.biblio_fournisseurs?.nom || "Fournisseur non précisé"}
              {c.date_commande ? ` · commandée le ${dateFr(c.date_commande)}` : ""}
              {c.date_reception ? ` · 1ʳᵉ réception ${dateFr(c.date_reception)}` : ""}
            </span>
            <Badge ton={s.ton}>{s.label}</Badge>
          </div>
          {c.note && <p className="text-sm text-navy-900/60">{c.note}</p>}

          {/* Lignes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">Titres commandés</p>
            {lignes.length === 0 ? (
              <p className="text-sm text-navy-900/50">Aucune ligne — ajoutez un titre ci-dessous.</p>
            ) : lignes.map((l) => {
              const reste = api.resteARecevoir(l);
              return (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">
                      {l.titre}
                      {!l.ressource_id && <Badge ton="warning" className="ml-2">non rattaché</Badge>}
                    </p>
                    <p className="text-xs text-navy-900/55">
                      {l.auteur ? `${l.auteur} · ` : ""}{l.quantite} × {fmt(l.prix_unitaire)} {devise}
                      {" · "}reçus {l.quantite_recue}/{l.quantite}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {reste > 0 && c.statut !== "annulee" && (
                      <Bouton variante="fantome" onClick={() => recevoir(l)} disabled={busy}>Recevoir {reste}</Bouton>
                    )}
                    {reste === 0 && <Badge ton="success">complet</Badge>}
                    {modifiable && l.quantite_recue === 0 && (
                      <button onClick={() => supprimerLigne(l)} className="text-xs text-rose-500 hover:underline">retirer</button>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-right text-sm font-semibold text-navy-900">
              Total : {fmt(api.totalCommande(lignes))} {devise}
            </p>
          </div>

          {modifiable && <FormuleLigne ecoleId={ecoleId} acquisitionId={id} onAjoute={() => { charger(); onChange?.(); }} />}

          <div className="flex flex-wrap justify-end gap-2 border-t border-navy-900/10 pt-4">
            {c.statut === "brouillon" && (
              <>
                <Bouton variante="danger" onClick={supprimer}>Supprimer</Bouton>
                <Bouton onClick={() => changerStatut("commandee", "Passer la commande")} disabled={busy || lignes.length === 0}>
                  Passer la commande
                </Bouton>
              </>
            )}
            {(c.statut === "commandee" || c.statut === "partielle") && (
              <Bouton variante="danger" onClick={() => changerStatut("annulee", "Annuler")} disabled={busy}>Annuler la commande</Bouton>
            )}
            <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          </div>
        </div>
      )}
    </Modale>
  );
}

// Ajout d'une ligne, avec rattachement facultatif à une notice existante.
function FormuleLigne({ ecoleId, acquisitionId, onAjoute }) {
  const toast = useToast();
  const [f, setF] = useState({ titre: "", auteur: "", isbn: "", quantite: 1, prix_unitaire: 0 });
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Recherche serveur bornée : on ne charge jamais tout le catalogue.
  useEffect(() => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    let vivant = true;
    const t = setTimeout(async () => {
      try {
        const r = await getRessources(ecoleId, { q, page: 0, taille: 6 });
        if (vivant) setSuggestions(r.lignes);
      } catch { if (vivant) setSuggestions([]); }
    }, 250);
    return () => { vivant = false; clearTimeout(t); };
  }, [ecoleId, q]);

  async function ajouter(e) {
    e.preventDefault();
    if (!f.titre.trim()) { toast.erreur("Le titre est obligatoire."); return; }
    setBusy(true);
    try {
      await api.ajouterLigne(ecoleId, acquisitionId, {
        ressource_id: notice?.id || null,
        titre: f.titre.trim(), auteur: f.auteur || null, isbn: f.isbn || null,
        quantite: Math.max(1, Number(f.quantite) || 1),
        prix_unitaire: Number(f.prix_unitaire) || 0,
      });
      setF({ titre: "", auteur: "", isbn: "", quantite: 1, prix_unitaire: 0 });
      setNotice(null); setQ("");
      onAjoute();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={ajouter} className="space-y-3 rounded-xl border border-navy-900/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">Ajouter un titre</p>

      {notice ? (
        <div className="flex items-center justify-between rounded-lg border border-or-500/40 bg-or-500/5 px-3 py-2 text-sm">
          <span className="text-navy-900">Rattaché à : <b>{notice.titre}</b></span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs text-navy-900/50 hover:text-navy-900">détacher</button>
        </div>
      ) : (
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher une notice existante (facultatif)…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
          {suggestions.length > 0 && (
            <ul className="mt-1 space-y-1">
              {suggestions.map((r) => (
                <li key={r.id}>
                  <button type="button"
                    onClick={() => { setNotice(r); setF((x) => ({ ...x, titre: x.titre || r.titre })); setSuggestions([]); setQ(""); }}
                    className="w-full rounded-lg border border-navy-900/10 px-3 py-1.5 text-left text-sm hover:border-or-500">
                    {r.titre}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-1 block text-xs text-navy-900/45">
            Sans rattachement, la ligne se suit mais ne peut pas être réceptionnée.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Titre" value={f.titre} onChange={maj("titre")} required />
        <Champ label="Auteur" value={f.auteur} onChange={maj("auteur")} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Champ label="ISBN" value={f.isbn} onChange={maj("isbn")} />
        <Champ label="Quantité" type="number" min="1" value={f.quantite} onChange={maj("quantite")} />
        <Champ label="Prix unitaire" type="number" min="0" step="0.01" value={f.prix_unitaire} onChange={maj("prix_unitaire")} />
      </div>
      <div className="flex justify-end">
        <Bouton type="submit" variante="fantome" disabled={busy}>Ajouter la ligne</Bouton>
      </div>
    </form>
  );
}

// =====================================================================
//  Fournisseurs
// =====================================================================
function Fournisseurs({ ecoleId }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [edite, setEdite] = useState(null);

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setLignes(await api.getFournisseurs(ecoleId)); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  async function supprimer(f) {
    if (!(await confirmer(`Supprimer « ${f.nom} » ?`))) return;
    try { await api.supprimerFournisseur(f.id); toast.succes("Fournisseur supprimé."); recharger(); }
    catch (e) { toast.erreur(e); }
  }

  return (
    <div className="space-y-4">
      <Alerte ton="erreur">{erreur}</Alerte>
      <div className="flex justify-end">
        <Bouton onClick={() => setEdite({})}>+ Ajouter un fournisseur</Bouton>
      </div>

      {chargement ? <SkeletonListe lignes={3} /> : lignes.length === 0 ? (
        <EtatVide icone="🏢" titre="Aucun fournisseur">Enregistrez vos libraires et éditeurs habituels.</EtatVide>
      ) : (
        <div className="space-y-2">
          {lignes.map((f) => (
            <Carte key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-navy-900">
                  {f.nom}{!f.actif && <Badge ton="neutre" className="ml-2">inactif</Badge>}
                </p>
                <p className="text-xs text-navy-900/55">
                  {[f.contact, f.telephone, f.email].filter(Boolean).join(" · ") || "Aucun contact renseigné"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button onClick={() => setEdite(f)} className="text-navy-900/50 hover:text-navy-900">modifier</button>
                <button onClick={() => supprimer(f)} className="text-rose-500 hover:underline">suppr.</button>
              </div>
            </Carte>
          ))}
        </div>
      )}

      {edite && <ModaleFournisseur ecoleId={ecoleId} fournisseur={edite}
        onFermer={() => setEdite(null)} onEnregistre={() => { setEdite(null); recharger(); }} />}
    </div>
  );
}

function ModaleFournisseur({ ecoleId, fournisseur, onFermer, onEnregistre }) {
  const toast = useToast();
  const [f, setF] = useState({
    nom: fournisseur.nom || "", contact: fournisseur.contact || "", email: fournisseur.email || "",
    telephone: fournisseur.telephone || "", adresse: fournisseur.adresse || "",
    note: fournisseur.note || "", actif: fournisseur.actif !== false,
  });
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.nom.trim()) { toast.erreur("Le nom est obligatoire."); return; }
    setBusy(true);
    try {
      await api.enregistrerFournisseur(ecoleId, {
        ...(fournisseur.id ? { id: fournisseur.id } : {}),
        nom: f.nom.trim(), contact: f.contact || null, email: f.email || null,
        telephone: f.telephone || null, adresse: f.adresse || null, note: f.note || null, actif: f.actif,
      });
      toast.succes("Fournisseur enregistré.");
      onEnregistre();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre={fournisseur.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
      <form onSubmit={enregistrer} className="space-y-4">
        <Champ label="Nom" value={f.nom} onChange={maj("nom")} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Contact" value={f.contact} onChange={maj("contact")} />
          <Champ label="Téléphone" value={f.telephone} onChange={maj("telephone")} />
        </div>
        <Champ label="E-mail" type="email" value={f.email} onChange={maj("email")} />
        <Champ label="Adresse" value={f.adresse} onChange={maj("adresse")} />
        <Champ label="Note" value={f.note} onChange={maj("note")} />
        <label className="flex items-center gap-2 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.actif} onChange={(e) => setF((x) => ({ ...x, actif: e.target.checked }))}
            className="h-4 w-4 accent-or-500" />
          Fournisseur actif
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Enregistrer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// =====================================================================
//  Suggestions d'achat
// =====================================================================
function Suggestions({ ecoleId }) {
  const toast = useToast();
  const [statut, setStatut] = useState("soumise");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [reponses, setReponses] = useState({});

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setRes(await api.getSuggestions(ecoleId, { statut: statut || undefined, page, taille: TAILLE })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, statut, page]);
  useEffect(() => { recharger(); }, [recharger]);

  async function repondre(s, vers) {
    try {
      await api.repondreSuggestion(s.id, vers, reponses[s.id] || null);
      toast.succes("Réponse enregistrée.");
      setReponses((r) => ({ ...r, [s.id]: "" }));
      recharger();
    } catch (e) { toast.erreur(e); }
  }

  const pages = nbPages(res.total, TAILLE);

  return (
    <div className="space-y-4">
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex flex-wrap items-center gap-1.5">
        {[["soumise", "En attente"], ["acceptee", "Acceptées"], ["refusee", "Refusées"], ["", "Toutes"]].map(([v, l]) => (
          <button key={v || "tous"} onClick={() => { setStatut(v); setPage(0); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statut === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"}`}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-sm text-navy-900/50">{res.total} suggestion{res.total > 1 ? "s" : ""}</span>
      </div>

      {chargement ? <SkeletonListe lignes={3} /> : res.lignes.length === 0 ? (
        <EtatVide icone="💡" titre="Aucune suggestion">
          Les étudiants et enseignants peuvent proposer des acquisitions depuis leur espace.
        </EtatVide>
      ) : (
        <div className="space-y-2">
          {res.lignes.map((s) => {
            const st = api.STATUTS_SUGGESTION[s.statut] || { label: s.statut, ton: "neutre" };
            return (
              <Carte key={s.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{s.titre}</p>
                    <p className="text-xs text-navy-900/55">
                      {[s.auteur, s.editeur, s.isbn].filter(Boolean).join(" · ")}
                      {s.profils ? ` — proposé par ${s.profils.prenom || ""} ${s.profils.nom || ""}`.trimEnd() : ""}
                    </p>
                  </div>
                  <Badge ton={st.ton}>{st.label}</Badge>
                </div>
                {s.motif && <p className="text-sm text-navy-900/65">« {s.motif} »</p>}
                {s.reponse && <p className="rounded-lg bg-creme px-3 py-2 text-xs text-navy-900/70">Réponse : {s.reponse}</p>}

                {s.statut === "soumise" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={reponses[s.id] || ""} onChange={(e) => setReponses((r) => ({ ...r, [s.id]: e.target.value }))}
                      placeholder="Réponse au demandeur (facultative)"
                      className="min-w-48 flex-1 rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
                    <Bouton variante="fantome" onClick={() => repondre(s, "acceptee")}>Accepter</Bouton>
                    <Bouton variante="fantome" onClick={() => repondre(s, "refusee")}>Refuser</Bouton>
                  </div>
                )}
              </Carte>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
          <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
          <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
        </div>
      )}
    </div>
  );
}
