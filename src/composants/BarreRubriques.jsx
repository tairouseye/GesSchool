import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

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
//  items : [{ cle, label, to, pastille?, pastilleRouge? }] ; actif : la `cle`
//  de la rubrique ouverte (ou null).
export default function BarreRubriques({ items, actif, label = "Rubriques", className = "" }) {
  const barre = useRef(null);
  const bloc = useRef(null);
  const precedent = useRef(actif);

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
  //  propre position vaut 0 et ne dit plus rien.
  useEffect(() => {
    if (precedent.current === actif) return;
    precedent.current = actif;
    const el = bloc.current;
    if (!el || el.getBoundingClientRect().top > 0) return; // pas collée : rien à faire
    const avant = el.previousElementSibling;
    const base = avant
      ? avant.getBoundingClientRect().bottom
      : el.parentElement.getBoundingClientRect().top + parseFloat(getComputedStyle(el.parentElement).paddingTop);
    const haut = base + window.scrollY + parseFloat(getComputedStyle(el).marginTop);
    if (window.scrollY > haut) window.scrollTo({ top: haut });
  }, [actif]);

  return (
    <div ref={bloc} className={`sticky top-0 z-20 border-b border-navy-900/10 bg-creme/95 backdrop-blur ${className}`}>
      <nav ref={barre} aria-label={label}
        className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const courant = it.cle === actif;
          return (
            <Link key={it.cle} to={it.to} aria-current={courant ? "page" : undefined}
              aria-label={it.pastille > 0 ? `${it.label}, ${it.pastille} nouveau${it.pastille > 1 ? "x" : ""}` : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                courant
                  ? "border-navy-900 bg-navy-900 text-creme"
                  : "border-navy-900/15 bg-white text-navy-900 hover:border-navy-900/40"
              }`}>
              {it.label}
              {it.pastille > 0 && (
                <span aria-hidden="true" className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold ${
                  it.pastilleRouge ? "bg-rose-700 text-white" : "bg-or-500 text-navy-900"
                }`}>
                  {it.pastille > 9 ? "9+" : it.pastille}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
