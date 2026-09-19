import { useEffect, useRef, useState, useCallback } from "react";
import { Bouton, Alerte, Modale } from "@/composants/ui.jsx";

// Scan de code-barres par la caméra, via l'API navigateur `BarcodeDetector`.
//
// Choix assumé : AUCUNE dépendance. `BarcodeDetector` est disponible sur
// Chrome/Edge (Android et bureau) ; iOS Safari et Firefox ne l'implémentent
// pas. Là-bas on n'affiche pas un bouton mort : on renvoie explicitement vers
// la saisie clavier, qui fonctionne partout et couvre déjà les douchettes USB.
//
// Le piège de ce genre de composant est la caméra qui reste allumée : l'arrêt
// des pistes est centralisé et rejoué au démontage comme à la fermeture.

export const scanCameraDisponible = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window
  && !!navigator.mediaDevices?.getUserMedia;

const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "codabar"];

export default function ScannerCodeBarres({ ouvert, onCode, onFermer, titre = "Scanner un code-barres" }) {
  const videoRef = useRef(null);
  const fluxRef = useRef(null);
  const boucleRef = useRef(null);
  const dernierRef = useRef({ code: "", t: 0 });
  const [erreur, setErreur] = useState("");
  const [dernier, setDernier] = useState("");

  const arreter = useCallback(() => {
    if (boucleRef.current) { clearInterval(boucleRef.current); boucleRef.current = null; }
    const flux = fluxRef.current;
    if (flux) { flux.getTracks().forEach((t) => t.stop()); fluxRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!ouvert) { arreter(); return undefined; }
    let vivant = true;

    (async () => {
      if (!scanCameraDisponible()) {
        setErreur("Ce navigateur ne sait pas lire les codes-barres par la caméra. Utilisez la saisie clavier ou une douchette.");
        return;
      }
      try {
        const detecteur = new window.BarcodeDetector({ formats: FORMATS });
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (!vivant) { flux.getTracks().forEach((t) => t.stop()); return; }
        fluxRef.current = flux;
        if (videoRef.current) {
          videoRef.current.srcObject = flux;
          await videoRef.current.play().catch(() => {});
        }

        boucleRef.current = setInterval(async () => {
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;
          try {
            const trouves = await detecteur.detect(v);
            const code = trouves?.[0]?.rawValue?.trim();
            if (!code) return;
            // Un code reste dans le champ de la caméra pendant plusieurs
            // images : sans ce verrou, un seul livre serait « scanné » 10 fois.
            const maintenant = Date.now();
            if (dernierRef.current.code === code && maintenant - dernierRef.current.t < 2000) return;
            dernierRef.current = { code, t: maintenant };
            setDernier(code);
            onCode(code);
          } catch { /* image illisible : on réessaie à l'itération suivante */ }
        }, 300);
      } catch (e) {
        setErreur(e?.name === "NotAllowedError"
          ? "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur."
          : `Caméra indisponible : ${e.message}`);
      }
    })();

    return () => { vivant = false; arreter(); };
  }, [ouvert, arreter, onCode]);

  // Filet de sécurité : la caméra ne doit jamais survivre au composant.
  useEffect(() => arreter, [arreter]);

  function fermer() { arreter(); onFermer(); }

  return (
    <Modale ouvert={!!ouvert} onFermer={fermer} titre={titre}>
      <div className="space-y-3">
        <Alerte ton="erreur">{erreur}</Alerte>

        {!erreur && (
          <div className="relative overflow-hidden rounded-xl bg-navy-900">
            <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
            {/* Repère de visée */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-20 w-4/5 rounded-lg border-2 border-or-500/80" />
            </div>
          </div>
        )}

        {dernier && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Dernier code lu : <span className="font-mono">{dernier}</span>
          </p>
        )}

        <p className="text-xs text-navy-900/45">
          Présentez le code-barres dans le cadre. Le scan continue tant que cette fenêtre reste ouverte.
        </p>

        <div className="flex justify-end">
          <Bouton variante="fantome" onClick={fermer}>Terminer</Bouton>
        </div>
      </div>
    </Modale>
  );
}
