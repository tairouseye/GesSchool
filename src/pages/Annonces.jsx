import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/annonces.js";
import { televerserFichier, getFichiers as getFichiersEcole, supprimerFichier, lienFichier, poids, TAILLE_MAX } from "@/lib/fichiers.js";
import { getAnneeCourante, getClasses, getNiveaux, getCycles } from "@/lib/academique.js";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

const TONS_CIBLE = {
  tous: "bg-navy-900/5 text-navy-900/60",
  parents: "bg-or-500/15 text-or-600",
  etudiants: "bg-violet-500/10 text-violet-700",
  enseignants: "bg-emerald-500/10 text-emerald-700",
  classe: "bg-sky-500/10 text-sky-700",
};

export default function Annonces() {
  const { ecoleId, utilisateur } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const [annonces, setAnnonces] = useState([]);
  const [classes, setClasses] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);
  const [pieces, setPieces] = useState({});

  // Lien signé valable une heure : le serveur vérifie le droit de lire la
  // ligne avant de délivrer le fichier.
  async function ouvrir(fichier) {
    try {
      const url = await lienFichier(fichier.chemin);
      if (url) window.open(url, "_blank", "noopener");
      else toast.erreur("Fichier introuvable.");
    } catch (e) { toast.erreur(e); }
  }

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      const [ann, cls, niv, cyc] = await Promise.all([
        api.getAnnonces(ecoleId), getClasses(ecoleId, an?.id), getNiveaux(ecoleId), getCycles(ecoleId)]);
      setNiveaux(niv); setCycles(cyc);
      // Une requête par annonce serait N+1 ; on tire tout d'un coup et on
      // regroupe côté client.
      const tous = await getFichiersEcole(ecoleId);
      const parAnnonce = {};
      tous.forEach((x) => { if (x.annonce_id) (parAnnonce[x.annonce_id] ||= []).push(x); });
      setPieces(parAnnonce);
      setAnnonces(ann);
      setClasses(cls);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const wrap = async (fn, msg) => {
    try {
      await fn();
      await recharger();
      if (msg) toast.succes(msg);
      return true;
    } catch (e) {
      toast.erreur(e.message || "Une erreur est survenue.");
      return false;
    }
  };

  return (
    <>
      <EnTete
        titre="Annonces"
        sousTitre="Communication vers les parents et le personnel"
        action={<Bouton onClick={() => setModale(true)}>+ Nouvelle annonce</Bouton>}
      />
      <div className="space-y-4 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {annonces.length === 0 ? (
          <Carte className="p-8 text-sm text-navy-900/50">
            Aucune annonce. Publie ta première communication avec « + Nouvelle annonce ».
          </Carte>
        ) : (
          annonces.map((a) => (
            <Carte key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-navy-900">{a.titre}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS_CIBLE[a.cible] || TONS_CIBLE.tous}`}>
                      {api.libelleAudience(a)}
                    </span>
                  </div>
                  {a.contenu && <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/70">{a.contenu}</p>}
                  {(pieces[a.id] || []).length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {pieces[a.id].map((x) => (
                        <li key={x.id}>
                          <button type="button" onClick={() => ouvrir(x)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-900/10 bg-white px-2.5 py-1 text-xs text-navy-900/75 hover:border-or-500 hover:text-or-600">
                            📎 <span className="max-w-48 truncate">{x.nom_fichier}</span>
                            <span className="text-navy-900/35">{poids(x.taille)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-navy-900/40">
                    {fmtDate(a.publie_le)}
                    {a.profils && ` · ${a.profils.prenom} ${a.profils.nom}`}
                  </p>
                </div>
                <button
                  onClick={async () => { if (await confirmer("Supprimer cette annonce ?")) wrap(() => api.supprimerAnnonce(a.id), "Annonce supprimée."); }}
                  className="shrink-0 text-xs text-rose-500 hover:underline"
                >
                  supprimer
                </button>
              </div>
            </Carte>
          ))
        )}
      </div>

      <ModaleAnnonce
        ouvert={modale}
        onFermer={() => setModale(false)}
        classes={classes} niveaux={niveaux} cycles={cycles}
        onCreer={(data, fichiers) =>
          wrap(async () => {
            const a = await api.creerAnnonce(ecoleId, data, utilisateur?.id);
            // Les pièces jointes ne sont envoyées qu'une fois l'annonce
            // créée : elles ont besoin de son identifiant pour hériter de
            // son audience.
            for (const fic of fichiers || []) {
              await televerserFichier(ecoleId, fic, { annonceId: a.id, auteurId: utilisateur?.id });
            }
            setModale(false);
          }, (fichiers || []).length ? "Annonce publiée avec ses pièces jointes." : "Annonce publiée.")
        }
      />
    </>
  );
}

function ModaleAnnonce({ ouvert, onFermer, classes, niveaux, cycles, onCreer }) {
  const vide = { titre: "", contenu: "", cible: "tous", classe_id: "", niveau_id: "", cycle_id: "" };
  const [f, setF] = useState(vide);
  const [fichiers, setFichiers] = useState([]);
  const [refus, setRefus] = useState("");
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // On écarte les fichiers trop lourds AVANT l'envoi : le serveur les
  // refuserait après plusieurs minutes de téléversement.
  function choisir(liste) {
    const trop = liste.filter((x) => x.size > TAILLE_MAX);
    setRefus(trop.length
      ? `${trop.map((x) => x.name).join(", ")} — au-delà de ${poids(TAILLE_MAX)}, non joint${trop.length > 1 ? "s" : ""}.`
      : "");
    setFichiers(liste.filter((x) => x.size <= TAILLE_MAX));
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle annonce" large>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.titre.trim()) return;
          if (api.cibleExigeChoix(f.cible) && !f[api.CHAMP_CIBLE[f.cible]]) return;
          onCreer({ ...f, titre: f.titre.trim() }, fichiers);
          setF(vide); setFichiers([]); setRefus("");
        }}
      >
        <Champ label="Titre *" value={f.titre} onChange={(e) => maj("titre", e.target.value)} placeholder="Réunion de rentrée…" />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Message</span>
          <textarea
            value={f.contenu}
            onChange={(e) => maj("contenu", e.target.value)}
            rows={5}
            placeholder="Détails de l'annonce…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          />
        </label>

        {/* Pièces jointes. Elles suivent EXACTEMENT l'audience de l'annonce :
            une annonce de classe ne les expose qu'aux parents de cette classe
            (migration 150). Elles sont aussi archivées dans la Documentation. */}
        <div className="rounded-xl border border-dashed border-navy-900/15 bg-creme/40 p-3">
          <label className="block cursor-pointer">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">
              Pièces jointes <span className="font-normal text-navy-900/40">(PDF, image, document — {poids(TAILLE_MAX)} maximum)</span>
            </span>
            <input type="file" multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => choisir([...e.target.files])}
              className="block w-full text-sm text-navy-900/70 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-creme" />
          </label>
          {fichiers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {fichiers.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs text-navy-900/70">
                  <span className="min-w-0 truncate">📎 {x.name} <span className="text-navy-900/40">({poids(x.size)})</span></span>
                  <button type="button" onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}
                    className="shrink-0 text-rose-500 hover:underline">retirer</button>
                </li>
              ))}
            </ul>
          )}
          {refus && <p className="mt-2 text-xs text-rose-600">{refus}</p>}
          <p className="mt-2 text-[11px] text-navy-900/45">
            Ces fichiers seront conservés dans Pilotage → Documentation.
          </p>
          {/* ⚠️ Prévention d'un cas réel : le règlement intérieur de Tut'Tank,
              joint à une annonce ciblée « Élémentaire », n'a atteint que 51
              élèves sur 96 — et ne figurait dans aucune étagère consultable.
              L'école avait fait le geste évident ; rien ne l'avertissait
              (migration 159). */}
          {fichiers.length > 0 && api.cibleExigeChoix(f.cible) && (
            <p className="mt-2 rounded-lg border border-or-500/40 bg-or-500/5 px-2.5 py-2 text-[11px] text-navy-900/70">
              Cette annonce étant ciblée, la pièce jointe ne parviendra <b>qu&apos;aux familles visées</b>.
              Un règlement intérieur ou un texte officiel concerne en général tout l&apos;établissement :
              une fois l&apos;annonce publiée, versez-le au rayon <b>Textes de référence</b> depuis
              Pilotage → Documentation.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Destinataires</span>
            <select
              value={f.cible}
              onChange={(e) => maj("cible", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            >
              {api.CIBLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {f.cible === "cycle" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Cycle *</span>
              <select value={f.cycle_id} onChange={(e) => maj("cycle_id", e.target.value)} required
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="">— Choisir —</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </label>
          )}
          {f.cible === "niveau" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Niveau *</span>
              <select value={f.niveau_id} onChange={(e) => maj("niveau_id", e.target.value)} required
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="">— Choisir —</option>
                {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle}</option>)}
              </select>
            </label>
          )}
          {f.cible === "classe" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Classe *</span>
              <select
                value={f.classe_id}
                onChange={(e) => maj("classe_id", e.target.value)}
                required
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
              >
                <option value="">— Choisir —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.libelle}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Publier</Bouton>
        </div>
      </form>
    </Modale>
  );
}
