import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { mesNotifications, marquerLue, marquerToutesLues } from "@/lib/parent.js";
import ActivationPush from "@/composants/ActivationPush.jsx";
import { Carte, Alerte, Bouton, EtatVide, SkeletonListe } from "@/composants/ui.jsx";

// Alertes de l'étudiant.
//
// 🔴 CET ÉCRAN MANQUAIT. Le personnel et les parents avaient tous deux un
// centre d'alertes et une invitation à activer les notifications du téléphone ;
// l'espace étudiant n'avait ni l'un ni l'autre. Un étudiant n'était donc
// jamais prévenu de rien, et ne pouvait pas savoir qu'il aurait pu l'être.
//
// Les fonctions de `parent.js` sont réutilisées telles quelles : la policy
// `notifications_self` porte sur `destinataire_id = auth.uid()`, elle ne
// suppose aucun rôle. Rien à ajouter en base.
const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const ICONE = (titre = "") => {
  if (/note|r[ée]sultat|relev[ée]/i.test(titre)) return "📘";
  if (/absence|retard/i.test(titre)) return "🚫";
  if (/facture|paiement|scolarit[ée]/i.test(titre)) return "💳";
  if (/document|attestation|certificat/i.test(titre)) return "🧾";
  return "🔔";
};

export default function EtudiantNotifications() {
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    try { setListe(await mesNotifications()); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const nonLues = liste.filter((n) => !n.lu).length;

  async function ouvrir(n) {
    if (n.lu) return;
    //  Optimiste : la pastille doit tomber tout de suite, le serveur suit.
    setListe((l) => l.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
    try { await marquerLue(n.id); } catch (e) { setErreur(e.message); }
  }

  async function toutLire() {
    setListe((l) => l.map((x) => ({ ...x, lu: true })));
    try { await marquerToutesLues(); } catch (e) { setErreur(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/etudiant" className="text-sm text-navy-700 hover:text-or-500">← Accueil</Link>
        {nonLues > 0 && (
          <Bouton variante="fantome" onClick={toutLire}>Tout marquer comme lu</Bouton>
        )}
      </div>

      <h1 className="font-display text-xl font-bold text-navy-900">
        Mes alertes{nonLues > 0 ? ` · ${nonLues} non lue(s)` : ""}
      </h1>

      <Alerte ton="erreur">{erreur}</Alerte>

      <ActivationPush onErreur={setErreur} />

      {chargement ? (
        <SkeletonListe lignes={4} />
      ) : liste.length === 0 ? (
        <EtatVide icone="🔔" titre="Aucune alerte">
          Vous serez prévenu ici d&apos;une nouvelle note, d&apos;un relevé disponible,
          d&apos;une échéance de scolarité ou d&apos;un message de l&apos;établissement.
        </EtatVide>
      ) : (
        <ul className="space-y-2">
          {liste.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => ouvrir(n)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  n.lu ? "border-navy-900/10 bg-white" : "border-or-500/40 bg-or-500/5"
                }`}>
                <span className="text-xl leading-none">{ICONE(n.titre)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className={`text-sm ${n.lu ? "font-medium text-navy-900/80" : "font-semibold text-navy-900"}`}>
                      {n.titre || "Alerte"}
                    </span>
                    <span className="text-xs text-navy-900/40">{fmt(n.created_at)}</span>
                  </span>
                  {n.message && <span className="mt-0.5 block text-sm text-navy-900/70">{n.message}</span>}
                </span>
                {!n.lu && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-or-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
