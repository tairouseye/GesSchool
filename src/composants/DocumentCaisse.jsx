import { montantEnLettres } from "@/lib/montantEnLettres.js";
import SceauVerification from "@/composants/SceauVerification.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { GESPRO } from "@/lib/gespro.js";

// GesSchool — facture et reçu de caisse, mise en page « établissement ».
//
// Reprend la structure des imprimés que les écoles utilisent déjà au Sénégal :
// cadre de couleur, bandeau de tableau, mention du montant en toutes lettres,
// modes de paiement, pied de page légal (RCCM / NINEA). La palette n'est PAS
// figée : elle vient de `ecoles.couleur_primaire` / `couleur_secondaire`, pour
// que chaque école reconnaisse son propre document.
//
// La facture et le reçu échangent leurs couleurs (cadre / bandeau), comme sur
// les carnets imprimés : on distingue les deux d'un coup d'œil, de loin.

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

// Teinte très claire d'une couleur hex, pour les lignes alternées.
function teinte(hex, alpha = 0.14) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return `rgba(11, 31, 58, ${alpha})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
}

export default function DocumentCaisse({
  type = "facture",          // "facture" | "recu"
  ecole,
  identite = {},             // { rccm, ninea, forme_juridique, banque_nom, banque_compte, cheque_ordre }
  mobile = {},               // { orange_money, wave, free_money }
  numero,
  date,
  objet,
  lignes = [],
  total = 0,
  destinataire,              // « Élève · matricule », en tête du document
  paiement = null,           // reçu : { mode, reference, payeur }
  codeVerification = null,
}) {
  const recu = type === "recu";
  const primaire = ecole?.couleur_primaire || "#0B1F3A";
  const secondaire = ecole?.couleur_secondaire || "#C9A227";
  // Le cadre et le bandeau du tableau sont toujours en opposition.
  const cadre = recu ? secondaire : primaire;
  const bandeau = recu ? primaire : secondaire;
  const devise = ecole?.devise || "XOF";

  const modesMobile = [
    ["Orange Money", mobile?.orange_money],
    ["Wave", mobile?.wave],
    ["Free Money", mobile?.free_money],
  ].filter(([, v]) => v);

  const piedLegal = [
    [ecole?.nom, identite?.forme_juridique].filter(Boolean).join(" "),
    ecole?.adresse, ecole?.ville,
    identite?.rccm ? `RCCM : ${identite.rccm}` : null,
    identite?.ninea ? `NINEA : ${identite.ninea}` : null,
    ecole?.telephone, ecole?.email,
  ].filter(Boolean).join(" · ");

  return (
    <div className="zone-impression document-caisse bg-white" style={{ border: `10px solid ${cadre}` }}>
      <div className="relative overflow-hidden bg-white px-6 pb-5 pt-6 sm:px-8">
        {/* Arc décoratif du modèle : un demi-disque débordant par le haut. */}
        <div aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: teinte(bandeau, 0.9) }} />

        {/* --- En-tête --- */}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight"
              style={{ color: primaire }}>
              {recu ? "Reçu" : "Facture"}
            </h2>
            <dl className="mt-3 space-y-1 text-sm text-navy-900">
              <div className="flex gap-2"><dt className="w-14 text-navy-900/60">N° :</dt><dd className="font-mono font-medium">{numero || "—"}</dd></div>
              <div className="flex gap-2"><dt className="w-14 text-navy-900/60">Date :</dt><dd className="font-medium">{dateFr(date)}</dd></div>
              <div className="flex gap-2"><dt className="w-14 text-navy-900/60">Objet :</dt><dd className="font-medium">{objet || "Frais de scolarité"}</dd></div>
            </dl>
          </div>
          <div className="shrink-0 text-right">
            {/* `Cachet` hérite de la couleur par `currentColor` : on la pose
                sur le conteneur, il n'accepte pas de style. */}
            {ecole?.logo_url
              ? <img src={ecole.logo_url} alt="" className="ml-auto h-20 w-20 object-contain" />
              : <span className="block" style={{ color: primaire }}>
                  <Cachet size={64} sigle={ecole?.sigle || "GS"} className="ml-auto" />
                </span>}
            {destinataire && (
              <p className="mt-2 max-w-[13rem] text-sm font-semibold text-navy-900">{destinataire}</p>
            )}
          </div>
        </div>

        {/* --- Tableau --- */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: bandeau }}>
              {["Description", "Qté", "Prix", "Total"].map((t, i) => (
                <th key={t}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"}`}
                  style={{ color: recu ? "#FFFFFF" : primaire }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id || i} style={i % 2 === 1 ? { backgroundColor: teinte(bandeau, 0.16) } : undefined}>
                <td className="px-3 py-2 text-navy-900">{l.libelle}</td>
                <td className="px-3 py-2 text-center font-mono text-navy-900/70">{l.quantite ?? 1}</td>
                <td className="px-3 py-2 text-right font-mono text-navy-900/70">{fmt(l.prix_unitaire ?? l.montant)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium text-navy-900">{fmt(l.montant)}</td>
              </tr>
            ))}
            {/* Le carnet imprimé garde des lignes vides : sur un document
                généré elles n'ont plus d'usage, on s'arrête aux vraies lignes. */}
            {lignes.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-navy-900/40">Aucune ligne.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${cadre}` }}>
              <td colSpan={2} />
              <td className="px-3 py-2 text-right font-display text-lg font-bold uppercase" style={{ color: primaire }}>Total</td>
              <td className="px-3 py-2 text-right font-mono text-lg font-bold text-navy-900">
                {fmt(total)} {devise}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* --- Montant en toutes lettres : la mention qui rend le chiffre
                infalsifiable, et qui manquait à l'application. --- */}
        <div className="mt-4 border-y py-3" style={{ borderColor: teinte(cadre, 0.35) }}>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-navy-900/60">
            {recu ? "Arrêté le présent reçu à la somme de" : "Arrêtée la présente facture à la somme de"}
          </p>
          <p className="mt-1 text-center font-display text-base font-bold text-navy-900">
            {montantEnLettres(total, devise)}
          </p>
        </div>

        {/* --- Bas de document : diffère selon la pièce --- */}
        {recu ? (
          <div className="mt-5 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-bold" style={{ color: primaire }}>Paiement effectué par :</p>
              <p className="mt-1 text-sm text-navy-900">{paiement?.payeur || destinataire || "—"}</p>
              <p className="mt-1 text-xs text-navy-900/55">
                {[paiement?.mode, paiement?.reference ? `réf. ${paiement.reference}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-col items-end justify-end">
              <p className="text-sm font-bold" style={{ color: primaire }}>Signature</p>
              {ecole?.cachet_url
                ? <img src={ecole.cachet_url} alt="" className="mt-1 h-20 object-contain" />
                : <div className="mt-1 h-16 w-40 border-b border-navy-900/25" />}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-center text-sm font-bold uppercase tracking-wide" style={{ color: primaire }}>
              Modes de paiement
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-navy-900/75">
              <span>💵 Espèces</span>
              {modesMobile.map(([nom, num]) => <span key={nom}>📱 {nom} : {num}</span>)}
              {identite?.cheque_ordre && <span>🧾 Chèque à l&apos;ordre de {identite.cheque_ordre}</span>}
              {identite?.banque_compte && (
                <span>🏦 {identite.banque_nom || "Virement"} : {identite.banque_compte}</span>
              )}
            </div>
            {modesMobile.length === 0 && !identite?.banque_compte && (
              <p className="no-print mt-2 text-center text-[11px] text-or-600">
                Renseignez vos moyens de paiement dans Paramètres pour qu&apos;ils figurent ici.
              </p>
            )}
          </div>
        )}

        {codeVerification && <SceauVerification code={codeVerification} reference={numero} />}
      </div>

      {/* --- Bandeau légal --- */}
      <div className="px-4 py-2 text-center text-[10px] font-medium leading-snug"
        style={{ backgroundColor: cadre, color: "#FFFFFF" }}>
        {piedLegal || ecole?.nom}
      </div>
      {GESPRO.afficherBranding && (
        <p className="no-print bg-white py-1 text-center text-[9px] text-navy-900/30">
          Solution développée par {GESPRO.nom} · {GESPRO.contacts.site.replace(/^https?:\/\//, "")}
        </p>
      )}
    </div>
  );
}
