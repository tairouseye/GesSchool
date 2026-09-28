import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import * as api from "@/lib/pilotage.js";
import { getAnneeCourante, etatMiseEnRoute } from "@/lib/academique.js";
import { Link } from "react-router-dom";

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

  // Effectif et taux de recouvrement se consolident : l'un compte des têtes,
  // l'autre est un rapport, donc sans unité.
  const t = lignes.reduce((a, l) => ({
    effectif: a.effectif + Number(l.effectif || 0),
    facture: a.facture + Number(l.total_facture || 0),
    paye: a.paye + Number(l.total_paye || 0),
  }), { effectif: 0, facture: 0, paye: 0 });

  // Les MONTANTS, eux, ne s'additionnent qu'à devise égale (migration 154).
  const monnaies = api.consoliderParDevise(lignes, devise);

  return (
    <>
      <EnTete
        titre="Pilotage"
        sousTitre={`${lignes.length} établissement${lignes.length > 1 ? "s" : ""} · vue consolidée`}
        action={<Bouton variante="fantome" onClick={() => navigate("/onboarding")}>+ Ajouter une école</Bouton>}
      />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <MiseEnRoute ecoleId={ecoleId} ecole={ecole} />

        {chargement ? (
          <SkeletonListe lignes={3} />
        ) : lignes.length === 0 ? (
          <EtatVide icone="🏫" titre="Aucune école">Aucune école n'est rattachée à votre compte de promoteur.</EtatVide>
        ) : (
          <>
            {/* KPIs consolidés */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label="Effectif total" valeur={fmt(t.effectif)} />
              <Kpi label="Taux de recouvrement" valeur={`${taux(t.paye, t.facture)}%`} ton="vert" />
              <KpiMonnaie label="Trésorerie" monnaies={monnaies} champ="tresorerie" ton="navy" />
              <KpiMonnaie label="Masse salariale (mois)" monnaies={monnaies} champ="masse" ton="rouge" />
              <KpiMonnaie label="Résultat (année civile)" monnaies={monnaies} champ="resultat" selonSigne />
            </div>

            {/* Comparatif par école */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {lignes.map((l) => {
                const actif = l.ecole_id === ecoleId;
                const resultat = api.resultatAnnee(l);
                const dev = l.devise || devise;   // la devise de CETTE école
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
                      <Ligne l="Trésorerie" v={`${fmt(l.tresorerie)} ${dev}`} />
                      <Ligne l="Masse salariale" v={`${fmt(l.masse_salariale)} ${dev}`} />
                      <Ligne l="Résultat (année civile)" v={`${fmt(resultat)} ${dev}`} ton={resultat >= 0 ? "vert" : "rouge"} />
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

function MiseEnRoute({ ecoleId, ecole }) {
  const [etat, setEtat] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setEtat(await etatMiseEnRoute(ecoleId, an?.id));
      } catch { setEtat(null); }
    })();
  }, [ecoleId]);
  if (!etat) return null;

  const etapes = [
    { ok: etat.niveaux > 0 && etat.classes > 0, label: "Structure (niveaux & classes)", detail: `${etat.niveaux} niveau(x) · ${etat.classes} classe(s)`, to: "/structure" },
    { ok: etat.matieres > 0, label: "Matières", detail: `${etat.matieres} matière(s)`, to: "/structure" },
    { ok: etat.enseignants > 0, label: "Enseignants", detail: `${etat.enseignants} enseignant(s)`, to: "/enseignants" },
    { ok: etat.affectations > 0, label: "Affectations profs", detail: `${etat.affectations} affectation(s)`, to: "/enseignants" },
    { ok: etat.frais > 0, label: "Grille tarifaire", detail: `${etat.frais} frais`, to: "/paiements" },
    { ok: etat.inscriptions > 0, label: "Élèves inscrits", detail: `${etat.inscriptions} inscrit(s)`, to: "/eleves" },
  ];
  const restants = etapes.filter((e) => !e.ok).length;

  if (restants === 0) {
    return (
      <Carte className="flex items-center gap-3 border-l-4 border-l-emerald-400 p-4">
        <span className="text-lg" aria-hidden>✅</span>
        <p className="text-sm text-navy-900/70"><b className="text-navy-900">Mise en route terminée</b> — {ecole?.nom} est entièrement paramétrée.</p>
      </Carte>
    );
  }

  return (
    <Carte className="border-l-4 border-l-or-500 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-navy-900">Mise en route — {ecole?.nom}</h3>
        <span className="text-xs font-medium text-or-600">{restants} étape(s) restante(s)</span>
      </div>
      <p className="mt-1 text-sm text-navy-900/50">Complétez le paramétrage pour débloquer toutes les fonctions (bulletins, emplois du temps, facturation).</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {etapes.map((e, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${e.ok ? "border-navy-900/10" : "border-or-500/40 bg-or-500/5"}`}>
            <span className={e.ok ? "text-emerald-600" : "text-or-600"} aria-hidden>{e.ok ? "✓" : "⚠️"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-900">{e.label}</p>
              <p className="text-xs text-navy-900/45">{e.detail}</p>
            </div>
            {!e.ok && <Link to={e.to} className="shrink-0 text-xs font-medium text-navy-700 hover:text-or-600">Configurer →</Link>}
          </li>
        ))}
      </ul>
    </Carte>
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

// Une tuile de montant consolidé. Tant qu'il n'y a qu'une devise, elle se lit
// comme avant ; dès qu'il y en a plusieurs, chaque monnaie garde sa ligne —
// « 12 000 » sans dire de quoi, ou pire la somme d'USD et de francs CFA,
// n'informe pas : elle trompe.
function KpiMonnaie({ label, monnaies, champ, ton, selonSigne }) {
  const tons = { navy: "text-navy-900", vert: "text-emerald-700", rouge: "text-rose-600", or: "text-or-600" };
  const couleur = (v) => (selonSigne ? (v >= 0 ? tons.or : tons.rouge) : tons[ton] || tons.navy);
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      {monnaies.length === 0 ? (
        <p className="mt-2 font-display text-2xl font-bold text-navy-900/30">—</p>
      ) : (
        <div className={monnaies.length > 1 ? "mt-2 space-y-0.5" : "mt-2"}>
          {monnaies.map(([dev, v]) => (
            <p key={dev} className={`font-display font-bold ${monnaies.length > 1 ? "text-lg" : "text-2xl"} ${couleur(v[champ])}`}>
              {fmt(v[champ])}
              <span className="ml-1 text-sm font-normal text-navy-900/40">{dev}</span>
            </p>
          ))}
        </div>
      )}
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
