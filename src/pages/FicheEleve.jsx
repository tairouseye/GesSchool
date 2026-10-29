import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, Onglets, Badge, Skeleton, SkeletonListe } from "@/composants/ui.jsx";
import * as api from "@/lib/eleves.js";
import { genererCodeTuteur } from "@/lib/parent.js";
import { lienWhatsApp } from "@/lib/recouvrement.js";
import { getAnneeCourante, getClasses, getChampsEleve, getSousNiveaux, sousNiveauxDeClasse } from "@/lib/academique.js";
import { peutEditerEleves, peutGererParents, peutVoir, peutGererTarifs, peutVoirEcheancier } from "@/lib/permissions.js";
import { eleveEcheancier, fratrieEleve, definirTarifEleve, definirNouveauEleve } from "@/lib/paiements.js";
import { etat as etatPaiement, resumeEcheancier } from "@/lib/paiementStatut.js";
import Echeancier, { BadgeStatut } from "@/composants/Echeancier.jsx";
import { lexiqueEleve, motEleve } from "@/lib/lexique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import Photo from "@/composants/Photo.jsx";

export default function FicheEleve() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ecoleId, ecole, roles } = useAuth();
  const L = lexiqueEleve(ecole?.type_etablissement);
  const peutEditer = peutEditerEleves(roles);
  const gereParents = peutGererParents(roles); // responsable pédagogique : codes parents
  const peutMessage = peutVoir(roles, "messagerie");
  const confirmer = useConfirm();
  const toast = useToast();
  const [eleve, setEleve] = useState(null);
  const [tuteurs, setTuteurs] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modaleTuteur, setModaleTuteur] = useState(false);
  const [modaleInscr, setModaleInscr] = useState(false);
  const [sousNiveaux, setSousNiveaux] = useState([]);
  const [modaleEdit, setModaleEdit] = useState(false);
  const [carteOuverte, setCarteOuverte] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [codes, setCodes] = useState({}); // tuteur_id -> code parent
  const [champsPerso, setChampsPerso] = useState([]);
  // Échéancier et fratrie (mig. 210). `undefined` = en cours, `null` =
  // indisponible (droit absent ou migration non appliquée) : le bloc se tait.
  const voitEcheancier = peutVoirEcheancier(roles);
  const gereTarif = peutGererTarifs(roles);
  const [echeancier, setEcheancier] = useState(undefined);
  const [fratrie, setFratrie] = useState([]);
  const [modaleTarif, setModaleTarif] = useState(false);
  const [onglet, setOnglet] = useState("apercu");

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [el, tut, insc, cls, champs, sn] = await Promise.all([
        api.getEleve(id),
        api.getTuteursEleve(id),
        api.getInscriptionsEleve(id),
        getClasses(ecoleId, an?.id),
        getChampsEleve(ecoleId),
        getSousNiveaux(ecoleId).catch(() => []),
      ]);
      setEleve(el);
      setTuteurs(tut);
      setInscriptions(insc);
      setClasses(cls);
      setChampsPerso(champs);
      setSousNiveaux(sn);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [id, ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const chargerPaiement = useCallback(() => {
    if (voitEcheancier) eleveEcheancier(id).then(setEcheancier).catch(() => setEcheancier(null));
    else setEcheancier(null);
    fratrieEleve(id).then(setFratrie).catch(() => setFratrie([]));
  }, [id, voitEcheancier]);
  useEffect(() => { chargerPaiement(); }, [chargerPaiement]);

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

  if (chargement) return (<><EnTete titre={`Fiche ${L.s}`} /><div className="p-8"><SkeletonListe lignes={3} /></div></>);
  if (!eleve) return (<><EnTete titre={`Fiche ${L.s}`} /><div className="p-8 text-navy-900/60">{L.S} introuvable.</div></>);

  const inscCourante = inscriptions.find((i) => i.annee_id === annee?.id) || null;
  const age = ageDe(eleve.date_naissance);
  const voitPaiements = voitEcheancier && echeancier !== null;
  const onglets = [["apercu", "Aperçu"], ["scolarite", "État civil & scolarité"], ...(voitPaiements ? [["paiements", "Paiements"]] : [])];

  const supprimer = async () => {
    if (await confirmer({ message: `Supprimer définitivement cet ${L.s} ?`, confirmer: "Supprimer" })) {
      wrap(async () => {
        await api.supprimerEleve(eleve.id);
        navigate("/eleves");
      }, `${L.S} supprimé.`);
    }
  };

  return (
    <>
      {/* Bandeau d'identité (refonte) : qui est l'élève, d'un coup d'œil,
          puis les onglets. Remplace l'en-tête générique de page. */}
      <div className="border-b border-navy-900/10 bg-white px-4 pt-5 sm:px-8">
        <nav className="text-sm text-navy-900/60" aria-label="Fil d'Ariane">
          <button onClick={() => navigate("/eleves")} className="font-medium text-navy-700 hover:text-or-600">{L.P}</button>
          {inscCourante?.classes?.libelle && <> › {inscCourante.classes.libelle}</>}
          {" › "}<span className="text-navy-900">{eleve.prenom} {eleve.nom}</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="flex flex-col items-center">
            <Photo
              bucket="eleves"
              valeur={eleve.photo_url}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover"
              fallback={
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-violet-500 font-display text-2xl font-bold text-white">
                  {(eleve.prenom?.[0] || "").toUpperCase()}{(eleve.nom?.[0] || "").toUpperCase()}
                </span>
              }
            />
            {peutEditer && (
              <label className="mt-1.5 cursor-pointer text-xs text-navy-700 hover:text-or-600">
                {photoEnCours ? "Envoi…" : eleve.photo_url ? "Changer" : "Ajouter une photo"}
                <input
                  type="file" accept="image/*" className="hidden" disabled={photoEnCours}
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    setPhotoEnCours(true);
                    await wrap(async () => {
                      const url = await api.televerserPhoto(ecoleId, eleve.id, file);
                      await api.majEleve(eleve.id, { photo_url: url });
                    });
                    setPhotoEnCours(false);
                  }}
                />
              </label>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-navy-900">{eleve.prenom} {eleve.nom}</h1>
              {inscCourante
                ? <Badge ton={inscCourante.statut === "abandon" ? "neutre" : inscCourante.statut === "transfere" ? "info" : "success"}>{LIBELLE_STATUT[inscCourante.statut] || inscCourante.statut}</Badge>
                : <Badge>Non inscrit</Badge>}
            </div>
            <p className="mt-1 text-sm text-navy-900/60">
              {[inscCourante?.classes?.libelle, eleve.matricule && `Matricule ${eleve.matricule}`, age != null && `${age} ans`,
                eleve.date_naissance && `${eleve.sexe === "F" ? "née" : "né"} le ${dateFr(eleve.date_naissance)}${eleve.lieu_naissance ? ` à ${eleve.lieu_naissance}` : ""}`]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Bouton variante="fantome" onClick={() => setCarteOuverte(true)}>🪪 Carte scolaire</Bouton>
            {peutEditer && (
              <Bouton onClick={() => setModaleInscr(true)} disabled={!annee || classes.length === 0}>
                {inscCourante ? "Changer de classe" : "Inscrire"}
              </Bouton>
            )}
          </div>
        </div>
        <div className="mt-5"><Onglets items={onglets} actif={onglet} onChange={setOnglet} /></div>
      </div>

      <div className="p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {onglet === "apercu" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Résumé des paiements de l'année */}
            {voitPaiements && (
              <Carte className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy-900/60">Paiements {annee?.libelle}</p>
                  {echeancier && <BadgeStatut statut={echeancier.statut} />}
                </div>
                {echeancier === undefined ? <Skeleton className="mt-3 h-16" /> : <ResumePaiement donnees={echeancier} devise={ecole?.devise || "XOF"} />}
                <button onClick={() => setOnglet("paiements")} className="mt-3 text-sm font-medium text-navy-700 hover:text-or-600">Voir l'échéancier →</button>
              </Carte>
            )}

            {/* Inscription de l'année */}
            <Carte className="p-5">
              <p className="text-sm font-medium text-navy-900/60">Inscription {annee?.libelle}</p>
              {inscCourante ? (
                <>
                  <p className="mt-2 font-display text-2xl font-bold text-navy-900">
                    {inscCourante.classes?.libelle || "—"}
                    {inscCourante.sous_niveaux?.libelle && (
                      <span className="ml-2 rounded-full bg-sky-500/10 px-2 py-0.5 align-middle text-xs font-medium text-sky-700">{inscCourante.sous_niveaux.libelle}</span>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-navy-900/60">{inscriptions.length > 1 ? `${inscriptions.length} années dans l'établissement` : "Première année dans l'établissement"}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-navy-900/60">Pas encore inscrit pour l'année en cours.</p>
              )}
            </Carte>

            {/* Repères */}
            <Carte className="p-5">
              <p className="text-sm font-medium text-navy-900/60">Repères</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Info label="Sexe" valeur={eleve.sexe === "M" ? "Masculin" : eleve.sexe === "F" ? "Féminin" : "—"} />
                <Info label="Nationalité" valeur={eleve.nationalite || "—"} />
                <Info label="Responsables" valeur={String(tuteurs.length)} />
                {fratrie.length > 0 && <Info label="Fratrie" valeur={`${fratrie.length + 1} enfants`} />}
              </dl>
            </Carte>

            {/* Responsables */}
            <Carte className="p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-navy-900">Responsables</h3>
              </div>
              {tuteurs.length === 0 ? (
                <p className="text-sm text-navy-900/60">Aucun responsable enregistré.</p>
              ) : (
                <ul className="space-y-3">
                  {tuteurs.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-xl border border-navy-900/10 px-4 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900/5 text-sm font-bold text-navy-900">
                        {(t.tuteurs.prenom?.[0] || "").toUpperCase()}{(t.tuteurs.nom?.[0] || "").toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-900">
                          {t.tuteurs.prenom} {t.tuteurs.nom}
                          {t.lien_parente && <span className="ml-1.5 text-sm font-normal text-navy-900/60">· {t.lien_parente}</span>}
                        </p>
                        <p className="text-sm text-navy-900/60">
                          {t.tuteurs.telephone || "—"}
                          {t.tuteurs.profil_id ? <span className="ml-2 text-emerald-700">· appli activée ✓</span> : <span className="ml-2">· pas encore dans l'appli</span>}
                          {t.responsable_paiement && <span className="ml-2 text-or-600">· paiement</span>}
                          {t.responsable_legal && <span className="ml-2">· légal</span>}
                        </p>
                      </div>
                      {(peutEditer || gereParents || (t.tuteurs.profil_id && peutMessage)) && (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {t.tuteurs.profil_id && peutMessage && (
                          <button
                            onClick={() => navigate(`/messagerie?parent=${t.tuteurs.profil_id}&nom=${encodeURIComponent(`${t.tuteurs.prenom} ${t.tuteurs.nom}`)}&eleve=${encodeURIComponent(`${eleve?.prenom || ""} ${eleve?.nom || ""}`.trim())}`)}
                            className="text-xs font-medium text-navy-700 hover:text-or-600"
                          >
                            ✉️ Message
                          </button>
                        )}
                        {codes[t.tuteurs.id] ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="rounded-lg bg-or-500/15 px-2 py-1 font-mono text-xs font-bold tracking-widest text-or-600">
                              {codes[t.tuteurs.id]}
                            </span>
                            {t.tuteurs.telephone && (
                              <a
                                href={lienWhatsApp(
                                  t.tuteurs.telephone,
                                  `Bonjour, voici votre accès à l'espace parent GesSchool pour suivre ${`${eleve?.prenom || ""} ${eleve?.nom || ""}`.trim()} (notes, absences, paiements).\n\n1) Ouvrez ${window.location.origin}\n2) Créez votre compte\n3) Entrez le code : ${codes[t.tuteurs.id]}`,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                              >
                                💬 Envoyer par WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              setErreur("");
                              try {
                                const code = await genererCodeTuteur(t.tuteurs.id);
                                setCodes((s) => ({ ...s, [t.tuteurs.id]: code }));
                              } catch (e) { setErreur(e.message); }
                            }}
                            className="text-xs text-navy-700 hover:text-or-600"
                          >
                            Code parent
                          </button>
                        )}
                        {peutEditer && (
                          <button onClick={() => wrap(() => api.retirerLienTuteur(t.id))} className="text-xs text-rose-700 hover:underline">
                            retirer
                          </button>
                        )}
                      </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {peutEditer && (
                <button onClick={() => setModaleTuteur(true)}
                  className="mt-4 w-full rounded-lg border border-dashed border-navy-900/25 py-2 text-sm font-medium text-navy-900/70 hover:border-navy-900/50 hover:text-navy-900">
                  + Ajouter un responsable
                </button>
              )}
            </Carte>

            {/* Fratrie : les élèves qui ont un responsable en commun */}
            {fratrie.length > 0 && (
              <Carte className="p-6">
                <h3 className="mb-3 font-semibold text-navy-900">
                  Fratrie <span className="text-sm font-normal text-navy-900/60">· {fratrie.length + 1} enfants inscrits</span>
                </h3>
                <ul className="space-y-2">
                  {fratrie.map((f) => (
                    <li key={f.eleve_id}>
                      <button onClick={() => { setOnglet("apercu"); navigate(`/eleves/${f.eleve_id}`); }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-navy-900/10 px-4 py-2.5 text-left text-sm hover:border-or-500">
                        <span className={`font-medium ${(f.statut && etatPaiement(f.statut).texte) || "text-navy-900"}`}>
                          {f.prenom} {f.nom}
                          <span className="ml-2 text-xs font-normal text-navy-900/60">{f.classe || "—"}</span>
                        </span>
                        {f.statut && <BadgeStatut statut={f.statut} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </Carte>
            )}
          </div>
        )}

        {onglet === "scolarite" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Carte className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-navy-900">État civil</h3>
                {peutEditer && (
                  <button onClick={() => setModaleEdit(true)} className="text-sm font-medium text-navy-700 hover:text-or-600">
                    Modifier
                  </button>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <Info label="Matricule" valeur={eleve.matricule} mono />
                <Info label="Sexe" valeur={eleve.sexe === "M" ? "Masculin" : eleve.sexe === "F" ? "Féminin" : "—"} />
                <Info label="Naissance" valeur={eleve.date_naissance ? dateFr(eleve.date_naissance) : "—"} />
                <Info label="Lieu" valeur={eleve.lieu_naissance || "—"} />
                <Info label="Nationalité" valeur={eleve.nationalite || "—"} />
                <Info label="Adresse" valeur={eleve.adresse || "—"} />
                {champsPerso.map((c) => (
                  <Info key={c.cle} label={c.libelle} valeur={eleve.champs_perso?.[c.cle] || "—"} />
                ))}
              </dl>
              {peutEditer && (
                <Bouton variante="fantome" className="mt-5 w-full text-rose-700" onClick={supprimer}>
                  Supprimer l'{L.s}
                </Bouton>
              )}
            </Carte>

            <Carte className="p-6 lg:col-span-2">
              <h3 className="mb-4 font-semibold text-navy-900">Inscriptions</h3>
              {inscriptions.length === 0 ? (
                <p className="text-sm text-navy-900/60">Aucune inscription.</p>
              ) : (
                <ul className="divide-y divide-navy-900/5">
                  {inscriptions.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="font-medium text-navy-900">
                        {i.classes?.libelle || "—"}
                        {/* Le niveau réel, quand la classe en regroupe plusieurs :
                            « TPS/PS A · TPS ». Saisi sans être lu, il ne servirait à rien. */}
                        {i.sous_niveaux?.libelle && (
                          <span className="ml-1.5 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            {i.sous_niveaux.libelle}
                          </span>
                        )}
                      </span>
                      <span className="text-navy-900/60">{i.annees_scolaires?.libelle}</span>
                      <Badge ton={i.statut === "abandon" ? "neutre" : i.statut === "transfere" ? "info" : "success"}>{LIBELLE_STATUT[i.statut] || i.statut}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        )}

        {/* Paiements de l'année : mois payés, dus, à venir (mig. 210) */}
        {onglet === "paiements" && voitPaiements && (
          <Carte className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-navy-900">
                Paiements {annee?.libelle ? `· ${annee.libelle}` : ""}
              </h3>
              <div className="flex items-center gap-2">
                {echeancier && <BadgeStatut statut={echeancier.statut} />}
                {gereTarif && echeancier && (
                  <button onClick={() => setModaleTarif(true)} className="text-sm font-medium text-navy-700 hover:text-or-600">Tarif</button>
                )}
              </div>
            </div>
            {echeancier === undefined ? (
              <p className="text-sm text-navy-900/60">Chargement…</p>
            ) : (
              <>
                <NoteTarif tarif={echeancier.tarif} />
                <Echeancier donnees={echeancier} />
              </>
            )}
          </Carte>
        )}
      </div>

      <ModaleTarif
        ouvert={modaleTarif}
        onFermer={() => setModaleTarif(false)}
        tarif={echeancier?.tarif}
        onEnregistrer={async (t) => {
          try {
            await definirTarifEleve(id, t);
            //  « Nouvel élève » (mig. 211) : seulement s'il a changé.
            if (t.nouveau !== undefined && t.nouveau !== (echeancier?.tarif?.nouveau_saisi ?? null)) {
              await definirNouveauEleve(id, t.nouveau);
            }
            setModaleTarif(false);
            toast.succes("Tarif enregistré.");
            chargerPaiement();
          } catch (e) { toast.erreur(e.message || "Une erreur est survenue."); }
        }}
      />

      {/* Modale édition élève */}
      <ModaleEditEleve
        ouvert={modaleEdit}
        onFermer={() => setModaleEdit(false)}
        eleve={eleve}
        champs={champsPerso}
        onEnregistrer={(maj) => wrap(async () => { await api.majEleve(eleve.id, maj); setModaleEdit(false); })}
      />

      {/* Modale ajout tuteur */}
      <ModaleTuteur
        ouvert={modaleTuteur}
        onFermer={() => setModaleTuteur(false)}
        onAjout={(t, lien) => wrap(async () => { await api.ajouterTuteur(ecoleId, id, t, lien); setModaleTuteur(false); })}
      />

      {/* Modale inscription */}
      <ModaleInscription
        ouvert={modaleInscr}
        onFermer={() => setModaleInscr(false)}
        classes={classes}
        sousNiveaux={sousNiveaux}
        annee={annee}
        onInscrire={(classeId, redoublant, sousNiveauId) =>
          wrap(async () => { await api.inscrire(ecoleId, id, classeId, annee.id, "inscrit", redoublant, sousNiveauId); setModaleInscr(false); })
        }
      />

      {/* Carte scolaire (badge imprimable) */}
      <Modale ouvert={carteOuverte} onFermer={() => setCarteOuverte(false)} titre="Carte scolaire">
        <div className="zone-impression">
          <div className="mx-auto w-[340px] overflow-hidden rounded-2xl border-2 border-navy-900">
            <div className="flex items-center gap-2 bg-navy-900 px-3 py-2 text-creme">
              {ecole?.logo_url
                ? <img src={ecole.logo_url} alt="" className="h-9 w-9 shrink-0 rounded bg-white object-contain" />
                : <div className="grid h-9 w-9 place-items-center rounded bg-white/10 text-xs font-bold">{ecole?.sigle || "GS"}</div>}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">{ecole?.nom}</p>
                <p className="text-[10px] uppercase tracking-wide text-creme/70">Carte scolaire · {annee?.libelle || ""}</p>
              </div>
            </div>
            <div className="flex gap-3 p-3">
              {eleve.photo_url
                ? <img src={eleve.photo_url} alt="" className="h-24 w-20 shrink-0 rounded-lg border border-navy-900/15 object-cover" />
                : <div className="grid h-24 w-20 shrink-0 place-items-center rounded-lg border border-dashed border-navy-900/20 text-3xl text-navy-900/20">👤</div>}
              <div className="min-w-0 text-xs text-navy-900/70">
                <p className="text-sm font-bold text-navy-900">{eleve.nom} {eleve.prenom}</p>
                <p className="mt-1"><span className="text-navy-900/40">Matricule :</span> {eleve.matricule || "—"}</p>
                <p><span className="text-navy-900/40">Classe :</span> {(() => {
                  const i = inscriptions.find((x) => x.annee_id === annee?.id);
                  if (!i) return "—";
                  return `${i.classes?.libelle || "—"}${i.sous_niveaux?.libelle ? ` · ${i.sous_niveaux.libelle}` : ""}`;
                })()}</p>
                <p><span className="text-navy-900/40">Sexe :</span> {eleve.sexe === "F" ? "Féminin" : eleve.sexe === "M" ? "Masculin" : "—"}</p>
                <p><span className="text-navy-900/40">Né(e) le :</span> {eleve.date_naissance ? new Date(eleve.date_naissance).toLocaleDateString("fr-FR") : "—"}</p>
              </div>
            </div>
            <div className="border-t border-navy-900/10 px-3 py-1.5 text-center text-[10px] text-navy-900/40">
              {[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="no-print mt-4 flex justify-end">
          <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
        </div>
      </Modale>
    </>
  );
}

const LIBELLE_STATUT = { inscrit: "Inscrit", reinscrit: "Réinscrit", transfere: "Transféré", abandon: "Abandon" };

// « 2016-03-12 » → « 12 mars 2016 », découpé sans passer par un fuseau horaire.
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateFr(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${Number(m[3])} ${MOIS_FR[Number(m[2]) - 1]} ${m[1]}` : d || "";
}

function ageDe(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  if (!m) return null;
  const auj = new Date();
  let a = auj.getFullYear() - Number(m[1]);
  if (auj.getMonth() + 1 < Number(m[2]) || (auj.getMonth() + 1 === Number(m[2]) && auj.getDate() < Number(m[3]))) a -= 1;
  return a >= 0 && a < 120 ? a : null;
}

// Résumé de l'échéancier pour l'aperçu : payé sur l'année, barre, prochaine
// échéance. Le détail reste dans l'onglet Paiements.
function ResumePaiement({ donnees, devise }) {
  const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
  if (donnees?.statut === "exonere") return <p className="mt-3 text-sm text-navy-900/70">Élève exonéré : rien n'est dû cette année.</p>;
  const lignes = donnees?.lignes || [];
  if (lignes.length === 0) return <p className="mt-3 text-sm text-navy-900/60">Aucun frais défini pour cette classe.</p>;
  const r = resumeEcheancier(lignes);
  const part = r.totalAnnee > 0 ? Math.min(100, (r.totalPaye / r.totalAnnee) * 100) : 0;
  const prochaine = lignes.find((l) => l.etat !== "paye" && l.etat !== "en_retard");
  return (
    <>
      <p className="mt-2 font-display text-2xl font-bold text-navy-900">
        {fmt(r.totalPaye)} <span className="text-sm font-medium text-navy-900/60">/ {fmt(r.totalAnnee)} {devise}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-900/10">
        <div className={`h-full rounded-full ${r.totalDu > 0 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${part}%` }} />
      </div>
      <p className="mt-3 text-sm text-navy-900/70">
        {r.totalDu > 0
          ? <>Dû aujourd'hui : <b className="text-rose-700">{fmt(r.totalDu)} {devise}</b></>
          : prochaine
            ? <>Prochaine échéance : <b className="text-navy-900">{fmt(prochaine.montant)} {devise}</b>{prochaine.echeance ? ` le ${dateFr(prochaine.echeance)}` : ""}</>
            : "Année entièrement réglée."}
      </p>
    </>
  );
}

function Info({ label, valeur, mono }) {
  return (
    <div className="flex justify-between border-b border-navy-900/5 pb-1.5">
      <dt className="text-navy-900/50">{label}</dt>
      <dd className={`font-medium text-navy-900 ${mono ? "font-mono text-xs" : ""}`}>{valeur}</dd>
    </div>
  );
}

function ModaleEditEleve({ ouvert, onFermer, eleve, champs = [], onEnregistrer }) {
  const { ecole } = useAuth();
  const M = motEleve(ecole?.type_etablissement);
  const [f, setF] = useState({});
  useEffect(() => {
    if (eleve) setF({
      prenom: eleve.prenom || "", nom: eleve.nom || "", sexe: eleve.sexe || "",
      date_naissance: eleve.date_naissance || "", lieu_naissance: eleve.lieu_naissance || "",
      nationalite: eleve.nationalite || "", adresse: eleve.adresse || "",
      champs_perso: { ...(eleve.champs_perso || {}) },
    });
  }, [eleve, ouvert]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const majPerso = (cle, v) => setF((s) => ({ ...s, champs_perso: { ...s.champs_perso, [cle]: v } }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={`Modifier l'${M}`} large>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onEnregistrer({
            prenom: f.prenom.trim(), nom: f.nom.trim(), sexe: f.sexe || null,
            date_naissance: f.date_naissance || null, lieu_naissance: f.lieu_naissance || null,
            nationalite: f.nationalite || null, adresse: f.adresse || null,
            champs_perso: f.champs_perso || {},
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={f.prenom || ""} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={f.nom || ""} onChange={(e) => maj("nom", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Sexe</span>
            <select
              value={f.sexe || ""} onChange={(e) => maj("sexe", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </label>
          <Champ label="Naissance" type="date" value={f.date_naissance || ""} onChange={(e) => maj("date_naissance", e.target.value)} />
          <Champ label="Lieu" value={f.lieu_naissance || ""} onChange={(e) => maj("lieu_naissance", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Nationalité" value={f.nationalite || ""} onChange={(e) => maj("nationalite", e.target.value)} />
          <Champ label="Adresse" value={f.adresse || ""} onChange={(e) => maj("adresse", e.target.value)} />
        </div>
        {champs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 border-t border-navy-900/10 pt-4 sm:grid-cols-2">
            {champs.map((c) => (
              c.type === "liste" ? (
                <label key={c.cle} className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{c.libelle}</span>
                  <select value={f.champs_perso?.[c.cle] || ""} onChange={(e) => majPerso(c.cle, e.target.value)}
                    className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                    <option value="">—</option>
                    {(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ) : (
                <Champ key={c.cle} label={c.libelle}
                  type={c.type === "nombre" ? "number" : c.type === "date" ? "date" : "text"}
                  value={f.champs_perso?.[c.cle] || ""} onChange={(e) => majPerso(c.cle, e.target.value)} />
              )
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.prenom?.trim() || !f.nom?.trim()}>Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleTuteur({ ouvert, onFermer, onAjout }) {
  const [t, setT] = useState({ prenom: "", nom: "", telephone: "", email: "", profession: "", lien: "Parent" });
  const maj = (k, v) => setT((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Ajouter un responsable">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAjout(
            { prenom: t.prenom.trim(), nom: t.nom.trim(), telephone: t.telephone, email: t.email, profession: t.profession },
            { lien_parente: t.lien, responsable_legal: true, responsable_paiement: true }
          );
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={t.prenom} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={t.nom} onChange={(e) => maj("nom", e.target.value)} required />
          <Champ label="Téléphone" type="tel" value={t.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          <Champ label="Lien" value={t.lien} onChange={(e) => maj("lien", e.target.value)} />
          <Champ label="E-mail" value={t.email} onChange={(e) => maj("email", e.target.value)} />
          <Champ label="Profession" value={t.profession} onChange={(e) => maj("profession", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!t.prenom.trim() || !t.nom.trim()}>Ajouter</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleInscription({ ouvert, onFermer, classes, sousNiveaux = [], annee, onInscrire }) {
  const [classeId, setClasseId] = useState("");
  const [redoublant, setRedoublant] = useState(false);
  const [sousNiveauId, setSousNiveauId] = useState("");
  // Sous-niveaux de la classe choisie — vide pour un niveau simple, et le
  // champ n'apparaît alors pas du tout (migration 164).
  const choix = sousNiveauxDeClasse(sousNiveaux, classes, classeId);
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={`Inscription — ${annee?.libelle || ""}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (classeId) onInscrire(classeId, redoublant, sousNiveauId || null);
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Classe *</span>
          <select
            value={classeId} onChange={(e) => { setClasseId(e.target.value); setSousNiveauId(""); }} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          >
            <option value="">— Choisir —</option>
            {classes.map((c) => (<option key={c.id} value={c.id}>{c.libelle}</option>))}
          </select>
        </label>
        {/* N'apparaît que si la classe regroupe plusieurs niveaux : « TPS/PS »
            contient des TPS et des PS. Facultatif — sans choix, l'élève garde
            le niveau de sa classe. */}
        {choix.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">
              Niveau dans la classe <span className="font-normal text-navy-900/45">(facultatif)</span>
            </span>
            <select value={sousNiveauId} onChange={(e) => setSousNiveauId(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— niveau de la classe —</option>
              {choix.map((x) => (<option key={x.id} value={x.id}>{x.libelle}</option>))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-navy-900/70">
          <input type="checkbox" checked={redoublant} onChange={(e) => setRedoublant(e.target.checked)} />
          Redoublant
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!classeId}>Valider</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// Ce que l'élève paie, quand ce n'est pas le tarif de sa classe.
function NoteTarif({ tarif }) {
  if (!tarif) return null;
  const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
  if (tarif.exonere) {
    return <p className="mb-3 rounded-lg bg-navy-900/5 px-3 py-2 text-xs text-navy-900/70">Exonéré : rien n'est dû.</p>;
  }
  const special = tarif.mensualite != null || (tarif.tarif_niveau != null && Number(tarif.montant) !== Number(tarif.tarif_niveau));
  if (!special) return null;
  const pourquoi = tarif.mensualite == null ? "réduction de fratrie" : tarif.motif === "fratrie" ? "fratrie" : "tarif propre";
  return (
    <p className="mb-3 rounded-lg bg-or-500/10 px-3 py-2 text-xs text-navy-900/70">
      Mensualité de l'élève : <b>{fmt(tarif.montant)} XOF</b>
      {tarif.tarif_niveau != null && <> au lieu de {fmt(tarif.tarif_niveau)}</>} ({pourquoi}).
    </p>
  );
}

// Le tarif propre à l'élève (mig. 210) : mensualité, motif, exonération.
// Vide = le tarif du niveau, moins la règle de fratrie éventuelle.
function ModaleTarif({ ouvert, onFermer, tarif, onEnregistrer }) {
  const [mensualite, setMensualite] = useState("");
  const [motif, setMotif] = useState("fratrie");
  const [exonere, setExonere] = useState(false);
  // "" = déduit (aucune inscription antérieure) · "oui" · "non"
  const [nouveau, setNouveau] = useState("");
  const avecNouveau = tarif && "nouveau" in tarif;
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    if (!ouvert) return;
    setMensualite(tarif?.mensualite != null ? String(Number(tarif.mensualite)) : "");
    setMotif(tarif?.motif && tarif.motif !== "exonere" ? tarif.motif : "fratrie");
    setExonere(!!tarif?.exonere);
    setNouveau(tarif?.nouveau_saisi === true ? "oui" : tarif?.nouveau_saisi === false ? "non" : "");
  }, [ouvert, tarif]);
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Tarif de l'élève">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setEnCours(true);
        try {
          await onEnregistrer({
            mensualite: exonere ? null : mensualite, motif, exonere,
            ...(avecNouveau ? { nouveau: nouveau === "oui" ? true : nouveau === "non" ? false : null } : {}),
          });
        }
        finally { setEnCours(false); }
      }}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={exonere} onChange={(e) => setExonere(e.target.checked)} />
          Exonéré — l'élève ne paie ni l'inscription ni les mensualités
        </label>
        {!exonere && (
          <>
            <Champ label="Mensualité de l'élève (XOF)" type="number" min="0" step="500"
              value={mensualite} onChange={(e) => setMensualite(e.target.value)}
              placeholder={tarif?.tarif_niveau != null ? `Tarif de la classe : ${Number(tarif.tarif_niveau).toLocaleString("fr-FR")}` : ""} />
            <p className="-mt-2 text-xs text-navy-900/50">Laisser vide pour appliquer le tarif de la classe (et la règle de fratrie).</p>
            <label className="block text-sm">
              <span className="mb-1 block text-navy-900/70">Motif</span>
              <select value={motif} onChange={(e) => setMotif(e.target.value)}
                className="w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
                <option value="fratrie">Fratrie</option>
                <option value="autre">Autre</option>
              </select>
            </label>
          </>
        )}
        {avecNouveau && (
          <label className="block text-sm">
            <span className="mb-1 block text-navy-900/70">Cette année, l'élève paie</span>
            <select value={nouveau} onChange={(e) => setNouveau(e.target.value)}
              className="w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Automatique — {tarif.nouveau ? "l'inscription (nouvel élève)" : "la réinscription (ancien)"}</option>
              <option value="oui">L'inscription (nouvel élève)</option>
              <option value="non">La réinscription (ancien élève)</option>
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
