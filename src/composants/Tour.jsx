import { useEffect, useLayoutEffect, useState } from "react";

// GesSchool — visite guidée légère (spotlight + bulle d'aide).
// steps: [{ selector?, titre, texte }]  — sans selector = étape centrée.
export default function Tour({ steps, ouvert, onFermer }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [tic, setTic] = useState(0); // force le recalcul (resize/scroll)

  useEffect(() => { if (ouvert) setI(0); }, [ouvert]);

  // Avance automatiquement si l'étape cible un élément absent.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const step = steps[i];
    if (!step) return;
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector);
    if (!el) {
      // élément non présent → passer à la suivante (ou terminer)
      if (i < steps.length - 1) setI((x) => x + 1); else fin();
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [ouvert, i, tic]); // eslint-disable-line

  useEffect(() => {
    if (!ouvert) return;
    const onResize = () => setTic((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [ouvert]);

  if (!ouvert || !steps?.length) return null;
  const step = steps[i];
  const dernier = i === steps.length - 1;

  function fin() { onFermer?.(); }

  // Position de la bulle
  const vw = window.innerWidth, vh = window.innerHeight;
  const larg = Math.min(340, vw - 24);
  let bulle;
  if (rect) {
    const enDessous = rect.top + rect.height + 200 < vh;
    const top = enDessous ? rect.top + rect.height + 12 : Math.max(12, rect.top - 196);
    let left = rect.left + rect.width / 2 - larg / 2;
    left = Math.max(12, Math.min(left, vw - larg - 12));
    bulle = { top, left };
  } else {
    bulle = { top: vh / 2 - 100, left: vw / 2 - larg / 2 };
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Spotlight */}
      {rect ? (
        <div
          style={{
            position: "fixed", top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12, borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(11,31,58,0.66)", transition: "all .2s ease",
            pointerEvents: "none",
          }}
          className="ring-2 ring-or-500"
        />
      ) : (
        <div className="fixed inset-0 bg-navy-900/66" />
      )}

      {/* Bulle */}
      <div
        style={{ position: "fixed", top: bulle.top, left: bulle.left, width: larg }}
        className="rounded-2xl bg-white p-5 shadow-2xl"
      >
        <p className="font-display text-base font-bold text-navy-900">{step.titre}</p>
        {step.texte && <p className="mt-1.5 text-sm text-navy-900/70">{step.texte}</p>}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-navy-900/40">{i + 1} / {steps.length}</span>
          <div className="flex items-center gap-2">
            <button onClick={fin} className="text-xs text-navy-900/50 hover:text-navy-900">Passer</button>
            {i > 0 && (
              <button onClick={() => setI((x) => x - 1)} className="rounded-lg border border-navy-900/15 px-3 py-1.5 text-xs font-medium text-navy-900/70 hover:bg-creme">
                Précédent
              </button>
            )}
            <button onClick={() => (dernier ? fin() : setI((x) => x + 1))}
              className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme hover:bg-navy-800">
              {dernier ? "Terminer" : "Suivant"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
