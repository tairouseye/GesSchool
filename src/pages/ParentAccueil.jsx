import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mesEnfants } from "@/lib/parent.js";
import { annoncesParent } from "@/lib/annonces.js";
import { Carte, Alerte } from "@/composants/ui.jsx";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function ParentAccueil() {
  const [enfants, setEnfants] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [enf, ann] = await Promise.all([mesEnfants(), annoncesParent()]);
        setEnfants(enf);
        setAnnonces(ann);
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Mes enfants</h1>
        <p className="text-sm text-navy-900/50">Suivez la scolarité de vos enfants.</p>
      </div>
      <Alerte ton="erreur">{erreur}</Alerte>

      {chargement ? (
        <p className="text-sm text-navy-900/50">Chargement…</p>
      ) : enfants.length === 0 ? (
        <Carte className="p-8 text-sm text-navy-900/50">
          Aucun enfant rattaché à votre compte. Contactez l'établissement.
        </Carte>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {enfants.map((e) => (
            <Link
              key={e.eleve_id}
              to={`/parent/enfant/${e.eleve_id}`}
              className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm transition hover:ring-2 hover:ring-or-500"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-navy-900/10 font-display text-lg font-bold text-navy-900/60">
                  {(e.prenom?.[0] || "").toUpperCase()}{(e.nom?.[0] || "").toUpperCase()}
                </span>
                <div>
                  <p className="font-display text-lg font-bold text-navy-900">{e.prenom} {e.nom}</p>
                  <p className="text-sm text-navy-900/50">{e.classe || "—"} · {e.ecole || ""}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-or-600">Voir le détail →</p>
            </Link>
          ))}
        </div>
      )}

      {/* Annonces de l'école */}
      {annonces.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="font-display text-lg font-bold text-navy-900">📣 Annonces</h2>
          {annonces.map((a) => (
            <Carte key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-navy-900">{a.titre}</h3>
                {a.classe && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700">{a.classe}</span>
                )}
              </div>
              {a.contenu && <p className="mt-1 whitespace-pre-wrap text-sm text-navy-900/70">{a.contenu}</p>}
              <p className="mt-2 text-xs text-navy-900/40">{fmtDate(a.publie_le)} · {a.ecole}</p>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
