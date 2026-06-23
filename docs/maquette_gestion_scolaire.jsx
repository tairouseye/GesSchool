// =====================================================================
//  GesSchool — Maquette de référence (4 écrans MVP)
//  SaaS de gestion scolaire — Sénégal / Afrique de l'Ouest
//
//  Ce fichier est une MAQUETTE (données mockées) qui fixe l'IDENTITÉ
//  VISUELLE et la structure des 4 écrans de la Phase 1. Le code de
//  production reprendra ces composants/couleurs/typos mais branchés
//  sur Supabase.
//
//  IDENTITÉ VISUELLE
//   - Palette : navy (#0B1F3A) profond + or (#C9A227) ; fonds crème (#F7F5EF).
//   - Motif « cachet » : sceau circulaire estampillé (autorité institutionnelle).
//   - Typographies :
//       • Space Grotesk  → titres / chiffres clés (caractère)
//       • Inter          → texte courant / UI
//       • JetBrains Mono → matricules, montants, références (data)
//
//  Tailwind attendu (extend) :
//   colors: { navy:{900:'#0B1F3A',800:'#13294B',700:'#1C3A66'},
//             or:{500:'#C9A227',400:'#D9B84A'}, creme:'#F7F5EF' }
//   fontFamily: { display:['Space Grotesk'], sans:['Inter'], mono:['JetBrains Mono'] }
// =====================================================================

import React, { useState } from "react";

// ---------------------------------------------------------------------
//  Données mockées (remplacées par Supabase en production)
// ---------------------------------------------------------------------
const ECOLE = {
  nom: "Institut Cheikh Anta Diop",
  sigle: "ICAD",
  annee: "2025-2026",
  devise: "XOF",
};

const KPIS = [
  { label: "Élèves inscrits", valeur: "842", delta: "+34", ton: "or" },
  { label: "Taux de recouvrement", valeur: "78%", delta: "+5 pts", ton: "vert" },
  { label: "Encaissé (mois)", valeur: "12,4 M", suffixe: "XOF", ton: "navy" },
  { label: "Moyenne générale", valeur: "12,8", suffixe: "/20", ton: "navy" },
];

const ELEVES = [
  { matricule: "ICAD-2025-0481", nom: "DIALLO Aïssatou", classe: "6e A", sexe: "F", statut: "inscrit", solde: 0 },
  { matricule: "ICAD-2025-0482", nom: "FALL Mamadou", classe: "6e A", sexe: "M", statut: "inscrit", solde: 45000 },
  { matricule: "ICAD-2025-0483", nom: "NDIAYE Fatou", classe: "5e B", sexe: "F", statut: "réinscrit", solde: 0 },
  { matricule: "ICAD-2025-0484", nom: "SOW Ibrahima", classe: "3e A", sexe: "M", statut: "inscrit", solde: 120000 },
];

const BULLETIN = {
  eleve: "DIALLO Aïssatou",
  classe: "6e A",
  periode: "Trimestre 1",
  moyenne: 14.2,
  rang: 3,
  effectif: 38,
  mention: "Bien",
  lignes: [
    { matiere: "Mathématiques", moy: 15.5, coef: 4, app: "Très bon trimestre" },
    { matiere: "Français", moy: 13.0, coef: 4, app: "Doit participer davantage" },
    { matiere: "Sciences de la Vie", moy: 14.5, coef: 2, app: "Sérieuse" },
    { matiere: "Histoire-Géo", moy: 12.5, coef: 2, app: "Ensemble correct" },
    { matiere: "Anglais", moy: 16.0, coef: 2, app: "Excellent" },
  ],
};

const FACTURES = [
  { numero: "F-2025-0312", eleve: "FALL Mamadou", echeance: "30/06", total: 150000, paye: 105000, statut: "partiellement_payee" },
  { numero: "F-2025-0313", eleve: "DIALLO Aïssatou", echeance: "30/06", total: 150000, paye: 150000, statut: "payee" },
  { numero: "F-2025-0314", eleve: "SOW Ibrahima", echeance: "15/06", total: 200000, paye: 80000, statut: "en_retard" },
];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n);

// ---------------------------------------------------------------------
//  Motif « cachet » — sceau circulaire (SVG réutilisable)
// ---------------------------------------------------------------------
function Cachet({ size = 84, className = "" }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
      <defs>
        <path id="cachet-arc" d="M50,50 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <text fontSize="7" fill="currentColor" letterSpacing="2" className="font-display uppercase">
        <textPath href="#cachet-arc" startOffset="6%">
          {ECOLE.nom} • {ECOLE.annee} •
        </textPath>
      </text>
      <text x="50" y="48" textAnchor="middle" fontSize="20" fill="currentColor" className="font-display font-bold">
        {ECOLE.sigle}
      </text>
      <text x="50" y="62" textAnchor="middle" fontSize="6" fill="currentColor" letterSpacing="3" className="uppercase">
        Officiel
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------
//  Primitives UI
// ---------------------------------------------------------------------
const Badge = ({ children, ton = "navy" }) => {
  const tons = {
    or: "bg-or-500/15 text-or-500 border-or-500/30",
    vert: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    rouge: "bg-rose-500/10 text-rose-700 border-rose-500/30",
    navy: "bg-navy-900/5 text-navy-900 border-navy-900/15",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tons[ton]}`}>
      {children}
    </span>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-navy-900/10 bg-white shadow-sm ${className}`}>{children}</div>
);

