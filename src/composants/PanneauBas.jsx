import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

//  Panneau qui monte du bas de l'écran (espaces parent et étudiant) : la liste
//  complète des rubriques, le choix de l'enfant, le menu « Plus ».
//
//  Pourquoi pas `Modale` : sur téléphone, une boîte centrée oblige à lever le
//  pouce jusqu'au milieu de l'écran. Ici tout est en bas, et le panneau se
//  ferme comme dans les applis courantes : glissé vers le bas, toucher du
//  fond, Échap, ou ✕.
//
//  ⚠️ RENDU DANS <body> (portail). Ses déclencheurs vivent dans des barres
//  collées qui portent un `transform` ou un `backdrop-filter` : l'un comme
//  l'autre fait de la barre le repère des `position: fixed` de ses enfants, et
//  le panneau s'ouvrait alors DANS la barre au lieu de couvrir l'écran.
const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SEUIL_FERMETURE = 90; // px glissés vers le bas pour fermer
const DUREE = 300;          // ms, la même que les classes `duration-300`

export default function PanneauBas({ ouvert, onFermer, titre, children }) {
  const ref = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  //  Monté ≠ visible : le panneau doit exister un instant HORS de l'écran pour
  //  pouvoir y glisser, et rester monté le temps de redescendre.
  const [monte, setMonte] = useState(ouvert);
  const [visible, setVisible] = useState(false);
  const [glisse, setGlisse] = useState(0);
  const depart = useRef(null);
  const declencheur = useRef(null);

  useEffect(() => {
    if (ouvert) {
      declencheur.current = document.activeElement;
      setMonte(true);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setVisible(false);
    setGlisse(0);
    const t = setTimeout(() => setMonte(false), DUREE);
    return () => clearTimeout(t);
  }, [ouvert]);

  // Clavier, focus, défilement de la page bloqué derrière le panneau.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e) => {
      if (e.key === "Escape") { fermer.current?.(); return; }
      const boite = ref.current;
      if (e.key !== "Tab" || !boite) return;
      const el = [...boite.querySelectorAll(FOCALISABLES)].filter((n) => n.getClientRects().length > 0);
      if (!el.length) { e.preventDefault(); boite.focus(); return; }
      const actif = document.activeElement;
      if (!boite.contains(actif)) { e.preventDefault(); (e.shiftKey ? el[el.length - 1] : el[0]).focus(); }
      else if (e.shiftKey && (actif === el[0] || actif === boite)) { e.preventDefault(); el[el.length - 1].focus(); }
      else if (!e.shiftKey && actif === el[el.length - 1]) { e.preventDefault(); el[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => ref.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
      const el = declencheur.current;
      declencheur.current = null;
      if (el?.isConnected && typeof el.focus === "function") el.focus();
    };
  }, [ouvert]);

  if (!monte) return null;

  const poignee = {
    onPointerDown: (e) => { depart.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e) => { if (depart.current !== null) setGlisse(Math.max(0, e.clientY - depart.current)); },
    onPointerUp: () => {
      if (depart.current === null) return;
      depart.current = null;
      if (glisse > SEUIL_FERMETURE) fermer.current?.(); else setGlisse(0);
    },
    onPointerCancel: () => { depart.current = null; setGlisse(0); },
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onFermer}
        className={`absolute inset-0 bg-navy-900/40 motion-safe:transition-opacity motion-safe:duration-300 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl outline-none motion-safe:transition-transform motion-safe:duration-300 ${visible ? "translate-y-0" : "translate-y-full"}`}
        style={glisse ? { transform: `translateY(${glisse}px)`, transition: "none" } : undefined}>
        <div {...poignee} aria-hidden="true" className="grid shrink-0 cursor-grab touch-none place-items-center pb-1 pt-3">
          <span className="h-1.5 w-10 rounded-full bg-navy-900/15" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3">
          <h3 className="font-display text-lg font-semibold text-navy-900">{titre}</h3>
          <button type="button" onClick={onFermer} aria-label="Fermer"
            className="grid h-10 w-10 place-items-center rounded-lg text-navy-900/40 hover:text-navy-900">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
