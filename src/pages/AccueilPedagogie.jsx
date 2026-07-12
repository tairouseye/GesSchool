import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte } from "@/composants/ui.jsx";
import { statsPedagogie } from "@/lib/dashboard.js";
import { getAbsencesRecentes, STATUTS_JUSTIF } from "@/lib/viescolaire.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "";

// Couleur d'une moyenne /20 : rouge sous la barre, ambre limite, vert au-dessus.
const tonMoyenne = (m) => (m == null ? "text-navy-900/30" : m < 10 ? "text-rose-600" : m < 12 ? "text-or-600" : "text-emerald-600");

export default function AccueilPedagogie() {
  const { ecoleId, ecole, profil } = useAuth();
  const [stats, setStats] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [st, abs] = await Promise.all([
          statsPedagogie(ecoleId, an?.id),
          getAbsencesRecentes(ecoleId, 8),
        ]);
        setStats(st);
        setAbsences(abs);
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId]);

  const maxEff = stats ? Math.max(1, ...stats.niveaux.map((n) => n.effectif)) : 1;

  return (
    <>
      <EnTete titre="Pédagogie" sousTitre={ecole?.nom} />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Link to="/appel" className="block rounded-2xl bg-navy-900 p-6 text-creme shadow-sm transition hover:bg-navy-800">
          <p className="font-display text-xl font-bold">✅ Faire l'appel</p>
          <p className="mt-1 text-sm text-creme/70">Bonjour {profil?.prenom} — pointe les présents/absents de ta classe en un clic.</p>
        </Link>

        {/* À traiter */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link to="/assiduite"
            className={`block rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${stats?.absNonJustif > 0 ? "border-rose-300 bg-rose-50" : "border-navy-900/10"}`}>
            <p className="text-sm font-medium text-navy-900/60">Absences non justifiées</p>
            {chargement ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-navy-900/10" />
              : <p className={`mt-1 font-display text-3xl font-bold ${stats?.absNonJustif > 0 ? "text-rose-600" : "text-navy-900/30"}`}>{stats?.absNonJustif ?? 0}</p>}
            <p className="mt-1 text-xs text-navy-900/45">à relancer / justifier</p>
          </Link>
          <Link to="/assiduite"
            className="block rounded-2xl border border-navy-900/10 p-5 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-navy-900/60">Absences cette semaine</p>
            {chargement ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-navy-900/10" />
              : <p className="mt-1 font-display text-3xl font-bold text-navy-900">{stats?.absSemaine ?? 0}</p>}
            <p className="mt-1 text-xs text-navy-900/45">volume de la semaine</p>
          </Link>
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi chargement={chargement} label="Élèves inscrits" valeur={stats && String(stats.effectif)}
            sous={stats ? `${stats.filles} F · ${stats.garcons} G` : null} ton="or" />
          <Kpi chargement={chargement} label="Moyenne générale" valeur={stats?.moyenne != null ? stats.moyenne.toFixed(1) : "—"} suffixe="/20"
            tonValeur={tonMoyenne(stats?.moyenne)} />
          <Kpi chargement={chargement} label="Notes saisies" valeur={stats && String(stats.nbNotes)} />
          <Kpi chargement={chargement} label="Redoublants" valeur={stats && String(stats.redoublants)} />
        </div>

        {/* Par niveau : effectif + niveau académique */}
        <Carte className="p-6">
          <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Par niveau</h3>
          {!stats || stats.niveaux.length === 0 ? (
            <p className="text-sm text-navy-900/40">Aucune inscription pour l'année en cours.</p>
          ) : (
            <ul className="space-y-3">
              {stats.niveaux.map((nv, i) => (
                <li key={i} className="flex items-center gap-4">
                  <span className="w-28 shrink-0 truncate text-sm font-medium text-navy-900">{nv.libelle}</span>
                  <div className="flex-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-navy-900/10">
                      <div className="h-full bg-navy-900/80" style={{ width: `${(nv.effectif / maxEff) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-sm text-navy-900/60">{nv.effectif}</span>
                  <span className={`w-16 shrink-0 text-right font-mono text-sm font-semibold ${tonMoyenne(nv.moyenne)}`}>
                    {nv.moyenne != null ? nv.moyenne.toFixed(1) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-end gap-4 text-[11px] text-navy-900/40">
            <span>effectif</span><span>moyenne /20</span>
          </div>
        </Carte>

        {/* Absences récentes */}
        <Carte className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-navy-900">Absences récentes</h3>
            <Link to="/assiduite" className="text-xs font-medium text-navy-700 hover:text-or-600">Tout voir →</Link>
          </div>
          {absences.length === 0 ? (
            <p className="text-sm text-navy-900/40">Aucune absence enregistrée.</p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {absences.map((a) => {
                const s = STATUTS_JUSTIF[a.statut] || STATUTS_JUSTIF.non_justifie;
                const tons = { rouge: "text-rose-600", or: "text-or-600", vert: "text-emerald-700" };
                return (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}</span>
                    <span className="text-navy-900/50">{a.classes?.libelle || "—"}</span>
                    <span className="font-mono text-xs text-navy-900/50">{fmtDate(a.date_abs)}</span>
                    <span className="capitalize text-navy-900/60">{a.type}</span>
                    <span className={`text-xs font-medium ${tons[s.ton]}`}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}

function Kpi({ label, valeur, suffixe, sous, ton, tonValeur, chargement }) {
  const tons = { navy: "text-navy-900", or: "text-or-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      {chargement ? (
        <div className="mt-2 h-9 animate-pulse rounded bg-navy-900/5" />
      ) : (
        <p className={`mt-2 font-display text-3xl font-bold ${tonValeur || tons[ton] || tons.navy}`}>
          {valeur ?? "—"}{suffixe && <span className="ml-1 text-base font-normal text-navy-900/40">{suffixe}</span>}
        </p>
      )}
      {sous && !chargement && <p className="mt-1 text-xs text-navy-900/45">{sous}</p>}
    </Carte>
  );
}