const statutFacture = {
  payee: { label: "Payée", ton: "vert" },
  partiellement_payee: { label: "Partielle", ton: "or" },
  en_retard: { label: "En retard", ton: "rouge" },
  emise: { label: "Émise", ton: "navy" },
};

// ---------------------------------------------------------------------
//  Layout : barre latérale + en-tête
// ---------------------------------------------------------------------
const NAV = [
  { id: "dashboard", label: "Tableau de bord", icone: "▦" },
  { id: "eleves", label: "Élèves", icone: "👤" },
  { id: "bulletins", label: "Bulletins", icone: "🎓" },
  { id: "paiements", label: "Paiements", icone: "₣" },
];

function Sidebar({ actif, onChange }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-navy-900 text-creme">
      <div className="flex items-center gap-3 px-6 py-6">
        <Cachet size={44} className="text-or-500" />
        <div>
          <p className="font-display text-lg font-bold leading-none">GesSchool</p>
          <p className="text-xs text-creme/60">{ECOLE.sigle} · {ECOLE.annee}</p>
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition
              ${actif === item.id
                ? "bg-or-500 font-semibold text-navy-900"
                : "text-creme/80 hover:bg-navy-800"}`}
          >
            <span className="w-5 text-center">{item.icone}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-navy-800 px-6 py-4 text-xs text-creme/50">
        Connecté : <span className="text-creme/80">Direction</span>
      </div>
    </aside>
  );
}

function Topbar({ titre }) {
  return (
    <header className="flex items-center justify-between border-b border-navy-900/10 bg-creme/80 px-8 py-5 backdrop-blur">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">{titre}</h1>
        <p className="text-sm text-navy-900/50">{ECOLE.nom}</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-sm font-medium text-navy-900">
          Année {ECOLE.annee}
        </button>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-or-500 font-display font-bold text-navy-900">
          D
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
//  Écran 1 — Tableau de bord
// ---------------------------------------------------------------------
function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-sm text-navy-900/50">{k.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-navy-900">
              {k.valeur}
              {k.suffixe && <span className="ml-1 text-base font-normal text-navy-900/40">{k.suffixe}</span>}
            </p>
            {k.delta && <div className="mt-3"><Badge ton={k.ton}>{k.delta}</Badge></div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold text-navy-900">Encaissements — 6 derniers mois</h3>
          <div className="mt-6 flex h-48 items-end gap-3">
            {[60, 72, 55, 88, 70, 95].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-navy-900/90"
                     style={{ height: `${h}%` }} />
                <span className="font-mono text-[10px] text-navy-900/40">M{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <Cachet size={120} className="text-navy-900/15" />
          <p className="text-center text-sm text-navy-900/50">
            Établissement vérifié<br />
            <span className="font-mono text-xs">{ECOLE.sigle} · {ECOLE.annee}</span>
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Écran 2 — Élèves
// ---------------------------------------------------------------------
function Eleves() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-4">
        <input
          placeholder="Rechercher un élève, un matricule…"
          className="w-80 rounded-xl border border-navy-900/15 bg-creme px-4 py-2 text-sm outline-none focus:border-or-500"
        />
        <button className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-creme hover:bg-navy-800">
          + Nouvel élève
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50">
          <tr>
            <th className="px-6 py-3 font-medium">Matricule</th>
            <th className="px-6 py-3 font-medium">Élève</th>
            <th className="px-6 py-3 font-medium">Classe</th>
            <th className="px-6 py-3 font-medium">Statut</th>
            <th className="px-6 py-3 text-right font-medium">Solde</th>
          </tr>
        </thead>
        <tbody>
          {ELEVES.map((e) => (
            <tr key={e.matricule} className="border-t border-navy-900/5 hover:bg-creme/60">
              <td className="px-6 py-4 font-mono text-xs text-navy-900/70">{e.matricule}</td>
              <td className="px-6 py-4 font-medium text-navy-900">{e.nom}</td>
              <td className="px-6 py-4">{e.classe}</td>
              <td className="px-6 py-4"><Badge ton={e.statut === "inscrit" ? "navy" : "or"}>{e.statut}</Badge></td>
              <td className="px-6 py-4 text-right font-mono">
                {e.solde === 0
                  ? <span className="text-emerald-600">à jour</span>
                  : <span className="text-rose-600">{fmt(e.solde)} {ECOLE.devise}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------
//  Écran 3 — Bulletin (aperçu façon document officiel + cachet)
// ---------------------------------------------------------------------
function Bulletins() {
  const total = BULLETIN.lignes.reduce((s, l) => s + l.coef, 0);
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="relative overflow-hidden p-8">
        {/* Cachet en filigrane */}
        <Cachet size={220} className="pointer-events-none absolute -right-10 -top-10 text-or-500/10" />

        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-xl font-bold text-navy-900">Bulletin scolaire</p>
            <p className="text-sm text-navy-900/50">{ECOLE.nom} — {BULLETIN.periode}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-navy-900">{BULLETIN.eleve}</p>
            <p className="text-sm text-navy-900/50">Classe {BULLETIN.classe}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-navy-900/15 text-navy-900/50">
            <tr>
              <th className="py-2 font-medium">Matière</th>
              <th className="py-2 text-center font-medium">Moy.</th>
              <th className="py-2 text-center font-medium">Coef.</th>
              <th className="py-2 font-medium">Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {BULLETIN.lignes.map((l) => (
              <tr key={l.matiere} className="border-b border-navy-900/5">
                <td className="py-2.5 font-medium text-navy-900">{l.matiere}</td>
                <td className="py-2.5 text-center font-mono">{l.moy.toFixed(1)}</td>
                <td className="py-2.5 text-center font-mono text-navy-900/60">{l.coef}</td>
                <td className="py-2.5 text-navy-900/70">{l.app}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-navy-900 p-4 text-creme">
            <p className="text-xs text-creme/60">Moyenne générale</p>
            <p className="font-display text-2xl font-bold">{BULLETIN.moyenne}<span className="text-sm font-normal">/20</span></p>
          </div>
          <div className="rounded-xl bg-or-500 p-4 text-navy-900">
            <p className="text-xs text-navy-900/60">Rang</p>
            <p className="font-display text-2xl font-bold">{BULLETIN.rang}<span className="text-sm font-normal">/{BULLETIN.effectif}</span></p>
          </div>
          <div className="rounded-xl border border-navy-900/15 p-4">
            <p className="text-xs text-navy-900/50">Mention</p>
            <p className="font-display text-2xl font-bold text-navy-900">{BULLETIN.mention}</p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <p className="text-xs text-navy-900/40">Total coefficients : <span className="font-mono">{total}</span></p>
          <button className="rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-creme hover:bg-navy-800">
            Générer le PDF
          </button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Écran 4 — Paiements
// ---------------------------------------------------------------------
function Paiements() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-4">
        <h3 className="font-display text-lg font-semibold text-navy-900">Factures & encaissements</h3>
        <button className="rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900">
          + Encaisser un paiement
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50">
          <tr>
            <th className="px-6 py-3 font-medium">N° Facture</th>
            <th className="px-6 py-3 font-medium">Élève</th>
            <th className="px-6 py-3 font-medium">Échéance</th>
            <th className="px-6 py-3 text-right font-medium">Total</th>
            <th className="px-6 py-3 text-right font-medium">Payé</th>
            <th className="px-6 py-3 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {FACTURES.map((f) => {
            const s = statutFacture[f.statut];
            return (
              <tr key={f.numero} className="border-t border-navy-900/5 hover:bg-creme/60">
                <td className="px-6 py-4 font-mono text-xs text-navy-900/70">{f.numero}</td>
                <td className="px-6 py-4 font-medium text-navy-900">{f.eleve}</td>
                <td className="px-6 py-4 font-mono text-xs">{f.echeance}</td>
                <td className="px-6 py-4 text-right font-mono">{fmt(f.total)}</td>
                <td className="px-6 py-4 text-right font-mono">{fmt(f.paye)}</td>
                <td className="px-6 py-4"><Badge ton={s.ton}>{s.label}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------
//  App maquette
// ---------------------------------------------------------------------
export default function MaquetteGesSchool() {
  const [ecran, setEcran] = useState("dashboard");
  const titres = { dashboard: "Tableau de bord", eleves: "Élèves & inscriptions", bulletins: "Bulletins", paiements: "Paiements" };
  return (
    <div className="flex h-screen bg-creme font-sans text-navy-900">
      <Sidebar actif={ecran} onChange={setEcran} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar titre={titres[ecran]} />
        <main className="flex-1 overflow-auto p-8">
          {ecran === "dashboard" && <Dashboard />}
          {ecran === "eleves" && <Eleves />}
          {ecran === "bulletins" && <Bulletins />}
          {ecran === "paiements" && <Paiements />}
        </main>
      </div>
    </div>
  );
}
