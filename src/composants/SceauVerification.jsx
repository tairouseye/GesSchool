import QRCode from "@/composants/QRCode.jsx";
import { urlVerification } from "@/lib/verification.js";

// Pied de page « authentification » apposé sur les documents officiels.
// Le QR renvoie vers la page publique de vérification GesSchool, qui atteste le
// document depuis sa source. À poser DANS la zone imprimable (.zone-impression).
export default function SceauVerification({ code, reference = null, compact = false }) {
  if (!code) return null;
  const url = urlVerification(code);
  const domaine = url.replace(/^https?:\/\//, "").split("#")[0].replace(/\/+$/, "");
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-navy-900/10 pt-3">
      <QRCode value={url} taille={compact ? 68 : 84} niveau="L" />
      <div className="text-[10px] leading-snug text-navy-900/55">
        <p className="font-semibold text-navy-900/75">Document authentifiable</p>
        <p>Scannez ce QR code pour vérifier l'authenticité de ce document.</p>
        <p className="text-navy-900/40">
          {domaine}/#/verifier{reference ? ` · Réf. ${reference}` : ""}
        </p>
      </div>
    </div>
  );
}
