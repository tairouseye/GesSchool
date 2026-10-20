import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mesNotifications, marquerLue, marquerToutesLues, mesEnfants } from "@/lib/parent.js";
//  L'interrupteur de notifications est partagé avec l'espace étudiant.
import ActivationPush from "@/composants/ActivationPush.jsx";
import { Carte, Alerte, Bouton, EtatVide, SkeletonListe } from "@/composants/ui.jsx";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const ICONE = (titre = "") => {
  if (/note/i.test(titre)) return "📘";
  if (/absence|retard/i.test(titre)) return "🚫";
  if (/facture/i.test(titre)) return "💳";
  return "🔔";
};

//  Où mène une alerte. Possible depuis que la rubrique d'un enfant est dans
//  l'adresse : avant, une alerte « Nouvelle facture » laissait le parent
//  chercher l'enfant, puis la tuile Paiements. Catégories posées par la base
//  (_notifier_parents, migration 112 et suivantes) ; inconnue → pas de lien.
const RUBRIQUE_DE = { note: "notes", absence: "absences", facture: "paiements", transport: "transport", annonce: "annonces" };
function lienAlerte(n) {
  if (n.categorie === "message") return "/parent/messages";
  const r = RUBRIQUE_DE[n.categorie];
  return n.eleve_id && r ? `/parent/enfant/${n.eleve_id}/${r}` : null;
}

export default function ParentNotifications() {
  const [items, setItems] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  //  La liste n'a JAMAIS pu être lue : on ne dit pas « Aucune alerte ».
  const [echec, setEchec] = useState(false);
  const [action, setAction] = useState(null); // id en cours de marquage, ou "toutes"

  const recharger = async () => {
    // Les notifications portent `eleve_id` mais pas le nom de l'enfant :
    // la table `eleves` est fermée au parent. On le retrouve par
    // `mes_enfants`, qu'il a déjà le droit de lire.
    //  ⚠️ `allSettled` : les noms des enfants sont un complément. Leur échec
    //  ne doit pas empêcher d'afficher les alertes elles-mêmes.
    const [n, e] = await Promise.allSettled([mesNotifications(), mesEnfants()]);
    if (n.status === "fulfilled") {
      setItems(n.value); setEchec(false); setErreur("");
    } else {
      setErreur(n.reason?.message || "Erreur de chargement.");
      setEchec(true);
    }
    if (e.status === "fulfilled") setEnfants(e.value);
    setChargement(false);
  };

  // Marquer lu : l'échec se DIT (avant, la promesse rejetée était ignorée et
  // le bouton semblait sans effet).
  const marquer = async (cle, fn) => {
    setAction(cle); setErreur("");
    try { await fn(); await recharger(); }
    catch (er) { setErreur(er.message); }
    finally { setAction(null); }
  };

  useEffect(() => { recharger(); }, []);

  const nonLues = items.filter((n) => !n.lu).length;

  // ⚠️ Sans cela, un parent de trois enfants reçoit trois « Nouvelle note »
  // rigoureusement identiques et ne sait pas lesquelles concernent qui. Le
  // nom n'est affiché qu'à partir de deux enfants : avec un seul, il n'ajoute
  // rien et encombre.
  const nomEnfant = (eleveId) => {
    if (!eleveId || enfants.length < 2) return null;
    const e = enfants.find((x) => x.eleve_id === eleveId);
    return e ? `${e.prenom} ${e.nom}`.trim() : null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
        {nonLues > 0 && (
          <Bouton variante="fantome" disabled={action === "toutes"} onClick={() => marquer("toutes", marquerToutesLues)}>
            {action === "toutes" ? "…" : "Tout marquer comme lu"}
          </Bouton>
        )}
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Alertes</h1>
        <p className="text-sm text-navy-900/60">
          {chargement || echec ? "" : nonLues > 0 ? `${nonLues} non lue(s)` : "Tout est à jour."}
        </p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <ActivationPush onErreur={setErreur} />

      {chargement ? (
        <div role="status" aria-label="Chargement des alertes"><SkeletonListe lignes={4} /></div>
      ) : echec && items.length === 0 ? (
        <EtatVide icone="📶" titre="Les alertes n'ont pas pu être chargées"
          action={<Bouton onClick={() => { setChargement(true); recharger(); }}>Réessayer</Bouton>}>
          Vérifiez votre connexion, puis réessayez.
        </EtatVide>
      ) : items.length === 0 ? (
        <EtatVide icone="🔔" titre="Aucune alerte">Vous n'avez aucune notification pour le moment.</EtatVide>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Carte
              key={n.id}
              className={`flex items-start gap-3 p-4 ${n.lu ? "" : "border-l-4 border-l-or-500"}`}
            >
              <span className="text-xl">{ICONE(n.titre)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy-900">{n.titre}</p>
                  {nomEnfant(n.eleve_id) ? (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      {nomEnfant(n.eleve_id)}
                    </span>
                  ) : enfants.length > 1 && !n.eleve_id ? (
                    // Une alerte d'établissement ne vise aucun enfant : le
                    // dire évite que l'absence de nom passe pour un oubli.
                    <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-[11px] font-medium text-navy-900/50">
                      Toute l&apos;école
                    </span>
                  ) : null}
                  {!n.lu && <span className="rounded-full bg-or-500/15 px-2 py-0.5 text-[10px] font-medium text-or-600">nouveau</span>}
                </div>
                {n.message && <p className="text-sm text-navy-900/70">{n.message}</p>}
                <p className="mt-1 text-xs text-navy-900/40">{fmt(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {lienAlerte(n) && (
                  <Link to={lienAlerte(n)} onClick={() => { if (!n.lu) marquerLue(n.id).catch(() => {}); }}
                    className="inline-flex min-h-10 items-center rounded-lg bg-navy-900 px-3 text-xs font-semibold text-creme hover:bg-navy-800">
                    Voir
                  </Link>
                )}
                {!n.lu && (
                  <button onClick={() => marquer(n.id, () => marquerLue(n.id))} disabled={action === n.id}
                    className="min-h-10 px-1 text-xs text-navy-700 hover:text-or-600 disabled:opacity-50">
                    {action === n.id ? "…" : "marquer lu"}
                  </button>
                )}
              </div>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
