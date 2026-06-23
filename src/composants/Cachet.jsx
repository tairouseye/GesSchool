// GesSchool — motif « cachet » (sceau circulaire estampillé).
// Composant réutilisable de l'identité visuelle. Hérite de la couleur
// via `currentColor` (text-or-500, text-navy-900/10 pour filigrane…).
export default function Cachet({
  size = 84,
  sigle = "GS",
  haut = "GesSchool",
  bas = "Officiel",
  className = "",
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <path id="cachet-arc" d="M50,50 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <text fontSize="7" fill="currentColor" letterSpacing="2" className="font-display uppercase">
        <textPath href="#cachet-arc" startOffset="6%">{`${haut} • `}</textPath>
      </text>
      <text x="50" y="48" textAnchor="middle" fontSize="20" fill="currentColor" className="font-display" fontWeight="700">
        {sigle}
      </text>
      <text x="50" y="62" textAnchor="middle" fontSize="6" fill="currentColor" letterSpacing="3" className="uppercase">
        {bas}
      </text>
    </svg>
  );
}
