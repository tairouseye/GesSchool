import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanneauBas from "@/composants/PanneauBas.jsx";
import { Icone } from "@/composants/Icones.jsx";

//  Barre de rubriques des espaces parent et étudiant : une rangée de liens qui
//  défile horizontalement, collée en haut de l'écran.
//
//  ⚠️ POURQUOI ELLE EXISTE. Le menu de ces espaces, ce sont les tuiles de
//  l'accueil ; une fois dans une rubrique, elles disparaissaient et le seul
//  chemin était « ← Accueil ». Consulter les notes, puis les paiements, puis
//  les absences coûtait deux retours à la grille (audit ergonomie, oct. 2026 ;
//  variante retenue parmi trois maquettes). Ici chaque rubrique est à un
//  toucher, et ses pastilles (impayé, nouvelles notes) restent visibles.
//
//  ⚠️ « TOUT » EN TÊTE DE RANGÉE. Sur un téléphone, trois ou quatre rubriques
//  tiennent dans la largeur ; les huit autres étaient hors de l'écran, sans
//  rien qui le signale. Ce bouton les montre toutes d'un coup, avec leurs
//  pastilles, dans un panneau qui monte du bas.
//
//  La barre se colle SOUS l'en-tête quand celui-ci est collé lui aussi : sa
//  hauteur est publiée dans `--haut-entete` par la coque (ParentLayout), et
//  vaut 0 quand il s'efface au défilement ou qu'il n'est pas collé.
//
//  items : [{ cle, label, to, icone?, pastille?, pastilleRouge? }] ; actif : la
//  `cle` de la rubrique ouverte (ou null). `icone` vaut `cle` par défaut.
export default function BarreRubriques({ items, actif, label = "Rubriques", className = "" }) {
  const barre = useRef(null);
  const bloc = useRef(null);
  const precedent = useRef(actif);
  const [tout, setTout] = useState(false);

  // La rubrique ouverte est centrée dans la barre — SANS faire défiler la page
  // (`scrollIntoView` ferait aussi bouger la fenêtre).
  useEffect(() => {
    const b = barre.current;
    const el = b?.querySelector('[aria-current="page"]');
    if (!b || !el) return;
    b.scrollLeft = el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2;
  }, [actif, items.length]);

  //  ⚠️ CHANGER DE RUBRIQUE RAMÈNE AU DÉBUT DE LA RUBRIQUE. L'application ne
  //  remet pas la page en haut à chaque navigation : depuis une barre collée en
  //  haut, on atterrissait au milieu du contenu suivant. On ne remonte que
  //  jusqu'à la barre (l'en-tête reste hors de vue), et seulement si elle était
  //  collée. Sa place « naturelle » se lit sur ce qui la précède : collée, sa
  //  propre position ne vaut plus que son décalage de collage et ne dit rien.
  useEffect(() => {
    if (precedent.current === actif) return;
    precedent.current = actif;
    const el = bloc.current;
    if (!el) return;
    const collage = parseFloat(getComputedStyle(el).top) || 0;
    if (el.getBoundingClientRect().top > collage + 1) return; // pas collée : rien à faire
    const avant = el.previousElementSibling;
    const base = avant
      ? avant.getBoundingClientRect().bottom
      : el.parentElement.getBoundingClientRect().top + parseFloat(getComputedStyle(el.parentElement).paddingTop);
    // Remonter fait revenir l'en-tête : on laisse sa place au-dessus de la barre.
    const haut = base + window.scrollY + parseFloat(getComputedStyle(el).marginTop) - collage;
    if (window.scrollY > haut) window.scrollTo({ top: haut });
  }, [actif]);

  const Pastille = ({ it }) => (it.pastille > 0 ? (
    <span aria-hidden="true" className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold ${
      it.pastilleRouge ? "bg-rose-700 text-white" : "bg-or-500 text-navy-900"
    }`}>
      {it.pastille > 9 ? "9+" : it.pastille}
    </span>
  ) : null);
  const nomAccessible = (it) => (it.pastille > 0 ? `${it.label}, ${it.pastille} nouveau${it.pastille > 1 ? "x" : ""}` : undefined);
  //  Une pastille dans une rubrique hors de l'écran doit se voir sur « Tout ».
  const enAttente = items.some((it) => it.pastille > 0);

  return (
    <div ref={bloc} style={{ top: "var(--haut-entete, 0px)" }}
      className={`sticky z-20 border-b border-navy-900/10 bg-creme/95 backdrop-blur motion-safe:transition-[top] motion-safe:duration-300 ${className}`}>
      <nav ref={barre} aria-label={label}
        className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => setTout(true)} aria-haspopup="dialog"
          aria-label={`Toutes les rubriques${enAttente ? ", certaines ont du nouveau" : ""}`}
          className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-or-500/40 bg-or-500/15 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:border-or-500">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
            <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          Tout
          {enAttente && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-creme bg-or-500" />}
        </button>
        {items.map((it) => {
          const courant = it.cle === actif;
          return (
            <Link key={it.cle} to={it.to} aria-current={courant ? "page" : undefined} aria-label={nomAccessible(it)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                courant
                  ? "border-navy-900 bg-navy-900 text-creme"
                  : "border-navy-900/15 bg-white text-navy-900 hover:border-navy-900/40"
              }`}>
              {it.label}
              <Pastille it={it} />
            </Link>
          );
        })}
      </nav>

      <PanneauBas ouvert={tout} onFermer={() => setTout(false)} titre={label}>
        <ul className="grid grid-cols-3 gap-2 pb-2">
          {items.map((it) => {
            const courant = it.cle === actif;
            return (
              <li key={it.cle}>
                <Link to={it.to} onClick={() => setTout(false)} aria-current={courant ? "page" : undefined} aria-label={nomAccessible(it)}
                  className={`relative flex h-full min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-xs font-semibold leading-tight transition ${
                    courant ? "border-navy-900 bg-navy-900 text-creme" : "border-navy-900/10 bg-creme text-navy-900 hover:border-navy-900/30"
                  }`}>
                  <Icone name={it.icone || it.cle} className={`h-6 w-6 ${courant ? "text-or-400" : "text-or-600"}`} />
                  {it.label}
                  {it.pastille > 0 && <span className="absolute right-1.5 top-1.5"><Pastille it={it} /></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </PanneauBas>
    </div>
  );
}
