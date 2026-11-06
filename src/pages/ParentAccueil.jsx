import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { mesEnfants, lierParent, enfantEcheancier, enfantFactures, enfantDeclarations, enfantEmploi } from "@/lib/parent.js";
import { annoncesEnfant } from "@/lib/annonces.js";
import { pastillePaiement, aPayerAccueil, prochainCours, derniereAnnonce, couleurEnfant, ageEnfant, TONS_PASTILLE } from "@/lib/accueilParent.js";
import { lienWhatsApp } from "@/lib/recouvrement.js";
import { Alerte, Bouton, Carte, Champ, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import Photo from "@/composants/Photo.jsx";

//  L'ACCUEIL EN CARTES (maquette de Mme Kane, Tut'Tank, 05/11/2026) : la
//  directrice connaît ses parents — ils ouvrent l'appli sur leur téléphone,
//  vite, pour une seule question : « est-ce que tout va bien ? ». D'où une
//  grande carte par enfant qui y répond (classe, paiements), un geste pour
//  écrire à l'école, et la dernière annonce. Le détail est sur la fiche de
//  l'enfant, à un toucher.

//  Même clé que l'onglet « Mon enfant » (ParentLayout) : la carte touchée
//  devient l'enfant que cet onglet rouvre.
const CLE_DERNIER_ENFANT = "parent_dernier_enfant";
const ecrire = (v) => { try { localStorage.setItem(CLE_DERNIER_ENFANT, v); } catch { /* stockage bloqué */ } };
const ICONE_MESSAGE = <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>;
const ICONE_WHATSAPP = <><path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z" /><path d="M9 9.5c.3 2 1.8 3.8 4 4.5l1.2-1.2 2 .8-.4 1.8c-3.6.4-7.4-3.2-7-7l1.8-.4.8 2z" /></>;
const ICONE_ALERTE = <><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></>;
const dateAnnonce = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export default function ParentAccueil() {
  const toast = useToast();
  const [enfants, setEnfants] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);
  //  Par enfant : { echeancier, factures, annonces, declarations, emploi } — chacun peut manquer
  //  (rubrique en panne) sans empêcher la carte de s'afficher.
  const [details, setDetails] = useState({});
  const lecture = useRef(0);

  //  ⚠️ « Aucun enfant rattaché » N'EST AFFICHÉ QU'APRÈS UNE RÉPONSE RÉUSSIE.
  //  Un échec réseau l'affichait sous le message d'erreur : un parent pouvait
  //  croire ses enfants détachés et ressaisir un code.
  const [echec, setEchec] = useState(false);
  const charger = useCallback(async () => {
    setErreur("");
    const n = ++lecture.current;
    try {
      const liste = await mesEnfants();
      setEnfants(liste);
      setEchec(false);
      liste.forEach((e) => {
        Promise.allSettled([enfantEcheancier(e.eleve_id), enfantFactures(e.eleve_id), annoncesEnfant(e.eleve_id), enfantDeclarations(e.eleve_id), enfantEmploi(e.eleve_id)])
          .then(([ech, fac, ann, dec, edt]) => {
            if (n !== lecture.current) return;
            const v = (r) => (r.status === "fulfilled" ? r.value : undefined);
            setDetails((d) => ({ ...d, [e.eleve_id]: { echeancier: v(ech), factures: v(fac), annonces: v(ann), declarations: v(dec), emploi: v(edt) } }));
          });
      });
    } catch (e) {
      setErreur(e.message);
      setEchec(true);
    } finally {
      setChargement(false);
    }
  }, []);
  const reessayer = () => { setChargement(true); charger(); };

  useEffect(() => { charger(); }, [charger]);

  //  L'école n'est nommée sur la carte que si les enfants sont dans des
  //  écoles différentes : sinon, c'est une ligne de plus à lire pour rien.
  const plusieursEcoles = new Set(enfants.map((e) => e.ecole_id)).size > 1;
  const annonce = derniereAnnonce(enfants.map((e) => ({ annonces: details[e.eleve_id]?.annonces })));
  //  WhatsApp ouvre la conversation avec l'école. Avec deux écoles, on ne
  //  devine pas laquelle : les alertes prennent la place. (Les notifications
  //  WhatsApp automatiques de la maquette demandent un service d'envoi payant.)
  const whatsapp = !plusieursEcoles && enfants[0]?.telephone_ecole
    ? lienWhatsApp(enfants[0].telephone_ecole, "Bonjour, je vous écris depuis l'espace parent.") : null;
  const enfantAnnonce = annonce && enfants.find((e) => (details[e.eleve_id]?.annonces || []).some((a) => a.id === annonce.id));
  //  Une ligne par enfant, jamais un total : deux enfants peuvent être dans
  //  deux écoles, avec deux devises.
  const priorites = enfants.flatMap((e) => {
    const p = aPayerAccueil(details[e.eleve_id]);
    return p ? [{ enfant: e, ...p }] : [];
  });

  return (
    <div className="space-y-5">
      <Alerte ton="erreur">{erreur}</Alerte>

      {chargement ? (
        <div role="status" aria-label="Chargement de vos enfants"><SkeletonListe lignes={2} /></div>
      ) : echec && enfants.length === 0 ? (
        <EtatVide icone="📶" titre="Vos enfants n'ont pas pu être chargés"
          action={<Bouton onClick={reessayer}>Réessayer</Bouton>}>
          Vérifiez votre connexion, puis réessayez.
        </EtatVide>
      ) : enfants.length === 0 ? (
        <EtatVide icone="👪" titre="Aucun enfant rattaché"
          action={<Bouton onClick={() => setModale(true)}>+ Ajouter un enfant</Bouton>}>
          Saisissez le <strong>code</strong> remis par l'établissement pour suivre la scolarité de votre enfant.
        </EtatVide>
      ) : (
        <>
          {/*  CE QUI DEMANDE UN GESTE, D'ABORD (maquette du 06/11/2026). Rien à
               faire : le bloc n'existe pas, l'accueil reste celui d'un parent
               tranquille. */}
          {priorites.length > 0 && (
            <section aria-labelledby="titre-priorites" className="space-y-2.5">
              <h2 id="titre-priorites" className="font-display text-lg font-bold text-navy-900">À faire en priorité</h2>
              {priorites.map((p) => <CartePriorite key={p.enfant.eleve_id} {...p} compact={priorites.length > 1} />)}
            </section>
          )}

          {/* Les deux gestes les plus demandés, nommés par ce qu'ils font. */}
          <div className="grid grid-cols-2 gap-2.5">
            <Geste to="/parent/messages" fond="bg-sky-50" trait="stroke-sky-600" titre="Écrire à l'école" sous="Direction, enseignants, caisse" icone={ICONE_MESSAGE} />
            {whatsapp ? (
              <Geste href={whatsapp} fond="bg-emerald-50" trait="stroke-emerald-700" titre="WhatsApp" sous="Contacter l'école" icone={ICONE_WHATSAPP} />
            ) : (
              <Geste to="/parent/notifications" fond="bg-emerald-50" trait="stroke-emerald-700" titre="Alertes" sous="Ce que l'école vous signale" icone={ICONE_ALERTE} />
            )}
          </div>

          <section aria-labelledby="titre-enfants" className="space-y-3" data-tour="enfants">
            <h2 id="titre-enfants" className="font-display text-lg font-bold text-navy-900">
              {enfants.length > 1 ? "Mes enfants" : "Mon enfant"}
            </h2>
            {enfants.map((e) => (
              <CarteEnfant key={e.eleve_id} enfant={e} detail={details[e.eleve_id]} avecEcole={plusieursEcoles} />
            ))}
            <button type="button" onClick={() => setModale(true)}
              className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-dashed border-navy-900/25 text-sm font-medium text-navy-900/70">
              + Ajouter un enfant
            </button>
          </section>

          {annonce && (
            <section aria-labelledby="titre-annonce" className="space-y-2">
              <h2 id="titre-annonce" className="font-display text-lg font-bold text-navy-900">Dernière annonce</h2>
              <Link to={`/parent/enfant/${enfantAnnonce?.eleve_id || enfants[0].eleve_id}/annonces`}
                onClick={() => enfantAnnonce && ecrire(enfantAnnonce.eleve_id)}
                className="block rounded-2xl bg-amber-50 p-4 text-navy-900 transition active:scale-[.98]">
                <span className="block text-xs font-semibold text-amber-800">{dateAnnonce(annonce.publie_le)}</span>
                <span className="mt-0.5 block font-semibold">{annonce.titre}</span>
                {annonce.contenu && <span className="mt-1 line-clamp-3 block text-sm text-navy-900/75">{annonce.contenu}</span>}
                <span className="mt-2 block text-xs font-semibold text-navy-700">Toutes les annonces →</span>
              </Link>
            </section>
          )}
        </>
      )}

      <ModaleAjout
        ouvert={modale}
        onFermer={() => setModale(false)}
        onLie={async () => { setModale(false); toast.succes("Enfant ajouté à votre compte."); await charger(); }}
      />
    </div>
  );
}

