import { useEffect, useState } from "react";

//  Barres qui s'effacent au défilement (espace parent, téléphone).
//
//  Vers le bas : on lit, l'en-tête et les onglets laissent la place. Vers le
//  haut : ils reviennent au moindre geste. Ils restent toujours visibles en
//  haut de page et tout en bas — un parent qui arrive au bout d'une liste
//  cherche la suite, pas à deviner où est passé le menu.
//
//  Un seuil de quelques pixels ignore les tremblements du doigt, qui sinon
//  feraient clignoter les barres. `actif = false` les fige à l'écran (visite
//  guidée en cours, grand écran).
const SEUIL = 6;
const ZONE_HAUTE = 48;

export function useMasqueAuDefilement(actif = true) {
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    if (!actif) { setMasque(false); return undefined; }
    let dernier = window.scrollY;
    let attente = false;
    const lire = () => {
      attente = false;
      const y = window.scrollY;
      const enBas = y + window.innerHeight >= document.documentElement.scrollHeight - 8;
      if (y < ZONE_HAUTE || enBas) { setMasque(false); dernier = y; return; }
      const d = y - dernier;
      if (Math.abs(d) < SEUIL) return; // on cumule les petits mouvements
      setMasque(d > 0);
      dernier = y;
    };
    const onScroll = () => { if (!attente) { attente = true; requestAnimationFrame(lire); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [actif]);

  return [masque, setMasque];
}

// Vrai quand la requête média est satisfaite ; suit les changements (rotation,
// fenêtre redimensionnée).
export function useMedia(requete) {
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia(requete).matches);
  useEffect(() => {
    const m = window.matchMedia(requete);
    const maj = () => setOk(m.matches);
    maj();
    m.addEventListener("change", maj);
    return () => m.removeEventListener("change", maj);
  }, [requete]);
  return ok;
}
