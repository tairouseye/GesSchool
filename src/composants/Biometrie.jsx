import { useCallback, useEffect, useRef, useState } from "react";
import { Alerte, Bouton } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import {
  activerBiometrie, appareilsBiometrie, retirerAppareil, biometrieSupportee,
  capteurDisponible, invitationVue, noterInvitation, messageBiometrie,
} from "@/lib/biometrie.js";

// GesSchool — la connexion par empreinte ou visage, côté compte
// (maquette docs/maquette-connexion-biometrique.html, écrans ② ③ ④).

const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "");
const auj = (d) => d && new Date(d).toDateString() === new Date().toDateString();

/**
 * La liste des appareils activés, « Retirer », « Activer sur ce téléphone ».
 * Parent → Mon compte ; personnel → fenêtre ouverte depuis le panneau du compte.
 */
export function GestionBiometrie({ onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  //  Par référence : un `onChange` écrit en ligne relancerait le chargement à
  //  chaque rendu.
  const prevenir = useRef(onChange);
  prevenir.current = onChange;

  const charger = useCallback(async () => {
    try { const l = await appareilsBiometrie(); setListe(l); prevenir.current?.(l.length); setErreur(""); }
    catch (e) { setListe([]); setErreur(messageBiometrie(e)); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function activer() {
    setOccupe(true); setErreur("");
    try { await activerBiometrie(); toast.succes("Connexion par empreinte activée sur ce téléphone."); await charger(); }
    catch (e) { const m = messageBiometrie(e); if (m !== "Opération annulée.") setErreur(m); }
    finally { setOccupe(false); }
  }

  async function retirer(a) {
    if (!await confirmer({
      titre: "Retirer cet appareil ?",
      message: `« ${a.friendly_name || "Appareil"} » ne pourra plus ouvrir votre compte par empreinte ou visage. Le mot de passe reste valable.`,
      confirmer: "Retirer",
    })) return;
    try { await retirerAppareil(a.id); toast.succes("Appareil retiré."); await charger(); }
    catch (e) { setErreur(messageBiometrie(e)); }
  }

  if (!biometrieSupportee()) {
    return <p className="text-sm text-navy-900/50">Ce navigateur ne permet pas la connexion par empreinte ou visage.</p>;
  }
  return (
    <div>
      {liste === null ? (
        <p className="text-sm text-navy-900/40">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="text-sm text-navy-900/60">Aucun appareil activé pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-navy-900/10">
          {liste.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <b className="block truncate text-navy-900">{a.friendly_name || "Appareil"}</b>
                <span className="text-xs text-navy-900/50">
                  Activé le {fmtD(a.created_at)} · {a.last_used_at ? (auj(a.last_used_at) ? "utilisé aujourd'hui" : `utilisé le ${fmtD(a.last_used_at)}`) : "jamais utilisé"}
                </span>
              </span>
              <button type="button" onClick={() => retirer(a)} className="shrink-0 text-xs font-semibold text-rose-700 hover:underline">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3"><Alerte ton="erreur">{erreur}</Alerte></div>
      <div className="mt-3">
        <Bouton onClick={activer} disabled={occupe}>{occupe ? "…" : "+ Activer sur ce téléphone"}</Bouton>
      </div>
      <p className="mt-3 rounded-xl bg-creme p-3 text-xs text-navy-900/55">
        Le nom affiché est celui que donne le téléphone. Votre empreinte et votre visage restent sur le téléphone :
        GesSchool ne les voit jamais. Si un téléphone est perdu, retirez-le ici.
      </p>
    </div>
  );
}

/**
 * Après connexion : « Connectez-vous plus vite la prochaine fois » — une
 * seule fois par téléphone, s'il a un capteur. « Non merci » ne revient pas.
 */
export function InviteBiometrie() {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (invitationVue()) return undefined;
    capteurDisponible().then((ok) => { if (vivant && ok) setVisible(true); });
    return () => { vivant = false; };
  }, []);

  if (!visible) return null;

  const nonMerci = () => { noterInvitation("non"); setVisible(false); };
  const activer = async () => {
    setOccupe(true);
    try { await activerBiometrie(); toast.succes("Connexion par empreinte activée sur ce téléphone."); setVisible(false); }
    catch (e) {
      const m = messageBiometrie(e);
      if (m === "Ce téléphone est déjà activé.") { noterInvitation("fait"); setVisible(false); }
      else if (m !== "Opération annulée.") toast.erreur(m);
    }
    finally { setOccupe(false); }
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-or-500/30 bg-or-500/10 px-4 py-3">
      <span className="text-lg leading-none">🔐</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-navy-900/80">
          <b>Connectez-vous plus vite la prochaine fois.</b> Activez la connexion par empreinte ou par visage
          sur ce téléphone. Votre empreinte reste sur le téléphone.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={activer} disabled={occupe}
            className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme disabled:opacity-60">
            {occupe ? "…" : "Activer"}
          </button>
          <button onClick={nonMerci} className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-900/50 hover:text-navy-900/80">
            Non merci
          </button>
        </div>
      </div>
    </div>
  );
}
