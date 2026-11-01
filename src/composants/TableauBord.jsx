import { Link } from "react-router-dom";
import { Carte, Skeleton } from "@/composants/ui.jsx";

// Briques des tableaux de bord (refonte du 31/10/2026, dans l'esprit d'Alma) :
// un bonjour daté, puis « À faire » — une ligne et un bouton par action —,
// puis les chiffres. Le tableau Gestion (29/10) en était le seul exemple ;
// Pédagogie, Pilotage et l'espace parent s'y alignent, pour qu'on retrouve
// partout le même ordre de lecture.

//  « jeudi 29 octobre » → « Jeudi 29 octobre » (la classe `capitalize`
//  mettrait aussi une majuscule au mois).
export function jourDuJour() {
  const brut = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

export function Salutation({ prenom, children }) {
  return (
    <div>
      <p className="text-sm text-navy-900/60">{jourDuJour()}</p>
      <h2 className="font-display text-2xl font-bold text-navy-900">Bonjour{prenom ? ` ${prenom}` : ""}</h2>
      {children && <p className="mt-0.5 text-sm text-navy-900/60">{children}</p>}
    </div>
  );
}

const TONS = {
  or: "bg-amber-100 text-amber-700",
  rouge: "bg-rose-100 text-rose-700",
  navy: "bg-navy-900/10 text-navy-900",
  bleu: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  vert: "bg-emerald-100 text-emerald-700",
};

// La carte « À faire ». `items` : [{ to, ton, icone, titre, detail, bouton }],
// les entrées fausses sont ignorées (on écrit `cond && {…}`).
export function ListeAFaire({ titre = "À faire aujourd'hui", items = [], chargement = false, vide = "Rien à traiter pour l'instant ✓" }) {
  const lignes = items.filter(Boolean);
  return (
    <Carte>
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
        <h3 className="font-semibold text-navy-900">{titre}</h3>
        {!chargement && lignes.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{lignes.length}</span>
        )}
      </div>
      {chargement ? (
        <div className="space-y-3 p-5 sm:p-6"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : lignes.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-navy-900/60 sm:px-6">{vide}</p>
      ) : (
        <ul className="divide-y divide-navy-900/5 px-2 pb-2 pt-3">
          {lignes.map((a) => <LigneAFaire key={a.cle || a.titre} {...a} />)}
        </ul>
      )}
    </Carte>
  );
}

// Une ligne cliquable en entier ; le « bouton » dit l'action qui attend.
// Sur téléphone, le bouton passe sous le texte plutôt que de l'écraser.
export function LigneAFaire({ to, ton = "navy", icone, titre, detail, bouton }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-navy-900/[0.03] sm:gap-4 sm:px-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg ${TONS[ton] || TONS.navy}`} aria-hidden="true">{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-navy-900">{titre}</span>
          {detail && <span className="block text-sm text-navy-900/60">{detail}</span>}
        </span>
        {bouton && (
          <span className="shrink-0 rounded-lg border border-navy-900/15 px-3 py-1.5 text-sm font-semibold text-navy-900 group-hover:border-navy-900/40">
            {bouton}
          </span>
        )}
      </Link>
    </li>
  );
}

// Raccourcis : les gestes les plus fréquents de l'espace, en un clic.
// `items` : [{ to, icone, label, detail }], entrées fausses ignorées.
export function Raccourcis({ items = [] }) {
  const liens = items.filter(Boolean);
  if (liens.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {liens.map((r) => (
        <Link key={r.to} to={r.to}
          className="group flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-white p-4 transition hover:border-or-500/60">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-lg text-or-500" aria-hidden="true">{r.icone}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-900">{r.label}</span>
            {r.detail && <span className="block truncate text-xs text-navy-900/55">{r.detail}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

// Titre de carte + lien « voir tout » aligné à droite.
export function TitreCarte({ children, to, lien = "Tout voir" }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="font-semibold text-navy-900">{children}</h3>
      {to && <Link to={to} className="ml-auto shrink-0 text-sm font-medium text-navy-700 hover:text-or-600">{lien} →</Link>}
    </div>
  );
}

// Initiales en pastille ronde (listes d'élèves, de débiteurs).
export function Initiales({ nom, ton = "navy" }) {
  const lettres = String(nom || "").split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const tons = { navy: "bg-navy-900/5 text-navy-900", rouge: "bg-rose-50 text-rose-700", or: "bg-amber-50 text-amber-700" };
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${tons[ton] || tons.navy}`} aria-hidden="true">
      {lettres || "?"}
    </span>
  );
}

