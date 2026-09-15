import { useMemo } from "react";
import qrcode from "qrcode-generator";

// Rendu SVG d'un QR code — net à l'impression, sans dépendance réseau ni canvas.
// `value` = texte encodé ; `taille` = côté en px ; `niveau` = correction d'erreur
// (M par défaut : bon compromis densité / robustesse).
export default function QRCode({ value, taille = 76, niveau = "M", className = "" }) {
  const svg = useMemo(() => {
    if (!value) return "";
    try {
      const qr = qrcode(0, niveau); // type 0 = version minimale auto
      qr.addData(String(value));
      qr.make();
      // margin: 2 modules de zone silencieuse intégrée (aide au scan).
      let s = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      // Force le SVG à remplir exactement le conteneur dimensionné.
      s = s.replace("<svg ", '<svg style="display:block;width:100%;height:100%" ');
      return s;
    } catch {
      return "";
    }
  }, [value, niveau]);

  if (!svg) return null;
  return (
    <span
      className={className}
      role="img"
      aria-label="QR code de vérification du document"
      style={{
        display: "inline-block",
        width: taille,
        height: taille,
        background: "#fff",
        padding: 3,
        borderRadius: 4,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