//  Le montant d'un enfant et le bouton qui mène à ses paiements. Un paiement
//  déclaré attend la caisse : on le dit, et le bouton ne pousse plus à payer.
//  `compact` : dès deux enfants, une ligne chacun. Deux grandes cartes
//  repoussaient « Mes enfants » sous le bas de l'écran.
function CartePriorite({ enfant: e, montant, texte, declaree, compact }) {
  const lien = {
    to: `/parent/enfant/${e.eleve_id}/paiements`,
    onClick: () => ecrire(e.eleve_id),
    "aria-label": `${declaree ? "Voir les paiements" : "Payer"} de ${e.prenom}`,
  };
  const tonLien = declaree ? "border border-navy-900/15 text-navy-900" : "bg-navy-900 text-creme";
  const attente = "Votre paiement déclaré attend la validation de l'école.";
  if (compact) {
    return (
      <Carte className="flex items-center gap-3 border-l-4 border-l-or-500 p-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-navy-900/70">{e.prenom}</span>
          <span className="block font-display text-xl font-bold text-navy-900">{fmt(montant)} <span className="text-xs font-semibold">{e.devise || "XOF"}</span></span>
          <span className="block text-xs text-navy-900/70">{declaree ? attente : texte}</span>
        </span>
        <Link {...lien} className={`flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold ${tonLien}`}>
          {declaree ? "Voir" : "Payer"}
        </Link>
      </Carte>
    );
  }
  return (
    <Carte className="border-t-4 border-t-or-500 p-4">
      <p className="text-sm font-semibold text-navy-900/70">Frais de scolarité de {e.prenom}</p>
      <p className="mt-1 font-display text-3xl font-bold text-navy-900">{fmt(montant)} <span className="text-sm font-semibold">{e.devise || "XOF"}</span></p>
      <p className="mt-0.5 text-sm text-navy-900/70">{texte}</p>
      {declaree && <p className="mt-2 rounded-lg bg-or-500/10 px-3 py-2 text-sm text-navy-900">{attente}</p>}
      <Link {...lien} className={`mt-3 flex min-h-12 items-center justify-center rounded-xl text-sm font-semibold ${tonLien}`}>
        {declaree ? "Voir les paiements" : "Payer"}
      </Link>
    </Carte>
  );
}

