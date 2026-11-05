import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { mesEnfants, lierParent, enfantEcheancier, enfantFactures } from "@/lib/parent.js";
import { annoncesEnfant } from "@/lib/annonces.js";
import { pastillePaiement, derniereAnnonce } from "@/lib/accueilParent.js";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Salutation } from "@/composants/TableauBord.jsx";
import { Alerte, Bouton, Champ, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import Photo from "@/composants/Photo.jsx";

//  L'ACCUEIL EN CARTES (maquette de Mme Kane, Tut'Tank, 05/11/2026) : la
//  directrice connaît ses parents — ils ouvrent l'appli sur leur téléphone,
//  vite, pour une seule question : « est-ce que tout va bien ? ». D'où une
//  grande carte par enfant qui y répond (classe, paiements), un geste pour
//  écrire à l'école, et la dernière annonce. Le détail est sur la fiche de
//  l'enfant, à un toucher.

// Couleur stable par enfant (dérivée de son id) : pastille foncée, fond clair.
const COULEURS = [
  ["bg-sky-600", "bg-sky-50"], ["bg-rose-600", "bg-rose-50"], ["bg-indigo-700", "bg-indigo-50"],
  ["bg-emerald-600", "bg-emerald-50"], ["bg-amber-600", "bg-amber-50"], ["bg-violet-600", "bg-violet-50"],
];
const couleurDe = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS[h % COULEURS.length];
};
const TONS_PASTILLE = {
  rouge: "bg-rose-100 text-rose-800", vert: "bg-emerald-100 text-emerald-800",
  bleu: "bg-sky-100 text-sky-800", neutre: "bg-white text-navy-900/70",
};
//  Même clé que l'onglet « Mon enfant » (ParentLayout) : la carte touchée
//  devient l'enfant que cet onglet rouvre.
const CLE_DERNIER_ENFANT = "parent_dernier_enfant";
const ecrire = (v) => { try { localStorage.setItem(CLE_DERNIER_ENFANT, v); } catch { /* stockage bloqué */ } };
const dateAnnonce = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export default function ParentAccueil() {
  const toast = useToast();
  const { profil } = useAuth();
  const [enfants, setEnfants] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);
  //  Par enfant : { echeancier, factures, annonces } — chacun peut manquer
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
        Promise.allSettled([enfantEcheancier(e.eleve_id), enfantFactures(e.eleve_id), annoncesEnfant(e.eleve_id)])
          .then(([ech, fac, ann]) => {
            if (n !== lecture.current) return;
            const v = (r) => (r.status === "fulfilled" ? r.value : undefined);
            setDetails((d) => ({ ...d, [e.eleve_id]: { echeancier: v(ech), factures: v(fac), annonces: v(ann) } }));
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
  const enfantAnnonce = annonce && enfants.find((e) => (details[e.eleve_id]?.annonces || []).some((a) => a.id === annonce.id));

  return (
    <div className="space-y-5">
      <Salutation prenom={profil?.prenom}>
        {enfants.length > 1 ? "Touchez la carte d'un enfant pour voir sa scolarité." : "Touchez la carte de votre enfant pour voir sa scolarité."}
      </Salutation>
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
          {/* Le geste le plus demandé, nommé par un verbe. */}
          <Link to="/parent/messages"
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-navy-900 transition active:scale-[.98]">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl">✉️</span>
            <span className="min-w-0">
              <span className="block font-semibold">Écrire à l'école</span>
              <span className="block text-xs text-navy-900/60">Direction, enseignants, caisse</span>
            </span>
          </Link>

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

//  Une carte = un enfant : qui il est, sa classe, et si les paiements sont
//  à jour. Toute la carte se touche (72 px de haut au moins).
function CarteEnfant({ enfant: e, detail, avecEcole }) {
  const [fonce, clair] = couleurDe(e.eleve_id);
  const pastille = detail ? pastillePaiement(detail.echeancier, detail.factures) : null;
  const initiales = `${(e.prenom?.[0] || "").toUpperCase()}${(e.nom?.[0] || "").toUpperCase()}`;
  const nbAnnonces = Number(e.annonces_nouvelles) || 0;
  return (
    <Link to={`/parent/enfant/${e.eleve_id}`} onClick={() => ecrire(e.eleve_id)}
      className={`flex min-h-[4.5rem] items-center gap-3 rounded-2xl p-3.5 text-navy-900 transition active:scale-[.98] ${clair}`}>
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
          {pastille && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONS_PASTILLE[pastille.ton]}`}>{pastille.texte}</span>}
          {nbAnnonces > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {nbAnnonces > 1 ? `${nbAnnonces} annonces` : "1 annonce"}
            </span>
          )}
        </span>
        {avecEcole && e.ecole && <span className="mt-1 block truncate text-xs text-navy-900/60">{e.ecole}</span>}
      </span>
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
