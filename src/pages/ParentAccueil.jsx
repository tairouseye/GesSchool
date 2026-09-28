import { useEffect, useState, useCallback } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { mesEnfants, lierParent } from "@/lib/parent.js";
import { Alerte, Bouton, Champ, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { Icone } from "@/composants/Icones.jsx";

// Couleur d'avatar stable par enfant (dérivée de son id) — accord avec les tuiles.
const AVATAR_COULEURS = ["bg-violet-500", "bg-rose-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-fuchsia-500", "bg-teal-500", "bg-indigo-500"];
const avatarColor = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COULEURS[h % AVATAR_COULEURS.length];
};

export default function ParentAccueil() {
  const toast = useToast();
  // ⚠️ Les pastilles de non-lus n'étaient QUE sur les icônes de l'en-tête,
  // minuscules sur téléphone — là où se trouve l'essentiel du public parent.
  // Le chemin visible ne signalait rien, le chemin qui signale était presque
  // invisible. Les tuiles les portent maintenant aussi.
  const { nonLues = 0, msgNonLus = 0 } = useOutletContext() || {};
  const [enfants, setEnfants] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);

  const charger = useCallback(async () => {
    try {
      setEnfants(await mesEnfants());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Mes enfants</h1>
          <p className="text-sm text-navy-900/50">Suivez la scolarité de vos enfants.</p>
        </div>
        <Bouton onClick={() => setModale(true)}>+ Ajouter un enfant</Bouton>
      </div>
      <Alerte ton="erreur">{erreur}</Alerte>

      {chargement ? (
        <SkeletonListe lignes={2} />
      ) : enfants.length === 0 ? (
        <EtatVide icone="👪" titre="Aucun enfant rattaché"
          action={<Bouton onClick={() => setModale(true)}>+ Ajouter un enfant</Bouton>}>
          Saisissez le <strong>code</strong> remis par l'établissement pour suivre la scolarité de votre enfant.
        </EtatVide>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="enfants">
          {enfants.map((e) => (
            <Link
              key={e.eleve_id}
              to={`/parent/enfant/${e.eleve_id}`}
              className="group rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-or-500"
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl font-display text-lg font-bold text-white ${avatarColor(e.eleve_id)}`}>
                  {(e.prenom?.[0] || "").toUpperCase()}{(e.nom?.[0] || "").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-navy-900">{e.prenom} {e.nom}</p>
                  <p className="truncate text-sm text-navy-900/50">{e.classe || "—"} · {e.ecole || ""}</p>
                </div>
                {e.logo && (
                  <img
                    src={e.logo}
                    alt={e.ecole || "École"}
                    title={e.ecole || ""}
                    className="ml-auto h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-navy-900/10"
                  />
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-or-600">Ouvrir l'espace →</p>
                {/* Fenêtre de 7 jours, faute d'état « lu » sur les annonces :
                    un total resterait affiché pour toujours dès la première
                    publication — du bruit, pas un signal. */}
                {Number(e.annonces_nouvelles) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-or-500/15 px-2.5 py-1 text-xs font-semibold text-or-600">
                    📣 {e.annonces_nouvelles} annonce{Number(e.annonces_nouvelles) > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Raccourcis en tuiles : les icônes de l'en-tête sont minuscules sur
          téléphone, où se trouve l'essentiel du public parent.
          « Mon compte » n'y figure pas : c'est un réglage, qu'on ouvre une
          fois — la roue dentée de l'en-tête suffit, et une tuile de la même
          taille que « Messages » lui donnerait une importance qu'il n'a pas. */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: "/parent/messages", cle: "messagerie", label: "Messages", n: msgNonLus },
          { to: "/parent/notifications", cle: "annonces", label: "Alertes", n: nonLues },
          { to: "/parent/textes", cle: "_documentation", label: "Règlement" },
        ].map((t) => (
          <Link key={t.to} to={t.to}
            className="relative flex min-h-[100px] flex-col items-start justify-between rounded-2xl border border-white/5 bg-navy-800 p-4 text-left shadow-md ring-1 ring-inset ring-white/5 transition hover:bg-navy-700 hover:ring-or-500/30 active:scale-[.98]">
            <Icone name={t.cle} className="h-7 w-7 text-or-500" />
            <span className="text-sm font-semibold text-creme">{t.label}</span>
            {Number(t.n) > 0 && (
              <span className="absolute right-2.5 top-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-or-500 px-1.5 text-[11px] font-bold text-navy-900 shadow">
                {Number(t.n) > 9 ? "9+" : t.n}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* La liste des annonces a quitté cet accueil : elle appartient à
          l'enfant concerné, et l'ouverture de l'application ne doit pas
          commencer par un mur de texte (migration 157). Le repère est sur la
          carte de chaque enfant — sans lui, les annonces deviendraient
          invisibles, faute de notification à leur publication. */}

      <ModaleAjout
        ouvert={modale}
        onFermer={() => setModale(false)}
        onLie={async () => { setModale(false); toast.succes("Enfant ajouté à votre compte."); await charger(); }}
      />
    </div>
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
