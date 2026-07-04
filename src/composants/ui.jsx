// GesSchool — primitives UI partagées (identité navy/or).
import { useEffect, useRef } from "react";

export function Bouton({ children, variante = "primaire", className = "", ...props }) {
  const variantes = {
    primaire: "bg-navy-900 text-creme hover:bg-navy-800 disabled:opacity-50",
    or: "bg-or-500 text-navy-900 hover:bg-or-400 disabled:opacity-50",
    fantome: "border border-navy-900/15 bg-white text-navy-900 hover:bg-creme disabled:opacity-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50",
  };
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Champ({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>}
      <input
        className={`w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition focus:border-or-500 focus:ring-2 focus:ring-or-500/20 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Carte({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-navy-900/10 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function Modale({ ouvert, onFermer, titre, children, large = false }) {
  const ref = useRef(null);
  // Fermeture au clavier (Échap) + focus sur la boîte à l'ouverture.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e) => { if (e.key === "Escape") onFermer?.(); };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onFermer}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titre === "string" ? titre : undefined}
        tabIndex={-1}
        className={`w-full ${large ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white shadow-xl outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-navy-900">{titre}</h3>
          <button onClick={onFermer} aria-label="Fermer" className="text-navy-900/40 hover:text-navy-900">✕</button>
        </div>
        <div className="max-h-[75vh] overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// État vide homogène (liste sans données) : icône + titre + explication + action.
export function EtatVide({ icone = "📭", titre, children, action, className = "" }) {
  return (
    <div className={`grid place-items-center rounded-2xl border border-dashed border-navy-900/15 bg-white/60 px-6 py-12 text-center ${className}`}>
      <div className="text-4xl">{icone}</div>
      {titre && <p className="mt-3 font-display text-lg font-semibold text-navy-900">{titre}</p>}
      {children && <p className="mt-1 max-w-md text-sm text-navy-900/50">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Bloc « squelette » animé pour les chargements.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-navy-900/10 ${className}`} />;
}

// Liste de cartes-squelettes (remplace « Chargement… »).
export function SkeletonListe({ lignes = 5, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lignes }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-white p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function Alerte({ ton = "erreur", children }) {
  if (!children) return null;
  const tons = {
    erreur: "border-rose-300 bg-rose-50 text-rose-700",
    succes: "border-emerald-300 bg-emerald-50 text-emerald-700",
    info: "border-navy-900/15 bg-creme text-navy-900/70",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tons[ton]}`}>{children}</div>
  );
}
