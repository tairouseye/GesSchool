import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import {
  enfantNotes, enfantFactures, enfantAbsences, enfantEmploi, enfantFournitures,
  ecolePaiementInfos, declarerPaiement, televerserPreuve, enfantDeclarations, justifierAbsenceParent,
  enfantBulletins, enfantBulletinLignes, demanderDocument, mesDemandes, TYPES_DOCUMENT,
  enfantCantine, enfantMenuCantine, enfantTransport, mesEnfants,
  alertesEnfant, marquerAlertesLues, monAccesNotes, demanderAccesNotes,
  enfantFactureDetail, avanceOptions, declarerAvance, enfantEcheancier, enfantProgramme,
} from "@/lib/parent.js";
import { MOIS as MOIS_PROGRAMME } from "@/lib/programmationIEF.js";
import { BadgeStatut } from "@/composants/Echeancier.jsx";
import { etat as etatPaiement, resumeEcheancier, objetFacture, lignesDetail, libelleLigne } from "@/lib/paiementStatut.js";
import { grouperParMois, choixParDefaut, basculerMois, totalDesMois, resumeMois, avancesCouvertes, reglerRetard } from "@/lib/avance.js";
import {
  facturesVisibles, syntheseFactures, resteFacture, etatFacture, peutPayer, estAnnulee,
  declarationsAffichees, enAttenteParFacture, aDesRecus, recuParDefaut,
} from "@/lib/situationParent.js";
import DocumentCaisse from "@/composants/DocumentCaisse.jsx";
import { fourniParEcole, venduEcole, grouperFournitures, messageFournitures, lienPartageWhatsApp } from "@/lib/fournituresPartage.js";
import { annoncesEnfant } from "@/lib/annonces.js";
import { lienFichier, poids } from "@/lib/fichiers.js";
import { pourGrille, JOURS as JOURS_EMPLOI } from "@/lib/emploi.js";
import GrilleEmploi from "@/composants/GrilleEmploi.jsx";
import { enfantCahier } from "@/lib/cahier.js";
import { pspEtatEleve, initierPaiement } from "@/lib/paiementEnLigne.js";
import { Icone } from "@/composants/Icones.jsx";
import SceauVerification from "@/composants/SceauVerification.jsx";
import { codeBulletinId, codeFacture } from "@/lib/verification.js";
import { Bouton, Champ, Carte, Alerte, Modale, SkeletonListe } from "@/composants/ui.jsx";
import Photo from "@/composants/Photo.jsx";
import { enfantAcquis } from "@/lib/acquis.js";
import { valeur as valeurAcquis } from "@/lib/acquisEchelle.js";
import { messageErreur } from "@/lib/erreurs.js";
import { resumeRubriques, tonNote } from "@/lib/apercuEnfant.js";
import { pastillePaiement, prochainCours, couleurEnfant, ageEnfant } from "@/lib/accueilParent.js";
import { dateFr } from "@/lib/dates.js";

const MODES_MOBILE = [["wave", "Wave"], ["orange_money", "Orange Money"], ["free_money", "Free Money"]];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const fmtDate = (d) =>
  (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");
//  La devise de l'école de l'enfant (mig. 220, lot 4) : un « XOF » écrit en
//  dur donnait une monnaie fausse aux écoles en CDF ou en GNF. XOF reste le
//  repli tant que la migration n'est pas appliquée.
const DeviseCtx = createContext("XOF");
const useDevise = () => useContext(DeviseCtx);

export default function ParentEnfant() {
  //  ⚠️ LA RUBRIQUE OUVERTE VIT DANS L'ADRESSE (/parent/enfant/:id/:rubrique),
  //  plus dans un état local. Avant, le bouton retour d'Android quittait la
  //  fiche de l'enfant au lieu de revenir à la rubrique précédente, et aucune
  //  alerte ne pouvait mener directement à « Paiements ».
  const { id, rubrique } = useParams();
  //  Changer d'enfant : le panneau vit dans la coque (ParentLayout). Le bouton
  //  est ici, à côté du retour : dans l'en-tête, il coupait le nom de l'école.
  const { choisirEnfant, nbEnfants = 0 } = useOutletContext() || {};
  const lienRubrique = (cle) => (cle ? `/parent/enfant/${id}/${cle}` : `/parent/enfant/${id}`);
  const [enfant, setEnfant] = useState(null);
  const [notes, setNotes] = useState([]);
  const [factures, setFactures] = useState([]);
  //  L'échéancier, dès la fiche : la tuile Paiements doit dire la même chose
  //  que l'accueil et que la rubrique. Elle lisait les seules factures et
  //  affichait « Tout est réglé ✓ » à 70 familles de Tut'Tank en retard sur
  //  un mois sans facture (relevé du 05/11/2026).
  const [echeancier, setEcheancier] = useState(undefined);
  const [absences, setAbsences] = useState([]);
  const [emploi, setEmploi] = useState([]);
  const [fournitures, setFournitures] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [infos, setInfos] = useState({});
  const [declarations, setDeclarations] = useState([]);
  const [cahier, setCahier] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [cantine, setCantine] = useState(null);
  const [menu, setMenu] = useState([]);
  const [transport, setTransport] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  //  Échec PARTIEL du chargement initial (une requête sur six) : on le dit,
  //  sans vider ce qui a pu être lu.
  const [erreurInitiale, setErreurInitiale] = useState("");
  //  `mes_enfants` a répondu, mais cet enfant n'y est pas (adresse modifiée,
  //  enfant détaché) : la base refuse déjà tout, on l'explique.
  const [inconnu, setInconnu] = useState(false);

  const [acquis, setAcquis] = useState([]);   // suivi des acquis (préscolaire, mig. 172)
  const [aDesAcquis, setADesAcquis] = useState(false);
  const [alertes, setAlertes] = useState({}); // pastilles « nouveau » par catégorie
  const [acces, setAcces] = useState({ requiert: false, statut: null }); // consentement notes (supérieur)

  const loadedRef = useRef(new Set());      // sections chargées ou en cours (dédup)
  //  État de chaque rubrique : absent = en cours, { ok } = chargée,
  //  { erreur } = échec. ⚠️ Avant, un échec laissait le squelette affiché
  //  pour toujours : seul le succès marquait la rubrique comme chargée.
  const [etats, setEtats] = useState({});

  //  L'enfant affiché. Une réponse qui arrive APRÈS un changement d'enfant
  //  (connexion lente) est ignorée : sans ce garde, les notes de l'aîné
  //  pouvaient s'afficher sous le nom du cadet.
  const enfantCourant = useRef(id);
  useEffect(() => { enfantCourant.current = id; }, [id]);

  // Sections disponibles (Cantine/Transport seulement si abonnement).
  //  La tuile « Suivi des acquis » n'apparaît que lorsque l'école a
  //  observé quelque chose. On la sonde une fois, au chargement initial :
  //  proposer une tuile vide ferait croire à un oubli de l'enseignante.
  const tuiles = TUILES.filter((t) =>
    (t.cle !== "cantine" || cantine)
    && (t.cle !== "transport" || transport)
    && (t.cle !== "acquis" || aDesAcquis));

  // Rubrique de l'adresse : inconnue → accueil en tuiles. Une rubrique connue
  // mais absente pour cet enfant (pas d'abonnement cantine…) ne retombe sur
  // l'accueil qu'une fois le chargement fini, pour ne pas refuser trop tôt une
  // tuile dont l'information arrive.
  const demandee = TUILES.some((t) => t.cle === rubrique) ? rubrique : null;
  const onglet = demandee && !chargement && !tuiles.some((t) => t.cle === demandee) ? null : demandee;

  // Chargement INITIAL minimal : en-tête (enfant), badges (factures, demandes)
  // et visibilité des tuiles Cantine/Transport. Le reste est chargé à l'ouverture
  // de chaque section (lazy-load) → page enfant bien plus légère sur mobile.
  //
  // ⚠️ `allSettled`, pas `all` : un seul échec (la cantine, par exemple)
  // vidait TOUT — factures comprises — et la rubrique Paiements annonçait
  // ensuite « Aucune facture » à un parent qui en avait.
  const chargerInitial = useCallback(async () => {
    const pour = id;
    const [enf, f, dem, can, tra, al, ech] = await Promise.allSettled([
      mesEnfants(), enfantFactures(id), mesDemandes(), enfantCantine(id), enfantTransport(id), alertesEnfant(id),
      enfantEcheancier(id),
    ]);
    if (enfantCourant.current !== pour) return;
    const val = (r, defaut) => (r.status === "fulfilled" ? r.value ?? defaut : defaut);
    const liste = enf.status === "fulfilled" ? enf.value || [] : null;
    setEnfant(liste ? liste.find((x) => x.eleve_id === pour) || null : null);
    setInconnu(liste != null && !liste.some((x) => x.eleve_id === pour));
    setFactures(val(f, [])); setDemandes(val(dem, [])); setCantine(val(can, null)); setTransport(val(tra, null));
    setAlertes(val(al, {}));
    setEcheancier(val(ech, null));
    const echec = [enf, f, dem, can, tra].find((r) => r.status === "rejected");
    setErreurInitiale(echec ? echec.reason?.message || "Erreur de chargement." : "");
    //  Sonde discrète : si la RPC refuse (consentement non accordé) ou ne
    //  rend rien, la tuile reste simplement absente.
    enfantAcquis(pour, null)
      .then((a) => { if (enfantCourant.current === pour) setADesAcquis((a || []).length > 0); })
      .catch(() => { if (enfantCourant.current === pour) setADesAcquis(false); });
  }, [id]);

  // Charge les données d'UNE section, une seule fois (sauf `force`).
  //  Chaque rubrique relit ce qu'elle affiche (Paiements relit les factures,
  //  Documents les demandes…) : un échec du chargement initial ne se
  //  transforme donc jamais en rubrique « vide ».
  const chargerSection = useCallback(async (cle, force = false) => {
    if (!cle || (loadedRef.current.has(cle) && !force)) return;
    loadedRef.current.add(cle);
    const pour = id;
    const appliquer = (fn) => { if (enfantCourant.current === pour) fn(); };
    try {
      if (cle === "notes" || cle === "bulletins" || cle === "acquis") {
        //  Le consentement (supérieur) se relit avec la rubrique : en cas
        //  d'échec, on n'affiche ni « aucune note » ni l'écran de demande.
        const charge = { notes: enfantNotes, bulletins: enfantBulletins, acquis: (e) => enfantAcquis(e, null) }[cle];
        const [acc, d] = await Promise.all([monAccesNotes(id), charge(id)]);
        appliquer(() => {
          setAcces(acc);
          if (cle === "notes") setNotes(d); else if (cle === "bulletins") setBulletins(d); else setAcquis(d);
        });
      }
      else if (cle === "cahier") { const d = await enfantCahier(id); appliquer(() => setCahier(d)); }
      else if (cle === "emploi") { const d = await enfantEmploi(id); appliquer(() => setEmploi(d)); }
      else if (cle === "fournitures") { const d = await enfantFournitures(id); appliquer(() => setFournitures(d)); }
      else if (cle === "absences") { const d = await enfantAbsences(id); appliquer(() => setAbsences(d)); }
      else if (cle === "annonces") { const d = await annoncesEnfant(id); appliquer(() => setAnnonces(d)); }
      else if (cle === "documents") { const d = await mesDemandes(); appliquer(() => setDemandes(d)); }
      else if (cle === "transport") { const d = await enfantTransport(id); appliquer(() => setTransport(d)); }
      else if (cle === "cantine") {
        const [c, m] = await Promise.all([enfantCantine(id), enfantMenuCantine(id)]);
        appliquer(() => { setCantine(c); setMenu(m); });
      }
      else if (cle === "paiements") {
        const [f, i, d] = await Promise.all([enfantFactures(id), ecolePaiementInfos(id), enfantDeclarations(id)]);
        appliquer(() => { setFactures(f); setInfos(i); setDeclarations(d); });
      }
      appliquer(() => setEtats((s) => ({ ...s, [cle]: { ok: true } })));
    } catch (e) {
      appliquer(() => {
        loadedRef.current.delete(cle);
        setEtats((s) => ({ ...s, [cle]: { erreur: e.message || "Erreur de chargement." } }));
      });
    }
  }, [id]);

  // Nouvelle tentative : la rubrique repasse en chargement (squelette).
  const reessayer = (cle) => {
    setEtats((s) => { const n = { ...s }; delete n[cle]; return n; });
    chargerSection(cle, true);
  };

  // Montée / changement d'enfant : (ré)initialise et charge l'essentiel.
  //  Les données de l'enfant précédent sont effacées : jamais affichées,
  //  même un instant, sous le nom du nouveau.
  useEffect(() => {
    setChargement(true);
    loadedRef.current = new Set();
    setEtats({});
    setErreur(""); setErreurInitiale(""); setInconnu(false);
    setEnfant(null); setNotes([]); setBulletins([]); setAcquis([]); setADesAcquis(false);
    setFactures([]); setEcheancier(undefined); setInfos({}); setDeclarations([]); setAbsences([]); setCahier([]);
    setEmploi([]); setFournitures([]); setAnnonces([]); setCantine(null); setMenu([]); setTransport(null);
    setAlertes({}); setAcces({ requiert: false, statut: null });
    chargerInitial().finally(() => { if (enfantCourant.current === id) setChargement(false); });
  }, [chargerInitial, id]);

  const relancerInitial = () => {
    setChargement(true);
    chargerInitial().finally(() => setChargement(false));
  };

  // Grille → rubrique (ou retour) : on repart du haut de la page. Entre deux
  // rubriques, c'est la barre qui ramène au début du contenu.
  const ongletPrecedent = useRef(onglet);
  useEffect(() => {
    const avant = ongletPrecedent.current;
    ongletPrecedent.current = onglet;
    if (avant !== onglet && (avant === null || onglet === null)) window.scrollTo({ top: 0 });
  }, [onglet]);

  // Ouverture d'une section → charge ses données à la demande.
  useEffect(() => { if (onglet) chargerSection(onglet); }, [onglet, chargerSection]);

  // Ouverture d'une section → marque comme lues les alertes de sa catégorie
  // (la pastille « nouveau » disparaît). Le test dans l'updater évite tout appel inutile.
  useEffect(() => {
    const cat = { notes: "note", absences: "absence", paiements: "facture" }[onglet];
    if (!cat) return;
    setAlertes((a) => {
      if (!(a[cat] > 0)) return a;
      marquerAlertesLues(id, cat).catch(() => {});
      return { ...a, [cat]: 0 };
    });
  }, [onglet, id]);

  // Rafraîchit après une action (paiement déclaré, absence justifiée, demande…).
  const rafraichir = async () => {
    await chargerInitial();
    if (onglet) await chargerSection(onglet, true);
  };

  // Consentement (supérieur) : le parent demande l'accès aux notes.
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  async function demanderAcces() {
    setDemandeEnCours(true); setErreur("");
    try { const st = await demanderAccesNotes(id); setAcces((a) => ({ ...a, statut: st || "en_attente" })); }
    catch (e) { setErreur(e.message); }
    finally { setDemandeEnCours(false); }
  }
  const notesGatees = acces.requiert && acces.statut !== "autorise";

  // Badges calculés depuis les données déjà chargées (aucune requête en plus).
  //  `mes_demandes` couvre toute la fratrie : on ne garde que CET enfant
  //  (`eleve_id`, mig. 208). Sans la colonne (base pas encore migrée), on
  //  conserve l'ancien comportement plutôt que de tout masquer.
  const demandesEnfant = demandes.filter((d) => d.eleve_id === undefined || d.eleve_id === id);
  const demandesEnCours = demandesEnfant.filter((d) => d.statut === "en_attente" || d.statut === "en_cours").length;
  const badges = {
    documents: demandesEnCours, notes: alertes.note || 0, absences: alertes.absence || 0,
    annonces: Number(enfant?.annonces_nouvelles) || 0,
  };

  const sectionActive = TUILES.find((t) => t.cle === onglet);

  return (
    <DeviseCtx.Provider value={enfant?.devise || "XOF"}>
    <div className="space-y-5">
      {/*  Un seul chemin, comme sur les écrans de Mme Kane : la fiche revient
          aux enfants, la rubrique revient à la fiche. */}
      <div className="flex items-center justify-between gap-3">
        {onglet === null || inconnu ? (
          <Link to="/parent" className="inline-flex min-h-10 items-center text-sm font-semibold text-navy-900">← Mes enfants</Link>
        ) : (
          <Link to={lienRubrique(null)} className="inline-flex min-h-10 items-center text-sm font-semibold text-navy-900">← {enfant?.prenom || "Mon enfant"}</Link>
        )}
        {enfant && nbEnfants > 1 && choisirEnfant && (
          <button type="button" onClick={choisirEnfant} aria-haspopup="dialog"
            aria-label={`Changer d'enfant (actuellement ${enfant.prenom} ${enfant.nom})`}
            className="flex min-h-10 min-w-0 max-w-[11rem] items-center gap-2 rounded-full border border-navy-900/15 bg-white px-3 text-sm font-semibold text-navy-900">
            <span className="truncate">{enfant.prenom}</span>
            <span aria-hidden="true" className="text-navy-900/60">▾</span>
          </button>
        )}
      </div>
      <Alerte ton="erreur">{erreur}</Alerte>
      {!chargement && !inconnu && erreurInitiale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-or-500/40 bg-or-500/10 px-4 py-3 text-sm text-or-700" role="status">
          <span>Certaines informations n&apos;ont pas pu être chargées ({messageErreur(erreurInitiale)}).</span>
          <button type="button" onClick={relancerInitial}
            className="min-h-10 rounded-lg border border-or-500/50 bg-white px-3 text-xs font-semibold text-navy-900 hover:border-or-600">
            Réessayer
          </button>
        </div>
      )}

      {chargement ? (
        <div role="status" aria-label="Chargement"><SkeletonListe lignes={4} /></div>
      ) : inconnu ? (
        <Carte className="p-6 text-center">
          <p className="font-display text-lg font-semibold text-navy-900">Enfant introuvable</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-navy-900/60">
            Cet enfant n&apos;est pas rattaché à votre compte. Revenez à la liste de vos enfants.
          </p>
          <Link to="/parent" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-creme">
            Mes enfants
          </Link>
        </Carte>
      ) : onglet === null ? (
        <>
          <BandeauEnfant enfant={enfant} eleveId={id} />
          <TuilesEnfant eleveId={id} tuiles={tuiles.filter((t) => !t.horsGrille)} badges={badges} lienRubrique={lienRubrique}
            pastille={pastillePaiement(echeancier, factures)} accent={enfant?.couleur_secondaire}
            alertes={alertes} demandesEnCours={demandesEnCours} />
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl font-bold text-navy-900">{sectionActive?.label}</h2>
          {!etats[onglet] ? (
        <div role="status" aria-label={`Chargement : ${sectionActive?.label || "rubrique"}`}><SkeletonListe lignes={4} /></div>
      ) : etats[onglet].erreur ? (
        <ErreurRubrique message={etats[onglet].erreur} onReessayer={() => reessayer(onglet)} />
      ) : onglet === "notes" ? (
        notesGatees ? <ConsentementNotes statut={acces.statut} enCours={demandeEnCours} onDemander={demanderAcces} /> : <Notes notes={notes} lienBulletins={lienRubrique("bulletins")} />
      ) : onglet === "bulletins" ? (
        notesGatees ? <ConsentementNotes statut={acces.statut} enCours={demandeEnCours} onDemander={demanderAcces} /> : <Bulletins bulletins={bulletins} />
      ) : onglet === "acquis" ? (
        notesGatees
          ? <ConsentementNotes statut={acces.statut} enCours={demandeEnCours} onDemander={demanderAcces} />
          : <Acquis lignes={acquis} />
      ) : onglet === "cahier" ? (
        <Cahier entrees={cahier} />
      ) : onglet === "emploi" ? (
        <Emploi creneaux={emploi} enfant={enfant} />
      ) : onglet === "fournitures" ? (
        <Fournitures items={fournitures} enfant={enfant} />
      ) : onglet === "annonces" ? (
        <AnnoncesEnfant items={annonces} enfant={enfant} />
      ) : onglet === "paiements" ? (
        <Paiements factures={factures} infos={infos} declarations={declarations} eleveId={id} onChange={rafraichir} />
      ) : onglet === "programme" ? (
        <ProgrammeDuMois eleveId={id} />
      ) : onglet === "documents" ? (
        <Documents eleveId={id} demandes={demandesEnfant} onChange={rafraichir} />
      ) : onglet === "cantine" ? (
        <CantineParent cantine={cantine} menu={menu} />
      ) : onglet === "transport" ? (
        <TransportParent transport={transport} />
      ) : (
        <Absences absences={absences} onChange={rafraichir} />
      )}
        </>
      )}
    </div>
    </DeviseCtx.Provider>
  );
}

