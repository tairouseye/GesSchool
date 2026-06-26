import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import * as api from "@/lib/pilotage.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const taux = (paye, total) => (Number(total) > 0 ? Math.round((Number(paye) / Number(total)) * 100) : 0);

export default function Pilotage() {
  const { ecoleId, ecole, rafraichirProfil } = useAuth();
  const devise = ecole?.devise || "XOF";
  const navigate = useNavigate();
  const [lignes, setLignes] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      setLignes(await api.getSynthese());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  async function gerer(id) {
    setErreur("");
    try {
      await api.entrerEcole(id);
      await rafraichirProfil();
      navigate("/");
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Totaux consolidés
  const t = lignes.reduce((a, l) => ({
    effectif: a.effectif + Number(l.effectif || 0),
    facture: a.facture + Number(l.total_facture || 0),
    paye: a.paye + Number(l.total_paye || 0),
    tresorerie: a.tresorerie + Number(l.tresorerie || 0),
    masse: a.masse + Number(l.masse_salariale || 0),
    resultat: a.resultat + Number(l.recettes_annee || 0) + Number(l.scolarite_annee || 0) - Number(l.depenses_annee || 0),
  }), { effectif: 0, facture: 0, paye: 0, tresorerie: 0, masse: 0, resultat: 0 });

  return (
    <>
      <EnTete
        titre="Pilotage"
        sousTitre={`${lignes.length} établissement${lignes.length > 1 ? "s" : ""} · vue consolidée`}
        action={<Bouton variante="fantome" onClick={() => navigate("/onboarding")}>+ Ajouter une école</Bouton>}
      />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {chargement ? (
          <p className="text-sm text-navy-900/50">Chargement…</p>
        ) : lignes.length === 0 ? (
          <Carte className="p-8 text-sm text-navy-900/50">Aucune école rattachée à votre compte.</Carte>
        ) : (
          <>
            {/* KPIs consolidés */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label="Effectif total" valeur={fmt(t.effectif)} />
              <Kpi label="Taux de recouvrement" valeur={`${taux(t.paye, t.facture)}%`} ton="vert" />
              <Kpi label="Trésorerie" valeur={fmt(t.tresorerie)} suffixe={devise} ton="navy" />
              <Kpi label="Masse salariale (mois)" valeur={fmt(t.masse)} suffixe={devise} ton="rouge" />
              <Kpi label="Résultat (année)" valeur={fmt(t.resultat)} suffixe={devise} ton={t.resultat >= 0 ? "or" : "rouge"} />
            </div>

            {/* Comparatif par école */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {lignes.map((l) => {
                const actif = l.ecole_id === ecoleId;
                const resultat = Number(l.recettes_annee || 0) + Number(l.scolarite_annee || 0) - Number(l.depenses_annee || 0);
                return (
                  <Carte key={l.ecole_id} className={`p-5 ${actif ? "ring-2 ring-or-500" : ""}`}>
                    <div className="flex items-center gap-3">
                      <Cachet size={40} sigle={l.sigle || "GS"} className="text-navy-900/60" />
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-bold text-navy-900">{l.ecole}</p>
                        {actif && <span className="text-xs text-or-600">École active</span>}
                      </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 text-sm">
                      <Ligne l="Effectif" v={fmt(l.effectif)} />
                      <Ligne l="Recouvrement" v={`${taux(l.total_paye, l.total_facture)}%`} />
                      <Ligne l="Trésorerie" v={`${fmt(l.tresorerie)} ${devise}`} />
                      <Ligne l="Masse salariale" v={`${fmt(l.masse_salariale)} ${devise}`} />
                      <Ligne l="Résultat (année)" v={`${fmt(resultat)} ${devise}`} ton={resultat >= 0 ? "vert" : "rouge"} />
                    </dl>

                    <div className="mt-4">
                      {actif ? (
                        <Bouton className="w-full" onClick={() => navigate("/")}>Ouvrir l'administration</Bouton>
                      ) : (
                        <Bouton variante="fantome" className="w-full" onClick={() => gerer(l.ecole_id)}>Gérer cette école</Bouton>
                      )}
                    </div>
                  </Carte>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, valeur, suffixe, ton }) {
  const tons = { navy: "text-navy-900", vert: "text-emerald-700", rouge: "text-rose-600", or: "text-or-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tons[ton] || tons.navy}`}>
        {valeur}{suffixe && <span className="ml-1 text-sm font-normal text-navy-900/40">{suffixe}</span>}
      </p>
    </Carte>
  );
}

function Ligne({ l, v, ton }) {
  const tons = { vert: "text-emerald-700", rouge: "text-rose-600" };
  return (
    <div className="flex items-center justify-between">
      <dt className="text-navy-900/50">{l}</dt>
      <dd className={`font-mono ${tons[ton] || "text-navy-900"}`}>{v}</dd>
    </div>
  );
}
