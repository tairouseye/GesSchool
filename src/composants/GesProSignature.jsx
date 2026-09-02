import { Link } from "react-router-dom";
import { GESPRO, lienWhatsAppGesPro } from "@/lib/gespro.js";

// Signature « concepteur » unifiée (remplace les pieds de page copiés).
// - `ton` : "sombre" (texte clair sur fond navy) ou "clair" (texte navy sur fond clair).
// - `avecSlogan` / `avecContacts` / `avecVersion` : modulables selon l'emplacement.
// Respecte GESPRO.afficherBranding (version blanche possible).
export default function GesProSignature({
  ton = "sombre",
  avecSlogan = true,
  avecContacts = false,
  avecVersion = true,
  className = "",
}) {
  const clair = ton === "clair";
  const faible = clair ? "text-navy-900/40" : "text-creme/40";
  const moyen = clair ? "text-navy-900/50" : "text-creme/50";
  const fort = clair ? "text-navy-900/70" : "text-creme/70";
  const lien = clair ? "hover:text-or-600" : "hover:text-or-500";

  // Version « blanche » : on garde juste la version applicative si demandée.
  if (!GESPRO.afficherBranding) {
    return avecVersion ? (
      <div className={`text-center ${className}`}>
        <p className={`font-mono text-[10px] ${faible}`}>GesSchool v{__APP_VERSION__} · {__BUILD_DATE__}</p>
      </div>
    ) : null;
  }

  return (
    <div className={`space-y-1 text-center text-[11px] ${moyen} ${className}`}>
      <p>Développé par <Link to="/a-propos" className={`font-semibold underline-offset-2 hover:underline ${fort}`}>{GESPRO.nom}</Link></p>
      {avecSlogan && GESPRO.slogan && <p className={`italic ${faible}`}>{GESPRO.slogan}</p>}
      {avecContacts && (
        <p className={faible}>
          <a href={`mailto:${GESPRO.contacts.email}`} className={lien}>{GESPRO.contacts.email}</a>
          {" · "}
          <a href={lienWhatsAppGesPro("Bonjour, j'ai besoin d'assistance sur GesSchool.")} target="_blank" rel="noreferrer" className={lien}>
            💬 Assistance WhatsApp
          </a>
        </p>
      )}
      {avecVersion && <p className={`font-mono ${faible}`}>GesSchool v{__APP_VERSION__} · {__BUILD_DATE__}</p>}
    </div>
  );
}
