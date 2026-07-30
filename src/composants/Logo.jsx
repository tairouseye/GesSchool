// GesSchool — logo produit : toque de diplômé (piste B, forme ronde).
// Par défaut, dessiné en `currentColor` (comme l'ancien Cachet : hérite de
// text-or-500 sur fond navy). Avec `fond`, s'affiche comme une pastille
// autonome (cercle navy + toque or) pour les fonds clairs.
export default function Logo({ size = 64, className = "", fond = false }) {
  const toque = (
    <>
      <path d="M50 26 L83 40 L50 54 L17 40 Z" fill="currentColor" />
      <path d="M32 46 V60 c0 6.5 36 6.5 36 0 V46" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M83 40 V60" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="83" cy="62.5" r="3.2" fill="currentColor" />
    </>
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {fond && <circle cx="50" cy="50" r="50" fill="#0b1f3a" />}
      <g style={fond ? { color: "#c9a227" } : undefined}>{toque}</g>
    </svg>
  );
}
