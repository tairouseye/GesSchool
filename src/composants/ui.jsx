// GesSchool — primitives UI partagées (identité navy/or).

export function Bouton({ children, variante = "primaire", className = "", ...props }) {
  const variantes = {
    primaire: "bg-navy-900 text-creme hover:bg-navy-800 disabled:opacity-50",
    or: "bg-or-500 text-navy-900 hover:bg-or-400 disabled:opacity-50",
    fantome: "border border-navy-900/15 bg-white text-navy-900 hover:bg-creme disabled:opacity-50",
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
