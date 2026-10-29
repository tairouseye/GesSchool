import { useId } from "react";

// GesSchool — logo produit : la plume d'écolier (piste J, choisie le
// 29/10/2026 sur docs/maquette-logo-education.html ; remplace la toque).
// Par défaut, dessiné en `currentColor` (hérite de text-or-500 sur fond
// navy). La nervure est découpée par un masque : elle laisse voir le fond,
// quel qu'il soit. Avec `fond`, s'affiche comme une pastille autonome
// (cercle navy + plume or) pour les fonds clairs.
// ⚠️ Même dessin dans index.html (écran d'ouverture), public/icone.svg et
// les icônes PNG de l'appli (public/gesschool-*.png).
export default function Logo({ size = 64, className = "", fond = false }) {
  //  useId rend « :r0: » : les deux-points cassent url(#…) dans certains navigateurs.
  const masque = `plume${useId().replace(/:/g, "")}`;
  const plume = (
    <>
      <mask id={masque}>
        <rect width="100" height="100" fill="#fff" />
        <path d="M74 18 C58 32 44 50 31 73" stroke="#000" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </mask>
      <path d="M80 10 C52 16 32 40 28 72 L33 76 C58 62 76 42 80 10 Z" fill="currentColor" mask={`url(#${masque})`} />
      <path d="M30 74 L20 90" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 92 H60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </>
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {fond && <circle cx="50" cy="50" r="50" fill="#0b1f3a" />}
      {fond
        ? <g transform="translate(50 50) scale(.68) translate(-49 -51)" style={{ color: "#c9a227" }}>{plume}</g>
        : plume}
    </svg>
  );
}
