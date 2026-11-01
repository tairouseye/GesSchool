import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { notificationsPersonnel, marquerLuesPersonnel, LIENS, ICONES } from "@/lib/notificationsPersonnel.js";
import { ilYa } from "@/composants/TableauBord.jsx";

// Le panneau de la cloche du personnel (mig. 219) : les alertes récentes,
// les non lues en tête de couleur. Toucher une alerte la marque lue et mène
// à l'écran qui la traite. `onChange` reçoit le nouveau nombre de non lues.
export default function CentreNotifications({ ouvert, onFermer, onChange }) {
  const { profil, ecoleId } = useAuth();
  const navigate = useNavigate();
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!ouvert) return;
    setListe(null); setErreur("");
    notificationsPersonnel(profil?.id, ecoleId).then(setListe).catch((e) => { setErreur(e.message); setListe([]); });
  }, [ouvert, profil?.id, ecoleId]);

  useEffect(() => {
    if (!ouvert) return;
    const echap = (e) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouvert, onFermer]);

  const nonLues = (liste || []).filter((n) => !n.lu);
  const recompter = (l) => onChange?.(l.filter((n) => !n.lu).length);

  async function ouvrir(n) {
    if (!n.lu) {
      const l = liste.map((x) => (x.id === n.id ? { ...x, lu: true } : x));
      setListe(l); recompter(l);
      marquerLuesPersonnel(profil?.id, ecoleId, [n.id]).catch(() => {});
    }
    const to = LIENS[n.categorie];
    if (to) { onFermer(); navigate(to); }
  }

  async function toutLire() {
    const l = liste.map((x) => ({ ...x, lu: true }));
    setListe(l); recompter(l);
    try { await marquerLuesPersonnel(profil?.id, ecoleId); } catch (e) { setErreur(e.message); }
  }

  if (!ouvert) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-navy-900/30" onMouseDown={onFermer}>
      <div role="dialog" aria-modal="true" aria-label="Notifications" onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-x-3 top-16 mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl lg:left-[17rem] lg:right-auto lg:top-4 lg:mx-0 lg:w-96">
        <div className="flex items-center gap-2 border-b border-navy-900/10 px-4 py-3">
          <p className="font-semibold text-navy-900">Notifications</p>
          {nonLues.length > 0 && <span className="rounded-full bg-rose-100 px-2 text-xs font-bold text-rose-700">{nonLues.length}</span>}
          {nonLues.length > 0 && (
            <button type="button" onClick={toutLire} className="ml-auto text-xs font-medium text-navy-700 hover:text-or-600">Tout marquer comme lu</button>
          )}
          <button type="button" onClick={onFermer} aria-label="Fermer" className={`${nonLues.length > 0 ? "" : "ml-auto"} grid h-8 w-8 place-items-center rounded-lg text-navy-900/60 hover:bg-navy-900/5`}>✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {erreur && <p className="px-4 py-3 text-sm text-rose-700">{erreur}</p>}
          {liste == null ? (
            <p className="px-4 py-6 text-center text-sm text-navy-900/55">Chargement…</p>
          ) : liste.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-navy-900/60">
              Aucune notification.<br />Vous serez prévenu ici d&apos;un paiement déclaré, d&apos;un justificatif, d&apos;un message ou d&apos;une demande de document.
            </p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {liste.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => ouvrir(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-navy-900/[0.03] ${n.lu ? "" : "bg-or-500/[0.07]"}`}>
                    <span className="mt-0.5 text-lg" aria-hidden="true">{ICONES[n.categorie] || "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.lu ? "text-navy-900/80" : "font-semibold text-navy-900"}`}>{n.titre}</span>
                      {n.message && <span className="block truncate text-xs text-navy-900/60">{n.message}</span>}
                      <span className="block text-[11px] text-navy-900/45">{ilYa(n.created_at)}</span>
                    </span>
                    {!n.lu && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-or-500" aria-label="non lue" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
