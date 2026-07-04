import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, EtatVide } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/cahier.js";

const auj = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "");

export default function CahierTextes() {
  const { ecoleId, utilisateur, profil, roles } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [enseignant, setEnseignant] = useState(null);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [entrees, setEntrees] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const mat = await getMatieres(ecoleId);
        setMatieres(mat);
        const ens = await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        setEnseignant(ens);
        // Promoteur/direction : toutes les classes ; enseignant : ses classes.
        const cls = voitToutesClasses(roles)
          ? await getClasses(ecoleId, an?.id)
          : await getMesClasses(ecoleId, an?.id, ens?.id);
        setClasses(cls);
        if (cls.length) setClasseId(cls[0].id);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email]);

  const recharger = useCallback(async () => {
    if (!classeId) { setEntrees([]); return; }
    setErreur("");
    try { setEntrees(await api.getCahier(ecoleId, classeId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => { try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; } catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; } };

  return (
    <>
      <EnTete
        titre="Cahier de textes"
        sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={classes.length > 0 && (
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        )}
      />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {classes.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            Aucune classe à afficher. {enseignant ? "Aucune classe ne t'est attribuée cette année." : "Ton compte n'est pas relié à une fiche enseignant."}
          </Carte>
        ) : (
          <>
            <FormEntree
              matieres={matieres}
              onAjout={(data) => wrap(() => api.creerEntree(ecoleId, { ...data, classe_id: classeId, enseignant_id: enseignant?.id }))}
            />

            {entrees.length === 0 ? (
              <EtatVide icone="📓" titre="Aucune entrée">Ajoutez une séance et son contenu pour cette classe.</EtatVide>
            ) : (
              <div className="space-y-3">
                {entrees.map((e) => (
                  <Carte key={e.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-or-600">{fmt(e.date_seance)}</span>
                        {e.matieres?.libelle && <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/70">{e.matieres.libelle}</span>}
                        {e.enseignants && <span className="text-xs text-navy-900/40">{e.enseignants.prenom} {e.enseignants.nom}</span>}
                      </div>
                      <button onClick={async () => { if (await confirmer("Supprimer cette entrée ?")) wrap(() => api.supprimerEntree(e.id), "Entrée supprimée."); }}
                        className="shrink-0 text-xs text-rose-500 hover:underline">supprimer</button>
                    </div>
                    {e.contenu && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-900/80"><b className="text-navy-900/50">Séance :</b> {e.contenu}</p>}
                    {e.devoirs && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/80">
                        <b className="text-or-600">📘 Devoirs :</b> {e.devoirs}
                        {e.date_pour && <span className="ml-1 text-xs text-navy-900/50">(pour le {fmt(e.date_pour)})</span>}
                      </p>
                    )}
                  </Carte>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FormEntree({ matieres, onAjout }) {
  const vide = { date_seance: auj(), matiere_id: "", contenu: "", devoirs: "", date_pour: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Ajouter une séance</h3>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!f.contenu.trim() && !f.devoirs.trim()) return; onAjout(f); setF(vide); }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Date" type="date" value={f.date_seance} onChange={(e) => maj("date_seance", e.target.value)} />
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Matière</span>
            <select value={f.matiere_id} onChange={(e) => maj("matiere_id", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Contenu de la séance</span>
          <textarea value={f.contenu} onChange={(e) => maj("contenu", e.target.value)} rows={2}
            placeholder="Ce qui a été fait en cours…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Devoirs à faire</span>
            <textarea value={f.devoirs} onChange={(e) => maj("devoirs", e.target.value)} rows={2}
              placeholder="Travail à faire à la maison…"
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
          </label>
          <Champ label="Pour le" type="date" value={f.date_pour} onChange={(e) => maj("date_pour", e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Bouton type="submit">+ Enregistrer</Bouton>
        </div>
      </form>
    </Carte>
  );
}
