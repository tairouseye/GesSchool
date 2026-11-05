import { Link } from "react-router-dom";
import { Icone } from "@/composants/Icones.jsx";

//  Les pièces communes des accueils de métier (05/11/2026), sur le modèle de
//  l'espace parent : quelques gestes en grand, nommés par ce qu'ils font, et
//  ce qui attend. Les chiffres de l'école restent à un toucher.

export function CadreAccueil({ prenom, droite, children }) {
  const jourLong = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-navy-900/60 first-letter:uppercase">{jourLong}</p>
          <h1 className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">Bonjour{prenom ? ` ${prenom}` : ""}</h1>
        </div>
        {droite}
      </div>
      {children}
    </div>
  );
}

const FONDS = {
  principal: ["bg-navy-900 text-creme", "bg-white/15", ""],
  bleu: ["bg-sky-50 text-navy-900", "bg-white", "text-sky-700"],
  vert: ["bg-emerald-50 text-navy-900", "bg-white", "text-emerald-700"],
  jaune: ["bg-amber-50 text-navy-900", "bg-white", "text-amber-800"],
  violet: ["bg-violet-50 text-navy-900", "bg-white", "text-violet-700"],
};

// items : [{ titre, sous?, icone, fond, to | onClick }]
export function Gestes({ items, colonnes = "sm:grid-cols-3" }) {
  return (
    <div className={`grid gap-3 ${colonnes}`}>
      {items.map((g) => {
        const [fond, pastille, trait] = FONDS[g.fond] || FONDS.bleu;
        const classe = `flex min-h-[6.5rem] items-center gap-3.5 rounded-3xl p-4 text-left transition active:scale-[.98] ${fond}`;
        const contenu = (
          <>
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${pastille}`}><Icone name={g.icone} className={`h-8 w-8 ${trait}`} /></span>
            <span className="min-w-0">
              <span className="block font-display text-xl font-bold">{g.titre}</span>
              {g.sous && <span className="block text-sm">{g.sous}</span>}
            </span>
          </>
        );
        return g.to
          ? <Link key={g.titre} to={g.to} className={classe}>{contenu}</Link>
          : <button key={g.titre} type="button" onClick={g.onClick} className={classe}>{contenu}</button>;
      })}
    </div>
  );
}

const TONS = {
  rouge: ["bg-rose-50", "text-rose-800"], or: ["bg-amber-50", "text-amber-800"], bleu: ["bg-sky-50", "text-sky-800"],
  violet: ["bg-violet-50", "text-violet-800"], navy: ["bg-white ring-1 ring-inset ring-navy-900/10", "text-navy-900"],
};

// lignes : [{ to, titre, detail?, bouton, ton }], celles de lib/aTraiter.js.
export function AFaire({ titre = "À traiter", lignes, chargement }) {
  return (
    <section aria-label={titre} className="space-y-2">
      <h2 className="font-display text-lg font-bold text-navy-900">{titre}</h2>
      {lignes.length === 0 && !chargement && (
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Rien en attente pour l&apos;instant.</p>
      )}
      {lignes.map((t) => {
        const [fond, texte] = TONS[t.ton] || TONS.navy;
        return (
          <Link key={t.titre} to={t.to} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl p-3.5 ${fond}`}>
            <span className="min-w-0">
              <span className="block font-semibold text-navy-900">{t.titre}</span>
              {t.detail && <span className="block text-sm text-navy-900/70">{t.detail}</span>}
            </span>
            <span className={`shrink-0 text-sm font-bold ${texte}`}>{t.bouton}</span>
          </Link>
        );
      })}
    </section>
  );
}

// Un encadré de chiffres : [[libellé, valeur, ton?]], et le lien vers le détail.
export function Reperes({ titre, lignes, to, lien }) {
  return (
    <section aria-label={titre} className="space-y-2">
      <h2 className="font-display text-lg font-bold text-navy-900">{titre}</h2>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-navy-900/10">
        <dl className="space-y-2">
          {lignes.map(([label, valeur, ton]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-navy-900/70">{label}</dt>
              <dd className={`font-display text-lg font-bold tabular-nums ${ton || "text-navy-900"}`}>{valeur}</dd>
            </div>
          ))}
        </dl>
        {to && <Link to={to} className="mt-1 inline-flex min-h-10 items-center text-sm font-semibold text-navy-700">{lien}</Link>}
      </div>
    </section>
  );
}
