import { useEffect, useState } from "react";
import { Carte, Bouton } from "@/composants/ui.jsx";
import { pushSupporte, etatPush, activerPush, desactiverPush } from "@/lib/push.js";

// Interrupteur des notifications de l'appareil, pour les espaces « famille ».
//
// Extrait de `ParentNotifications.jsx` sans rien changer à son comportement :
// l'espace ÉTUDIANT n'avait ni centre d'alertes ni invitation à activer le
// push, alors que le parent et le personnel en avaient un. Plutôt que de
// recopier cet interrupteur — dont la partie délicate est le cas iPhone —, les
// deux espaces partagent désormais le même.
//
// ⚠️ Sur iPhone, le web push n'existe QUE si la PWA est installée sur l'écran
// d'accueil. On l'explique au lieu de ne rien afficher : sinon l'utilisateur
// conclut que la fonction n'existe pas.
export default function ActivationPush({ onErreur = () => {} }) {
  const [etat, setEtat] = useState("…");
  const [occupe, setOccupe] = useState(false);

  const rafraichir = async () => { try { setEtat(await etatPush()); } catch { setEtat("non_supporte"); } };
  useEffect(() => { rafraichir(); }, []);

  const iOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = typeof window !== "undefined" && (window.navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches);

  if (!pushSupporte() || etat === "non_supporte") {
    if (iOS && !installee) {
      return (
        <Carte className="p-4">
          <p className="text-sm font-medium text-navy-900">📲 Activez les alertes sur votre iPhone</p>
          <p className="mt-1 text-xs text-navy-900/60">
            Touchez <b>Partager</b> (en bas de Safari), puis <b>« Sur l&apos;écran d&apos;accueil »</b>. Rouvrez ensuite
            l&apos;app depuis son icône : le bouton pour activer les notifications apparaîtra ici.
          </p>
        </Carte>
      );
    }
    return null;
  }

  const basculer = async () => {
    setOccupe(true);
    onErreur("");
    try {
      if (etat === "actif") await desactiverPush();
      else await activerPush();
      await rafraichir();
    } catch (e) { onErreur(e.message); }
    finally { setOccupe(false); }
  };

  return (
    <Carte className="flex items-center justify-between p-4">
      <div>
        <p className="text-sm font-medium text-navy-900">Notifications sur le téléphone</p>
        <p className="text-xs text-navy-900/50">
          {etat === "actif" ? "Activées — tu seras alerté même app fermée."
            : etat === "refuse" ? "Bloquées dans les réglages du navigateur."
            : "Reçois les alertes directement sur ton appareil."}
        </p>
      </div>
      {etat !== "refuse" && (
        <Bouton variante={etat === "actif" ? "fantome" : "primaire"} onClick={basculer} disabled={occupe}>
          {occupe ? "…" : etat === "actif" ? "Désactiver" : "Activer"}
        </Bouton>
      )}
    </Carte>
  );
}
