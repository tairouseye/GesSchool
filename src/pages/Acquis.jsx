import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, SkeletonListe, Badge } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import { getAnneeCourante, getClasses, getCycles, getNiveaux, getPeriodesAnnee } from "@/lib/academique.js";
import { getElevesClasse } from "@/lib/bulletins.js";
import { voitToutesClasses, estRoleComplet } from "@/lib/permissions.js";
import { getMesClasses, getMonEnseignant } from "@/lib/appel.js";
import { VALEURS, valeur as valeurDe, parDomaine, avancement } from "@/lib/acquisEchelle.js";
import * as api from "@/lib/acquis.js";

// GesSchool — le suivi des acquis, au préscolaire (mig. 172).
//
// ⚠️ ON N'ÉVALUE PAS, ON OBSERVE. Un enfant de TPS n'a pas une moyenne de
// 12,5 en langage : il « sait nommer les objets usuels » — acquis, en cours
// d'acquisition, ou pas encore. D'où une échelle à trois valeurs, et aucune
// moyenne nulle part.
//
// ⚠️ UN ENFANT À LA FOIS, ET NON UNE GRILLE CLASSE × ITEMS. Un tableau de
// 25 enfants sur 60 items ferait 1 500 cases : illisible au téléphone, et
// faux dans l'esprit — on observe un enfant, pas une matrice. On choisit
// donc l'enfant, puis on parcourt ses domaines.

