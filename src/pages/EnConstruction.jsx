import { EnTete } from "@/composants/Layout.jsx";
import Cachet from "@/composants/Cachet.jsx";

// Placeholder pour les modules de la Phase 1 (à venir).
export default function EnConstruction({ titre, phase = "Phase 1" }) {
  return (
    <>
      <EnTete titre={titre} />
      <div className="grid place-items-center p-16">
        <div className="flex flex-col items-center text-center">
          <Cachet size={96} className="text-navy-900/10" />
          <p className="mt-4 text-navy-900/50">
            Module <strong>{titre}</strong> — à construire en <strong>{phase}</strong>.
          </p>
        </div>
      </div>
    </>
  );
}
