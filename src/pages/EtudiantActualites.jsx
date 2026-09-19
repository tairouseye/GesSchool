import { useEffect, useState, useCallback } from "react";
import { Bouton, Carte, Alerte, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { mesNotifications, marquerNotificationsLues, mesAnnonces } from "@/lib/etudiant.js";

const quand = (d) => {
  if (!d) return "";
  const t = new Date(d);
  const h = Math.round((Date.now() - t.getTime()) / 3600000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return t.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

// Espace étudiant — notifications personnelles et annonces de l'établissement.
export default function EtudiantActualites() {
  const [notifs, setNotifs] = useState(null);
  const [annonces, setAnnonces] = useState([]);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    try {
      const [n, a] = await Promise.all([mesNotifications(), mesAnnonces()]);
      setNotifs(n); setAnnonces(a);
    } catch (e) { setErreur(e.message); setNotifs([]); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const nonLues = (notifs || []).filter((n) => !n.lu);

  async function toutMarquer() {
    try { await marquerNotificationsLues(nonLues.map((n) => n.id)); recharger(); }
    catch (e) { setErreur(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">🔔 Actualités</p>
        <p className="text-sm text-creme/70">Vos alertes et les annonces de l&apos;établissement</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-navy-900">
            Mes alertes{nonLues.length > 0 ? ` (${nonLues.length} non lue${nonLues.length > 1 ? "s" : ""})` : ""}
          </h2>
          {nonLues.length > 0 && (
            <Bouton variante="fantome" onClick={toutMarquer}>Tout marquer comme lu</Bouton>
          )}
        </div>

        {notifs === null ? <SkeletonListe lignes={3} /> : notifs.length === 0 ? (
          <EtatVide icone="🔔" titre="Aucune alerte">
            Vous serez prévenu ici d&apos;une nouvelle facture, d&apos;un relevé publié ou d&apos;une décision sur votre dépôt.
          </EtatVide>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => (
              <Carte key={n.id} className={`p-4 ${n.lu ? "" : "border-or-500/40 bg-or-500/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy-900">{n.titre || "Notification"}</p>
                  <span className="shrink-0 text-xs text-navy-900/45">{quand(n.created_at)}</span>
                </div>
                {n.message && <p className="mt-1 text-sm text-navy-900/65">{n.message}</p>}
              </Carte>
            ))}
          </div>
        )}
      </div>

      {annonces.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-base font-semibold text-navy-900">📣 Annonces</h2>
          <div className="space-y-2">
            {annonces.map((a) => (
              <Carte key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy-900">{a.titre}</p>
                  <span className="shrink-0 text-xs text-navy-900/45">{quand(a.publie_le)}</span>
                </div>
                {a.contenu && <p className="mt-1 whitespace-pre-line text-sm text-navy-900/65">{a.contenu}</p>}
              </Carte>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
