import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, SkeletonListe } from "@/composants/ui.jsx";
import { getOrganigramme } from "@/lib/organigramme.js";

function initiales(nom) {
  const p = (nom || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "•";
}

// Pastille d'une personne (nom + titre, badge « sans compte »).
function Personne({ n, chef = false }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${chef ? "border-or-500/40 bg-or-500/10" : "border-navy-900/10 bg-white"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${chef ? "bg-navy-900 text-or-500" : "bg-navy-900/10 text-navy-900/60"}`}>
        {initiales(n.nom)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-900">{n.nom}</p>
        <p className="truncate text-[11px] text-navy-900/50">
          {n.titre}{n.fonction && n.titre !== n.fonction ? ` · ${n.fonction}` : ""}
          {!n.compte && <span className="ml-1 rounded bg-navy-900/5 px-1 text-[10px] text-navy-900/40">sans compte</span>}
        </p>
      </div>
    </div>
  );
}

export default function Organigramme() {
  const { ecoleId, ecole } = useAuth();
  const [org, setOrg] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    getOrganigramme(ecoleId).then(setOrg).catch((e) => setErreur(e.message));
  }, [ecoleId]);

  return (
    <>
      <EnTete titre="Organigramme" sousTitre={ecole?.nom} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="rounded-xl bg-creme/60 px-4 py-2.5 text-xs text-navy-900/55">
          🔄 Généré automatiquement depuis les <Link to="/membres" className="font-medium text-or-600 hover:underline">Membres</Link> et
          le personnel. Attribuez les rôles là-bas — l'organigramme suit, sans double saisie.
        </div>

        {!org ? (
          <SkeletonListe lignes={4} />
        ) : (
          <div className="space-y-6">
            {/* Promoteur(s) — sommet */}
            <div className="flex flex-col items-center">
              <div className="w-full max-w-xs">
                {org.promoteurs.length === 0 ? (
                  <Carte className="p-4 text-center text-sm text-navy-900/40">Aucun promoteur.</Carte>
                ) : (
                  org.promoteurs.map((n) => (
                    <div key={n.cle} className="rounded-2xl border border-navy-900/10 bg-navy-900 p-4 text-center text-creme shadow-md">
                      <span className="grid mx-auto h-11 w-11 place-items-center rounded-full bg-or-500 font-display text-sm font-bold text-navy-900">{initiales(n.nom)}</span>
                      <p className="mt-2 font-display font-bold">{n.nom}</p>
                      <p className="text-xs text-creme/60">Promoteur</p>
                    </div>
                  ))
                )}
              </div>
              <div className="h-5 w-px bg-navy-900/15" />
            </div>

            {/* Sections d'encadrement */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {org.sections.map((s) => (
                <Carte key={s.id} className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">{s.icone}</span>
                    <h3 className="font-display text-base font-semibold text-navy-900">{s.label}</h3>
                  </div>

                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-navy-900/40">Responsable</p>
                  {s.responsable
                    ? <Personne n={s.responsable} chef />
                    : <div className="rounded-xl border border-dashed border-navy-900/15 px-3 py-2 text-xs text-navy-900/40">Poste à pourvoir</div>}

                  {s.equipe.length > 0 && (
                    <>
                      <p className="mb-1 mt-4 text-[10px] font-medium uppercase tracking-wide text-navy-900/40">
                        Équipe · {s.equipe.length}
                      </p>
                      <div className="space-y-1.5">
                        {s.equipe.map((n) => <Personne key={n.cle} n={n} />)}
                      </div>
                    </>
                  )}
                </Carte>
              ))}
            </div>

            {/* Autres (non rattachés) */}
            {org.autres.length > 0 && (
              <Carte className="p-5">
                <h3 className="mb-1 font-display text-base font-semibold text-navy-900">Autres · {org.autres.length}</h3>
                <p className="mb-3 text-xs text-navy-900/45">Personnel dont la fonction n'est pas rattachée à une section (agents, gardiens…).</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {org.autres.map((n) => <Personne key={n.cle} n={n} />)}
                </div>
              </Carte>
            )}
          </div>
        )}
      </div>
    </>
  );
}
