import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/depots.js";
import { NIVEAUX_ACCES } from "@/lib/bibliotheque.js";
import { nbPages } from "@/lib/biblio.regles.js";

const TAILLE = 20;
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const libType = (t) => api.TYPES_DEPOT.find(([v]) => v === t)?.[1] || t;
const deposantDe = (d) => d?.profils ? `${d.profils.prenom || ""} ${d.profils.nom || ""}`.trim()
  : d?.eleves ? `${d.eleves.prenom || ""} ${d.eleves.nom || ""}`.trim() : "—";

const FILTRES = [
  ["soumis", "À traiter"], ["verification", "En vérification"], ["a_corriger", "À corriger"],
  ["valide", "Validés"], ["publie", "Publiés"], ["rejete", "Rejetés"], ["", "Tous"],
];

export default function BiblioDepots() {
  const { ecoleId } = useAuth();
  const [statut, setStatut] = useState("soumis");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setRes(await api.getDepots(ecoleId, { statut: statut || undefined, page, taille: TAILLE })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, statut, page]);
  useEffect(() => { recharger(); }, [recharger]);

  const pages = nbPages(res.total, TAILLE);

  return (
    <>
      <EnTete titre="Dépôts institutionnels" sousTitre="Mémoires, thèses, rapports et publications — validation et publication" />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="flex flex-wrap gap-1.5">
          {FILTRES.map(([v, l]) => (
            <button key={v || "tous"} onClick={() => { setStatut(v); setPage(0); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statut === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto self-center text-sm text-navy-900/50">{res.total} dépôt{res.total > 1 ? "s" : ""}</span>
        </div>

        {chargement ? <SkeletonListe lignes={5} /> : res.lignes.length === 0 ? (
          <EtatVide icone="🎓" titre="Aucun dépôt">
            {statut === "soumis" ? "Rien à traiter pour le moment." : "Aucun dépôt dans cette catégorie."}
          </EtatVide>
        ) : (
          <div className="space-y-2">
            {res.lignes.map((d) => {
              const s = api.STATUTS_DEPOT[d.statut] || { label: d.statut, ton: "neutre" };
              return (
                <Carte key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button onClick={() => setOuvert(d.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-navy-900">{d.titre}</p>
                    <p className="text-xs text-navy-900/55">
                      {libType(d.type)} · {deposantDe(d)}
                      {d.annee_academique ? ` · ${d.annee_academique}` : ""} · déposé le {dateFr(d.created_at)}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <Badge ton={s.ton}>{s.label}</Badge>
                    <button onClick={() => setOuvert(d.id)} className="text-xs font-medium text-navy-700 hover:text-or-600">ouvrir</button>
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
      </div>

      <ModaleDepot id={ouvert} ecoleId={ecoleId} onFermer={() => setOuvert(null)} onChange={recharger} />
    </>
  );
}

function ModaleDepot({ id, ecoleId, onFermer, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [d, setD] = useState(null);
  const [commentaire, setCommentaire] = useState("");
  const [acces, setAcces] = useState("institution");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState({ directeur: "", jury: "", soutenu_le: "", revue: "", doi: "" });

  const charger = useCallback(async () => {
    if (!id) { setD(null); return; }
    try {
      const dep = await api.getDepot(id);
      setD(dep);
      const th = dep?.biblio_theses?.[0], pu = dep?.biblio_publications?.[0];
      setMeta({
        directeur: th?.directeur || "", jury: Array.isArray(th?.jury) ? th.jury.map((j) => j.nom).join(", ") : "",
        soutenu_le: th?.soutenu_le || "", revue: pu?.revue || "", doi: pu?.doi || "",
      });
      setCommentaire("");
    } catch (e) { toast.erreur(e); }
  }, [id, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function ouvrirFichier() {
    try {
      const url = await api.lienDepot(d.fichier_chemin);
      if (url) window.open(url, "_blank", "noreferrer"); else toast.erreur("Fichier inaccessible.");
    } catch (e) { toast.erreur(e); }
  }

  async function decider(statut, libelle) {
    if (statut === "a_corriger" && !commentaire.trim()) {
      toast.erreur("Indiquez les corrections attendues dans le commentaire.");
      return;
    }
    if (!(await confirmer(`${libelle} ce dépôt ?`))) return;
    setBusy(true);
    try {
      await api.deciderDepot(d.id, statut, commentaire);
      toast.succes("Décision enregistrée.");
      charger(); onChange?.();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  async function enregistrerMeta() {
    setBusy(true);
    try {
      if (d.type === "publication") {
        await api.enregistrerPublication(ecoleId, d.id, { revue: meta.revue || null, doi: meta.doi || null });
      } else {
        await api.enregistrerThese(ecoleId, d.id, {
          directeur: meta.directeur || null,
          jury: meta.jury ? meta.jury.split(",").map((x) => ({ nom: x.trim() })).filter((x) => x.nom) : null,
          soutenu_le: meta.soutenu_le || null,
        });
      }
      toast.succes("Métadonnées enregistrées.");
      charger();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  async function publier() {
    if (!(await confirmer({
      titre: "Publier au catalogue",
      message: "Le dépôt deviendra une notice consultable dans la bibliothèque, avec son fichier.",
      confirmer: "Publier", danger: false,
    }))) return;
    setBusy(true);
    try {
      await api.publierDepot(d.id, acces);
      toast.succes("Publié au catalogue.");
      charger(); onChange?.();
    } catch (e) { toast.erreur(e); }
    finally { setBusy(false); }
  }

  if (!id) return null;
  const s = d ? (api.STATUTS_DEPOT[d.statut] || { label: d.statut, ton: "neutre" }) : null;
  const etapes = d ? api.transitions(d.statut) : [];

  return (
    <Modale ouvert={!!id} onFermer={onFermer} titre={d?.titre || "Dépôt"} large>
      {!d ? <p className="text-sm text-navy-900/50">Chargement…</p> : (
        <div className="space-y-5">
          <div className="rounded-xl bg-creme/60 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-navy-900">{libType(d.type)} · {deposantDe(d)}</span>
              <Badge ton={s.ton}>{s.label}</Badge>
            </div>
            {d.annee_academique && <p className="mt-1 text-xs text-navy-900/55">Année : {d.annee_academique}</p>}
            {d.resume && <p className="mt-2 text-navy-900/70">{d.resume}</p>}
            {d.fichier_chemin && (
              <button onClick={ouvrirFichier} className="mt-2 text-sm font-medium text-navy-700 hover:text-or-600">
                📄 Ouvrir le fichier{d.fichier_nom ? ` (${d.fichier_nom})` : ""}
              </button>
            )}
            {d.commentaire && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Dernier retour : {d.commentaire}
              </p>
            )}
          </div>

          {/* Métadonnées académiques */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">
              {d.type === "publication" ? "Publication" : "Soutenance"}
            </p>
            {d.type === "publication" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Champ label="Revue" value={meta.revue} onChange={(e) => setMeta((m) => ({ ...m, revue: e.target.value }))} />
                <Champ label="DOI" value={meta.doi} onChange={(e) => setMeta((m) => ({ ...m, doi: e.target.value }))} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Champ label="Directeur" value={meta.directeur} onChange={(e) => setMeta((m) => ({ ...m, directeur: e.target.value }))} />
                <Champ label="Jury (séparé par virgules)" value={meta.jury} onChange={(e) => setMeta((m) => ({ ...m, jury: e.target.value }))} />
                <Champ label="Soutenu le" type="date" value={meta.soutenu_le} onChange={(e) => setMeta((m) => ({ ...m, soutenu_le: e.target.value }))} />
              </div>
            )}
            <div className="flex justify-end">
              <Bouton variante="fantome" onClick={enregistrerMeta} disabled={busy}>Enregistrer les métadonnées</Bouton>
            </div>
          </div>

          {/* Décisions */}
          {etapes.length > 0 && (
            <div className="space-y-3 border-t border-navy-900/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">Décision</p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Commentaire (obligatoire pour demander des corrections)</span>
                <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                {etapes.map(([st, lib]) => (
                  <Bouton key={st} variante={st === "rejete" ? "danger" : "fantome"} onClick={() => decider(st, lib)} disabled={busy}>
                    {lib}
                  </Bouton>
                ))}
              </div>
            </div>
          )}

          {/* Publication au catalogue */}
          {d.statut === "valide" && (
            <div className="space-y-3 rounded-xl border border-or-500/40 bg-or-500/5 p-4">
              <p className="text-sm font-medium text-navy-900">Publier au catalogue</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Niveau d'accès</span>
                  <select value={acces} onChange={(e) => setAcces(e.target.value)}
                    className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                    {NIVEAUX_ACCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <Bouton onClick={publier} disabled={busy}>{busy ? "…" : "Publier"}</Bouton>
              </div>
            </div>
          )}
          {d.statut === "publie" && (
            <Alerte ton="succes">Publié au catalogue — la notice est consultable dans la bibliothèque.</Alerte>
          )}

          <div className="flex justify-end">
            <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          </div>
        </div>
      )}
    </Modale>
  );
}
