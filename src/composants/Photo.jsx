import { useEffect, useState } from "react";
import { urlSignee } from "@/lib/stockage.js";

// Affiche une image stockée dans un bucket privé via une URL signée.
// Rend `fallback` (ou rien) tant que l'URL n'est pas prête / si absente.
export default function Photo({ bucket, valeur, alt = "", className = "", fallback = null }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let actif = true;
    setUrl(null);
    if (valeur) urlSignee(bucket, valeur).then((u) => { if (actif) setUrl(u); });
    return () => { actif = false; };
  }, [bucket, valeur]);

  if (!url) return fallback;
  return <img src={url} alt={alt} className={className} />;
}
