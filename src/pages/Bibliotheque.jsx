import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Recherche, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/bibliotheque.js";
import { nbPages } from "@/lib/biblio.regles.js";
import { moduleActif } from "@/lib/modules.js";

const TAILLE = 20;
const libType = (t) => api.TYPES.find(([v]) => v === t)?.[1] || t;
const auteursDe = (r) => (r.biblio_ressource_auteurs || [])
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
  .map((l) => `${l.biblio_auteurs?.prenom || ""} ${l.biblio_auteurs?.nom || ""}`.trim())
  .filter(Boolean).join(", ");
const fmtTaille = (o) => (!o ? "—" : o > 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.round(o / 1024)} Ko`);

export default function Bibliotheque() {
  const { ecoleId, typeEtablissement } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [stats, setStats] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [edition, setEdition] = useState(null);   // ressource en cours d'édition (ou {} pour création)
  const [fiche, setFiche] = useState(null);       // id de la ressource ouverte

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try {
      const r = await api.getRessources(ecoleId, { q, type: type || undefined, page, taille: TAILLE });
      setRes(r);
      setStats(await api.statsExemplaires(ecoleId, r.lignes.map((x) => x.id)));
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, q, type, page]);
  useEffect(() => { recharger(); }, [recharger]);

  // Toute nouvelle recherche/filtre repart de la première page.
  const chercher = (v) => { setQ(v); setPage(0); };
  const filtrer = (v) => { setType(v); setPage(0); };

  async function supprimer(r) {
    if (!(await confirmer({ titre: "Supprimer la notice", message: `Supprimer « ${r.titre} » ainsi que ses exemplaires et fichiers ?`, danger: true, confirmer: "Supprimer" }))) return;
    try { await api.supprimerRessource(r.id); toast.succes("Notice supprimée."); recharger(); }
    catch (e) { toast.erreur(e); }
  }
  async function basculerVisible(r) {
    try { await api.modifierRessource(r.id, { visible: !r.visible }); recharger(); }
    catch (e) { toast.erreur(e); }
  }

  const pages = nbPages(res.total, TAILLE);

  return (
    <>
      <EnTete titre="Bibliothèque" sousTitre="Catalogue, exemplaires et documents numériques"
        action={<Bouton onClick={() => setEdition({})}>+ Ajouter une ressource</Bouton>} />

      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {typeEtablissement !== "superieur" && (
          <Alerte ton="info">La bibliothèque universitaire s'adresse aux établissements en mode « Supérieur ».</Alerte>
        )}

        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <Recherche valeur={q} onChange={chercher} placeholder="Titre, auteur, éditeur, mot-clé…" />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Type</span>
            <select value={type} onChange={(e) => filtrer(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Tous</option>
              {api.TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <span className="ml-auto self-center text-sm text-navy-900/50">
            {res.total} notice{res.total > 1 ? "s" : ""}
          </span>
        </Carte>

        {chargement ? (
          <SkeletonListe lignes={6} />
        ) : res.lignes.length === 0 ? (
          <EtatVide icone="📚" titre="Aucune ressource">
            {q || type ? "Aucun résultat pour cette recherche." : "Ajoutez une première notice au catalogue."}
          </EtatVide>
        ) : (
          <div className="space-y-2">
            {res.lignes.map((r) => {
              const s = stats[r.id] || { total: 0, disponibles: 0 };
              return (
                <Carte key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button onClick={() => setFiche(r.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-navy-900">
                      {r.titre}{r.sous_titre ? <span className="text-navy-900/50"> — {r.sous_titre}</span> : null}
                      {!r.visible && <Badge ton="neutre" className="ml-2">masquée</Badge>}
                    </p>
                    <p className="text-xs text-navy-900/50">
                      {libType(r.type_ressource)}{auteursDe(r) ? ` · ${auteursDe(r)}` : ""}
                      {r.annee_pub ? ` · ${r.annee_pub}` : ""}{r.editeur ? ` · ${r.editeur}` : ""}
                    </p>
                  </button>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge ton={s.disponibles > 0 ? "success" : s.total > 0 ? "warning" : "neutre"}>
                      {s.total === 0 ? "aucun exemplaire" : `${s.disponibles}/${s.total} dispo.`}
                    </Badge>
                    <button onClick={() => setFiche(r.id)} className="font-medium text-navy-700 hover:text-or-600">ouvrir</button>
                    <button onClick={() => setEdition(r)} className="text-navy-900/50 hover:text-navy-900">modifier</button>
                    <button onClick={() => basculerVisible(r)} className="text-navy-900/50 hover:text-navy-900">
                      {r.visible ? "masquer" : "publier"}
                    </button>
                    <button onClick={() => supprimer(r)} className="text-rose-500 hover:underline">suppr.</button>
                  </div>
                </Carte>
              );
            })}
          </div>
        )}

        {/* Pagination SERVEUR */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
            <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
            <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
          </div>
        )}
      </div>

      <ModaleRessource ouvert={!!edition} ressource={edition} ecoleId={ecoleId}
        onFermer={() => setEdition(null)}
        onEnregistre={() => { setEdition(null); recharger(); }} />

      <ModaleFiche id={fiche} ecoleId={ecoleId} onFermer={() => setFiche(null)} onChange={recharger} />
    </>
  );
}

// --- Création / édition d'une notice ---------------------------------------
function ModaleRessource({ ouvert, ressource, ecoleId, onFermer, onEnregistre }) {
  const toast = useToast();
  const vide = { titre: "", sous_titre: "", type_ressource: "livre", auteur_libre: "", editeur: "", annee_pub: "", isbn: "", discipline: "", langue: "fr", resume: "", mots_cles: "" };
  const [f, setF] = useState(vide);
  const [busy, setBusy] = useState(false);
  const edition = ressource && ressource.id;

  useEffect(() => {
    if (!ouvert) return;
    setF(edition
      ? { ...vide, ...ressource, annee_pub: ressource.annee_pub ?? "", mots_cles: (ressource.mots_cles || []).join(", ") }
      : vide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, ressource]);

  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function soumettre(e) {
    e.preventDefault();
    if (!f.titre.trim()) return;
    setBusy(true);
    try {
      const payload = {
        titre: f.titre.trim(), sous_titre: f.sous_titre || null, type_ressource: f.type_ressource,
        editeur: f.editeur || null, annee_pub: f.annee_pub ? Number(f.annee_pub) : null,
        isbn: f.isbn || null, discipline: f.discipline || null, langue: f.langue || null,
        resume: f.resume || null,
        mots_cles: (f.mots_cles || "").split(",").map((x) => x.trim()).filter(Boolean),
      };
      if (edition) await api.modifierRessource(ressource.id, payload);
      else await api.creerRessource(ecoleId, payload);
      toast.succes(edition ? "Notice modifiée." : "Notice ajoutée.");
      onEnregistre();
    } catch (er) { toast.erreur(er); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={edition ? "Modifier la notice" : "Nouvelle ressource"} large>
      <form className="space-y-4" onSubmit={soumettre}>
        <Champ label="Titre *" value={f.titre} onChange={(e) => maj("titre", e.target.value)} />
        <Champ label="Sous-titre" value={f.sous_titre || ""} onChange={(e) => maj("sous_titre", e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
            <select value={f.type_ressource} onChange={(e) => maj("type_ressource", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {api.TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <Champ label="Année" type="number" value={f.annee_pub} onChange={(e) => maj("annee_pub", e.target.value)} />
          <Champ label="Langue" value={f.langue || ""} onChange={(e) => maj("langue", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Éditeur" value={f.editeur || ""} onChange={(e) => maj("editeur", e.target.value)} />
          <Champ label="ISBN / ISSN" value={f.isbn || ""} onChange={(e) => maj("isbn", e.target.value)} />
          <Champ label="Discipline" value={f.discipline || ""} onChange={(e) => maj("discipline", e.target.value)} />
        </div>
        <Champ label="Mots-clés (séparés par des virgules)" value={f.mots_cles || ""} onChange={(e) => maj("mots_cles", e.target.value)} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Résumé</span>
          <textarea value={f.resume || ""} onChange={(e) => maj("resume", e.target.value)} rows={3}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
        </label>
        <p className="text-xs text-navy-900/45">Le titre, l'éditeur, la discipline, le résumé et les mots-clés alimentent la recherche plein texte.</p>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy || !f.titre.trim()}>{busy ? "…" : edition ? "Enregistrer" : "Ajouter"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// --- Fiche : exemplaires + documents numériques ----------------------------
function ModaleFiche({ id, ecoleId, onFermer, onChange }) {
  const { modulesActifs } = useAuth();
  const numeriqueActif = moduleActif(modulesActifs, "biblio_numerique"); // module facturé à part
  const toast = useToast();
  const confirmer = useConfirm();
  const [r, setR] = useState(null);
  const [ex, setEx] = useState({ code_barres: "", cote: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    if (!id) { setR(null); return; }
    try { setR(await api.getRessource(id)); } catch (e) { setErreur(e.message); }
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  async function ajouterExemplaire(e) {
    e.preventDefault();
    try {
      await api.creerExemplaire(ecoleId, id, { code_barres: ex.code_barres.trim() || null, cote: ex.cote.trim() || null });
      setEx({ code_barres: "", cote: "" });
      toast.succes("Exemplaire ajouté."); charger(); onChange?.();
    } catch (er) { toast.erreur(er); }
  }
  async function supprimerExemplaire(x) {
    if (!(await confirmer("Supprimer cet exemplaire ?"))) return;
    try { await api.supprimerExemplaire(x.id); charger(); onChange?.(); } catch (er) { toast.erreur(er); }
  }

  async function televerser(file) {
    if (!file) return;
    setEnvoi(true); setErreur("");
    try {
      const meta = await api.televerserDocument(ecoleId, file, "ouvrages");
      await api.creerNumerique(ecoleId, id, {
        fichier_chemin: meta.chemin, fichier_nom: meta.nom, taille: meta.taille,
        mime: meta.mime, format: meta.format, acces: "institution", licence: "inconnue",
      });
      toast.succes("Document ajouté.");
      charger();
    } catch (er) { setErreur(er.message); toast.erreur(er); }
    finally { setEnvoi(false); }
  }

  async function ouvrirDocument(n) {
    try {
      const url = await api.lienDocument(n.fichier_chemin);
      if (url) window.open(url, "_blank", "noreferrer");
      else toast.erreur("Accès refusé à ce document.");
    } catch (er) { toast.erreur(er); }
  }

  async function changerAcces(n, acces) {
    try { await api.modifierNumerique(n.id, { acces }); charger(); } catch (er) { toast.erreur(er); }
  }
  async function supprimerDoc(n) {
    if (!(await confirmer("Supprimer ce document numérique ?"))) return;
    try { await api.supprimerNumerique(n.id, n.fichier_chemin); charger(); } catch (er) { toast.erreur(er); }
  }

  return (
    <Modale ouvert={!!id} onFermer={onFermer} titre={r?.titre || "Fiche"} large>
      {!r ? <p className="text-sm text-navy-900/50">Chargement…</p> : (
        <div className="space-y-5">
          <Alerte ton="erreur">{erreur}</Alerte>

          <div className="rounded-xl bg-creme/60 p-4 text-sm">
            <p className="font-medium text-navy-900">{r.titre}</p>
            <p className="text-xs text-navy-900/55">
              {libType(r.type_ressource)}{r.editeur ? ` · ${r.editeur}` : ""}{r.annee_pub ? ` · ${r.annee_pub}` : ""}
              {r.discipline ? ` · ${r.discipline}` : ""}
            </p>
            {r.resume && <p className="mt-2 text-navy-900/70">{r.resume}</p>}
          </div>

          {/* Exemplaires physiques */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-900/45">Exemplaires physiques</p>
            {(r.biblio_exemplaires || []).length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun exemplaire.</p>
            ) : (
              <ul className="space-y-1.5">
                {r.biblio_exemplaires.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-navy-900/60">{x.code_barres || "sans code"}</span>
                      {x.cote ? <span className="ml-2 text-navy-900/60">cote {x.cote}</span> : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge ton={x.statut === "disponible" ? "success" : x.statut === "emprunte" ? "warning" : "neutre"}>
                        {api.STATUTS_EXEMPLAIRE[x.statut] || x.statut}
                      </Badge>
                      <button onClick={() => supprimerExemplaire(x)} className="text-xs text-rose-500 hover:underline">suppr.</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={ajouterExemplaire} className="mt-3 flex flex-wrap items-end gap-2">
              <Champ label="Code-barres" value={ex.code_barres} onChange={(e) => setEx((s) => ({ ...s, code_barres: e.target.value }))} />
              <Champ label="Cote" value={ex.cote} onChange={(e) => setEx((s) => ({ ...s, cote: e.target.value }))} />
              <Bouton type="submit" variante="fantome">+ Exemplaire</Bouton>
            </form>
          </div>

          {/* Documents numériques — module « Bibliothèque numérique » */}
          <div className="border-t border-navy-900/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-900/45">Documents numériques</p>
            {!numeriqueActif ? (
              <p className="rounded-xl bg-creme/60 px-4 py-3 text-sm text-navy-900/55">
                🔒 Le module <b>Bibliothèque numérique</b> n'est pas activé pour cet établissement.
              </p>
            ) : (r.biblio_numeriques || []).length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun fichier.</p>
            ) : (
              <ul className="space-y-1.5">
                {r.biblio_numeriques.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-navy-900">{n.fichier_nom || n.format}</span>
                      <span className="ml-2 text-xs text-navy-900/45">{fmtTaille(n.taille)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <select value={n.acces} onChange={(e) => changerAcces(n, e.target.value)}
                        className="rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-xs outline-none focus:border-or-500">
                        {api.NIVEAUX_ACCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <button onClick={() => ouvrirDocument(n)} className="font-medium text-navy-700 hover:text-or-600">ouvrir</button>
                      <button onClick={() => supprimerDoc(n)} className="text-rose-500 hover:underline">suppr.</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {numeriqueActif && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Téléverser un document (PDF, EPUB… — 50 Mo max)</span>
                <input type="file" accept=".pdf,.epub,.doc,.docx,.ppt,.pptx" disabled={envoi}
                  onChange={(e) => e.target.files?.[0] && televerser(e.target.files[0])}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm" />
                {envoi && <span className="mt-1 block text-xs text-navy-900/50">Envoi en cours…</span>}
              </label>
            )}
          </div>

          <div className="flex justify-end">
            <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          </div>
        </div>
      )}
    </Modale>
  );
}
