import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { getStats } from "@/lib/dashboard.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmtMontant = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return String(v);
};

export default function TableauDeBord() {
  const { ecoleId, ecole, profil } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(null);
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        setStats(await getStats(ecoleId, an?.id));
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId]);

  const kpis = stats
    ? [
        { label: "Élèves inscrits", valeur: String(stats.effectif), ton: "or" },
        { label: "Taux de recouvrement", valeur: `${stats.tauxRecouvrement.toFixed(0)}%`, ton: "vert" },
        { label: "Encaissé (ce mois)", valeur: fmtMontant(stats.encaisseMois), suffixe: devise, ton: "navy" },
        { label: "Moyenne (notes)", valeur: stats.moyenne != null ? stats.moyenne.toFixed(1) : "—", suffixe: "/20", ton: "navy" },
      ]
    : [];

  const maxSerie = stats ? Math.max(1, ...stats.serie.map((s) => s.montant)) : 1;

  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre={annee ? `${ecole?.nom} · Année ${annee.libelle}` : ecole?.nom} />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Carte className="p-6">
          <h2 className="font-display text-xl font-bold text-navy-900">Bonjour {profil?.prenom} 👋</h2>
          <p className="mt-1 text-sm text-navy-900/50">Vue d'ensemble de votre établissement.</p>
        </Carte>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(chargement ? Array.from({ length: 4 }) : kpis).map((k, i) => (
            <Carte key={i} className="p-5">
              {chargement || !k ? (
                <div className="h-16 animate-pulse rounded bg-navy-900/5" />
              ) : (
                <>
                  <p className="text-sm text-navy-900/50">{k.label}</p>
                  <p className="mt-2 font-display text-3xl font-bold text-navy-900">
                    {k.valeur}
                    {k.suffixe && <span className="ml-1 text-base font-normal text-navy-900/40">{k.suffixe}</span>}
                  </p>
                </>
              )}
            </Carte>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Graphe encaissements */}
          <Carte className="p-6 lg:col-span-2">
            <h3 className="font-display text-lg font-semibold text-navy-900">Encaissements — 6 derniers mois</h3>
            {stats && (
              <div className="mt-6 flex h-48 items-end gap-3">
                {stats.serie.map((s, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-lg bg-navy-900/90 transition-all"
                        style={{ height: `${(s.montant / maxSerie) * 100}%`, minHeight: s.montant > 0 ? 4 : 0 }}
                        title={`${fmtMontant(s.montant)} ${devise}`}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-navy-900/40">{s.mois}</span>
                  </div>
                ))}
              </div>
            )}
            {stats && stats.serie.every((s) => s.montant === 0) && (
              <p className="mt-4 text-xs text-navy-900/40">Aucun encaissement sur la période.</p>
            )}
          </Carte>

          {/* État établissement */}
          <Carte className="flex flex-col items-center justify-center gap-3 p-6">
            <Cachet size={120} sigle={ecole?.sigle || "GS"} className="text-navy-900/15" />
            <p className="text-center text-sm text-navy-900/50">
              {ecole?.nom}
              <br />
              <span className="font-mono text-xs">{ecole?.sigle} {annee ? `· ${annee.libelle}` : ""}</span>
            </p>
          </Carte>
        </div>

        {/* Facturé / encaissé */}
        {stats && (
          <Carte className="p-6">
            <h3 className="font-display text-lg font-semibold text-navy-900">Recouvrement {annee?.libelle}</h3>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <Bloc label="Facturé" valeur={`${fmtMontant(stats.totalFacture)} ${devise}`} />
              <Bloc label="Encaissé" valeur={`${fmtMontant(stats.totalPaye)} ${devise}`} ton="vert" />
              <Bloc label="Reste à encaisser" valeur={`${fmtMontant(stats.totalFacture - stats.totalPaye)} ${devise}`} ton="rouge" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-900/10">
              <div className="h-full bg-or-500" style={{ width: `${Math.min(100, stats.tauxRecouvrement)}%` }} />
            </div>
          </Carte>
        )}

        <Carte className="p-6">
          <h3 className="font-display text-lg font-semibold text-navy-900">Raccourcis</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Raccourci to="/eleves" label="Élèves" />
            <Raccourci to="/notes" label="Saisir des notes" />
            <Raccourci to="/bulletins" label="Bulletins" />
            <Raccourci to="/paiements" label="Paiements" />
            <Raccourci to="/structure" label="Structure" />
          </div>
        </Carte>
      </div>
    </>
  );
}

function Bloc({ label, valeur, ton }) {
  const c = ton === "vert" ? "text-emerald-600" : ton === "rouge" ? "text-rose-600" : "text-navy-900";
  return (
    <div className="rounded-xl border border-navy-900/10 p-4">
      <p className="text-xs text-navy-900/50">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${c}`}>{valeur}</p>
    </div>
  );
}

function Raccourci({ to, label }) {
  return (
    <Link to={to} className="rounded-xl border border-navy-900/15 bg-white px-4 py-2 font-medium text-navy-900 hover:border-or-500 hover:text-or-600">
      {label} →
    </Link>
  );
}