// Un geste de l'accueil : un lien dans l'appli, ou vers WhatsApp.
function Geste({ to, href, fond, trait, titre, sous, icone }) {
  const contenu = (
    <>
      <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-white">
        <svg viewBox="0 0 24 24" className={`h-6 w-6 fill-none ${trait}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icone}</svg>
      </span>
      <span>
        <span className="block text-sm font-bold">{titre}</span>
        <span className="block text-xs text-navy-900/60">{sous}</span>
      </span>
    </>
  );
  const classe = `flex min-h-[7rem] flex-col gap-2.5 rounded-2xl p-3.5 text-navy-900 transition active:scale-[.98] ${fond}`;
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={classe}>{contenu}</a>
    : <Link to={to} className={classe}>{contenu}</Link>;
}

//  Une carte = un enfant : qui il est, sa classe, son âge, et si les paiements
//  sont à jour. Toute la carte se touche (72 px de haut au moins).
function CarteEnfant({ enfant: e, detail, avecEcole }) {
  const { fonce, clair, texte } = couleurEnfant(e.eleve_id);
  const pastille = detail ? pastillePaiement(detail.echeancier, detail.factures) : null;
  const initiales = `${(e.prenom?.[0] || "").toUpperCase()}${(e.nom?.[0] || "").toUpperCase()}`;
  const age = ageEnfant(e.date_naissance);
  const cours = prochainCours(detail?.emploi);
  return (
    <Link to={`/parent/enfant/${e.eleve_id}`} onClick={() => ecrire(e.eleve_id)}
      className={`flex min-h-[4.5rem] items-center gap-3 rounded-[1.4rem] p-3.5 text-navy-900 transition active:scale-[.98] ${clair}`}>
      {/*  La photo de SON enfant — et d'aucun autre : la policy de la
          migration 169 repose sur `_parent_possede`. Sans photo, les
          initiales colorées. */}
      <Photo bucket="eleves" valeur={e.photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-4 ring-white"
        fallback={
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-lg font-bold text-white ring-4 ring-white ${fonce}`}>
            {initiales}
          </span>
        } />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-bold">{e.prenom} {e.nom}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {e.classe && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy-900/80">{e.classe}</span>}
          {pastille && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pastille.ton === "neutre" ? "bg-white text-navy-900/70" : TONS_PASTILLE[pastille.ton]}`}>{pastille.texte}</span>}
        </span>
        {cours && <span className="mt-1 block truncate text-xs font-medium text-navy-900/70">{cours}</span>}
        {avecEcole && e.ecole && <span className="mt-1 block truncate text-xs text-navy-900/60">{e.ecole}</span>}
      </span>
      {age != null && (
        <span className={`shrink-0 rounded-2xl bg-white px-2.5 py-1.5 text-center font-display text-xl font-bold leading-none ${texte}`}>
          {age}<span className="mt-0.5 block font-sans text-[10px] font-semibold text-navy-900/60">ans</span>
        </span>
      )}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-navy-900/40" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

// Rattache un (autre) enfant via un code — y compris dans un AUTRE établissement.
function ModaleAjout({ ouvert, onFermer, onLie }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function lier(e) {
    e.preventDefault();
    setErreur(""); setEnCours(true);
    try {
      await lierParent(code.trim());
      setCode("");
      await onLie();
    } catch (err) {
      setErreur(/invalide/i.test(err.message) ? "Code invalide. Vérifiez auprès de l'établissement." : err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Ajouter un enfant">
      <form onSubmit={lier} className="space-y-4">
        <p className="text-sm text-navy-900/60">
          Saisissez le <strong>code parent</strong> remis par l'établissement. Vous pouvez ajouter plusieurs enfants,
          <strong> même dans des écoles différentes</strong> : ils apparaîtront tous ici, chacun avec son établissement.
        </p>
        <Champ
          label="Code parent"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="EX. 3F9A2B7C"
          className="font-mono tracking-widest"
        />
        <Alerte ton="erreur">{erreur}</Alerte>
        <Bouton type="submit" className="w-full" disabled={enCours || !code.trim()}>
          {enCours ? "Liaison…" : "Ajouter"}
        </Bouton>
      </form>
    </Modale>
  );
}
