import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte } from "@/composants/ui.jsx";
import { getStats } from "@/lib/dashboard.js";
import { getAbsencesRecentes, STATUTS_JUSTIF } from "@/lib/viescolaire.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "";

export default function AccueilPedagogie() {
  const { ecoleId, ecole, profil } = useAuth();
  const [stats, setStats] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [st, abs] = await Promise.all([
          getStats(ecoleId, an?.id),
          getAbsencesRecentes(ecoleId, 8),
        ]);
        setStats(st);
        setAbsences(abs);
      } catch (e) {
        setErreur(e.message);
      }
    })();
  }, [ecoleId]);

  return (
    <>
      <EnTete titre="Pédagogie" sousTitre={ecole?.nom} />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Link to="/appel" className="block rounded-2xl bg-navy-900 p-6 text-creme shadow-sm transition hover:bg-navy-800">
          <p className="font-display text-xl font-bold">✅ Faire l'appel</p>
          <p className="mt-1 text-sm text-creme/70">Bonjour {profil?.prenom} — pointe les présents/absents de ta classe en un clic.</p>
        </Link>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Élèves inscrits" valeur={stats ? String(stats.effectif) : "—"} ton="or" />
          <Kpi label="Moyenne générale" valeur={stats?.moyenne != null ? stats.moyenne.toFixed(1) : "—"} suffixe="/20" ton="navy" />
          <Kpi label="Notes saisies" valeur={stats ? String(stats.nbNotes) : "—"} ton="navy" />
        </div>

        <Carte className="p-6">
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Absences récentes</h3>
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

function Kpi({ label, valeur, suffixe, ton }) {
  const tons = { navy: "text-navy-900", or: "text-or-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${tons[ton] || tons.navy}`}>
        {valeur}{suffixe && <span className="ml-1 text-base font-normal text-navy-900/40">{suffixe}</span>}
      </p>
    </Carte>
  );
}
