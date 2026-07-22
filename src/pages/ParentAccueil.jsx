import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { mesEnfants, lierParent } from "@/lib/parent.js";
import { annoncesParent } from "@/lib/annonces.js";
import { Carte, Alerte, Bouton, Champ, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

// Couleur d'avatar stable par enfant (dérivée de son id) — accord avec les tuiles.
const AVATAR_COULEURS = ["bg-violet-500", "bg-rose-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-fuchsia-500", "bg-teal-500", "bg-indigo-500"];
const avatarColor = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COULEURS[h % AVATAR_COULEURS.length];
};

export default function ParentAccueil() {
  const toast = useToast();
  const [enfants, setEnfants] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [enf, ann] = await Promise.all([mesEnfants(), annoncesParent()]);
      setEnfants(enf);
      setAnnonces(ann);
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
                <div>
                  <p className="font-display text-lg font-bold text-navy-900">{e.prenom} {e.nom}</p>
                  <p className="text-sm text-navy-900/50">{e.classe || "—"} · {e.ecole || ""}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-or-600">Ouvrir l'espace →</p>
            </Link>
          ))}
        </div>
      )}

      {/* Annonces de l'école */}
      {annonces.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="font-display text-lg font-bold text-navy-900">📣 Annonces</h2>
          {annonces.map((a) => (
            <Carte key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-navy-900">{a.titre}</h3>
                {a.classe && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700">{a.classe}</span>
                )}
              </div>
              {a.contenu && <p className="mt-1 whitespace-pre-wrap text-sm text-navy-900/70">{a.contenu}</p>}
              <p className="mt-2 text-xs text-navy-900/40">{fmtDate(a.publie_le)} · {a.ecole}</p>
            </Carte>
          ))}
        </div>
      )}

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