// Le bandeau de la fiche, à la couleur de la carte de l'enfant sur l'accueil :
// le parent reconnaît d'un coup d'œil de quel enfant il s'agit.
function BandeauEnfant({ enfant, eleveId }) {
  const { fonce } = couleurEnfant(eleveId);
  const age = ageEnfant(enfant?.date_naissance);
  const initiales = `${(enfant?.prenom?.[0] || "").toUpperCase()}${(enfant?.nom?.[0] || "").toUpperCase()}`;
  return (
    <div className={`flex items-center gap-3.5 rounded-3xl p-4 text-white ${fonce}`}>
      {/*  La photo de SON enfant : la policy de la migration 169 repose sur
          `_parent_possede`. Sans photo, les initiales. */}
      <Photo bucket="eleves" valeur={enfant?.photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/40"
        fallback={<span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 font-display text-xl font-bold">{initiales}</span>} />
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-bold">{enfant ? `${enfant.prenom} ${enfant.nom}` : "Mon enfant"}</p>
        <p className="truncate text-sm text-white/90">
          {[age != null ? `${age} ans` : null, enfant?.classe, enfant?.matricule].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

// Les rubriques en tuiles, deux par ligne (écrans de Mme Kane) : le parent
// voit tout sans faire défiler. Seul ce qui demande un geste porte une marque.
//  ⚠️ CHAQUE TUILE DIT CE QU'IL Y A DEDANS (pistes du 09/11/2026) : onze
//  tuiles muettes obligeaient à les ouvrir une à une pour savoir s'il y avait
//  un devoir ou une absence. Une ligne d'état sous le titre ; une donnée qui
//  n'a pas pu être lue ne produit AUCUNE ligne plutôt qu'une fausse.
//  Paiements reprend la pastille de l'accueil : le même calcul, le même mot.
const TONS_LIGNE = { rouge: "font-semibold text-rose-700", or: "font-semibold text-amber-800", vert: "font-semibold text-emerald-700" };
function TuilesEnfant({ eleveId, tuiles, badges, lienRubrique, pastille, accent, alertes, demandesEnCours }) {
  const [apercu, setApercu] = useState({});
  useEffect(() => {
    let vivant = true;
    setApercu({});
    //  Lectures seules : aucune ne marque rien comme lu (jamais
    //  `enfant_bulletins`, qui marque le bulletin « consulté »).
    Promise.allSettled([enfantCahier(eleveId), enfantEmploi(eleveId), enfantNotes(eleveId), enfantAbsences(eleveId), annoncesEnfant(eleveId), enfantFournitures(eleveId)])
      .then(([cahier, emploi, notes, absences, annonces, fournitures]) => {
        if (!vivant) return;
        const v = (r) => (r.status === "fulfilled" ? r.value || [] : undefined);
        setApercu({ cahier: v(cahier), emploi: v(emploi), notes: v(notes), absences: v(absences), annonces: v(annonces), fournitures: v(fournitures) });
      });
    return () => { vivant = false; };
  }, [eleveId]);
  const lignes = resumeRubriques({ ...apercu, alertes, demandesEnCours });
  const maintenant = prochainCours(apercu.emploi);
  if (maintenant) lignes.emploi = { texte: maintenant.replace(/^Prochain cours : /, "Ensuite : ").replace(/^En cours : /, "Maintenant : ") };
  if (pastille) lignes.paiements = { texte: pastille.texte, ton: pastille.ton === "rouge" ? "rouge" : pastille.ton === "vert" ? "vert" : undefined };
  //  La ligne dit déjà le nombre de devoirs : pas de pastille en double.
  const nombres = { ...badges, cahier: 0 };
  const couleur = accent ? { color: accent } : undefined;
  const classe = "relative flex min-h-24 flex-col gap-1.5 rounded-2xl border border-navy-900/10 bg-white p-3.5 text-navy-900 transition active:scale-[.98] [&:last-child:nth-child(odd)]:col-span-2";
  const autres = tuiles.filter((t) => t.autre);
  return (
    <nav aria-label="Rubriques" className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
      {tuiles.filter((t) => !t.autre).map((t) => {
        const n = nombres[t.cle] || 0;
        const ligne = lignes[t.cle];
        return (
          <Link key={t.cle} to={lienRubrique(t.cle)} className={classe}>
            <span style={couleur} className={accent ? "" : "text-sky-700"}><Icone name={t.icone || t.cle} className="h-7 w-7" /></span>
            <span className="text-sm font-bold leading-tight">{t.label}</span>
            {ligne && <span className={`line-clamp-2 text-xs leading-snug ${TONS_LIGNE[ligne.ton] || "text-navy-900/65"}`}>{ligne.texte}</span>}
            {n > 0 && <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{n}</span>}
          </Link>
        );
      })}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900/70">Autres rubriques</h3>
        <div className="flex flex-wrap gap-2">
          {[...autres, { cle: "_compte", label: "Mot de passe", icone: "parametres", to: "/parent/compte" }].map((t) => {
            const n = nombres[t.cle] || 0;
            return (
              <Link key={t.cle} to={t.to || lienRubrique(t.cle)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy-900/15 bg-white px-3.5 text-sm font-semibold text-navy-900 transition active:scale-[.98]">
                <span style={couleur} className={accent ? "" : "text-sky-700"}><Icone name={t.icone || t.cle} className="h-5 w-5" /></span>
                {t.label}
                {n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{n}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Les rubriques de l'enfant, DANS L'ORDRE DE L'USAGE (pistes du 09/11/2026,
// choix du promoteur) : ce que les parents ouvrent le plus en tête, le reste
// sous « Autres rubriques » (`autre`). Les noms sont ceux de l'accueil :
// « Suivi paiements » ici et « Paiements » là-bas désignaient la même page.
// L'ordre précédent reprenait les écrans de Mme Kane (05/11/2026).
const TUILES = [
  { cle: "paiements",   label: "Paiements" },
  { cle: "notes",       label: "Notes et bulletins" },
  //  ⚠️ Au préscolaire on n'évalue pas, on OBSERVE : cette tuile remplace
  //  « Notes » pour les plus petits. Elle n'apparaît que si l'école a
  //  réellement enregistré des observations — une tuile vide inquiéterait
  //  un parent sans rien lui apprendre (mig. 172).
  { cle: "acquis",      label: "Suivi des acquis" },
  { cle: "emploi",      label: "Emploi du temps" },
  { cle: "absences",    label: "Absences et retards" },
  { cle: "cahier",      label: "Cahier de textes" },
  { cle: "annonces",    label: "Annonces" },
  //  Pas de tuile : on y va depuis les Notes. L'adresse reste valable, les
  //  alertes « bulletin publié » y mènent.
  { cle: "bulletins",   label: "Bulletins", horsGrille: true },
  { cle: "documents",   label: "Documents", autre: true },
  { cle: "fournitures", label: "Fournitures", autre: true },
  { cle: "programme",   label: "Programme", icone: "programmation", autre: true },
  { cle: "cantine",     label: "Cantine", autre: true },
  { cle: "transport",   label: "Transport", autre: true },
];

// (icônes fournies par le composant partagé @/composants/Icones.jsx)

const JOURS_SEM = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const LIB_TRAJET = { aller_retour: "Aller-retour", aller: "Aller seul", retour: "Retour seul" };

function CantineParent({ cantine, menu }) {
  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <h3 className="font-display text-lg font-bold text-navy-900">🍽️ Cantine</h3>
        {!cantine ? (
          <p className="mt-1 text-sm text-navy-900/50">Aucun abonnement cantine.</p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-navy-900/70">
            <p>Formule : <b className="text-navy-900">{cantine.formule === "prepaye" ? "Prépayé (au repas)" : "Mensuel"}</b>{cantine.actif ? "" : " (inactif)"}</p>
            {cantine.formule === "prepaye"
              ? <p>Solde restant : <b className="text-navy-900">{fmt(cantine.solde)}</b></p>
              : <p>Tarif : <b>{fmt(cantine.tarif)}</b> / mois</p>}
            {cantine.regime && <p>Régime / allergies : <b>{cantine.regime}</b></p>}
          </div>
        )}
      </Carte>
      {menu.length > 0 && (
        <Carte className="p-5">
          <h4 className="mb-2 font-semibold text-navy-900">Menu de la semaine</h4>
          <ul className="space-y-1 text-sm text-navy-900/70">
            {menu.map((m) => <li key={m.jour}><b className="text-navy-900">{JOURS_SEM[m.jour]}</b> : {m.plats || "—"}</li>)}
          </ul>
        </Carte>
      )}
    </div>
  );
}

function TransportParent({ transport }) {
  if (!transport) return <Carte className="p-6 text-sm text-navy-900/50">Aucun abonnement transport.</Carte>;
  return (
    <Carte className="p-5">
      <h3 className="font-display text-lg font-bold text-navy-900">🚌 Transport scolaire</h3>
      <div className="mt-2 space-y-1 text-sm text-navy-900/70">
        <p>Circuit : <b className="text-navy-900">{transport.circuit || "—"}</b></p>
        <p>Arrêt : <b>{transport.arret || "—"}</b>{transport.heure_depart ? ` · départ ${transport.heure_depart}` : ""}</p>
        <p>Trajet : {LIB_TRAJET[transport.trajet] || transport.trajet}</p>
        {transport.chauffeur && <p>Chauffeur : {transport.chauffeur}{transport.chauffeur_tel ? ` · ${transport.chauffeur_tel}` : ""}</p>}
        <p>Tarif : <b>{fmt(transport.tarif)}</b> / mois</p>
      </div>
    </Carte>
  );
}

// Une rubrique dont le chargement a échoué : on le DIT, avec de quoi réessayer.
// Jamais un « aucune donnée », qui serait une affirmation fausse.
function ErreurRubrique({ message, onReessayer }) {
  return (
    <Carte className="p-6 text-center" role="alert">
      <p className="font-display font-semibold text-navy-900">Cette rubrique n&apos;a pas pu être chargée.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-navy-900/60">{messageErreur(message)}</p>
      <Bouton className="mt-4" variante="fantome" onClick={onReessayer}>Réessayer</Bouton>
    </Carte>
  );
}

// ⚠️ PAS DE MOYENNE GÉNÉRALE ICI. Celle qui s'affichait était une moyenne
// SIMPLE des matières, alors que le bulletin pondère chaque matière par son
// coefficient (calculerBulletins, src/lib/bulletins.js) : un parent lisait
// deux moyennes générales différentes pour la même période. Les coefficients
// des matières ne sont pas transmis au parent ; la seule valeur officielle
// est celle du bulletin publié, vers lequel on renvoie.
//
// La moyenne PAR MATIÈRE suit exactement la règle du bulletin (notes ramenées
// sur 20, pondérées par le coefficient de l'évaluation, évaluations archivées
// exclues — mig. 208) : elle est exacte, mais PROVISOIRE tant que la période
// n'est pas close, et exprimée sur 20 (le bulletin peut utiliser un autre
// barème).
//  « 14,5 » et non « 14.50 » : la virgule, comme sur le bulletin.
const nombreFr = (v) => String(Math.round(Number(v) * 100) / 100).replace(".", ",");
const moyenneFr = (m) => (m.sC ? nombreFr(m.sN / m.sC) : "—");
const TONS_NOTE = { rouge: "bg-rose-100 text-rose-800", or: "bg-amber-100 text-amber-800", vert: "bg-emerald-100 text-emerald-800" };

function Notes({ notes, lienBulletins }) {
  if (notes.length === 0) return <Carte className="p-6 text-sm text-navy-900/50">Aucune note pour l&apos;instant.</Carte>;
  const parPeriode = {};
  for (const n of notes) {
    const p = (parPeriode[n.periode] ||= { ordre: n.ordre, matieres: {} });
    const m = (p.matieres[n.matiere] ||= { sN: 0, sC: 0, notes: [] });
    const note20 = (Number(n.valeur) / (Number(n.bareme) || 20)) * 20;
    const c = Number(n.coefficient) || 1;
    m.sN += note20 * c; m.sC += c;
    m.notes.push({ type: n.type, valeur: n.valeur, bareme: n.bareme });
  }
  const periodes = Object.entries(parPeriode).sort((a, b) => a[1].ordre - b[1].ordre);

  return (
    <div className="space-y-5">
      {periodes.map(([periode, p]) => {
        const matieres = Object.entries(p.matieres);
        return (
          <Carte key={periode} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-navy-900/10 px-4 py-3 sm:px-6">
              <h3 className="font-display font-semibold text-navy-900">{periode}</h3>
              <Link to={lienBulletins} className="inline-flex min-h-11 items-center text-xs font-medium text-navy-700 underline-offset-2 hover:text-or-600 hover:underline">
                Moyenne générale : voir le bulletin
              </Link>
            </div>
            {/*  Sur téléphone, une matière par ligne : le parent lit la moyenne
                 sans faire glisser un tableau. Le détail n'apparaît que s'il
                 apprend quelque chose (plusieurs notes) : « 15/20 » répété
                 deux fois n'en apprenait rien. La couleur double le chiffre,
                 sans jamais le remplacer. */}
            <ul aria-label={`Notes — ${periode}`} className="divide-y divide-navy-900/5 px-4 sm:hidden">
              {matieres.map(([matiere, m]) => (
                <li key={matiere} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 font-medium text-navy-900">{matiere}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-sm font-bold ${m.sC ? TONS_NOTE[tonNote(m.sN / m.sC)] : "text-navy-900"}`}>{moyenneFr(m)}/20</span>
                  </div>
                  {m.notes.length > 1 && (
                    <p className="mt-1 font-mono text-xs text-navy-900/70">
                      Notes : {m.notes.map((x) => `${nombreFr(x.valeur)}/${nombreFr(x.bareme)}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={`Notes — ${periode}`}>
              <table className="w-full min-w-[18rem] text-left text-sm">
                <caption className="sr-only">Notes de la période {periode}, et moyenne provisoire par matière sur 20</caption>
                <thead className="bg-navy-900/[0.03] text-navy-900/60">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium sm:px-6">Matière</th>
                    <th scope="col" className="px-4 py-2 font-medium sm:px-6">Notes</th>
                    <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium sm:px-6">Moy. /20</th>
                  </tr>
                </thead>
                <tbody>
                  {matieres.map(([matiere, m]) => (
                    <tr key={matiere} className="border-t border-navy-900/5 align-top">
                      <th scope="row" className="px-4 py-2 font-medium text-navy-900 sm:px-6">{matiere}</th>
                      <td className="px-4 py-2 font-mono text-xs text-navy-900/70 sm:px-6">
                        {m.notes.map((x) => `${x.valeur}/${x.bareme}`).join(" · ")}
                      </td>
                      <td className="px-4 py-2 text-right font-mono sm:px-6">{moyenneFr(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        );
      })}
      <p className="text-xs text-navy-900/50">
        Moyennes par matière <b>provisoires</b>, sur 20 : elles évoluent avec les nouvelles notes.
        La moyenne générale officielle, pondérée par les coefficients des matières, figure sur le bulletin publié par l&apos;école.
      </p>
    </div>
  );
}

// La semaine de l'enfant, présentée comme l'emploi du temps que l'école
// imprime (heures × jours), et non plus jour par jour en liste à dérouler.
// Couleurs et logo : ceux de l'école de l'enfant (mes_enfants, mig. 205).
//  UN JOUR À LA FOIS (écrans de Mme Kane) : sur un téléphone, le tableau de la
//  semaine se lit en le faisant glisser. Le parent cherche « aujourd'hui » :
//  il l'a d'emblée, et la semaine entière reste à un toucher (impression).
const TEINTES_MATIERES = ["#1aa6e6", "#2fae6b", "#e3c100", "#ef8a3c", "#8a6ad6", "#17a99a", "#ed127b", "#6b7280", "#b45309", "#4f46e5"];
function Emploi({ creneaux, enfant }) {
  const lignes = creneaux.map((c) => pourGrille(c));
  const jours = JOURS_EMPLOI.filter(([n]) => lignes.some((c) => Number(c.jour) === n));
  const aujourdhui = ((new Date().getDay() + 6) % 7) + 1;
  const [jour, setJour] = useState(() => (jours.some(([n]) => n === aujourdhui) ? aujourdhui : jours[0]?.[0]));
  const [semaine, setSemaine] = useState(false);
  if (creneaux.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/40">Aucun emploi du temps disponible.</Carte>;
  }
  if (semaine) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setSemaine(false)} className="no-print min-h-10 text-sm font-semibold text-navy-700">← Voir jour par jour</button>
        <Carte className="p-4">
          <GrilleEmploi creneaux={lignes}
            ecole={{ couleur_primaire: enfant?.couleur_primaire, couleur_secondaire: enfant?.couleur_secondaire }}
            entete={{ logo: enfant?.logo, nom: enfant?.ecole, titre: enfant?.classe ? `Classe ${enfant.classe}` : "", sous: "Emploi du temps" }} />
        </Carte>
      </div>
    );
  }
  const heure = (h) => String(h || "").slice(0, 5);
  const matieres = [...new Set(lignes.filter((c) => !c.pause).map((c) => c.couleur || c.titre))].sort((a, b) => a.localeCompare(b, "fr"));
  const teinte = (c) => TEINTES_MATIERES[matieres.indexOf(c.couleur || c.titre) % TEINTES_MATIERES.length];
  const duJour = lignes.filter((c) => Number(c.jour) === jour)
    .sort((a, b) => String(a.heure_debut).localeCompare(String(b.heure_debut)));
  //  Aujourd'hui seulement : le cours en cours ressort, ceux qui sont passés
  //  s'effacent. Un autre jour se lit en entier.
  const d = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const moment = (c) => (jour !== aujourdhui ? null
    : heure(c.heure_fin) <= hm ? "passe" : heure(c.heure_debut) <= hm ? "encours" : null);
  return (
    <div className="space-y-3">
      {/*  Jours abrégés : les cinq (ou six) tiennent à l'écran. « Vendredi »
           était coupé à droite et demandait de faire glisser la rangée. */}
      <div className="flex gap-1.5" role="group" aria-label="Jour">
        {jours.map(([n, nom]) => (
          <button key={n} type="button" onClick={() => setJour(n)} aria-pressed={n === jour}
            aria-label={n === aujourdhui ? `${nom}, aujourd'hui` : nom}
            className={`relative min-h-11 min-w-0 flex-1 rounded-full text-sm font-bold ${n === jour ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900"}`}>
            {nom.slice(0, 3)}
            {n === aujourdhui && <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-or-500" />}
          </button>
        ))}
      </div>
      <Carte className="divide-y divide-navy-900/5 px-4 py-1">
        {duJour.map((c, i) => {
          const m = moment(c);
          return (
            <div key={i} aria-current={m === "encours" ? "time" : undefined}
              className={`grid grid-cols-[6.5rem_1fr] items-center gap-3 py-3 text-sm ${m === "passe" ? "opacity-50" : ""} ${m === "encours" ? "-mx-4 rounded-xl bg-amber-50 px-4" : ""}`}>
              <b className="tabular-nums text-navy-900">{heure(c.heure_debut)} – {heure(c.heure_fin)}</b>
              {c.pause ? <span className="italic text-navy-900/55">{c.titre === "—" ? "Pause" : c.titre}</span> : (
                <span className="border-l-4 pl-2.5 font-semibold text-navy-900" style={{ borderColor: teinte(c) }}>
                  {c.titre}
                  {m === "encours" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">En cours</span>}
                </span>
              )}
            </div>
          );
        })}
      </Carte>
      {/*  La légende des couleurs reste dans « Voir toute la semaine », où
           elle sert ; ici chaque cours porte déjà son nom à côté de sa couleur. */}
      <button type="button" onClick={() => setSemaine(true)} className="min-h-10 text-sm font-semibold text-navy-700">Voir toute la semaine</button>
    </div>
  );
}

// Barème d'affichage de l'école (mig. 208). Le bulletin est enregistré dans
// ce barème : écrire « /20 » en dur était faux pour une école notée sur 10.
// Base pas encore migrée → 20, l'ancien affichage.
const baremeDe = (b) => Number(b?.bareme) || 20;

function Bulletins({ bulletins }) {
  const [sel, setSel] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [ouverture, setOuverture] = useState(null); // id du bulletin en cours d'ouverture
  const [erreur, setErreur] = useState("");

  async function ouvrir(b) {
    setOuverture(b.id); setErreur("");
    try { setLignes(await enfantBulletinLignes(b.id)); setSel(b); }
    catch (e) { setErreur(e.message); }
    finally { setOuverture(null); }
  }

  if (bulletins.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/50">Aucun bulletin publié pour le moment.</Carte>;
  }
  return (
    <div className="space-y-2">
      <Alerte ton="erreur">{erreur}</Alerte>
      {bulletins.map((b) => (
        <Carte key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-display font-semibold text-navy-900">{b.periode}</p>
            <p className="text-xs text-navy-900/60">
              Moyenne {b.moyenne != null ? Number(b.moyenne).toFixed(2) : "—"}/{baremeDe(b)}
              {b.rang ? ` · Rang ${b.rang}${b.effectif ? "/" + b.effectif : ""}` : ""} · {b.mention || "—"}
            </p>
          </div>
          <Bouton variante="fantome" onClick={() => ouvrir(b)} disabled={ouverture === b.id}>
            {ouverture === b.id ? "Ouverture…" : "Voir / Imprimer"}
          </Bouton>
        </Carte>
      ))}

      <Modale ouvert={!!sel} onFermer={() => setSel(null)} titre="Bulletin" large>
        {sel && (
          <>
            <BulletinParent b={sel} lignes={lignes} />
            <div className="no-print mt-5 flex justify-end gap-2">
              <Bouton variante="fantome" onClick={() => setSel(null)}>Fermer</Bouton>
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>
    </div>
  );
}

function BulletinParent({ b, lignes }) {
  const totalCoef = lignes.reduce((s, l) => s + Number(l.coefficient || 0), 0);
  return (
    <div className="zone-impression relative overflow-hidden rounded-xl border border-navy-900/10 bg-white p-4 sm:p-8 print:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {b.logo && <img src={b.logo} alt="" className="h-14 w-14 shrink-0 object-contain" />}
          <div>
            <p className="font-display text-xl font-bold text-navy-900">Bulletin scolaire</p>
            <p className="text-sm text-navy-900/50">{b.ecole} — {b.periode}{b.annee ? ` · ${b.annee}` : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-navy-900">{b.eleve_prenom} {b.eleve_nom}</p>
          <p className="text-sm text-navy-900/50">Classe {b.classe}</p>
          <p className="font-mono text-xs text-navy-900/40">{b.matricule}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Moyennes par matière">
      <table className="w-full min-w-[30rem] text-left text-sm print:min-w-0">
        <thead className="border-b border-navy-900/15 text-navy-900/50">
          <tr><th className="py-2 font-medium">Matière</th><th className="py-2 text-center font-medium">Moy. /{baremeDe(b)}</th><th className="py-2 text-center font-medium">Coef.</th><th className="py-2 text-center font-medium">Pts</th><th className="py-2 font-medium">Appréciation</th></tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-navy-900/5">
              <td className="py-2 font-medium text-navy-900">{l.matiere}</td>
              <td className="py-2 text-center font-mono">{l.moyenne != null ? Number(l.moyenne).toFixed(2) : "—"}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">{l.coefficient}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">{l.moyenne != null ? (Number(l.moyenne) * Number(l.coefficient)).toFixed(2) : "—"}</td>
              <td className="py-2 text-xs text-navy-900/70">{l.appreciation || ""}</td>
            </tr>
          ))}
          {lignes.length === 0 && <tr><td colSpan={5} className="py-3 text-navy-900/40">—</td></tr>}
        </tbody>
      </table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-navy-900 p-4 text-creme">
          <p className="text-xs text-creme/60">Moyenne générale</p>
          <p className="font-display text-2xl font-bold">{b.moyenne != null ? Number(b.moyenne).toFixed(2) : "—"}<span className="text-sm font-normal">/{baremeDe(b)}</span></p>
        </div>
        <div className="rounded-xl bg-or-500 p-4 text-navy-900">
          <p className="text-xs text-navy-900/60">Rang</p>
          <p className="font-display text-2xl font-bold">{b.rang ?? "—"}{b.effectif ? <span className="text-sm font-normal">/{b.effectif}</span> : ""}</p>
        </div>
        <div className="rounded-xl border border-navy-900/15 p-4">
          <p className="text-xs text-navy-900/50">Mention</p>
          <p className="font-display text-xl font-bold text-navy-900">{b.mention || "—"}</p>
        </div>
      </div>

      {/* Absences : affichées à partir du collège seulement. La règle n'est
          PAS décidée ici — `affiche_absences` vient de la base (mig. 163),
          pour que ce composant et celui du personnel ne divergent jamais.
          Et `absences` à NULL signifie « période non datée » : on le dit,
          on n'écrit pas 0, qui serait un mensonge rassurant. */}
      {b.affiche_absences && (
        <div className="mt-4 rounded-xl border border-navy-900/15 p-4 text-sm">
          {b.absences == null ? (
            <p className="text-navy-900/50">
              Absences non comptabilisées : les dates de la période ne sont pas renseignées.
            </p>
          ) : (
            <p className="text-navy-900/80">
              <b className="text-navy-900/50">Absences :</b> {b.absences}
              {Number(b.absences) > 0 && (
                <span className="text-navy-900/55"> dont {b.absences_justifiees ?? 0} justifiée{Number(b.absences_justifiees) > 1 ? "s" : ""}</span>
              )}
            </p>
          )}
        </div>
      )}

      {(b.appreciation || b.decision) && (
        <div className="mt-6 space-y-2 rounded-xl border border-navy-900/10 bg-creme/40 p-4 text-sm">
          {b.appreciation && <p className="text-navy-900/80"><b className="text-navy-900/50">Appréciation générale :</b> {b.appreciation}</p>}
          {b.decision && <p className="text-navy-900/80"><b className="text-navy-900/50">Décision du conseil :</b> {b.decision}</p>}
        </div>
      )}

      <div className="mt-6 flex items-end justify-between text-xs text-navy-900/40">
        <span>Total coefficients : <span className="font-mono">{totalCoef}</span></span>
        <span>{b.ecole} · {b.sigle}</span>
      </div>
      <SceauVerification code={codeBulletinId(b.id)} reference={b.periode} />
    </div>
  );
}

// Panneau de consentement (supérieur) : les notes/bulletins d'un étudiant majeur
// ne sont visibles qu'avec son autorisation.
function ConsentementNotes({ statut, enCours, onDemander }) {
  return (
    <Carte className="p-6 text-center">
      <div className="text-3xl">🔒</div>
      <h3 className="mt-2 font-display text-lg font-bold text-navy-900">Accès soumis à l'autorisation de l'étudiant</h3>
      {statut === "en_attente" ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-900/60">
          Votre demande a été envoyée. L'étudiant doit l'<b>autoriser</b> depuis son espace pour que vous puissiez consulter ses notes et bulletins.
        </p>
      ) : statut === "refuse" || statut === "revoque" ? (
        <>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-900/60">
            {statut === "refuse" ? "Votre demande a été refusée." : "L'accès a été révoqué par l'étudiant."} Vous pouvez en faire une nouvelle.
          </p>
          <Bouton className="mt-4" onClick={onDemander} disabled={enCours}>{enCours ? "…" : "Redemander l'accès"}</Bouton>
        </>
      ) : (
        <>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-900/60">
            Cet étudiant étant majeur, la consultation de ses notes nécessite son accord. Envoyez une demande : il pourra l'autoriser depuis son espace.
          </p>
          <Bouton className="mt-4" onClick={onDemander} disabled={enCours}>{enCours ? "…" : "Demander l'accès aux notes"}</Bouton>
        </>
      )}
    </Carte>
  );
}

// L'erreur s'affiche AU-DESSUS DU FORMULAIRE : en haut de page, elle sortait
// de l'écran d'un téléphone, et la demande semblait partie.
function Documents({ eleveId, demandes, onChange }) {
  const [type, setType] = useState("scolarite");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const onErreur = setErreur;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");
  const lib = { en_attente: "En attente", en_cours: "En cours", pret: "Prêt ✓", rejete: "Rejeté" };
  const ton = { en_attente: "text-or-600", en_cours: "text-navy-900/60", pret: "text-emerald-700", rejete: "text-rose-700" };
  const typeLib = Object.fromEntries(TYPES_DOCUMENT);

  async function envoyer() {
    if (!type) return;
    setEnvoi(true); onErreur("");
    try { await demanderDocument(eleveId, type, message.trim()); setMessage(""); await onChange(); }
    catch (e) { onErreur(e.message); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <h3 className="mb-3 font-display font-semibold text-navy-900">Demander un document</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de document</span>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {TYPES_DOCUMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Précisions (optionnel)</span>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Motif, urgence…"
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
          </label>
        </div>
        <div className="mt-3"><Alerte ton="erreur">{erreur}</Alerte></div>
        <div className="mt-3 flex justify-end">
          <Bouton onClick={envoyer} disabled={envoi}>{envoi ? "Envoi…" : "Envoyer la demande"}</Bouton>
        </div>
      </Carte>

      {demandes.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-2 font-display font-semibold text-navy-900">Mes demandes</h3>
          <ul className="divide-y divide-navy-900/5">
            {demandes.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-navy-900">{typeLib[d.type] || d.type} <span className="text-xs text-navy-900/40">· {d.eleve} · {fmtD(d.created_at)}</span></span>
                  <span className={`text-xs font-medium ${ton[d.statut] || ""}`}>{lib[d.statut] || d.statut}</span>
                </div>
                {d.reponse && <p className="mt-0.5 text-xs text-navy-900/50">Réponse : {d.reponse}</p>}
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}

// Le programme officiel du mois (mig. 214), maquette validée le 27/10/2026
// (docs/maquette-programme-parent.html) : le niveau RÉEL de l'enfant (CI dans
// « CI/CP »), le mois en cours par défaut, les autres mois publiés au choix,
// par domaine puis semaine. Lecture seule ; la base ne rend rien d'un autre
// niveau.
// Depuis le 28/10/2026, le mois en cours s'ouvre sur LA SEMAINE EN COURS
// (ses contenus et ceux « tout le mois ») ; « Tout le mois » reste à un geste.

function ProgrammeDuMois({ eleveId }) {
  const [donnees, setDonnees] = useState(null);
  const [mois, setMois] = useState(null);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(0);
  const [toutLeMois, setToutLeMois] = useState(false);

  useEffect(() => {
    let vivant = true;
    setErreur("");
    enfantProgramme(eleveId, mois)
      .then((d) => { if (vivant) { setDonnees(d); setOuvert(0); } })
      .catch((e) => { if (vivant) setErreur(messageErreur(e)); });
    return () => { vivant = false; };
  }, [eleveId, mois]);

  if (erreur) return <Carte className="p-5"><Alerte ton="erreur">{erreur}</Alerte></Carte>;
  if (!donnees) return <Carte className="p-5"><SkeletonListe lignes={3} /></Carte>;
  if (!donnees.niveau) return <Carte className="p-6 text-sm text-navy-900/50">Le programme n'est pas encore publié par l'école.</Carte>;

  const nomMois = (m) => (MOIS_PROGRAMME.find(([n]) => Number(n) === Number(m)) || [null, ""])[1];
  const dispo = new Set((donnees.mois_disponibles || []).map(Number));
  //  Les mois de l'année scolaire, d'octobre à juillet, grisés s'ils ne sont
  //  pas encore publiés.
  const moisAnnee = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
  const maintenant = new Date();
  const semaineCourante = Number(donnees.mois) === maintenant.getMonth() + 1
    ? Math.min(Math.ceil(maintenant.getDate() / 7), 6) : null;
  //  Un autre mois se lit en entier : la « semaine en cours » n'y a pas de sens.
  const parSemaine = !!semaineCourante && !toutLeMois;
  const domaines = parSemaine
    ? donnees.domaines
      .map((d) => ({ ...d, lignes: (d.lignes || []).filter((l) => l.semaine == null || l.semaine === semaineCourante) }))
      .filter((d) => d.lignes.length > 0)
    : donnees.domaines;

  return (
    <Carte className="zone-impression p-5">
      <h3 className="font-display font-semibold text-navy-900">📘 Programme du mois · {donnees.niveau}</h3>
      <p className="mt-0.5 text-xs text-navy-900/50">Programmation officielle de l'IEF, pour le niveau de votre enfant.</p>

      <div className="no-print mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {moisAnnee.map((m) => (
          <button key={m} type="button" disabled={!dispo.has(m)} onClick={() => { setMois(m); setToutLeMois(false); }}
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium ${Number(donnees.mois) === m
              ? "bg-or-500 font-semibold text-navy-900" : dispo.has(m) ? "bg-creme text-navy-900/70" : "bg-creme text-navy-900/25"}`}>
            {nomMois(m)}
          </button>
        ))}
      </div>
      <p className="mt-1 hidden text-sm font-medium text-navy-900 print:block">
        {nomMois(donnees.mois)}{parSemaine ? ` · semaine ${semaineCourante}` : ""}
      </p>

      {semaineCourante && donnees.domaines.length > 0 && (
        <div className="no-print mt-2 inline-flex rounded-lg bg-creme p-0.5 text-xs font-medium">
          {[[false, `Cette semaine (sem. ${semaineCourante})`], [true, "Tout le mois"]].map(([v, lib]) => (
            <button key={lib} type="button" onClick={() => { setToutLeMois(v); setOuvert(0); }}
              className={`min-h-10 rounded-md px-3 ${toutLeMois === v ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/55"}`}>
              {lib}
            </button>
          ))}
        </div>
      )}

      {donnees.domaines.length === 0 ? (
        <p className="mt-3 rounded-xl bg-creme p-3 text-sm text-navy-900/60">
          L'école n'a pas encore publié le programme de {donnees.niveau} pour {nomMois(donnees.mois).toLowerCase()}.
        </p>
      ) : domaines.length === 0 ? (
        <p className="mt-3 rounded-xl bg-creme p-3 text-sm text-navy-900/60">
          Rien n'est prévu pour la semaine {semaineCourante} dans le programme de {nomMois(donnees.mois).toLowerCase()}.
          {" "}<button type="button" onClick={() => setToutLeMois(true)} className="font-medium text-navy-700 underline">Voir tout le mois</button>
        </p>
      ) : (
        <div className="mt-2 divide-y divide-navy-900/10">
          {domaines.map((d, i) => (
            <div key={d.domaine} className="py-2.5">
              <button type="button" onClick={() => setOuvert(ouvert === i ? -1 : i)}
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-navy-900">
                {d.domaine}<span className="no-print text-navy-900/40">{ouvert === i ? "▾" : "▸"}</span>
              </button>
              <div className={ouvert === i ? "" : "hidden print:block"}>
                <LignesProgramme lignes={d.lignes} semaineCourante={parSemaine ? null : semaineCourante} />
              </div>
            </div>
          ))}
        </div>
      )}

      {donnees.domaines.length > 0 && (
        <div className="no-print mt-3">
          <Bouton variante="fantome" onClick={() => window.print()}>🖨️ Imprimer le programme</Bouton>
        </div>
      )}
    </Carte>
  );
}

//  Regroupées comme le document de l'IEF : sous-domaine, activité, puis les
//  semaines (même lecture que l'écran Programmation officielle).
//  « COMMUNICATION ORALE » (document de l'IEF) → « Communication orale » :
//  un titre en capitales se lit mal sur un téléphone.
const enPhrase = (t) => (t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

function LignesProgramme({ lignes, semaineCourante }) {
  const groupes = [];
  for (const l of lignes || []) {
    const cle = `${l.sous_domaine || ""}|${l.rubrique || ""}|${l.activite || ""}`;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.cle === cle) dernier.lignes.push(l);
    else groupes.push({ cle, tete: l, lignes: [l] });
  }
  return (
    <div className="mt-1">
      {groupes.map((g, i) => (
        <div key={i} className="mt-2">
          {g.tete.sous_domaine && (i === 0 || groupes[i - 1].tete.sous_domaine !== g.tete.sous_domaine) && (
            <div className="mt-2 text-sm font-bold text-or-700">{enPhrase(g.tete.sous_domaine)}</div>
          )}
          {(g.tete.activite || g.tete.rubrique) && (
            <div className="mt-1 text-xs font-semibold text-navy-900/80">{g.tete.activite || g.tete.rubrique}</div>
          )}
          {g.tete.palier && (
            <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Objectif : {g.tete.palier}</div>
          )}
          <ul className="mt-1">
            {g.lignes.map((l, k) => (
              <li key={k} className={`grid grid-cols-[4.5rem_1fr] gap-2 border-b border-dashed border-navy-900/10 py-1 text-sm text-navy-900/80 ${
                semaineCourante && l.semaine === semaineCourante ? "rounded bg-or-500/10" : ""}`}>
                <span className="text-xs font-medium text-navy-900/45">{l.semaine ? `Sem. ${l.semaine}` : "Tout le mois"}</span>
                <span className="whitespace-pre-wrap">
                  {l.contenu}
                  {semaineCourante && l.semaine === semaineCourante && <em className="ml-1 text-xs text-or-600">· cette semaine</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Cahier({ entrees }) {
  if (entrees.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune entrée dans le cahier de textes.</Carte>;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "");
  return (
    <div className="space-y-3">
      {entrees.map((e, i) => (
        <Carte key={i} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-or-600">{fmtD(e.date_seance)}</span>
            {e.matiere && <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/70">{e.matiere}</span>}
          </div>
          {e.contenu && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-900/80">{e.contenu}</p>}
          {e.devoirs && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/80">
              <b className="text-or-600">📘 Devoirs :</b> {e.devoirs}
              {e.date_pour && <span className="ml-1 text-xs text-navy-900/50">(pour le {fmtD(e.date_pour)})</span>}
            </p>
          )}
        </Carte>
      ))}
    </div>
  );
}

// Les annonces de CET enfant : son établissement, sa classe. La liste de
// l'accueil couvre toute la fratrie et peut mélanger plusieurs écoles ;
// ici, c'est cadré (migration 145).
// Une pièce jointe ne s'ouvre que par un lien signé, valable une heure :
// le serveur vérifie d'abord que ce parent a le droit de voir l'annonce.
function PiecesJointes({ fichiers }) {
  const liste = Array.isArray(fichiers) ? fichiers : [];
  //  ⚠️ Un échec était silencieux : le parent touchait la pièce jointe et
  //  rien ne se passait.
  //  Le hook AVANT le `return` : appelé sous condition, il faisait planter
  //  l'écran dès qu'une annonce passait de « sans » à « avec » pièce jointe
  //  (relevé par ESLint, lot 5).
  const [echec, setEchec] = useState("");
  if (liste.length === 0) return null;
  async function ouvrir(f) {
    setEchec("");
    try {
      const url = await lienFichier(f.chemin);
      if (!url) throw new Error("Pièce jointe indisponible.");
      window.open(url, "_blank", "noopener");
    } catch (e) { setEchec(`« ${f.nom_fichier} » n'a pas pu être ouverte : ${messageErreur(e)}`); }
  }
  return (
    <>
    {echec && <p className="mt-2 text-xs text-rose-700" role="alert">{echec}</p>}
    <ul className="mt-2 flex flex-wrap gap-2">
      {liste.map((f) => (
        <li key={f.id}>
          <button type="button" onClick={() => ouvrir(f)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-navy-900/10 bg-white px-2.5 py-1 text-xs text-navy-900/75 active:border-or-500">
            📎 <span className="max-w-44 truncate">{f.nom_fichier}</span>
            <span className="text-navy-900/35">{poids(f.taille)}</span>
          </button>
        </li>
      ))}
    </ul>
    </>
  );
}

function AnnoncesEnfant({ items, enfant }) {
  if (items.length === 0) {
    return (
      <Carte className="p-6 text-sm text-navy-900/40">
        Aucune annonce {enfant?.ecole ? `de ${enfant.ecole}` : "pour le moment"}.
      </Carte>
    );
  }
  return (
    <div className="space-y-3">
      {enfant?.ecole && (
        <p className="text-xs text-navy-900/45">
          Annonces de <b className="text-navy-900/70">{enfant.ecole}</b>
          {enfant.classe ? ` concernant ${enfant.prenom} (${enfant.classe})` : ""}.
        </p>
      )}
      {items.map((a) => (
        <Carte key={a.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy-900">{a.titre}</h3>
            {/* Dire à qui l'annonce s'adresse : sans cela, une annonce
                générale relue dans la page de chaque enfant passe pour un
                doublon alors qu'elle n'a été publiée qu'une fois. */}
            {a.portee_libelle ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700">{a.portee_libelle}</span>
            ) : (
              <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-xs text-navy-900/50">Toute l&apos;école</span>
            )}
          </div>
          {a.contenu && <p className="mt-1 whitespace-pre-wrap text-sm text-navy-900/70">{a.contenu}</p>}
          <PiecesJointes fichiers={a.fichiers} />
          <p className="mt-2 text-xs text-navy-900/40">{fmtDate(a.publie_le)}</p>
        </Carte>
      ))}
    </div>
  );
}

//  LA LISTE À PRÉPARER (écrans de Mme Kane) : le parent coche ce qui est prêt,
//  voit où il en est, et chaque article dit s'il est donné ou vendu par
//  l'école. Les coches restent sur le téléphone, par enfant : une liste de
//  rentrée se prépare en plusieurs fois.
const lireCoches = (cle) => { try { return new Set(JSON.parse(localStorage.getItem(cle)) || []); } catch { return new Set(); } };
const ecrireCoches = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify([...v])); } catch { /* stockage bloqué */ } };
function Fournitures({ items, enfant }) {
  const cle = `fournitures_prets_${enfant?.eleve_id || ""}`;
  const [prets, setPrets] = useState(() => lireCoches(cle));
  const [copie, setCopie] = useState(false);

  if (items.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune liste de fournitures publiée.</Carte>;

  // Une clé stable par article : les libellés se répètent d'une catégorie à
  // l'autre (« Gomme » chez Maison ET Petit matériel), l'index seul ne suffit
  // pas à les distinguer une fois la liste regroupée.
  const tous = items.map((f, i) => ({ ...f, _k: `${i}-${f.libelle}` }));
  const groupes = grouperFournitures(tous);
  const aPreparer = tous.filter((f) => !fourniParEcole(f));
  const obligatoires = aPreparer.filter((f) => f.obligatoire !== false);
  const faits = obligatoires.filter((f) => prets.has(f._k)).length;
  const restants = aPreparer.filter((f) => !prets.has(f._k));

  const basculer = (k) => setPrets((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    ecrireCoches(cle, n);
    return n;
  });

  const message = messageFournitures(restants, {
    enfant: enfant ? `${enfant.prenom} ${enfant.nom}` : null,
    classe: enfant?.classe, ecole: enfant?.ecole,
  });

  async function copier() {
    try {
      await navigator.clipboard.writeText(message);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch { /* presse-papiers indisponible : le bouton WhatsApp reste */ }
  }

  const etiquette = "shrink-0 self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold";
  return (
    <div className="space-y-3">
      <Carte className="p-4">
        <p className="flex justify-between gap-3 font-bold text-navy-900">
          <span>{faits} / {obligatoires.length} articles préparés</span>
          {enfant?.classe && <span className="font-normal text-navy-900/60">{enfant.classe}</span>}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-900/10">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${obligatoires.length ? (faits / obligatoires.length) * 100 : 0}%` }} />
        </div>
      </Carte>

      {groupes.map((g) => (
        <Carte key={g.id} className="p-4">
          <h3 className="font-display text-lg font-bold text-navy-900">{g.label}</h3>
          <ul className="mt-1 divide-y divide-navy-900/5">
            {g.items.map((f) => {
              const donne = fourniParEcole(f);
              const fait = prets.has(f._k);
              const texte = (
                <span className="min-w-0 flex-1">
                  <span className={fait ? "text-navy-900/40 line-through" : "text-navy-900"}>
                    {f.quantite > 1 && <span className="tabular-nums">{f.quantite} × </span>}{f.libelle}
                  </span>
                  {!f.obligatoire && <span className="ml-1.5 text-xs text-navy-900/45">(facultatif)</span>}
                  {f.note && <span className="block text-xs text-navy-900/55">{f.note}</span>}
                </span>
              );
              return (
                <li key={f._k}>
                  {donne ? (
                    <div className="flex min-h-12 items-center gap-3 py-2.5 text-sm">
                      <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-md border-2 border-emerald-600 bg-emerald-50" />
                      {texte}
                      <span className={`${etiquette} bg-emerald-100 text-emerald-800`}>Donné par l'école</span>
                    </div>
                  ) : (
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <input type="checkbox" checked={fait} onChange={() => basculer(f._k)} className="h-6 w-6 shrink-0 accent-emerald-600" />
                      {texte}
                      {venduEcole(f) && <span className={`${etiquette} bg-amber-100 text-amber-800`}>Vendu à l'école</span>}
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>
      ))}

      {restants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <a href={lienPartageWhatsApp(message)} target="_blank" rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">
            Envoyer ce qui manque par WhatsApp
          </a>
          <button type="button" onClick={copier}
            className="min-h-10 rounded-xl border border-navy-900/15 bg-white px-4 text-sm font-medium text-navy-900/70">
            {copie ? "Copié ✓" : "Copier la liste"}
          </button>
        </div>
      )}
    </div>
  );
}

//  LES PAIEMENTS MOIS PAR MOIS (maquette de Mme Kane, 05/11/2026 ; mig. 229).
//  Un parent compte en mois — « j'ai payé novembre ? » —, pas en numéros de
//  facture : une ligne par échéance, son état en toutes lettres, et sur la
//  ligne même la facture, le reçu, ou « Payer » quand c'est dû.
//  Sans la 229, les lignes n'ont pas de facture : les boutons n'apparaissent
//  pas, la liste reste juste.
const ETAT_MOIS = {
  paye: ["Payé", "bg-emerald-100 text-emerald-800"],
  avance: ["Payé d'avance", "bg-sky-100 text-sky-800"],
  en_retard: ["En retard", "bg-rose-100 text-rose-800"],
  partiel: ["Payé en partie", "bg-amber-100 text-amber-800"],
  a_venir: ["À venir", "bg-navy-900/5 text-navy-900/60"],
};
function MoisParMois({ donnees, factures, declarations, devise, onDocument, onPayer, onPayerMois, moisPayables, peutRegler, encours }) {
  const lignes = lignesDetail(donnees);
  if (lignes.length === 0) return null;
  const parId = Object.fromEntries((factures || []).map((f) => [f.id, f]));
  const declareSur = enAttenteParFacture(declarations);
  //  Un mois déclaré attend la caisse : ni « Payer » une seconde fois, ni
  //  « à régler à la caisse ».
  const avancesEnAttente = (declarations || []).filter((d) => d.statut === "en_attente" && d.avance).map((d) => d.avance);

  const ligne = (l) => {
    const [txt, ton] = ETAT_MOIS[l.statut.cle] || ETAT_MOIS.a_venir;
    const f = l.factureId ? parId[l.factureId] : null;
    const du = l.statut.cle === "en_retard" || l.statut.cle === "partiel";
    const declare = (f && declareSur[f.id] > 0) || avancesEnAttente.some((a) => a.includes(l.libelle));
    const payerFacture = du && !declare && f && peutPayer(f) && peutRegler;
    const payerMois = du && !declare && !f && moisPayables.has(l.mois);
    const precision = declare ? "paiement déclaré, en attente de l'école"
      : l.date ? `payé le ${fmtDate(l.date)}${l.mode ? ` · ${l.mode}` : ""}`
        : l.statut.cle === "a_venir" && l.echeance ? `à payer avant le ${fmtDate(l.echeance)}`
          : du && !payerFacture && !payerMois ? "à régler à la caisse de l'école" : "";
    return (
      //  L'état reste à droite, à la même place sur chaque ligne : on lit la
      //  colonne d'un coup d'œil. Seule la précision passe à la ligne.
      <li key={l.cle} className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-900">{l.libelle}</p>
          <p className="text-xs text-navy-900/60">
            <span className="tabular-nums">{fmt(l.montant)} {devise}</span>
            {precision && <span className="block">{precision}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ton}`}>{txt}</span>
          {(l.factureId || l.paiementId || payerFacture || payerMois) && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {(payerFacture || payerMois) && (
                <button type="button" disabled={f && encours === f.id}
                  onClick={() => (payerFacture ? onPayer(f) : onPayerMois(l.mois))}
                  className="min-h-10 rounded-lg bg-navy-900 px-3 py-1 text-xs font-semibold text-creme disabled:opacity-60">
                  {f && encours === f.id ? "…" : "Payer"}
                </button>
              )}
              {l.factureId && (
                <button type="button" onClick={() => onDocument({ id: l.factureId, type: "facture" })}
                  className="min-h-10 rounded-lg border border-navy-900/15 px-3 py-1 text-xs font-medium text-navy-900/75 hover:border-or-500">
                  Facture
                </button>
              )}
              {l.paiementId && (
                <button type="button" onClick={() => onDocument({ id: l.factureId, type: "recu", paiementId: l.paiementId })}
                  className="min-h-10 rounded-lg border border-emerald-600/30 px-3 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-600">
                  Reçu
                </button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  const autres = lignes.filter((l) => l.cle.startsWith("autre:"));
  const scolarite = lignes.filter((l) => !l.cle.startsWith("autre:"));
  const panneaux = [
    ["Inscription", scolarite.filter((l) => !l.mois)],
    ["Mensualités", scolarite.filter((l) => l.mois)],
    ["Autres frais", autres],
  ].filter(([, l]) => l.length > 0);
  return (
    <>
      {panneaux.map(([titre, l]) => (
        <Carte key={titre} className="p-4">
          <h3 className="font-display text-lg font-bold text-navy-900">{titre}</h3>
          <ul className="divide-y divide-navy-900/5">{l.map(ligne)}</ul>
        </Carte>
      ))}
      <p className="text-xs text-navy-900/55">Le reçu apparaît dès que l'école a enregistré le paiement.</p>
    </>
  );
}

function Paiements({ factures, infos, declarations, eleveId, onChange }) {
  const devise = useDevise();
  //  Erreur du paiement en ligne : affichée DANS la rubrique, pas en haut de
  //  page, hors de l'écran d'un téléphone.
  const [erreur, setErreur] = useState("");
  const onErreur = setErreur;
  const [payer, setPayer] = useState(null); // facture à régler (flux manuel)
  // Volontairement pas « document » : ce nom masquerait l'objet global du DOM
  // dans tout le composant.
  // { id, type: "facture" | "recu", paiementId } : la pièce à ouvrir.
  const [factureDoc, setFactureDoc] = useState(null);
  const [enLigne, setEnLigne] = useState({ actif: false });
  //  Échec de lecture ≠ « pas configuré » : sans ce drapeau, une coupure
  //  réseau faisait dire « Le paiement n'est pas encore configuré ».
  const [pspEchec, setPspEchec] = useState(false);
  const [encours, setEncours] = useState(null); // id de facture en cours de redirection
  //  L'échéancier (mig. 210) : les mois payés et dus, et l'état de l'enfant.
  //  `null` : migration non appliquée ou échec — on garde alors la seule
  //  synthèse des factures, qui reste juste. Relu quand les factures changent
  //  (déclaration validée, avance…).
  const [echeancier, setEcheancier] = useState(null);
  //  Avec l'échéancier, la liste des FACTURES (numéros) se replie : le parent
  //  lit ses mois, et n'ouvre les factures que s'il les cherche.
  const [voirFactures, setVoirFactures] = useState(false);
  //  Les mois sans facture que le parent peut régler (`avance_options`), et
  //  celui dont il vient de toucher « Payer ».
  const [groupesAvance, setGroupesAvance] = useState([]);
  const [moisDemande, setMoisDemande] = useState(null);
  useEffect(() => {
    let vivant = true;
    enfantEcheancier(eleveId)
      .then((r) => { if (vivant) setEcheancier(r); })
      .catch(() => { if (vivant) setEcheancier(null); });
    return () => { vivant = false; };
  }, [eleveId, factures]);

  useEffect(() => {
    let vivant = true;
    setPspEchec(false);
    pspEtatEleve(eleveId)
      .then((r) => { if (vivant) setEnLigne(r || { actif: false }); })
      .catch(() => { if (vivant) { setEnLigne({ actif: false }); setPspEchec(true); } });
    return () => { vivant = false; };
  }, [eleveId]);

  // Paiement automatique : on demande l'URL au prestataire puis on redirige.
  async function payerEnLigne(f, reste) {
    setEncours(f.id); onErreur("");
    try {
      const { payment_url } = await initierPaiement(f.id, reste);
      window.location.href = payment_url;
    } catch (e) { onErreur(e.message || "Paiement en ligne indisponible."); setEncours(null); }
  }

  const visibles = facturesVisibles(factures);
  const synthese = syntheseFactures(factures);
  const aDesNumeros = MODES_MOBILE.some(([k]) => infos?.[k]);
  const statutLib = { en_attente: "En attente", rejete: "Rejeté" };
  const statutTon = { en_attente: "text-or-600", rejete: "text-rose-700" };
  //  🔴 UNE DÉCLARATION VALIDÉE N'EST PLUS UNE DÉCLARATION : c'est un
  //  encaissement, et il se consulte en reçu sur sa facture. Ici, seulement
  //  ce qui attend la caisse ou ce qu'elle a refusé (avec son motif).
  const aSuivre = declarationsAffichees(declarations);
  const declareSur = enAttenteParFacture(declarations);

  const ech = echeancier && Array.isArray(echeancier.lignes) && (echeancier.lignes.length > 0 || echeancier.statut === "exonere")
    ? echeancier : null;
  const resEch = ech ? resumeEcheancier(ech.lignes) : null;
  const etatEnfant = ech ? etatPaiement(ech.statut) : null;
  //  UN GESTE POUR TOUT LE RETARD (pistes du 09/11/2026) : avant, un
  //  « Payer » par mois. Le bouton ouvre la fenêtre des mois, déjà cochés ;
  //  il nomme les mois qu'il règle (l'inscription a son propre bouton).
  //  ⚠️ Un paiement déjà déclaré attend la caisse : pas de bouton, pour ne
  //  pas payer deux fois.
  const retard = resEch && aDesNumeros && !(declarations || []).some((d) => d?.statut === "en_attente")
    ? reglerRetard(resEch.dus, groupesAvance) : null;
  const prochaine = resEch?.aVenir[0];

  return (
    <div className="space-y-4">
      <Alerte ton="erreur">{erreur}</Alerte>
      {ech ? (
        //  Une ligne, pas un tableau de bord : ce qu'il y a à faire, ou que
        //  tout va bien. Le détail, c'est la liste des mois juste dessous.
        //  JAMAIS LA COULEUR SEULE : le badge dit l'état en toutes lettres.
        resEch.totalDu > 0 ? (
          <Carte className="space-y-2 border-t-4 border-t-or-500 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-navy-900/70">À régler maintenant</p>
              <BadgeStatut statut={ech.statut} className="shrink-0" />
            </div>
            <p className="whitespace-nowrap font-display text-3xl font-bold text-navy-900">{fmt(resEch.totalDu)} <span className="text-sm font-semibold">{devise}</span></p>
            {retard && (
              <Bouton className="w-full" onClick={() => setMoisDemande(retard.dernier)}>
                {/*  Le montant n'est répété que s'il diffère du total affiché
                     au-dessus (une inscription due a son propre bouton). */}
                Payer {retard.libelle.toLowerCase()}
                {retard.total !== resEch.totalDu && <span className="whitespace-nowrap">&nbsp;· {fmt(retard.total)} {devise}</span>}
              </Bouton>
            )}
            {prochaine && (
              <p className="text-sm text-navy-900/60">
                Prochaine échéance : {prochaine.echeance ? fmtDate(prochaine.echeance) : libelleLigne(prochaine)} · {fmt(prochaine.montant)} {devise}
              </p>
            )}
          </Carte>
        ) : (
          <Carte className="flex items-center justify-between gap-3 p-4">
            <p className="min-w-0 text-sm font-semibold text-navy-900/70">{etatEnfant.explication}</p>
            <BadgeStatut statut={ech.statut} className="shrink-0" />
          </Carte>
        )
      ) : visibles.length > 0 ? (
        <Carte className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-navy-900/60">Total facturé</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{fmt(synthese.facture)} <span className="text-xs font-normal">{devise}</span></p>
            </div>
            <div>
              <p className="text-sm text-navy-900/60">Total payé</p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-700">{fmt(synthese.paye)} <span className="text-xs font-normal">{devise}</span></p>
            </div>
            <div>
              <p className="text-sm text-navy-900/60">Reste à payer</p>
              <p className={`mt-1 font-display text-2xl font-bold ${synthese.reste > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {fmt(synthese.reste)} <span className="text-xs font-normal">{devise}</span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-navy-900/70">
            {synthese.reste > 0
              ? `${synthese.aRegler} facture${synthese.aRegler > 1 ? "s" : ""} à régler.`
              : "Tout est réglé."}
          </p>
        </Carte>
      ) : (
        <Carte className="p-6 text-sm text-navy-900/40">Aucune facture.</Carte>
      )}

      {ech && (
        <MoisParMois donnees={ech} factures={factures} declarations={declarations} devise={devise}
          onDocument={setFactureDoc}
          onPayerMois={setMoisDemande}
          moisPayables={aDesNumeros ? new Set(groupesAvance.map((g) => g.mois)) : new Set()}
          onPayer={(f) => {
            const reste = resteFacture(f);
            if (enLigne.actif) payerEnLigne(f, reste);
            else if (aDesNumeros) setPayer({ ...f, reste });
          }}
          peutRegler={enLigne.actif || aDesNumeros} encours={encours} />
      )}

      {/*  Le paiement anticipé (mig. 202) : AVANT la liste, et même sans
          aucune facture — c'est précisément le cas où il sert. Il reçoit
          TOUTES les déclarations : une avance validée y reste « payée ». */}
      <PayerAvance eleveId={eleveId} infos={infos} aDesNumeros={aDesNumeros}
        declarations={declarations} onChange={onChange}
        onGroupes={setGroupesAvance} moisDemande={moisDemande} onFermerDemande={() => setMoisDemande(null)} />

      {visibles.length > 0 && ech && (
        <button type="button" onClick={() => setVoirFactures((v) => !v)} aria-expanded={voirFactures}
          className="min-h-10 text-sm font-medium text-navy-700 underline-offset-2 hover:underline">
          {voirFactures ? "Masquer les factures" : `Voir les factures (${visibles.length})`}
        </button>
      )}
      {visibles.length > 0 && (!ech || voirFactures) && (
        <Carte className="divide-y divide-navy-900/5 overflow-hidden">
          {visibles.map((f) => {
            const reste = resteFacture(f);
            const e = etatFacture(f);
            const payable = peutPayer(f);
            const nbRecus = Number(f.nb_paiements) || 0;
            return (
              <div key={f.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-navy-900">{f.numero}</p>
                    <p className="text-xs text-navy-900/60">Échéance : {f.date_echeance ? fmtDate(f.date_echeance) : "—"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.ton}`}>{e.label}</span>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-navy-900/60">Montant</dt>
                    <dd className={`font-mono ${estAnnulee(f) ? "text-navy-900/60 line-through" : "text-navy-900"}`}>{fmt(f.montant_total)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy-900/60">Déjà payé</dt>
                    <dd className="font-mono text-emerald-700">{fmt(f.montant_paye)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy-900/60">Solde</dt>
                    <dd className={`font-mono font-semibold ${reste > 0 ? "text-rose-700" : "text-navy-900/70"}`}>{fmt(reste)}</dd>
                  </div>
                </dl>

                {declareSur[f.id] > 0 && (
                  <p className="mt-2 text-xs text-or-700">
                    ⏳ Paiement de {fmt(declareSur[f.id])} {devise} déclaré, en attente de validation par l&apos;école.
                  </p>
                )}

                {/* Boutons de 40 px de haut : ils se touchent au doigt. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {payable && enLigne.actif && (
                    <button onClick={() => payerEnLigne(f, reste)} disabled={encours === f.id}
                      className="min-h-10 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
                      {encours === f.id ? "…" : "💳 En ligne"}
                    </button>
                  )}
                  {payable && aDesNumeros && (
                    <button onClick={() => setPayer({ ...f, reste })} className="min-h-10 rounded-lg bg-navy-900 px-3 py-1 text-xs font-medium text-creme">
                      Déclarer un paiement
                    </button>
                  )}
                  {/* Le parent réclamait systématiquement sa facture au
                      secrétariat : il peut l'éditer lui-même, payée ou non. */}
                  <button onClick={() => setFactureDoc({ id: f.id, type: "facture" })}
                    className="min-h-10 rounded-lg border border-navy-900/15 px-3 py-1 text-xs font-medium text-navy-900/70 hover:border-or-500">
                    🧾 Facture
                  </button>
                  {aDesRecus(f) && (
                    <button onClick={() => setFactureDoc({ id: f.id, type: "recu", paiementId: f.dernier_paiement_id })}
                      className="min-h-10 rounded-lg border border-emerald-600/30 px-3 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-600">
                      ✅ {nbRecus > 1 ? `Reçus (${nbRecus})` : "Reçu"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Carte>
      )}

      {enLigne.actif && (
        <p className="text-xs text-navy-900/50">
          💳 <b>Paiement en ligne</b> ({enLigne.prestataire === "paydunya" ? "PayDunya" : "CinetPay"}) : réglez par Wave, Orange Money ou carte — la facture se met à jour automatiquement.
          {enLigne.commission_a_charge === "parent" && ` Des frais de ${Math.round((enLigne.commission_taux || 0) * 100)} % sont ajoutés.`}
        </p>
      )}
      {!aDesNumeros && !enLigne.actif && (
        pspEchec ? (
          <p className="text-xs text-navy-900/60">
            Le paiement en ligne n&apos;a pas pu être vérifié (connexion ?). Rouvrez cette rubrique pour réessayer.
          </p>
        ) : (
          <p className="text-xs text-navy-900/50">Le paiement n&apos;est pas encore configuré par l&apos;établissement.</p>
        )
      )}

      {aSuivre.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-2 font-display font-semibold text-navy-900">Déclarations en attente ou rejetées</h3>
          <ul className="space-y-1 text-sm">
            {aSuivre.map((d) => (
              <li key={d.id}>
                <div className="flex items-center justify-between">
                  <span className="text-navy-900/70">
                    {d.avance ? `Avance ${d.avance}${d.numero ? ` (${d.numero})` : ""}` : d.numero} · {fmt(d.montant)} {devise}
                    {/*  Les deux parents lisent la même liste : on dit qui a déclaré. */}
                    {d.declarant && d.declarant !== "Vous" && <span className="text-navy-900/45"> · par {d.declarant}</span>}
                  </span>
                  <span className={`text-xs font-medium ${statutTon[d.statut]}`}>{statutLib[d.statut] || d.statut}</span>
                </div>
                {/*  🔴 LE MOTIF DU REJET (mig. 201). Sans lui, le parent
                    voyait « Rejeté » et rien d’autre : il recommençait à
                    l’identique, ou appelait l’école. */}
                {d.statut === "rejete" && d.motif && (
                  <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {d.motif}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-navy-900/50">Un paiement validé par l&apos;école se retrouve en reçu, sur sa facture.</p>
        </Carte>
      )}

      <ModalePayer
        facture={payer} infos={infos} eleveId={eleveId}
        onFermer={() => setPayer(null)}
        /*  Une erreur REMONTE à la modale, qui l'affiche : relayée à la page,
            elle s'écrivait DERRIÈRE la modale restée ouverte, invisible. */
        onDeclare={async (data) => {
          const preuve = data.fichier ? await televerserPreuve(eleveId, data.fichier) : null;
          await declarerPaiement(payer.id, data.montant, data.mode, data.reference, preuve);
          setPayer(null);
          await onChange();
        }}
      />

      {factureDoc && (
        <ModaleDocument factureId={factureDoc.id} initial={factureDoc.type} paiementId={factureDoc.paiementId}
          onFermer={() => setFactureDoc(null)} />
      )}
    </div>
  );
}

// Payer un ou plusieurs mois AVANT que l'école les facture (mig. 202).
//
// Le parent coche des mois, pas un montant : le tarif vient de la base, et
// c'est elle qui recalcule le total déclaré. À la validation par la caisse,
// la facture du mois est créée déjà réglée, et le parent est prévenu.
function PayerAvance({ eleveId, infos, aDesNumeros, declarations = [], onChange, onGroupes, moisDemande, onFermerDemande }) {
  const [groupes, setGroupes] = useState([]);
  const [echec, setEchec] = useState(false);
  const [version, setVersion] = useState(0);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let vivant = true;
    setEchec(false);
    //  Sans tarif mensuel ni inscription, la liste revient VIDE et la carte
    //  n'apparaît simplement pas. Un ÉCHEC, lui, n'est pas une liste vide :
    //  on le dit, avec de quoi réessayer.
    avanceOptions(eleveId)
      .then((l) => { if (vivant) { const g = grouperParMois(l); setGroupes(g); onGroupes?.(g); } })
      .catch(() => { if (vivant) { setGroupes([]); onGroupes?.([]); setEchec(true); } });
    return () => { vivant = false; };
    // `onGroupes` est un setter stable : on ne relit pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveId, version]);

  //  « Payer » sur la ligne d'un mois : la fenêtre s'ouvre, ce mois coché.
  useEffect(() => { if (moisDemande) setOuvert(true); }, [moisDemande]);
  const fermer = () => { setOuvert(false); onFermerDemande?.(); };

  //  Deux parents, un enfant : ce que l'un a payé d'avance disparaît de la
  //  liste de l'autre. On dit pourquoi, et qui l'a fait.
  const couvertes = avancesCouvertes(declarations);

  //  La déclaration passe par le mobile money de l'école : sans numéro
  //  configuré, le parent paie au guichet, et la caisse encaisse l'avance.
  if (!aDesNumeros) return null;
  if (echec) {
    return (
      <Carte className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-navy-900/70">
        <span>Le paiement d&apos;avance n&apos;a pas pu être chargé.</span>
        <Bouton variante="fantome" onClick={() => setVersion((v) => v + 1)}>Réessayer</Bouton>
      </Carte>
    );
  }
  if (groupes.length === 0 && couvertes.length === 0) return null;

  return (
    <Carte className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <h3 className="font-display font-semibold text-navy-900">Payer plusieurs mois</h3>
        {groupes.length > 0 ? (
          <p className="mt-0.5 text-sm text-navy-900/60">
            Réglez {groupes[0].libelle}{groupes.length > 1 ? " et les mois suivants" : ""} en une fois,
            {" "}même à l'avance : la facture sera émise déjà payée.
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-navy-900/60">Tous les mois restants de l&apos;année sont déjà réglés ou facturés.</p>
        )}
        {couvertes.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-navy-900/60">
            {couvertes.map((c) => (
              <li key={c.id}>
                {c.enAttente ? "⏳" : "✅"} {c.mois} : payé d&apos;avance{c.par ? ` par ${c.par}` : " par vous"}
                {c.enAttente ? ", en attente de validation" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      {groupes.length > 0 && <Bouton onClick={() => setOuvert(true)}>Choisir les mois</Bouton>}

      {ouvert && (
        <ModaleAvance
          groupes={groupes} infos={infos} moisInitial={moisDemande}
          onFermer={fermer}
          onDeclare={async ({ mois, mode, reference, fichier }) => {
            //  L'erreur remonte à la modale, qui l'affiche (cf. ModalePayer).
            const preuve = await televerserPreuve(eleveId, fichier);
            await declarerAvance(eleveId, mois, mode, reference, preuve);
            fermer();
            setVersion((v) => v + 1);
            await onChange();
          }}
        />
      )}
    </Carte>
  );
}

function ModaleAvance({ groupes, infos, moisInitial, onFermer, onDeclare }) {
  const devise = useDevise();
  //  Ouverte depuis un mois : lui et ceux d'avant, jamais de trou (cf. basculerMois).
  const [choisis, setChoisis] = useState(() => (moisInitial ? basculerMois(groupes, [], moisInitial) : choixParDefaut(groupes)));
  //  Premier mode configuré par l'école : un clic de moins dans le cas courant.
  const [mode, setMode] = useState(() => (MODES_MOBILE.find(([k]) => infos?.[k]) || ["wave"])[0]);
  const [reference, setReference] = useState("");
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const total = totalDesMois(groupes, choisis);
  const numero = infos?.[mode];
  const libelles = groupes.filter((g) => choisis.includes(g.mois)).map((g) => g.libelle);

  return (
    <Modale ouvert onFermer={onFermer} titre="Payer">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-navy-900/60">1. Choisissez les mois à payer :</p>
          <div className="space-y-1.5">
            {groupes.map((g) => {
              const coche = choisis.includes(g.mois);
              return (
                <label key={g.mois}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    coche ? "border-navy-900 bg-navy-900/5" : "border-navy-900/15"}`}>
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={coche}
                      onChange={() => setChoisis((c) => basculerMois(groupes, c, g.mois))} />
                    <span className="font-medium text-navy-900">{g.libelle}</span>
                  </span>
                  <span className="font-mono text-navy-900/70">{fmt(g.total)}</span>
                </label>
              );
            })}
          </div>
          {groupes[0]?.lignes.length > 1 && (
            <p className="mt-1 text-xs text-navy-900/50">
              Par mois : {groupes[0].lignes.map((l) => `${l.libelle.split(" — ")[0]} ${fmt(l.montant)}`).join(" + ")}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-creme p-4 text-sm">
          <p className="text-navy-900/60">2. Payez <b className="text-navy-900">{fmt(total)} {devise}</b> depuis votre application mobile money :</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES_MOBILE.map(([k, label]) => infos?.[k] && (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === k ? "bg-navy-900 text-creme" : "bg-white text-navy-900/70 border border-navy-900/15"}`}>
                {label}
              </button>
            ))}
          </div>
          {numero && <p className="mt-3 font-display text-xl font-bold text-navy-900">{numero}</p>}
          {libelles.length > 0 && (
            <p className="mt-1 text-xs text-navy-900/50">Motif à indiquer : <span className="font-mono">Scolarité {resumeMois(libelles)}</span></p>
          )}
        </div>

        <p className="text-sm text-navy-900/60">3. Déclarez votre paiement, l&apos;école le validera :</p>
        <Champ label="Réf. transaction" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID Wave/OM…" />
        <label className="block">
          {/*  Même exigence que pour une facture (mig. 198) : sans preuve,
              la caisse n'a rien à vérifier, et la base refuse. */}
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Preuve de paiement <span className="text-rose-700">(obligatoire)</span></span>
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm" />
          {fichier && <span className="mt-1 block text-xs text-emerald-700">📎 {fichier.name}</span>}
        </label>

        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton
            disabled={envoi || choisis.length === 0 || !fichier}
            onClick={async () => {
              setEnvoi(true); setErreur("");
              try { await onDeclare({ mois: choisis, mode, reference, fichier }); }
              catch (e) { setErreur(e.message); }
              finally { setEnvoi(false); }
            }}
          >
            {envoi ? "Envoi…" : `Déclarer ${fmt(total)} ${devise}`}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

// Facture et reçus d'une facture, imprimables par le parent lui-même.
// Tout arrive en un seul appel (migration 142) : le document s'affiche d'un
// bloc, il ne se compose pas progressivement sous les yeux du parent.
//
// `initial = "recu"` : ouvert depuis le bouton « Reçu », le document montre
// d'emblée un reçu — celui de `paiementId`, sinon le plus récent. Les autres
// restent à un clic dans le sélecteur « Pièce ».
function ModaleDocument({ factureId, onFermer, initial = "facture", paiementId = null }) {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [apercu, setApercu] = useState({ type: "facture", paiement: null });

  useEffect(() => {
    let vivant = true;
    enfantFactureDetail(factureId)
      .then((r) => {
        if (!vivant) return;
        setD(r);
        const p = initial === "recu" ? recuParDefaut(r?.paiements, paiementId) : null;
        if (p) setApercu({ type: "recu", paiement: p });
      })
      .catch((e) => { if (vivant) setErreur(e.message); });
    return () => { vivant = false; };
  }, [factureId, initial, paiementId]);

  const f = d?.facture;
  const recu = apercu.type === "recu";
  const rangRecu = recu ? (d?.paiements || []).findIndex((x) => x.id === apercu.paiement?.id) + 1 : 0;
  // Une université émet un document sobre : la mise en page « carnet » est un
  // usage du primaire et du secondaire.
  const ecoleStyle = d?.ecole?.type_etablissement !== "superieur";

  return (
    <Modale ouvert onFermer={onFermer} titre={f ? `Facture ${f.numero}` : "Facture"} large>
      <Alerte ton="erreur">{erreur}</Alerte>

      {!d ? (
        //  En échec, l'alerte ci-dessus suffit : pas de « Chargement… » éternel à côté.
        erreur ? null : <p className="text-sm text-navy-900/50" role="status">Chargement…</p>
      ) : !ecoleStyle ? (
        <p className="text-sm text-navy-900/50">
          Document indisponible à l&apos;impression pour cet établissement.
        </p>
      ) : (
        <div className="space-y-4">
          {d.paiements.length > 0 && (
            <div className="no-print flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-navy-900/45">Pièce :</span>
              <button type="button" onClick={() => setApercu({ type: "facture", paiement: null })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${!recu ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/60"}`}>
                Facture
              </button>
              {d.paiements.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setApercu({ type: "recu", paiement: p })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${apercu.paiement?.id === p.id ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/60"}`}>
                  Reçu {i + 1} · {fmt(p.montant)}
                </button>
              ))}
            </div>
          )}

          <DocumentCaisse
            type={apercu.type}
            ecole={d.ecole} identite={d.identite} mobile={d.mobile}
            numero={recu ? `${f.numero}-R${rangRecu}` : f.numero}
            date={recu ? apercu.paiement?.date_paiement : f.date_emission}
            objet={objetFacture(d.lignes, f.notes)}
            destinataire={[`${d.eleve?.prenom || ""} ${d.eleve?.nom || ""}`.trim(), d.eleve?.matricule]
              .filter(Boolean).join(" · ")}
            lignes={recu
              ? [{ id: apercu.paiement?.id, libelle: `Règlement sur facture ${f.numero}`, quantite: 1,
                   prix_unitaire: apercu.paiement?.montant, montant: apercu.paiement?.montant }]
              : d.lignes}
            total={recu ? apercu.paiement?.montant : f.montant_total}
            paiement={recu ? {
              mode: (MODES_MOBILE.find((m) => m[0] === apercu.paiement?.mode) || [])[1] || apercu.paiement?.mode,
              reference: apercu.paiement?.reference,
              payeur: `${d.eleve?.prenom || ""} ${d.eleve?.nom || ""}`.trim(),
            } : null}
            codeVerification={codeFacture(f.id)}
          />

          <div className="no-print flex justify-end">
            <Bouton variante="fantome" onClick={() => window.print()}>
              Imprimer {recu ? "le reçu" : "la facture"}
            </Bouton>
          </div>
        </div>
      )}
    </Modale>
  );
}

function ModalePayer({ facture, infos, onFermer, onDeclare }) {
  //  Premier mode CONFIGURÉ par l'école (comme pour l'avance) : « wave » en
  //  dur présélectionnait un mode sans numéro, et le parent déclarait un
  //  paiement Wave à une école qui n'a pas Wave.
  const modeParDefaut = (MODES_MOBILE.find(([k]) => infos?.[k]) || ["wave"])[0];
  const [mode, setMode] = useState(modeParDefaut);
  const [montant, setMontant] = useState("");
  const [reference, setReference] = useState("");
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (facture) {
      setMontant(String(Math.round(facture.reste || 0))); setReference(""); setMode(modeParDefaut);
      setFichier(null); setErreur("");
    }
  }, [facture, modeParDefaut]);

  if (!facture) return null;
  const numero = infos?.[mode];

  return (
    <Modale ouvert={!!facture} onFermer={onFermer} titre={`Payer la facture ${facture.numero}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-creme p-4 text-sm">
          <p className="text-navy-900/60">1. Payez depuis votre application mobile money sur le numéro de l'école :</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES_MOBILE.map(([k, label]) => infos?.[k] && (
              <button key={k} onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === k ? "bg-navy-900 text-creme" : "bg-white text-navy-900/70 border border-navy-900/15"}`}>
                {label}
              </button>
            ))}
          </div>
          {numero && (
            <p className="mt-3 font-display text-xl font-bold text-navy-900">{numero}</p>
          )}
          <p className="mt-1 text-xs text-navy-900/50">Référence à indiquer : <span className="font-mono">{facture.numero}</span></p>
        </div>

        <p className="text-sm text-navy-900/60">2. Déclarez votre paiement, l'école le validera :</p>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Montant payé" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^0-9]/g, ""))} />
          <Champ label="Réf. transaction" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID Wave/OM…" />
        </div>

        <label className="block">
          {/* 🔴 C’ÉTAIT « optionnel », ET C’EST CE QUI A PRODUIT LE DÉFAUT : une
              déclaration de 65 000 F est partie en validation sans preuve NI
              référence, chez une vraie école. La caisse n’avait qu’un montant et
              un nom. La base l’exige désormais (mig. 198) — ce libellé et le
              bouton désactivé ne font que le dire avant l’envoi. */}
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Preuve de paiement <span className="text-rose-700">(obligatoire)</span></span>
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm" />
          <span className="mt-1 block text-xs text-navy-900/50">
            La capture d&apos;écran ou le SMS de confirmation. Sans elle, l&apos;école
            n&apos;a aucun moyen de vérifier votre paiement.
          </span>
          {fichier && <span className="mt-1 block text-xs text-emerald-700">📎 {fichier.name}</span>}
        </label>

        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton
            disabled={envoi || !montant || !fichier}
            onClick={async () => {
              setEnvoi(true); setErreur("");
              try { await onDeclare({ montant: Number(montant), mode, reference, fichier }); }
              catch (e) { setErreur(e.message); }
              finally { setEnvoi(false); }
            }}
          >
            {envoi ? "Envoi…" : "Déclarer le paiement"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

function Absences({ absences, onChange }) {
  const [justif, setJustif] = useState(null); // absence à justifier
  if (absences.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune absence enregistrée 🎉</Carte>;
  const lib = { non_justifie: "Non justifié", en_attente: "En attente", justifie: "Justifié" };
  const ton = { non_justifie: "text-rose-700", en_attente: "text-or-600", justifie: "text-emerald-700" };
  return (
    <div className="space-y-2">
      {absences.map((a, i) => (
        <Carte key={a.id || i} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-mono text-xs text-navy-900/50">{dateFr(a.date_abs)}</span>{" "}
              <span className="font-medium text-navy-900 capitalize">{a.type === "retard" ? "Retard" : "Absence"}</span>
              {a.motif && <span className="text-navy-900/50"> · {a.motif}</span>}
            </p>
            {a.justification && <p className="mt-0.5 text-xs text-navy-900/50">Votre justification : « {a.justification} »</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${ton[a.statut] || ""}`}>{lib[a.statut] || a.statut}</span>
            {a.statut === "non_justifie" && (
              <button onClick={() => setJustif(a)} className="min-h-10 rounded-lg bg-navy-900 px-3 py-1 text-xs font-medium text-creme">Justifier</button>
            )}
          </div>
        </Carte>
      ))}

      <ModaleJustif
        absence={justif} onFermer={() => setJustif(null)}
        onEnvoyer={async (texte) => {
          //  L'erreur remonte à la modale, qui l'affiche (cf. ModalePayer).
          await justifierAbsenceParent(justif.id, texte); setJustif(null); await onChange();
        }}
      />
    </div>
  );
}

function ModaleJustif({ absence, onFermer, onEnvoyer }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  useEffect(() => { if (absence) { setTexte(""); setErreur(""); } }, [absence]);
  if (!absence) return null;
  return (
    <Modale ouvert={!!absence} onFermer={onFermer} titre={`Justifier l'absence du ${absence.date_abs}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Motif de l'absence</span>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3}
            placeholder="Ex. : enfant malade, rendez-vous médical…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <p className="text-xs text-navy-900/50">Votre justification sera transmise à l'établissement pour validation.</p>
        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={envoi || !texte.trim()}
            onClick={async () => {
              setEnvoi(true); setErreur("");
              try { await onEnvoyer(texte.trim()); }
              catch (e) { setErreur(e.message); }
              finally { setEnvoi(false); }
            }}>
            {envoi ? "…" : "Envoyer"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

// Le suivi des acquis, tel que la famille le lit (mig. 172).
//
// ⚠️ ON NE MONTRE QUE CE QUI A ÉTÉ OBSERVÉ. Un référentiel de 60 items dont
// 3 renseignés ne doit pas afficher 57 lignes vides : l'absence est déjà
// une information, et l'étaler ferait passer un suivi en cours pour un
// bilan accablant.
function Acquis({ lignes = [] }) {
  if (!lignes.length) {
    return (
      <p className="rounded-2xl bg-navy-900/[0.03] p-4 text-sm text-navy-900/60">
        Aucune observation enregistrée pour le moment.
      </p>
    );
  }
  const groupes = [];
  for (const l of lignes) {
    let g = groupes.find((x) => x.domaine === l.domaine);
    if (!g) { g = { domaine: l.domaine, lignes: [] }; groupes.push(g); }
    g.lignes.push(l);
  }
  return (
    <div className="space-y-4">
      {groupes.map((g) => (
        <div key={g.domaine} className="overflow-hidden rounded-2xl border border-navy-900/10">
          <h3 className="border-b border-navy-900/10 bg-navy-900/[0.03] px-4 py-2.5 font-display text-sm font-semibold text-navy-900">
            {g.domaine}
          </h3>
          <ul className="divide-y divide-navy-900/5">
            {g.lignes.map((l, i) => {
              const v = valeurAcquis(l.valeur);
              return (
                <li key={i} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-sm text-navy-900/80">{l.libelle}</span>
                    {v && (
                      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-navy-900/60">
                        {v.pastille} {v.label}
                      </span>
                    )}
                  </div>
                  {l.observation && (
                    <p className="mt-1 text-xs italic text-navy-900/50">{l.observation}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {/* ⚠️ Dire ce que ce suivi EST, pour qu'il ne se lise pas comme un
          bulletin chiffré. */}
      <p className="text-xs text-navy-900/40">
        Au préscolaire, l&apos;équipe observe les acquis plutôt que de donner des notes.
        « Pas encore acquis » décrit une étape du parcours, pas un échec.
      </p>
    </div>
  );
}
