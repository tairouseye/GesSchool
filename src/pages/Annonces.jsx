import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/annonces.js";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

const TONS_CIBLE = {
  tous: "bg-navy-900/5 text-navy-900/60",
  parents: "bg-or-500/15 text-or-600",
  enseignants: "bg-emerald-500/10 text-emerald-700",
  classe: "bg-sky-500/10 text-sky-700",
};

export default function Annonces() {
  const { ecoleId, utilisateur } = useAuth();
  const [annonces, setAnnonces] = useState([]);
  const [classes, setClasses] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      const [ann, cls] = await Promise.all([api.getAnnonces(ecoleId), getClasses(ecoleId, an?.id)]);
      setAnnonces(ann);
      setClasses(cls);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const wrap = async (fn) => {
    setErreur("");
    try {
      await fn();
      await recharger();
    } catch (e) {
      setErreur(e.message);
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
                      {a.cible === "classe" ? a.classes?.libelle || "Classe" : api.libelleCible(a.cible)}
                    </span>
                  </div>
                  {a.contenu && <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/70">{a.contenu}</p>}
                  <p className="mt-2 text-xs text-navy-900/40">
                    {fmtDate(a.publie_le)}
                    {a.profils && ` · ${a.profils.prenom} ${a.profils.nom}`}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm("Supprimer cette annonce ?")) wrap(() => api.supprimerAnnonce(a.id)); }}
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
        classes={classes}
        onCreer={(data) =>
          wrap(async () => {
            await api.creerAnnonce(ecoleId, data, utilisateur?.id);
            setModale(false);
          })
        }
      />
    </>
  );
}

function ModaleAnnonce({ ouvert, onFermer, classes, onCreer }) {
  const vide = { titre: "", contenu: "", cible: "tous", classe_id: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle annonce" large>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.titre.trim()) return;
          if (f.cible === "classe" && !f.classe_id) return;
          onCreer({ ...f, titre: f.titre.trim() });
          setF(vide);
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
