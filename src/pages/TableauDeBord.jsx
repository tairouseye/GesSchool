import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte } from "@/composants/ui.jsx";
import { statsGestion } from "@/lib/dashboard.js";
import { getAnneeCourante } from "@/lib/academique.js";
import { MODES } from "@/lib/paiements.js";

const fmtMontant = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return String(v);
};
const modeLabel = (m) => (MODES.find((x) => x[0] === m) || [])[1] || m;

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
        setStats(await statsGestion(ecoleId, an?.id));
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId]);

  const reste = stats ? stats.totalFacture - stats.totalPaye : 0;
  const maxSerie = stats ? Math.max(1, ...stats.serie.map((s) => s.montant)) : 1;
  const modes = stats ? Object.entries(stats.parMode).sort((a, b) => b[1] - a[1]) : [];
  const totalMode = modes.reduce((s, [, v]) => s + v, 0);

  return (
    <>
      <EnTete titre="Gestion" sousTitre={annee ? `${ecole?.nom} · Année ${annee.libelle}` : ecole?.nom} />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">Bonjour {profil?.prenom} 👋</h2>
          <p className="mt-1 text-sm text-navy-900/50">Ce qui demande votre attention aujourd'hui.</p>
        </div>

        {/* À traiter */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AlerteCard
            to="/paiements" chargement={chargement}
            valeur={stats?.declEnAttente} label="Déclarations à valider"
            sousTexte="paiements mobiles déclarés" actif={stats?.declEnAttente > 0} ton="or" />
          <AlerteCard
            to="/recouvrement" chargement={chargement}
            valeur={stats?.nbEnRetard} label="Élèves en impayé"
            sousTexte={stats ? `${fmtMontant(stats.retardMontant)} ${devise} en retard` : ""}
            actif={stats?.nbEnRetard > 0} ton="rouge" />
          <AlerteCard
            to="/recouvrement" chargement={chargement}
            valeur={stats?.echeanceNb} label="Échéances sous 7 jours"
            sousTexte={stats ? `${fmtMontant(stats.echeanceMontant)} ${devise} attendus` : ""}
            actif={stats?.echeanceNb > 0} ton="navy" />
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi chargement={chargement} label="Élèves inscrits" valeur={stats && String(stats.effectif)}
            sous={stats?.nouveaux ? `+${stats.nouveaux} ce mois` : null} ton="or" />
          <Kpi chargement={chargement} label="Taux de recouvrement" valeur={stats && `${stats.tauxRecouvrement.toFixed(0)}%`} ton="vert" />
          <Kpi chargement={chargement} label="Encaissé ce mois" valeur={stats && fmtMontant(stats.encMois)} suffixe={devise}
            sous={stats ? `Aujourd'hui ${fmtMontant(stats.encJour)} · semaine ${fmtMontant(stats.encSemaine)}` : null} />
          <Kpi chargement={chargement} label="Reste à encaisser" valeur={stats && fmtMontant(reste)} suffixe={devise} ton="rouge" />
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
                      <div className="w-full rounded-t-lg bg-navy-900/90 transition-all"
                        style={{ height: `${(s.montant / maxSerie) * 100}%`, minHeight: s.montant > 0 ? 4 : 0 }}
                        title={`${fmtMontant(s.montant)} ${devise}`} />
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

          {/* Répartition par mode */}
          <Carte className="p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Modes de paiement (ce mois)</h3>
            {modes.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun encaissement ce mois.</p>
            ) : (
              <ul className="space-y-3">
                {modes.map(([m, v]) => (
                  <li key={m}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-navy-900/70">{modeLabel(m)}</span>
                      <span className="font-mono text-navy-900">{fmtMontant(v)} {devise}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900/10">
                      <div className="h-full bg-or-500" style={{ width: `${totalMode ? (v / totalMode) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recouvrement */}
          {stats && (
            <Carte className="p-6 lg:col-span-2">
              <h3 className="font-display text-lg font-semibold text-navy-900">Recouvrement {annee?.libelle}</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <Bloc label="Facturé" valeur={`${fmtMontant(stats.totalFacture)} ${devise}`} />
                <Bloc label="Encaissé" valeur={`${fmtMontant(stats.totalPaye)} ${devise}`} ton="vert" />
                <Bloc label="Reste à encaisser" valeur={`${fmtMontant(reste)} ${devise}`} ton="rouge" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-900/10">
                <div className="h-full bg-or-500" style={{ width: `${Math.min(100, stats.tauxRecouvrement)}%` }} />
              </div>
            </Carte>
          )}

          {/* Top débiteurs */}
          <Carte className="p-6">
            <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Principaux impayés</h3>
            {!stats || stats.topDebiteurs.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun impayé en retard 🎉</p>
            ) : (
              <ul className="divide-y divide-navy-900/5">
                {stats.topDebiteurs.map((d, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate font-medium text-navy-900">{d.nom}</span>
                    <span className="ml-2 shrink-0 font-mono text-rose-600">{fmtMontant(d.reste)} {devise}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/recouvrement" className="mt-3 inline-block text-xs font-medium text-navy-700 hover:text-or-600">Voir le recouvrement →</Link>
          </Carte>
        </div>

        <Carte className="p-6">
          <h3 className="font-display text-lg font-semibold text-navy-900">Raccourcis</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Raccourci to="/eleves" label="Élèves & inscriptions" />
            <Raccourci to="/paiements" label="Paiements" />
            <Raccourci to="/recouvrement" label="Recouvrement" />
            <Raccourci to="/certificats" label="Documents" />
            <Raccourci to="/demandes" label="Demandes" />
          </div>
        </Carte>
      </div>
    </>
  );
}

function AlerteCard({ to, valeur, label, sousTexte, actif, ton, chargement }) {
  const tons = {
    rouge: actif ? "border-rose-300 bg-rose-50" : "border-navy-900/10",
    or: actif ? "border-or-500/40 bg-or-500/5" : "border-navy-900/10",
    navy: actif ? "border-navy-800/30 bg-navy-900/5" : "border-navy-900/10",
  };
  const chiffre = actif
    ? (ton === "rouge" ? "text-rose-600" : ton === "or" ? "text-or-600" : "text-navy-900")
    : "text-navy-900/30";
  return (
    <Link to={to} className={`block rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${tons[ton]}`}>
      <p className="text-sm font-medium text-navy-900/60">{label}</p>
      {chargement ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-navy-900/10" />
      ) : (
        <p className={`mt-1 font-display text-3xl font-bold ${chiffre}`}>{valeur ?? 0}</p>
      )}
      {sousTexte && <p className="mt-1 text-xs text-navy-900/45">{sousTexte}</p>}
    </Link>
  );
}

function Kpi({ label, valeur, suffixe, sous, ton, chargement }) {
  const tons = { navy: "text-navy-900", or: "text-or-600", vert: "text-emerald-600", rouge: "text-rose-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      {chargement ? (
        <div className="mt-2 h-9 animate-pulse rounded bg-navy-900/5" />
      ) : (
        <p className={`mt-2 font-display text-3xl font-bold ${tons[ton] || tons.navy}`}>
          {valeur ?? "—"}{suffixe && <span className="ml-1 text-base font-normal text-navy-900/40">{suffixe}</span>}
        </p>
      )}
      {sous && !chargement && <p className="mt-1 text-xs text-navy-900/45">{sous}</p>}
    </Carte>
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
