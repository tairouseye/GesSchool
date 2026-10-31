import { useEffect, useState, useCallback } from "react";
import { mesEnfants, lierParent } from "@/lib/parent.js";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Salutation } from "@/composants/TableauBord.jsx";
import ApercuEnfant from "@/composants/ApercuEnfant.jsx";
import { Alerte, Bouton, Champ, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import Photo from "@/composants/Photo.jsx";

// Couleur d'avatar stable par enfant (dérivée de son id) — accord avec les tuiles.
const AVATAR_COULEURS = ["bg-violet-500", "bg-rose-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-fuchsia-500", "bg-teal-500", "bg-indigo-500"];
const avatarColor = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COULEURS[h % AVATAR_COULEURS.length];
};
//  Même clé que l'onglet « Mon enfant » (ParentLayout) : choisir un enfant
//  ici le rouvre là, et inversement.
const CLE_DERNIER_ENFANT = "parent_dernier_enfant";
const lire = () => { try { return localStorage.getItem(CLE_DERNIER_ENFANT); } catch { return null; } };
const ecrire = (v) => { try { localStorage.setItem(CLE_DERNIER_ENFANT, v); } catch { /* stockage bloqué */ } };

export default function ParentAccueil() {
  const toast = useToast();
  const { profil } = useAuth();
  //  Les tuiles Messages / Alertes / Règlement ont quitté cet accueil : les
  //  onglets du bas (v2.285) les portent, pastilles comprises, et la place
  //  revient à l'aperçu de l'enfant (refonte « Classter », 31/10/2026).
  const [enfants, setEnfants] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);
  const [choisi, setChoisi] = useState(lire);

  //  ⚠️ « Aucun enfant rattaché » N'EST AFFICHÉ QU'APRÈS UNE RÉPONSE RÉUSSIE.
  //  Un échec réseau l'affichait sous le message d'erreur : un parent pouvait
  //  croire ses enfants détachés et ressaisir un code.
  const [echec, setEchec] = useState(false);
  const charger = useCallback(async () => {
    setErreur("");
    try {
      setEnfants(await mesEnfants());
      setEchec(false);
    } catch (e) {
      setErreur(e.message);
      setEchec(true);
    } finally {
      setChargement(false);
    }
  }, []);
  const reessayer = () => { setChargement(true); charger(); };

  useEffect(() => { charger(); }, [charger]);

  //  L'enfant affiché : celui choisi (ou le dernier consulté), sinon le premier.
  const enfant = enfants.find((e) => e.eleve_id === choisi) || enfants[0] || null;
  const choisir = (id) => { setChoisi(id); ecrire(id); };

  return (
    <div className="space-y-4">
      <Salutation prenom={profil?.prenom}>{enfants.length > 1 ? "Touchez un prénom pour changer d'enfant." : "Suivez la scolarité de votre enfant."}</Salutation>
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
          {/* Les enfants en pastilles : un toucher change l'aperçu. Le « + »
              rattache un autre enfant, même dans une autre école. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-tour="enfants" role="tablist" aria-label="Vos enfants">
            {enfants.map((e) => {
              const actif = e.eleve_id === enfant?.eleve_id;
              return (
                <button key={e.eleve_id} type="button" role="tab" aria-selected={actif} onClick={() => choisir(e.eleve_id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition ${
                    actif ? "bg-navy-900 font-semibold text-creme" : "border border-navy-900/15 bg-white font-medium text-navy-900"}`}>
                  {/*  La photo de SON enfant — et d'aucun autre : la policy de la
                      migration 169 repose sur `_parent_possede`. Sans photo,
                      les initiales colorées restent. */}
                  <Photo bucket="eleves" valeur={e.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover"
                    fallback={
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${avatarColor(e.eleve_id)}`}>
                        {(e.prenom?.[0] || "").toUpperCase()}{(e.nom?.[0] || "").toUpperCase()}
                      </span>
                    } />
                  {e.prenom}
                  {/* Fenêtre de 7 jours, faute d'état « lu » sur les annonces. */}
                  {Number(e.annonces_nouvelles) > 0 && <span className="h-2 w-2 rounded-full bg-or-500" aria-label="nouvelle annonce" />}
                </button>
              );
            })}
            <button type="button" onClick={() => setModale(true)} aria-label="Ajouter un enfant"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-navy-900/30 text-lg text-navy-900">+</button>
          </div>

          {enfant && (
            <div>
              <p className="mb-2 truncate text-xs text-navy-900/60">
                {enfant.prenom} {enfant.nom}{enfant.classe ? ` · ${enfant.classe}` : ""}{enfant.ecole ? ` · ${enfant.ecole}` : ""}
              </p>
              <ApercuEnfant key={enfant.eleve_id} enfant={enfant} devise={enfant.devise || "XOF"} />
            </div>
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