export default function Acquis() {
  const { ecoleId, roles, profil, utilisateur } = useAuth();
  const toutVoir = voitToutesClasses(roles);
  const confirmer = useConfirm();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [items, setItems] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [obs, setObs] = useState({});
  const [eleveId, setEleveId] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [cy, nv, per, cls] = await Promise.all([
          getCycles(ecoleId), getNiveaux(ecoleId),
          an?.id ? getPeriodesAnnee(ecoleId, an.id) : [],
          toutVoir
            ? getClasses(ecoleId, an?.id)
            : getMesClasses(ecoleId, an?.id, (await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email))?.id),
        ]);
        setCycles(cy); setNiveaux(nv); setPeriodes(per); setClasses(cls);
        if (per.length) setPeriodeId(per[0].id);
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email, toutVoir]);

  //  Le cycle de la classe choisie : c'est lui qui porte le référentiel.
  const classe = classes.find((c) => c.id === classeId);
  const cycleId = niveaux.find((n) => n.id === classe?.niveau_id)?.cycle_id || null;
  const cycle = cycles.find((c) => c.id === cycleId);

  //  ⚠️ Les classes du PRÉSCOLAIRE seulement : proposer ce suivi pour un
  //  CM1 n'aurait pas de sens — on y note. On filtre donc la liste plutôt
  //  que d'afficher une page vide sur un mauvais choix.
  const classesPresco = useMemo(() => classes.filter((c) => {
    const cy = cycles.find((x) => x.id === niveaux.find((n) => n.id === c.niveau_id)?.cycle_id);
    return cy?.type === "prescolaire";
  }), [classes, cycles, niveaux]);

  useEffect(() => {
    setClasseId((c) => (classesPresco.some((x) => x.id === c) ? c : (classesPresco[0]?.id || "")));
  }, [classesPresco]);

  const charger = useCallback(async () => {
    if (!cycleId || !classeId || !annee?.id) { setItems([]); setEleves([]); setObs({}); return; }
    setErreur("");
    try {
      const [it, els] = await Promise.all([
        api.getItems(ecoleId, cycleId),
        getElevesClasse(ecoleId, classeId, annee.id),
      ]);
      setItems(it);
      setEleves(els);
      setEleveId((c) => (els.some((x) => x.id === c) ? c : (els[0]?.id || "")));
      setObs(periodeId ? await api.getObservations(ecoleId, els.map((e) => e.id), periodeId) : {});
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, cycleId, classeId, annee?.id, periodeId]);

  useEffect(() => { charger(); }, [charger]);

  async function noter(itemId, v) {
    try {
      await api.observer(ecoleId, {
        eleveId, itemId, periodeId, valeur: v, saisiPar: profil?.id,
      });
      //  Mise à jour sur place : recharger toute la classe à chaque clic
      //  rendrait la saisie de 60 items insupportable.
      setObs((s) => {
        const pour = { ...(s[eleveId] || {}) };
        if (v) pour[itemId] = { ...(pour[itemId] || {}), valeur: v };
        else delete pour[itemId];
        return { ...s, [eleveId]: pour };
      });
    } catch (e) { toast.erreur(e.message); }
  }

  const obsEleve = obs[eleveId] || {};
  const groupes = useMemo(() => parDomaine(items, obsEleve), [items, obsEleve]);
  const av = useMemo(() => avancement(items, obsEleve), [items, obsEleve]);
  const eleve = eleves.find((e) => e.id === eleveId);

  if (chargement) {
    return (<><EnTete titre="Suivi des acquis" /><div className="p-8"><SkeletonListe lignes={4} /></div></>);
  }

  return (
    <>
      <EnTete titre="Suivi des acquis" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-4 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {classesPresco.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            Aucune classe de préscolaire. Ce suivi remplace les notes chiffrées,
            qui n&apos;ont pas de sens avant l&apos;élémentaire — il ne s&apos;affiche donc que
            pour les classes du cycle <b>Préscolaire</b>.
          </Carte>
        ) : (
          <>
            <Carte className="flex flex-wrap items-end gap-3 p-4">
              <Sel label="Classe" value={classeId} onChange={setClasseId}
                options={classesPresco.map((c) => [c.id, c.libelle])} />
              <Sel label="Période" value={periodeId} onChange={setPeriodeId}
                options={periodes.map((p) => [p.id, p.libelle])} />
              {items.length > 0 && (
                <Badge ton={av.observes ? "navy" : "neutre"}>
                  {av.observes} / {av.total} observé{av.observes > 1 ? "s" : ""}
                </Badge>
              )}
            </Carte>

            {items.length === 0 ? (
              <Carte className="p-6">
                <h3 className="font-display text-lg font-semibold text-navy-900">
                  Aucun référentiel pour ce cycle
                </h3>
                <p className="mt-1.5 text-sm text-navy-900/60">
                  Le suivi repose sur une liste d&apos;items observables — « nommer les objets
                  usuels », « respecter les règles de la classe »… Cette liste appartient à
                  l&apos;école : nous pouvons en proposer une de départ, que vous réécrirez à
                  votre main.
                </p>
                {estRoleComplet(roles) || roles.includes("direction") ? (
                  <div className="mt-4">
                    <Bouton onClick={async () => {
                      if (!cycleId) return;
                      if (!await confirmer("Charger un référentiel de départ pour ce cycle ? Vous pourrez ensuite le modifier.")) return;
                      try {
                        const n = await api.chargerModele(cycleId);
                        toast.succes(`${n} items chargés. Adaptez-les à votre école.`);
                        await charger();
                      } catch (e) { toast.erreur(e.message); }
                    }}>
                      Charger un référentiel de départ
                    </Bouton>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-navy-900/40">
                    Seule la direction peut mettre en place le référentiel.
                  </p>
                )}
              </Carte>
            ) : eleves.length === 0 ? (
              <EtatVide icone="🧸" titre="Aucun enfant inscrit">
                Aucun enfant inscrit dans cette classe pour cette année.
              </EtatVide>
            ) : (
              <>
                {/*  ⚠️ UN ENFANT À LA FOIS. Une grille 25 enfants × 60 items
                    ferait 1 500 cases : illisible, et fausse dans l'esprit —
                    on observe un enfant, pas une matrice. */}
                <div className="flex flex-wrap gap-1.5">
                  {eleves.map((e) => {
                    const a = avancement(items, obs[e.id] || {});
                    return (
                      <button key={e.id} type="button" onClick={() => setEleveId(e.id)}
                        className={`rounded-xl px-3 py-2 text-left text-xs font-medium transition ${eleveId === e.id
                          ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70 hover:bg-navy-900/10"}`}>
                        <span className="block">{e.prenom} {e.nom}</span>
                        <span className={`block text-[11px] ${eleveId === e.id ? "text-creme/60" : "text-navy-900/40"}`}>
                          {a.observes}/{a.total}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Carte className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="font-display font-semibold text-navy-900">
                    {eleve ? `${eleve.prenom} ${eleve.nom}` : ""}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    {VALEURS.map((v) => (
                      <span key={v.cle} className="text-navy-900/50" title={v.aide}>
                        {v.pastille} {v.label}
                      </span>
                    ))}
                  </span>
                </Carte>

                <div className="space-y-4">
                  {groupes.map((g) => (
                    <Carte key={g.domaine} className="p-0">
                      <h3 className="border-b border-navy-900/10 px-4 py-2.5 font-display text-sm font-semibold text-navy-900">
                        {g.domaine}
                      </h3>
                      <div className="divide-y divide-navy-900/5">
                        {g.items.map((it) => (
                          <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <span className="min-w-0 text-sm text-navy-900/80">{it.libelle}</span>
                            <div className="flex shrink-0 gap-1">
                              {VALEURS.map((v) => {
                                const actif = it.valeur === v.cle;
                                return (
                                  <button key={v.cle} type="button" title={v.aide}
                                    /*  Re-cliquer la valeur active la RETIRE :
                                        l'absence d'observation est une
                                        information légitime, et il faut
                                        pouvoir y revenir. */
                                    onClick={() => noter(it.id, actif ? null : v.cle)}
                                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${actif
                                      ? "bg-navy-900 text-creme"
                                      : "bg-navy-900/5 text-navy-900/60 hover:bg-navy-900/10"}`}>
                                    {v.pastille} <span className="hidden sm:inline">{v.court}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Carte>
                  ))}
                </div>

                {cycle && (
                  <p className="text-xs text-navy-900/40">
                    Référentiel du cycle <b>{cycle.libelle}</b> — {items.length} items.
                    Le modifier se fait dans Structure.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
        {options.length === 0 && <option value="">—</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
