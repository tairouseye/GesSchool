import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, EtatVide, Modale } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/cahier.js";
import * as prog from "@/lib/programmation.js";
import { MOIS } from "@/lib/programmationIEF.js";

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
  //  Programmation officielle du NIVEAU de la classe (mig. 165). Vide tant
  //  que la direction n'a rien importé : le formulaire reste saisissable à
  //  la main, exactement comme avant.
  const [progLignes, setProgLignes] = useState([]);

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

  //  ⚠️ La programmation est rattachée au NIVEAU, pas à la classe : celle de
  //  CM1 sert à CM1 A comme à CM1 B. On la charge donc depuis le niveau de
  //  la classe choisie, et on reste silencieux s'il n'y en a pas.
  const niveauId = classes.find((c) => c.id === classeId)?.niveau_id || null;
  useEffect(() => {
    let vivant = true;
    if (!niveauId || !annee?.id) { setProgLignes([]); return undefined; }
    prog.lignesDuMois(ecoleId, { niveauId, anneeId: annee.id, mois: new Date().getMonth() + 1 })
      .then((l) => { if (vivant) setProgLignes(l); })
      .catch(() => { if (vivant) setProgLignes([]); });
    return () => { vivant = false; };
  }, [ecoleId, niveauId, annee?.id]);

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
              progLignes={progLignes}
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

function FormEntree({ matieres, progLignes, onAjout }) {
  const vide = { date_seance: auj(), matiere_id: "", contenu: "", devoirs: "", date_pour: "", programmation_ligne_id: null };
  const [f, setF] = useState(vide);
  const [choix, setChoix] = useState(false);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  //  Point 15 de la visite : « réutiliser les éléments de programmation
  //  plutôt que les ressaisir ». Reprendre une ligne remplit le contenu ET
  //  garde le lien vers la ligne officielle, pour savoir ce qui a été
  //  effectivement traité du programme.
  const reprendre = (l) => {
    setF((s) => ({
      ...s,
      contenu: s.contenu.trim() ? `${s.contenu.trim()}\n${l.contenu}` : l.contenu,
      programmation_ligne_id: l.id,
    }));
    setChoix(false);
  };

  return (
    <Carte className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy-900">Ajouter une séance</h3>
        {/* Le bouton n'apparaît que si la direction a importé la
            planification du niveau : sans elle, rien ne change. */}
        {progLignes.length > 0 && (
          <Bouton variante="fantome" type="button" onClick={() => setChoix(true)}>
            📋 Reprendre la programmation
          </Bouton>
        )}
      </div>
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
          <span className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-navy-900/70">
            Contenu de la séance
            {f.programmation_ligne_id && (
              <span className="inline-flex items-center gap-1 rounded-full bg-or-500/15 px-2 py-0.5 text-[11px] font-medium text-or-600">
                repris de la programmation
                <button type="button" onClick={() => maj("programmation_ligne_id", null)}
                  className="opacity-60 hover:opacity-100" title="Détacher">✕</button>
              </span>
            )}
          </span>
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

      <ModaleProgrammation
        ouvert={choix} onFermer={() => setChoix(false)}
        lignes={progLignes} onChoisir={reprendre}
      />
    </Carte>
  );
}

// =====================================================================
//  Choisir dans la programmation officielle du mois
//
//  ⚠️ On MONTRE le texte officiel tel qu'il est écrit, et l'enseignante le
//  modifie ensuite librement dans le champ. Imposer le texte sans pouvoir
//  l'amender aurait transformé une aide en contrainte — et la planification
//  de l'IEF décrit un objectif, pas le déroulé d'une séance.
// =====================================================================
function ModaleProgrammation({ ouvert, onFermer, lignes, onChoisir }) {
  const [semaine, setSemaine] = useState("");
  const [domaine, setDomaine] = useState("");

  const domaines = [...new Set(lignes.map((l) => l.domaine).filter(Boolean))];
  const semaines = [...new Set(lignes.map((l) => l.semaine).filter((s) => s != null))].sort((a, b) => a - b);
  const visibles = lignes.filter((l) =>
    (!domaine || l.domaine === domaine)
    && (!semaine || (semaine === "mois" ? l.semaine == null : String(l.semaine) === semaine)));

  const moisCourant = (MOIS.find(([n]) => Number(n) === new Date().getMonth() + 1) || [, ""])[1];

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} large titre={`Programmation officielle — ${moisCourant}`}>
      <div className="flex flex-wrap gap-1.5">
        <Filtre actif={!domaine} onClick={() => setDomaine("")}>Tous les domaines</Filtre>
        {domaines.map((d) => (
          <Filtre key={d} actif={domaine === d} onClick={() => setDomaine(d)}>{d}</Filtre>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Filtre actif={!semaine} onClick={() => setSemaine("")}>Tout le mois</Filtre>
        {semaines.map((s) => (
          <Filtre key={s} actif={semaine === String(s)} onClick={() => setSemaine(String(s))}>Semaine {s}</Filtre>
        ))}
        {lignes.some((l) => l.semaine == null) && (
          <Filtre actif={semaine === "mois"} onClick={() => setSemaine("mois")}>Sans semaine</Filtre>
        )}
      </div>

      {visibles.length === 0 ? (
        <EtatVide icone="📋" titre="Rien à cet endroit du programme" />
      ) : (
        <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
          {visibles.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onChoisir(l)}
                className="w-full rounded-xl border border-navy-900/10 p-3 text-left transition hover:border-or-500 hover:bg-or-500/[0.04]">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                  <span className="rounded bg-navy-900/5 px-1.5 font-medium text-navy-900/50">
                    {l.semaine ? `S${l.semaine}` : "mois"}
                  </span>
                  {l.domaine && <span className="font-semibold text-navy-900/60">{l.domaine}</span>}
                  {l.rubrique && <span className="text-navy-900/40">/ {l.rubrique}</span>}
                  {l.activite && <span className="font-medium text-or-600">{l.activite}</span>}
                </div>
                <div className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/80">{l.contenu}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modale>
  );
}

function Filtre({ actif, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${actif
        ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70 hover:bg-navy-900/10"}`}>
      {children}
    </button>
  );
}