// =====================================================================
//  Blocs « Classter » (maquette docs/maquette-tableaux-classter.html,
//  validée le 31/10/2026) : des blocs denses côte à côte, chaque chiffre
//  avec son évolution, un graphique sur l'année comparée à la précédente,
//  un agenda et l'activité récente.
// =====================================================================

// Cadre commun d'un bloc : titre, compteur, lien « voir », contenu.
export function Bloc({ titre, to, lien = "Tout voir", compteur, className = "", children }) {
  return (
    <Carte className={`p-5 ${className}`}>
      {titre && (
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-navy-900">{titre}</h3>
          {compteur > 0 && <span className="rounded-full bg-rose-100 px-2 text-xs font-bold text-rose-700">{compteur}</span>}
          {to && <Link to={to} className="ml-auto shrink-0 text-xs font-medium text-navy-700 hover:text-or-600">{lien} →</Link>}
        </div>
      )}
      {children}
    </Carte>
  );
}

const TONS_PASTILLE = {
  bleu: "bg-sky-100 text-sky-700", or: "bg-amber-100 text-amber-700", vert: "bg-emerald-100 text-emerald-700",
  rouge: "bg-rose-100 text-rose-700", violet: "bg-violet-100 text-violet-700", navy: "bg-navy-900/10 text-navy-900",
};

// Évolution d'un chiffre : ▲/▼, l'écart, et PAR RAPPORT À QUOI.
// `bon` dit si une hausse est une bonne nouvelle (des impayés qui montent ne
// le sont pas) : c'est lui qui choisit le vert ou le rouge, pas le sens.
export function Evolution({ delta, texte, bon = true, format = (v) => v }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta === 0) return <span className="text-navy-900/55">= {texte}</span>;
  const hausse = delta > 0;
  return (
    <span>
      <span className={`font-semibold ${hausse === bon ? "text-emerald-700" : "text-rose-700"}`}>{hausse ? "▲" : "▼"} {format(Math.abs(delta))}</span>
      <span className="text-navy-900/55"> {texte}</span>
    </span>
  );
}

// Tuile de chiffre clé : libellé, pastille d'icône, valeur, puis une ligne
// (évolution ou précision) et, au besoin, une barre de progression.
export function Chiffre({ label, icone, ton = "bleu", valeur, suffixe, tonValeur = "text-navy-900", ligne, barre, chargement = false }) {
  return (
    <Carte className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-navy-900/60">{label}</span>
        {icone && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm ${TONS_PASTILLE[ton] || TONS_PASTILLE.bleu}`} aria-hidden="true">{icone}</span>}
      </div>
      {chargement ? (
        <div className="mt-2 h-9 animate-pulse rounded bg-navy-900/5" />
      ) : (
        <p className={`mt-1 font-display text-3xl font-bold ${tonValeur}`}>
          {valeur ?? "—"}{suffixe && <span className="ml-1 text-sm font-normal text-navy-900/40">{suffixe}</span>}
        </p>
      )}
      {barre != null && !chargement && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-900/10">
          <div className={`h-full rounded-full ${barre >= 80 ? "bg-emerald-500" : barre >= 60 ? "bg-or-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, barre))}%` }} />
        </div>
      )}
      {ligne && !chargement && <p className="mt-1 text-xs">{ligne}</p>}
    </Carte>
  );
}

