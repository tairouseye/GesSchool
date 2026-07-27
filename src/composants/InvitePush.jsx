import { useEffect, useState } from "react";
import { etatPush, activerPush, infoAppareil } from "@/lib/push.js";

// Invitation discrète à activer les notifications push. Ne s'affiche que si :
//  - l'utilisateur ne les a pas déjà activées,
//  - il ne l'a pas repoussée récemment (snooze localStorage ~7 j).
// Sur iPhone non installé, on montre l'aide « Ajouter à l'écran d'accueil ».
const SNOOZE_MS = 7 * 24 * 3600 * 1000;
const CLE_SNOOZE = "push_invite_snooze";

function snoozeActif() {
  try {
    const t = Number(localStorage.getItem(CLE_SNOOZE) || 0);
    return t && Date.now() - t < SNOOZE_MS;
  } catch { return false; }
}

export default function InvitePush() {
  const [etat, setEtat] = useState(null);
  const [cache, setCache] = useState(snoozeActif());
  const [occupe, setOccupe] = useState(false);
  const { iOS, installee, supporte } = infoAppareil();

  useEffect(() => {
    if (cache) return;
    etatPush().then(setEtat).catch(() => setEtat("non_supporte"));
  }, [cache]);

  if (cache) return null;

  const plusTard = () => { try { localStorage.setItem(CLE_SNOOZE, String(Date.now())); } catch { /* ignore */ } setCache(true); };

  const activer = async () => {
    setOccupe(true);
    try { await activerPush(); setEtat("actif"); }
    catch { /* permission refusée : on repousse pour ne pas insister */ plusTard(); }
    finally { setOccupe(false); }
  };

  // Déjà actif, refusé au niveau navigateur, ou état pas encore chargé → rien.
  if (!etat || etat === "actif" || etat === "refuse") return null;

  // iPhone en onglet Safari (non installé) : le push est impossible tant que la
  // PWA n'est pas ajoutée à l'écran d'accueil → on explique au lieu d'un bouton.
  const besoinInstalliOS = iOS && !installee && !supporte;

  if (!supporte && !besoinInstalliOS) return null; // appareil sans push, sans solution → silence

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-or-500/30 bg-or-500/10 px-4 py-3">
      <span className="text-lg leading-none">{besoinInstalliOS ? "📲" : "🔔"}</span>
      <div className="min-w-0 flex-1">
        {besoinInstalliOS ? (
          <p className="text-sm text-navy-900/80">
            <b>Recevez les alertes sur votre iPhone.</b> Touchez <b>Partager</b> puis
            <b> « Sur l'écran d'accueil »</b>, et rouvrez l'app depuis son icône.
          </p>
        ) : (
          <p className="text-sm text-navy-900/80">
            <b>Activez les notifications</b> pour ne rien manquer (rappels de paiement, notes, annonces).
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {!besoinInstalliOS && (
            <button onClick={activer} disabled={occupe}
              className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme disabled:opacity-60">
              {occupe ? "…" : "Activer"}
            </button>
          )}
          <button onClick={plusTard} className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-900/50 hover:text-navy-900/80">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
