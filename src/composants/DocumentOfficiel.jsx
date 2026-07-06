import Cachet from "@/composants/Cachet.jsx";

const dateLisible = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "";

// Rendu imprimable d'un document officiel. `signature` = affiche la signature
// (uniquement une fois le document validé).
export default function DocumentOfficiel({ ecole, titre, corps, signataire, signatureUrl, ville, date, reference, signature = true }) {
  return (
    <div className="zone-impression relative mx-auto max-w-3xl overflow-hidden rounded-xl border border-navy-900/10 bg-white p-10">
      <Cachet size={240} sigle={ecole?.sigle || "GS"} className="pointer-events-none absolute -right-10 top-1/3 text-or-500/5" />

      <div className="flex items-center gap-4 border-b border-navy-900/10 pb-5">
        {ecole?.logo_url
          ? <img src={ecole.logo_url} alt="" className="h-14 w-14 object-contain" />
          : <Cachet size={56} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
        <div>
          <p className="font-display text-xl font-bold text-navy-900">{ecole?.nom}</p>
          <p className="text-xs text-navy-900/50">
            {[ecole?.adresse, ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}
            {ecole?.telephone ? ` · ${ecole.telephone}` : ""}
          </p>
        </div>
      </div>

      {reference && <p className="mt-4 text-xs text-navy-900/50">Réf. : {reference}</p>}

      <h1 className="mt-6 text-center font-display text-2xl font-bold uppercase tracking-wide text-navy-900">{titre}</h1>

      <p className="mt-8 text-sm leading-7 text-navy-900/80">
        Je soussigné(e), <b>{signataire}</b> de l'établissement <b>{ecole?.nom}</b>, {corps}
      </p>
      <p className="mt-4 text-sm leading-7 text-navy-900/80">
        En foi de quoi le présent document est délivré à l'intéressé(e) pour servir et valoir ce que de droit.
      </p>

      <div className="mt-12 flex items-end justify-between">
        <span className="text-xs text-navy-900/40">Document généré via GesSchool</span>
        <div className="text-center">
          <p className="text-sm text-navy-900/70">Fait à {ville || "…"}, le {dateLisible(date)}</p>
          <p className="mt-1 text-sm font-medium text-navy-900">{signataire}</p>
          <div className="mt-1 flex h-16 items-center justify-center">
            {signature && signatureUrl
              ? <img src={signatureUrl} alt="" className="max-h-16 object-contain" />
              : <Cachet size={64} sigle={ecole?.sigle || "GS"} className="text-navy-900/20" />}
          </div>
          <p className="text-[10px] text-navy-900/30">Signature et cachet</p>
        </div>
      </div>
    </div>
  );
}
