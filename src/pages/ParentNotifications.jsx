import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mesNotifications, marquerLue, marquerToutesLues } from "@/lib/parent.js";
import { pushSupporte, etatPush, activerPush, desactiverPush } from "@/lib/push.js";
import { Carte, Alerte, Bouton, EtatVide, SkeletonListe } from "@/composants/ui.jsx";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

function PushToggle({ onErreur }) {
  const [etat, setEtat] = useState("…");
  const [occupe, setOccupe] = useState(false);

  const rafraichir = async () => { try { setEtat(await etatPush()); } catch { setEtat("non_supporte"); } };
  useEffect(() => { rafraichir(); }, []);

  if (!pushSupporte() || etat === "non_supporte") return null;

  const basculer = async () => {
    setOccupe(true);
    onErreur("");
    try {
      if (etat === "actif") await desactiverPush();
      else await activerPush();
      await rafraichir();
    } catch (e) { onErreur(e.message); }
    finally { setOccupe(false); }
  };

  return (
    <Carte className="flex items-center justify-between p-4">
      <div>
        <p className="text-sm font-medium text-navy-900">Notifications sur le téléphone</p>
        <p className="text-xs text-navy-900/50">
          {etat === "actif" ? "Activées — tu seras alerté même app fermée."
            : etat === "refuse" ? "Bloquées dans les réglages du navigateur."
            : "Reçois les alertes directement sur ton appareil."}
        </p>
      </div>
      {etat !== "refuse" && (
        <Bouton variante={etat === "actif" ? "fantome" : "primaire"} onClick={basculer} disabled={occupe}>
          {occupe ? "…" : etat === "actif" ? "Désactiver" : "Activer"}
        </Bouton>
      )}
    </Carte>
  );
}

const ICONE = (titre = "") => {
  if (/note/i.test(titre)) return "📘";
  if (/absence|retard/i.test(titre)) return "🚫";
  if (/facture/i.test(titre)) return "💳";
  return "🔔";
};

export default function ParentNotifications() {
  const [items, setItems] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const recharger = async () => {
    try {
      setItems(await mesNotifications());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { recharger(); }, []);

  const nonLues = items.filter((n) => !n.lu).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
        {nonLues > 0 && (
          <Bouton variante="fantome" onClick={async () => { await marquerToutesLues(); recharger(); }}>
            Tout marquer comme lu
          </Bouton>
        )}
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Alertes</h1>
        <p className="text-sm text-navy-900/50">{nonLues > 0 ? `${nonLues} non lue(s)` : "Tout est à jour."}</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <PushToggle onErreur={setErreur} />

      {chargement ? (
        <SkeletonListe lignes={4} />
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
                  {!n.lu && <span className="rounded-full bg-or-500/15 px-2 py-0.5 text-[10px] font-medium text-or-600">nouveau</span>}
                </div>
                {n.message && <p className="text-sm text-navy-900/70">{n.message}</p>}
                <p className="mt-1 text-xs text-navy-900/40">{fmt(n.created_at)}</p>
              </div>
              {!n.lu && (
                <button onClick={async () => { await marquerLue(n.id); recharger(); }} className="text-xs text-navy-700 hover:text-or-500">
                  marquer lu
                </button>
              )}
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
