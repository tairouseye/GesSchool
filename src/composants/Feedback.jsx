import { createContext, useContext, useState, useCallback, useRef } from "react";
import { Modale, Bouton } from "@/composants/ui.jsx";
import { messageErreur } from "@/lib/erreurs.js";

// GesSchool — feedback global : toasts (succès/erreur) + confirmations stylées.
// Usage :
//   const toast = useToast();      toast.succes("Enregistré");  toast.erreur(msg);
//   const confirmer = useConfirm(); if (await confirmer("Supprimer ?")) { … }

const ToastCtx = createContext(null);
const ConfirmCtx = createContext(null);

export function Feedback({ children }) {
  // --- Toasts ---
  const [toasts, setToasts] = useState([]);
  const push = useCallback((ton, message) => {
    if (!message) return;
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ton, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  const toast = useRef({
    succes: (m) => push("succes", m),
    // Les erreurs sont traduites en message convivial (accepte Error ou string).
    erreur: (m) => push("erreur", messageErreur(m)),
    info: (m) => push("info", m),
  }).current;

  // --- Confirmations ---
  const [conf, setConf] = useState(null); // { titre, message, danger, confirmer, resolve }
  const confirmer = useCallback(
    (opts) =>
      new Promise((resolve) => {
        const base = typeof opts === "string" ? { message: opts } : opts || {};
        setConf({ titre: "Confirmer", danger: true, confirmer: "Confirmer", ...base, resolve });
      }),
    []
  );
  const repondre = (val) => { conf?.resolve(val); setConf(null); };

  const tons = {
    succes: "border-emerald-300 bg-emerald-600 text-white",
    erreur: "border-rose-300 bg-rose-600 text-white",
    info: "border-navy-800 bg-navy-900 text-creme",
  };
  const icones = { succes: "✓", erreur: "!", info: "•" };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirmer}>
        {children}

        {/* Toasts */}
        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,22rem)] flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${tons[t.ton] || tons.info}`}
            >
              <span className="mt-px font-bold">{icones[t.ton] || "•"}</span>
              <span className="flex-1">{t.message}</span>
            </div>
          ))}
        </div>

        {/* Confirmation */}
        <Modale ouvert={!!conf} onFermer={() => repondre(false)} titre={conf?.titre}>
          <p className="text-sm text-navy-900/70">{conf?.message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Bouton variante="fantome" onClick={() => repondre(false)}>Annuler</Bouton>
            <Bouton variante={conf?.danger ? "danger" : "primaire"} onClick={() => repondre(true)}>
              {conf?.confirmer || "Confirmer"}
            </Bouton>
          </div>
        </Modale>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx) || { succes() {}, erreur() {}, info() {} };
export const useConfirm = () => useContext(ConfirmCtx) || (async () => window.confirm("Confirmer ?"));
