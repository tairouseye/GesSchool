import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import BarreRubriques from "@/composants/BarreRubriques.jsx";
import {
  enfantNotes, enfantFactures, enfantAbsences, enfantEmploi, enfantFournitures,
  ecolePaiementInfos, declarerPaiement, televerserPreuve, enfantDeclarations, justifierAbsenceParent,
  enfantBulletins, enfantBulletinLignes, demanderDocument, mesDemandes, TYPES_DOCUMENT,
  enfantCantine, enfantMenuCantine, enfantTransport, mesEnfants,
  alertesEnfant, marquerAlertesLues, monAccesNotes, demanderAccesNotes,
  enfantFactureDetail, avanceOptions, declarerAvance,
} from "@/lib/parent.js";
import { grouperParMois, choixParDefaut, basculerMois, totalDesMois, resumeMois, avancesCouvertes } from "@/lib/avance.js";
import {
  facturesVisibles, syntheseFactures, resteFacture, etatFacture, peutPayer, estAnnulee,
  declarationsAffichees, enAttenteParFacture, aDesRecus, recuParDefaut,
} from "@/lib/situationParent.js";
import DocumentCaisse from "@/composants/DocumentCaisse.jsx";
import { fourniParEcole, aAcheter, grouperFournitures, messageFournitures, lienPartageWhatsApp } from "@/lib/fournituresPartage.js";
import { annoncesEnfant } from "@/lib/annonces.js";
import { lienFichier, poids } from "@/lib/fichiers.js";
import { pourGrille } from "@/lib/emploi.js";
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