// Barres de l'année en cours + courbe pointillée or de l'année précédente.
// `points` : [{ lib, val (null = mois à venir), ref (null = inconnu) }].
export function GraphiqueAnnuel({ points = [], format = (v) => v, legende = ["Cette année", "Année précédente"], hauteur = 200 }) {
  const n = points.length;
  if (n === 0) return null;
  const max = Math.max(1, ...points.flatMap((p) => [p.val || 0, p.ref || 0]));
  const L = 640, H = hauteur, bas = H - 26, haut = 18, pas = (L - 20) / n;
  const y = (v) => bas - ((v || 0) / max) * (bas - haut);
  const x = (i) => 20 + pas * i + pas / 2;
  const avecRef = points.some((p) => p.ref > 0);
  const ligne = points.map((p, i) => (p.ref == null ? null : `${x(i)},${y(p.ref)}`)).filter(Boolean).join(" ");
  const dernier = points.reduce((d, p, i) => (p.val != null ? i : d), -1);
  const largeur = Math.min(36, pas * 0.64);
  return (
    <div>
      <div className="flex flex-wrap justify-end gap-4 text-xs text-navy-900/60">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-navy-900" />{legende[0]}</span>
        {avecRef && <span className="flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed border-or-500" />{legende[1]}</span>}
      </div>
      <svg viewBox={`0 0 ${L} ${H}`} className="mt-2 w-full" role="img"
        aria-label={points.map((p) => `${p.lib} : ${p.val == null ? "à venir" : format(p.val)}`).join(", ")}>
        {[0, 0.5, 1].map((t) => <line key={t} x1="20" x2={L} y1={haut + (bas - haut) * t} y2={haut + (bas - haut) * t} stroke="#e5e8ee" />)}
        {points.map((p, i) => p.val != null && (
          <g key={p.lib + i}>
            <rect x={x(i) - largeur / 2} y={y(p.val)} width={largeur} height={Math.max(0, bas - y(p.val))} rx="4"
              className={i === dernier ? "fill-or-500" : "fill-navy-900"} />
            {p.val > 0 && <text x={x(i)} y={y(p.val) - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0b1f3a">{format(p.val)}</text>}
          </g>
        ))}
        {avecRef && <polyline points={ligne} fill="none" stroke="rgb(var(--or-500))" strokeWidth="2" strokeDasharray="5 4" />}
        {points.map((p, i) => <text key={"m" + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{p.lib}</text>)}
      </svg>
    </div>
  );
}

// Agenda : une date en pastille, un titre, un détail.
// `items` : [{ date: "AAAA-MM-JJ", titre, detail, ton }], déjà triés.
const TONS_AGENDA = {
  rouge: ["bg-rose-50", "text-rose-700", "text-rose-700"], bleu: ["bg-sky-50", "text-sky-700", "text-sky-700"],
  violet: ["bg-violet-50", "text-violet-600", "text-violet-700"], or: ["bg-amber-50", "text-amber-700", "text-amber-700"],
};
export function Agenda({ items = [], vide = "Rien de prévu dans les prochaines semaines." }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-navy-900/60">{vide}</p>;
  return (
    <ul className="mt-3 space-y-3">
      {items.map((a, i) => {
        const d = new Date(`${a.date}T12:00:00`);
        const [fond, mois, jour] = TONS_AGENDA[a.ton] || TONS_AGENDA.bleu;
        return (
          <li key={i} className="flex gap-3">
            <div className={`w-11 shrink-0 rounded-lg py-1 text-center ${fond}`}>
              <p className={`text-[10px] font-semibold uppercase ${mois}`}>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</p>
              <p className={`font-display text-lg font-bold leading-none ${jour}`}>{String(d.getDate()).padStart(2, "0")}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-900">{a.titre}</p>
              {a.detail && <p className="truncate text-xs text-navy-900/60">{a.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// « À traiter » en version compacte : un point de couleur, le texte, un bouton.
const POINTS = { or: "bg-amber-500", rouge: "bg-rose-500", violet: "bg-violet-500", bleu: "bg-sky-500", navy: "bg-navy-900", vert: "bg-emerald-500" };
export function ListeCompacte({ items = [], vide = "Rien à traiter ✓" }) {
  const lignes = items.filter(Boolean);
  if (lignes.length === 0) return <p className="mt-3 text-sm text-navy-900/60">{vide}</p>;
  return (
    <ul className="mt-2 divide-y divide-navy-900/5 text-sm">
      {lignes.map((l) => (
        <li key={l.cle || l.titre}>
          <Link to={l.to} className="group flex items-center gap-3 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${POINTS[l.ton] || POINTS.navy}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-navy-900">{l.titre}</span>
            {l.bouton && (
              <span className="shrink-0 rounded-md border border-navy-900/15 px-2 py-0.5 text-xs font-semibold text-navy-900 group-hover:border-navy-900/40">{l.bouton}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Barres horizontales : une ligne par classe, niveau ou enseignant.
// `items` : [{ label, pct (0-100), droite, ton }].
const TONS_BARRE = { vert: "bg-emerald-500", or: "bg-or-500", rouge: "bg-rose-500", navy: "bg-navy-900/80" };
export function BarresListe({ items = [], vide = "Aucune donnée pour l'instant." }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-navy-900/60">{vide}</p>;
  return (
    <ul className="mt-3 space-y-2.5 text-xs">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate font-medium text-navy-900" title={it.label}>{it.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-900/10">
            <div className={`h-full rounded-full ${TONS_BARRE[it.ton] || TONS_BARRE.navy}`} style={{ width: `${Math.min(100, Math.max(0, it.pct || 0))}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right font-mono font-semibold text-navy-900">{it.droite}</span>
        </li>
      ))}
    </ul>
  );
}

// Anneau de répartition (modes de paiement…). `parts` : [{ label, val, couleur }].
export function Anneau({ parts = [], vide = "Rien sur la période." }) {
  const total = parts.reduce((s, p) => s + p.val, 0);
  if (!total) return <p className="mt-3 text-sm text-navy-900/60">{vide}</p>;
  let cumul = 0;
  return (
    <div className="mt-3 flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f5" strokeWidth="6" />
        {parts.map((p) => {
          const pct = (p.val / total) * 100;
          const arc = <circle key={p.label} cx="21" cy="21" r="15.9" fill="none" stroke={p.couleur} strokeWidth="6"
            strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-cumul} />;
          cumul += pct;
          return arc;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.couleur }} />
            <span className="truncate text-navy-900/70">{p.label}</span>
            <b className="ml-auto pl-2 text-navy-900">{Math.round((p.val / total) * 100)} %</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Fil d'activité : qui, quoi, quand. `items` : [{ initiales, ton, titre, detail, quand }].
export function FilActivite({ items = [], vide = "Aucune activité récente." }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-navy-900/60">{vide}</p>;
  return (
    <ul className="mt-3 space-y-3 text-sm">
      {items.map((a, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${TONS_PASTILLE[a.ton] || TONS_PASTILLE.navy}`} aria-hidden="true">{a.initiales}</span>
          <span className="min-w-0 flex-1 truncate"><b className="font-semibold text-navy-900">{a.titre}</b>{a.detail && <span className="text-navy-900/70"> · {a.detail}</span>}</span>
          <span className="shrink-0 text-xs text-navy-900/45">{a.quand}</span>
        </li>
      ))}
    </ul>
  );
}

// « il y a 2 h », « hier », « 28 oct. »
export function ilYa(date) {
  if (!date) return "";
  const d = new Date(date);
  const heures = (Date.now() - d.getTime()) / 3600000;
  if (heures < 1) return "à l'instant";
  if (heures < 24 && new Date().getDate() === d.getDate()) return `il y a ${Math.floor(heures)} h`;
  if (heures < 48) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Raccourcis en petite grille 2 × 2, à l'intérieur d'un bloc.
export function RaccourcisBloc({ items = [] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
      {items.filter(Boolean).map((r) => (r.onClick ? (
        //  Un raccourci peut ouvrir une fenêtre (« Encaisser ») au lieu d'une page.
        <button key={r.label} type="button" onClick={r.onClick} className="rounded-xl bg-fond p-3 text-left text-navy-900 transition hover:bg-or-500/15">
          <span className="block text-base" aria-hidden="true">{r.icone}</span>{r.label}
        </button>
      ) : (
        <Link key={r.to} to={r.to} className="rounded-xl bg-fond p-3 text-navy-900 transition hover:bg-or-500/15">
          <span className="block text-base" aria-hidden="true">{r.icone}</span>{r.label}
        </Link>
      )))}
    </div>
  );
}
