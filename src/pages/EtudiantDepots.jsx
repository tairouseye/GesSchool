import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/depots.js";
import { monDossier } from "@/lib/etudiant.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const libType = (t) => api.TYPES_DEPOT.find(([v]) => v === t)?.[1] || t;
// Le déposant ne peut travailler son dossier que tant qu'il n'est pas parti en validation.
const modifiable = (s) => s === "brouillon" || s === "a_corriger";

// Espace étudiant — dépôt institutionnel : soumettre son mémoire / sa thèse
// et suivre son avancement jusqu'à la publication au catalogue.
export default function EtudiantDepots() {
  const { utilisateur } = useAuth();
  const [dossier, setDossier] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [edite, setEdite] = useState(null); // objet dépôt, ou {} pour un nouveau
  const toast = useToast();
  const confirmer = useConfirm();

  const recharger = useCallback(async () => {
    setChargement(true);
    try { setLignes(await api.mesDepots()); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, []);

  useEffect(() => {
    monDossier().then(setDossier).catch((e) => setErreur(e.message));
    recharger();
  }, [recharger]);

  async function soumettre(d) {
    if (!d.fichier_chemin) { toast.erreur("Ajoutez d'abord le fichier de votre travail."); return; }
    if (!(await confirmer({
      titre: "Soumettre à la bibliothèque",
      message: "Votre dossier partira en validation et ne sera plus modifiable.",
      confirmer: "Soumettre", danger: false,
    }))) return;
    try {
      await api.soumettreDepot(d.id);
      toast.succes("Dossier soumis.");
      recharger();
    } catch (e) { toast.erreur(e); }
  }

  async function supprimer(d) {
    if (!(await confirmer("Supprimer ce dépôt ?"))) return;
    try { await api.supprimerDepot(d.id); toast.succes("Dépôt supprimé."); recharger(); }
    catch (e) { toast.erreur(e); }
  }

  async function ouvrir(d) {
    try {
      const url = await api.lienDepot(d.fichier_chemin);
      if (url) window.open(url, "_blank", "noreferrer"); else toast.erreur("Fichier inaccessible.");
    } catch (e) { toast.erreur(e); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">🎓 Mon dépôt</p>
        <p className="text-sm text-creme/70">Mémoire, thèse, rapport de stage ou publication</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex justify-end">
        <Bouton onClick={() => setEdite({})} disabled={!dossier}>+ Nouveau dépôt</Bouton>
      </div>

      {chargement ? <SkeletonListe lignes={3} /> : lignes.length === 0 ? (
        <EtatVide icone="🎓" titre="Aucun dépôt">
          Déposez votre mémoire ou votre thèse : la bibliothèque le vérifie puis le publie au catalogue.
        </EtatVide>
      ) : (
        <div className="space-y-3">
          {lignes.map((d) => {
            const s = api.STATUTS_DEPOT[d.statut] || { label: d.statut, ton: "neutre" };
            return (
              <Carte key={d.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{d.titre}</p>
                    <p className="text-xs text-navy-900/55">
                      {libType(d.type)}{d.annee_academique ? ` · ${d.annee_academique}` : ""} · déposé le {dateFr(d.created_at)}
                    </p>
                  </div>
                  <Badge ton={s.ton}>{s.label}</Badge>
                </div>

                {d.commentaire && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Retour de la bibliothèque : {d.commentaire}
                  </p>
                )}
                {d.statut === "publie" && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Publié au catalogue : votre travail est consultable par l'établissement.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {d.fichier_chemin && (
                    <Bouton variante="fantome" onClick={() => ouvrir(d)}>📄 Ouvrir</Bouton>
                  )}
                  {modifiable(d.statut) && <Bouton variante="fantome" onClick={() => setEdite(d)}>Modifier</Bouton>}
                  {modifiable(d.statut) && <Bouton onClick={() => soumettre(d)}>Soumettre</Bouton>}
                  {d.statut === "brouillon" && (
                    <Bouton variante="danger" onClick={() => supprimer(d)}>Supprimer</Bouton>
                  )}
                </div>
              </Carte>
            );
          })}
        </div>
      )}

      {edite && (
        <ModaleDepot depot={edite} dossier={dossier} profilId={utilisateur?.id} onFermer={() => setEdite(null)}
          onEnregistre={() => { setEdite(null); recharger(); }} />
      )}
    </div>
  );
}

function ModaleDepot({ depot, dossier, profilId, onFermer, onEnregistre }) {
  const toast = useToast();
  const neuf = !depot.id;
  const [f, setF] = useState({
    type: depot.type || "memoire",
    titre: depot.titre || "",
    resume: depot.resume || "",
    annee_academique: depot.annee_academique || "",
    mots_cles: (depot.mots_cles || []).join(", "),
  });
  const [fichier, setFichier] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.titre.trim()) { toast.erreur("Le titre est obligatoire."); return; }
    if (!dossier?.ecole_id) { toast.erreur("Dossier étudiant introuvable."); return; }
    setBusy(true);
    let cheminEnvoye = null;   // à reprendre si l'écriture en base échoue
    let ancienChemin = null;   // remplacé : à retirer une fois l'écriture faite
    try {
      let champsFichier = {};
      if (fichier) {
        const up = await api.televerserDepot(dossier.ecole_id, fichier);
        cheminEnvoye = up.chemin;
        ancienChemin = depot.fichier_chemin || null;
        champsFichier = { fichier_chemin: up.chemin, fichier_nom: up.nom, taille: up.taille };
      }
      const valeurs = {
        type: f.type, titre: f.titre.trim(), resume: f.resume || null,
        annee_academique: f.annee_academique || null,
        mots_cles: f.mots_cles ? f.mots_cles.split(",").map((m) => m.trim()).filter(Boolean) : [],
        ...champsFichier,
      };
      if (neuf) {
        // `deposant_profil_id` est EXIGÉ par la policy d'insertion (et conditionne
        // la relecture du fichier par son auteur) ; l'élève lie le dossier au cursus.
        await api.creerDepot(dossier.ecole_id, {
          ...valeurs, deposant_profil_id: profilId, deposant_eleve_id: dossier.eleve_id, statut: "brouillon",
        });
      } else {
        await api.modifierDepot(depot.id, valeurs);
      }
      // L'écriture a réussi : l'ancien fichier n'est plus référencé.
      if (ancienChemin && ancienChemin !== cheminEnvoye) await api.retirerFichierDepot(ancienChemin);
      toast.succes(neuf ? "Dépôt créé." : "Dépôt mis à jour.");
      onEnregistre();
    } catch (e2) {
      // Échec après téléversement : on reprend le fichier pour ne pas
      // abandonner un orphelin dans le bucket.
      if (cheminEnvoye) await api.retirerFichierDepot(cheminEnvoye).catch(() => {});
      toast.erreur(e2);
    }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre={neuf ? "Nouveau dépôt" : "Modifier le dépôt"}>
      <form onSubmit={enregistrer} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de travail</span>
          <select value={f.type} onChange={maj("type")}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {api.TYPES_DEPOT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <Champ label="Titre" value={f.titre} onChange={maj("titre")} required />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Résumé</span>
          <textarea value={f.resume} onChange={maj("resume")} rows={4}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Année académique" placeholder="2025-2026" value={f.annee_academique} onChange={maj("annee_academique")} />
          <Champ label="Mots-clés (séparés par virgules)" value={f.mots_cles} onChange={maj("mots_cles")} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">
            Fichier (PDF){depot.fichier_nom ? ` — actuel : ${depot.fichier_nom}` : ""}
          </span>
          <input type="file" accept=".pdf,.doc,.docx"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:text-creme" />
          <span className="mt-1 block text-xs text-navy-900/45">
            Votre fichier reste privé jusqu'à la publication par la bibliothèque.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