const MODES_MOBILE = [["wave", "Wave"], ["orange_money", "Orange Money"], ["free_money", "Free Money"]];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const fmtDate = (d) =>
  (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

export default function ParentEnfant() {
  //  ⚠️ LA RUBRIQUE OUVERTE VIT DANS L'ADRESSE (/parent/enfant/:id/:rubrique),
  //  plus dans un état local. Avant, le bouton retour d'Android quittait la
  //  fiche de l'enfant au lieu de revenir à la rubrique précédente, et aucune
  //  alerte ne pouvait mener directement à « Paiements ».
  const { id, rubrique } = useParams();
  const navigate = useNavigate();
  const lienRubrique = (cle) => (cle ? `/parent/enfant/${id}/${cle}` : `/parent/enfant/${id}`);
  const [enfant, setEnfant] = useState(null);
  const [notes, setNotes] = useState([]);
  const [factures, setFactures] = useState([]);
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
    const [enf, f, dem, can, tra, al] = await Promise.allSettled([
      mesEnfants(), enfantFactures(id), mesDemandes(), enfantCantine(id), enfantTransport(id), alertesEnfant(id),
    ]);
    if (enfantCourant.current !== pour) return;
    const val = (r, defaut) => (r.status === "fulfilled" ? r.value ?? defaut : defaut);
    const liste = enf.status === "fulfilled" ? enf.value || [] : null;
    setEnfant(liste ? liste.find((x) => x.eleve_id === pour) || null : null);
    setInconnu(liste != null && !liste.some((x) => x.eleve_id === pour));
    setFactures(val(f, [])); setDemandes(val(dem, [])); setCantine(val(can, null)); setTransport(val(tra, null));
    setAlertes(val(al, {}));
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
    setFactures([]); setInfos({}); setDeclarations([]); setAbsences([]); setCahier([]);
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
  //  Une facture annulée ou un brouillon ne doit rien : ni pastille, ni dette.
  const impayes = syntheseFactures(factures).aRegler;
  //  `mes_demandes` couvre toute la fratrie : on ne garde que CET enfant
  //  (`eleve_id`, mig. 208). Sans la colonne (base pas encore migrée), on
  //  conserve l'ancien comportement plutôt que de tout masquer.
  const demandesEnfant = demandes.filter((d) => d.eleve_id === undefined || d.eleve_id === id);
  const demandesEnCours = demandesEnfant.filter((d) => d.statut === "en_attente" || d.statut === "en_cours").length;
  const badges = {
    paiements: impayes, documents: demandesEnCours,
    notes: alertes.note || 0, absences: alertes.absence || 0,
  };

  const sectionActive = TUILES.find((t) => t.cle === onglet);

  return (
    <div className="space-y-5">
      {onglet === null || inconnu ? (
        <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      ) : (
        <>
          {/* Dans une rubrique : l'enfant courant, le retour à sa grille, et
              la barre pour passer directement à une autre rubrique. */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display font-semibold text-navy-900">{enfant ? `${enfant.prenom} ${enfant.nom}` : "Mon enfant"}</p>
              {enfant?.classe && <p className="truncate text-xs text-navy-900/60">{enfant.classe}{enfant.ecole ? ` · ${enfant.ecole}` : ""}</p>}
            </div>
            <Link to={lienRubrique(null)} className="shrink-0 text-sm font-medium text-navy-700 hover:text-or-600">Toutes les rubriques</Link>
          </div>
          <BarreRubriques
            label={`Rubriques de ${enfant?.prenom || "l'enfant"}`}
            className="-mx-6"
            actif={onglet}
            items={tuiles.map((t) => ({
              cle: t.cle, label: t.label, to: lienRubrique(t.cle),
              pastille: badges[t.cle] || 0, pastilleRouge: t.cle === "paiements",
            }))} />
        </>
      )}
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
          {/* En-tête + grille de tuiles colorées (accueil de l'enfant) */}
          <div className="flex items-start justify-between gap-3 rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
            <div className="flex min-w-0 items-center gap-3">
              {/*  Rien ne s'affiche s'il n'y a pas de photo : pas de cadre
                  vide ni d'icone generique, qui donneraient l'impression
                  d'une image cassee. */}
              {enfant?.photo && (
                <Photo bucket="eleves" valeur={enfant.photo} alt=""
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-creme/25" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-creme/60">Bonjour 👋</p>
                <p className="font-display text-2xl font-bold">{enfant ? `${enfant.prenom} ${enfant.nom}` : "Mon enfant"}</p>
                <p className="truncate text-sm text-creme/70">{enfant?.classe || ""}{enfant?.ecole ? ` · ${enfant.ecole}` : ""}</p>
              </div>
            </div>
            {enfant?.logo && (
              <img src={enfant.logo} alt={enfant.ecole || "École"} title={enfant.ecole || ""}
                className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tuiles.map((t) => (
              <button
                key={t.cle}
                onClick={() => navigate(lienRubrique(t.cle))}
                className="group relative flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-white/5 bg-navy-800 p-4 text-left shadow-md ring-1 ring-inset ring-white/5 transition hover:bg-navy-700 hover:ring-or-500/30 active:scale-[.98]"
              >
                <Icone name={t.cle} className="h-7 w-7 text-or-500" />
                <span className="text-sm font-semibold text-creme">{t.label}</span>
                {badges[t.cle] > 0 && (
                  <span className={`absolute right-2.5 top-2.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold shadow ${
                    t.cle === "paiements" ? "bg-rose-500 text-white" : "bg-or-500 text-navy-900"
                  }`}>
                    {badges[t.cle]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy-900">
            {sectionActive && <Icone name={sectionActive.cle} className="h-6 w-6 text-or-600" />}
            {sectionActive?.label}
          </h2>
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
  );
}

// Sections de l'enfant, en tuiles « sombre élégant » (navy + icône dorée).
const TUILES = [
  { cle: "notes",       label: "Notes" },
  //  ⚠️ Au préscolaire on n'évalue pas, on OBSERVE : cette tuile remplace
  //  « Notes » pour les plus petits. Elle n'apparaît que si l'école a
  //  réellement enregistré des observations — une tuile vide inquiéterait
  //  un parent sans rien lui apprendre (mig. 172).
  { cle: "acquis",      label: "Suivi des acquis" },
  { cle: "bulletins",   label: "Bulletins" },
  { cle: "cahier",      label: "Cahier de textes" },
  { cle: "emploi",      label: "Emploi du temps" },
  { cle: "paiements",   label: "Paiements" },
  { cle: "absences",    label: "Absences" },
  { cle: "fournitures", label: "Fournitures" },
  { cle: "documents",   label: "Documents" },
  { cle: "annonces",    label: "Annonces" },
  { cle: "cantine",     label: "Cantine" },
  { cle: "transport",   label: "Transport" },
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
              <Link to={lienBulletins} className="text-xs font-medium text-navy-700 underline-offset-2 hover:text-or-600 hover:underline">
                Moyenne générale : voir le bulletin
              </Link>
            </div>
            {/* Sur téléphone, le tableau défile horizontalement s'il déborde ;
                la zone est atteignable au clavier pour défiler aussi. */}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Notes — ${periode}`}>
              <table className="w-full min-w-[18rem] text-left text-sm">
                <caption className="sr-only">Notes de la période {periode}, et moyenne provisoire par matière sur 20</caption>
                <thead className="bg-creme text-navy-900/60">
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
                      <td className="px-4 py-2 text-right font-mono sm:px-6">{m.sC ? (m.sN / m.sC).toFixed(2) : "—"}</td>
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
function Emploi({ creneaux, enfant }) {
  if (creneaux.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/40">Aucun emploi du temps disponible.</Carte>;
  }
  return (
    <Carte className="p-4">
      <GrilleEmploi creneaux={creneaux.map((c) => pourGrille(c))}
        ecole={{ couleur_primaire: enfant?.couleur_primaire, couleur_secondaire: enfant?.couleur_secondaire }}
        entete={{ logo: enfant?.logo, nom: enfant?.ecole, titre: enfant?.classe ? `Classe ${enfant.classe}` : "", sous: "Emploi du temps" }} />
    </Carte>
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
  if (liste.length === 0) return null;
  //  ⚠️ Un échec était silencieux : le parent touchait la pièce jointe et
  //  rien ne se passait.
  const [echec, setEchec] = useState("");
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

function Fournitures({ items, enfant }) {
  // Ce que le parent doit encore acheter : coché par défaut, il décoche ce
  // qu'il a déjà. Une liste de rentrée s'achète en plusieurs fois.
  const [pris, setPris] = useState(() => new Set());
  const [copie, setCopie] = useState(false);

  if (items.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune liste de fournitures publiée.</Carte>;

  // Une clé stable par article : les libellés se répètent d'une catégorie à
  // l'autre (« Gomme » chez Maison ET Petit matériel), l'index seul ne suffit
  // pas à les distinguer une fois la liste regroupée.
  const restants = aAcheter(items).map((f, i) => ({ ...f, _k: `${i}-${f.libelle}` }));
  // `grouperFournitures` nettoie le libellé du préfixe mais conserve le
  // reste de l'article — la clé `_k` posée ci-dessus survit au regroupement.
  const groupes = grouperFournitures(restants);
  const ecoleFournit = grouperFournitures(items.filter(fourniParEcole));
  const selection = restants.filter((f) => !pris.has(f._k));

  const basculer = (k) => setPris((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const message = messageFournitures(selection, {
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

  return (
    <div className="space-y-4">
      <Carte className="p-6">
        <h3 className="mb-1 font-display font-semibold text-navy-900">À acheter</h3>
        <p className="mb-3 text-xs text-navy-900/50">
          {restants.length === 0
            ? "Rien à acheter : tout est fourni par l'école."
            : "Décochez ce que vous avez déjà, puis envoyez la liste à votre boutique."}
        </p>

        {restants.length > 0 && (
          <>
            <div className="space-y-4">
              {groupes.map((g) => (
                <div key={g.id}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">
                    {g.label} <span className="font-normal text-navy-900/30">({g.items.length})</span>
                  </p>
                  <ul className="divide-y divide-navy-900/5">
                    {g.items.map((f) => {
                      const fait = pris.has(f._k);
                      return (
                        <li key={f._k}>
                          <label className="flex cursor-pointer items-start gap-3 py-2.5 text-sm">
                            <input type="checkbox" checked={!fait} onChange={() => basculer(f._k)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-or-500" />
                            <span className={fait ? "text-navy-900/35 line-through" : "text-navy-900"}>
                              <span className="font-mono text-xs text-or-600">×{f.quantite}</span>{" "}
                              <span className="font-medium">{f.libelle}</span>
                              {!f.obligatoire && <span className="ml-2 text-xs text-navy-900/40">(optionnel)</span>}
                              {f.note && <span className="ml-2 text-xs text-navy-900/50">— {f.note}</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={lienPartageWhatsApp(message)}
                target="_blank" rel="noreferrer"
                aria-disabled={selection.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                  selection.length === 0 ? "pointer-events-none bg-navy-900/25" : "bg-emerald-600 hover:bg-emerald-500"}`}
              >
                Envoyer par WhatsApp
                {selection.length > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{selection.length}</span>}
              </a>
              <button type="button" onClick={copier} disabled={selection.length === 0}
                className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm font-medium text-navy-900/70 transition hover:border-or-500 disabled:opacity-40">
                {copie ? "Copié ✓" : "Copier la liste"}
              </button>
              {selection.length === 0 && (
                <span className="text-xs text-navy-900/45">Tout est coché comme déjà acheté.</span>
              )}
            </div>
            <p className="mt-2 text-xs text-navy-900/40">
              WhatsApp vous laissera choisir le destinataire.
            </p>
          </>
        )}
      </Carte>

      {ecoleFournit.length > 0 && (
        <Carte className="p-6">
          <h3 className="mb-1 font-display font-semibold text-navy-900">Fourni par l&apos;école</h3>
          <p className="mb-3 text-xs text-navy-900/50">Inutile de l&apos;acheter ailleurs.</p>
          <div className="space-y-4">
            {ecoleFournit.map((g) => (
              <div key={g.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-900/45">{g.label}</p>
                <ul className="divide-y divide-navy-900/5">
                  {g.items.map((f, i) => (
                    <li key={i} className="py-2 text-sm text-navy-900/70">
                      <span className="font-mono text-xs text-navy-900/45">×{f.quantite}</span>{" "}
                      <span className="font-medium">{f.libelle}</span>
                      {f.note && <span className="ml-2 text-xs text-navy-900/45">— {f.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Carte>
      )}
    </div>
  );
}

function Paiements({ factures, infos, declarations, eleveId, onChange }) {
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

  return (
    <div className="space-y-4">
      <Alerte ton="erreur">{erreur}</Alerte>
      {visibles.length > 0 ? (
        <Carte className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-navy-900/60">Total facturé</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{fmt(synthese.facture)} <span className="text-xs font-normal">XOF</span></p>
            </div>
            <div>
              <p className="text-sm text-navy-900/60">Total payé</p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-700">{fmt(synthese.paye)} <span className="text-xs font-normal">XOF</span></p>
            </div>
            <div>
              <p className="text-sm text-navy-900/60">Reste à payer</p>
              <p className={`mt-1 font-display text-2xl font-bold ${synthese.reste > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {fmt(synthese.reste)} <span className="text-xs font-normal">XOF</span>
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

      {/*  Le paiement anticipé (mig. 202) : AVANT la liste, et même sans
          aucune facture — c'est précisément le cas où il sert. Il reçoit
          TOUTES les déclarations : une avance validée y reste « payée ». */}
      <PayerAvance eleveId={eleveId} infos={infos} aDesNumeros={aDesNumeros}
        declarations={declarations} onChange={onChange} />

      {visibles.length > 0 && (
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
                    ⏳ Paiement de {fmt(declareSur[f.id])} XOF déclaré, en attente de validation par l&apos;école.
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
                    {d.avance ? `Avance ${d.avance}${d.numero ? ` (${d.numero})` : ""}` : d.numero} · {fmt(d.montant)} XOF
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
function PayerAvance({ eleveId, infos, aDesNumeros, declarations = [], onChange }) {
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
      .then((l) => { if (vivant) setGroupes(grouperParMois(l)); })
      .catch(() => { if (vivant) { setGroupes([]); setEchec(true); } });
    return () => { vivant = false; };
  }, [eleveId, version]);

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
        <h3 className="font-display font-semibold text-navy-900">Payer d&apos;avance</h3>
        {groupes.length > 0 ? (
          <p className="mt-0.5 text-sm text-navy-900/60">
            Réglez dès maintenant {groupes[0].libelle}{groupes.length > 1 ? " ou les mois suivants" : ""} :
            {" "}la facture sera émise déjà payée.
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
      {groupes.length > 0 && <Bouton onClick={() => setOuvert(true)}>Payer d&apos;avance</Bouton>}

      {ouvert && (
        <ModaleAvance
          groupes={groupes} infos={infos}
          onFermer={() => setOuvert(false)}
          onDeclare={async ({ mois, mode, reference, fichier }) => {
            //  L'erreur remonte à la modale, qui l'affiche (cf. ModalePayer).
            const preuve = await televerserPreuve(eleveId, fichier);
            await declarerAvance(eleveId, mois, mode, reference, preuve);
            setOuvert(false);
            setVersion((v) => v + 1);
            await onChange();
          }}
        />
      )}
    </Carte>
  );
}

function ModaleAvance({ groupes, infos, onFermer, onDeclare }) {
  const [choisis, setChoisis] = useState(() => choixParDefaut(groupes));
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
    <Modale ouvert onFermer={onFermer} titre="Payer d'avance">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-navy-900/60">1. Choisis les mois à payer :</p>
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
          <p className="text-navy-900/60">2. Paie <b className="text-navy-900">{fmt(total)} XOF</b> depuis ton application mobile money :</p>
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
            <p className="mt-1 text-xs text-navy-900/50">Motif à indiquer : <span className="font-mono">Avance {resumeMois(libelles)}</span></p>
          )}
        </div>

        <p className="text-sm text-navy-900/60">3. Déclare ton paiement, l&apos;école le validera :</p>
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
            {envoi ? "Envoi…" : `Déclarer ${fmt(total)} XOF`}
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
            objet={f.notes || "Frais de scolarité"}
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
          <p className="text-navy-900/60">1. Paie depuis ton application mobile money sur le numéro de l'école :</p>
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

        <p className="text-sm text-navy-900/60">2. Déclare ton paiement, l'école le validera :</p>
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
            n&apos;a aucun moyen de vérifier ton paiement.
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
              <span className="font-mono text-xs text-navy-900/50">{a.date_abs}</span>{" "}
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
