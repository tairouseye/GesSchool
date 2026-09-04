import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, Kpi, TuileAlerte, Onglets, Recherche, filtreTexte, Table } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/rh.js";
import { getComptes } from "@/lib/comptabilite.js";
import { MODES } from "@/lib/paiements.js";
import { getSignataires } from "@/lib/academique.js";
import { parserFeuilleBareme } from "@/lib/bareme.js";
import { creerDocument } from "@/lib/documents.js";
import DocumentOfficiel from "@/composants/DocumentOfficiel.jsx";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const moisCourant = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const libellePeriode = (p) => {
  if (!p) return "";
  const [a, m] = p.split("-");
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${mois[Number(m) - 1] || ""} ${a}`;
};

export default function RH() {
  const { ecoleId, ecole } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [onglet, setOnglet] = useState("personnel");
  const [personnels, setPersonnels] = useState([]);
  const [contrats, setContrats] = useState({});
  const [periode, setPeriode] = useState(moisCourant());
  const [salaires, setSalaires] = useState([]);
  const [erreur, setErreur] = useState("");
  const [formPers, setFormPers] = useState(null); // null = fermé, {} = création, {id…} = édition
  const [nbEnsNonImportes, setNbEnsNonImportes] = useState(0);
  const [elements, setElements] = useState([]);
  const [modaleElements, setModaleElements] = useState(false);
  const [regime, setRegime] = useState({ mode: "simplifie", cotisations: [], bareme: { mensuel: 0, annuel: 0 } });
  const [modaleRegime, setModaleRegime] = useState(false);
  const [detail, setDetail] = useState(null); // salaire_id dont on édite la composition
  const [bulletin, setBulletin] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [signataires, setSignataires] = useState([]);
  // Compte de trésorerie + mode utilisés pour régler les salaires de la période.
  const [reglement, setReglement] = useState({ compte_id: "", mode: "" });

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [pers, con, sig, nbEns, els, mode, cots, bar] = await Promise.all([
        api.getPersonnels(ecoleId), api.getContratsActifs(ecoleId), getSignataires(ecoleId),
        api.compterEnseignantsNonImportes(ecoleId).catch(() => 0), api.getElementsPaie(ecoleId).catch(() => []),
        api.getModePaie(ecoleId).catch(() => "simplifie"), api.getCotisations(ecoleId).catch(() => []),
        api.compterBareme(ecoleId).catch(() => ({ mensuel: 0, annuel: 0 })),
      ]);
      setPersonnels(pers);
      setContrats(con);
      setSignataires(sig);
      setNbEnsNonImportes(nbEns);
      setElements(els);
      setRegime({ mode, cotisations: cots, bareme: bar });
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  const rechargerPaie = useCallback(async () => {
    try {
      setSalaires(await api.getSalaires(ecoleId, periode));
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId, periode]);

  useEffect(() => { recharger(); }, [recharger]);
  useEffect(() => { rechargerPaie(); }, [rechargerPaie]);

  // Comptes de trésorerie : facultatif (un profil RH sans droit compta n'y a pas
  // accès) — on ignore l'erreur et le sélecteur reste simplement masqué.
  useEffect(() => {
    let vivant = true;
    getComptes(ecoleId)
      .then((cs) => { if (!vivant) return; const a = cs.filter((c) => c.actif !== false); setComptes(a); setReglement((r) => (r.compte_id ? r : { ...r, compte_id: a[0]?.id || "" })); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [ecoleId]);

  const wrap = async (fn, apresPaie = false, msg) => {
    try {
      await fn();
      await recharger();
      if (apresPaie) await rechargerPaie();
      if (msg) toast.succes(msg);
      return true;
    } catch (e) {
      toast.erreur(e.message || "Une erreur est survenue.");
      return false;
    }
  };

  const action = onglet === "personnel"
    ? <Bouton onClick={() => setFormPers({})}>+ Personnel</Bouton>
    : onglet === "paie"
      ? (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="fantome" onClick={() => setModaleRegime(true)}>Régime</Bouton>
          <Bouton variante="fantome" onClick={() => setModaleElements(true)}>Éléments</Bouton>
          <Bouton onClick={() => wrap(async () => { await api.genererPaie(ecoleId, periode); }, true)} disabled={personnels.length === 0}>⚡ Générer les fiches</Bouton>
        </div>
      )
      : null;

  // Tableau de bord RH (accueil de l'espace) — agrégé depuis les données chargées
  const jour = new Date().toISOString().slice(0, 10);
  const dans60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  // Personnel à payer sur la période : tout le personnel figure dans la paie
  // (même sans fiche générée). On n'exclut que les contrats explicitement
  // terminés ou pas encore commencés ce mois. Sans contrat enregistré → payable
  // (net 0 par défaut, à compléter). Net = fiche si elle existe, sinon base.
  const estPayable = (p) => { const c = contrats[p.id]; return c ? api.contratActifPour(c, periode) : true; };
  const actifs = personnels.filter(estPayable);
  const ficheDe = (pid) => salaires.find((s) => s.personnel_id === pid);
  const netPrevu = (p) => { const s = ficheDe(p.id); return s ? Number(s.montant_net || 0) : Number(contrats[p.id]?.salaire_base || 0); };
  const masseMois = actifs.reduce((sum, p) => sum + netPrevu(p), 0);
  const payeMois = salaires.filter((s) => s.paye).reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const restantMois = masseMois - payeMois;
  const aPayer = actifs.filter((p) => { const s = ficheDe(p.id); return !s || !s.paye; }).length;
  const fichesAgenerer = actifs.filter((p) => !ficheDe(p.id)).length;
  const fonctions = Object.entries(
    personnels.reduce((acc, p) => { const f = p.fonction || "—"; acc[f] = (acc[f] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxFonction = Math.max(1, ...fonctions.map(([, v]) => v));
  const echeances = personnels
    .map((p) => ({ p, c: contrats[p.id] }))
    .filter((x) => x.c?.fin && x.c.fin >= jour && x.c.fin <= dans60)
    .map((x) => ({ nom: `${x.p.prenom} ${x.p.nom}`, fin: x.c.fin, type: x.c.type }))
    .sort((a, b) => (a.fin || "").localeCompare(b.fin || ""));

  return (
    <>
      <EnTete titre="RH & paie" sousTitre="Personnel, contrats et salaires" action={action} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* À traiter */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TuileAlerte onClick={() => setOnglet("paie")} label="Salaires à payer" valeur={aPayer}
            sousTexte={`${fmt(restantMois)} ${devise} restants`} actif={aPayer > 0} ton="or" />
          <TuileAlerte onClick={() => setOnglet("paie")} label="Fiches à générer" valeur={fichesAgenerer}
            sousTexte={`paie ${libellePeriode(periode)}`} actif={fichesAgenerer > 0} ton="navy" />
          <TuileAlerte onClick={() => setOnglet("personnel")} label="Contrats à échéance" valeur={echeances.length}
            sousTexte="dans les 60 jours" actif={echeances.length > 0} ton="rouge" />
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Personnel" valeur={String(personnels.length)} ton="or" />
          <Kpi label={`Masse salariale (${libellePeriode(periode)})`} valeur={`${fmt(masseMois)} ${devise}`} />
          <Kpi label="Payé ce mois" valeur={`${fmt(payeMois)} ${devise}`} ton="vert" />
          <Kpi label="Restant à payer" valeur={`${fmt(restantMois)} ${devise}`} ton="rouge" />
        </div>

        {/* Répartition par fonction + contrats à échéance */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Carte className="p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Répartition par fonction</h3>
            {fonctions.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun personnel enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {fonctions.map(([f, v]) => (
                  <li key={f} className="flex items-center gap-4">
                    <span className="w-32 shrink-0 truncate text-sm font-medium text-navy-900">{f}</span>
                    <div className="flex-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-navy-900/10">
                        <div className="h-full bg-navy-900/80" style={{ width: `${(v / maxFonction) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-sm text-navy-900/60">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
          <Carte className="p-6">
            <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Contrats à échéance (60 j)</h3>
            {echeances.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun contrat n'arrive à échéance 🎉</p>
            ) : (
              <ul className="divide-y divide-navy-900/5">
                {echeances.map((e, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-navy-900">{e.nom}</span>
                    <span className="text-navy-900/50">{e.type || "—"}</span>
                    <span className="font-mono text-xs text-rose-600">{new Date(e.fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <Onglets items={[["personnel", "Personnel"], ["paie", "Paie"], ["documents", "Documents"]]} actif={onglet} onChange={setOnglet} />

        {onglet === "documents" ? (
          <PanneauDocumentsRH
            personnels={personnels} contrats={contrats} signataires={signataires} ecole={ecole} ecoleId={ecoleId}
            onEnvoye={() => { toast.succes("Document envoyé au signataire pour validation."); }}
          />
        ) : onglet === "personnel" ? (
          <PanneauPersonnel
            personnels={personnels} contrats={contrats} devise={devise}
            nbEnsNonImportes={nbEnsNonImportes}
            onImporter={() => wrap(async () => { const r = await api.importerEnseignantsCommePersonnel(ecoleId); toast.succes(`${r.crees} enseignant(s) ajouté(s) au personnel.`); })}
            onEditer={(p) => setFormPers({ ...p, contrat: contrats[p.id] || null })}
            onSuppr={async (id) => { if (await confirmer("Supprimer ce membre du personnel ?")) wrap(() => api.supprimerPersonnel(id), false, "Personnel supprimé."); }}
          />
        ) : (
          <PanneauPaie
            periode={periode} setPeriode={setPeriode} salaires={salaires} personnels={actifs} contrats={contrats}
            devise={devise} ecole={ecole}
            comptes={comptes} reglement={reglement} setReglement={setReglement}
            onDetail={async (ligne) => {
              try {
                if (ligne._nouveau) { const s = await api.ajouterFichePaie(ecoleId, ligne.personnel_id, periode, { montant_brut: ligne.montant_brut }); await rechargerPaie(); setDetail({ id: s.id, statut: "brouillon" }); }
                else setDetail({ id: ligne.id, statut: ligne.statut });
              } catch (e) { toast.erreur(e.message || "Erreur."); }
            }}
            onValider={(id) => wrap(() => api.validerSalaire(id), true, "Bulletin validé.")}
            onDevalider={async (id) => { if (await confirmer("Dévalider ce bulletin pour le modifier ?")) wrap(() => api.devaliderSalaire(id), true, "Bulletin repassé en brouillon."); }}
            onValiderTout={async () => { const ids = salaires.filter((s) => s.statut === "brouillon").map((s) => s.id); if (ids.length && await confirmer(`Valider ${ids.length} bulletin(s) en brouillon ?`)) wrap(async () => { for (const id of ids) await api.validerSalaire(id); }, true, "Bulletins validés."); }}
            onPayer={(ligne) => wrap(() => api.marquerPaye(ligne.id, { compte_id: reglement.compte_id, mode: reglement.mode }), true, "Salaire payé.")}
            onAnnuler={(id) => wrap(() => api.annulerPaiement(id), true)}
            onSuppr={(id) => wrap(() => api.supprimerSalaire(id), true)}
            onBulletin={(s) => setBulletin(s)}
          />
        )}
      </div>

      <ModalePersonnel
        edition={formPers} onFermer={() => setFormPers(null)}
        onEnregistrer={(p, c) => wrap(async () => {
          if (formPers && formPers.id) {
            // Édition : maj des infos + du salaire de base (contrat existant ou nouveau).
            await api.modifierPersonnel(formPers.id, p);
            if (c.salaire_base !== "" && c.salaire_base != null) {
              await api.definirSalaireBase(ecoleId, formPers.id, c, formPers.contrat?.id || null);
            }
          } else {
            const pers = await api.creerPersonnel(ecoleId, p);
            if (c.salaire_base) await api.creerContrat(ecoleId, { ...c, personnel_id: pers.id });
          }
          setFormPers(null);
        }, false, formPers && formPers.id ? "Personnel modifié." : "Personnel ajouté.")}
      />

      <ModaleElementsPaie
        ouvert={modaleElements} onFermer={() => setModaleElements(false)}
        ecoleId={ecoleId} elements={elements} onChange={recharger}
      />

      <ModaleRegimePaie
        ouvert={modaleRegime} onFermer={() => setModaleRegime(false)}
        ecoleId={ecoleId} regime={regime} devise={devise} onChange={recharger}
      />

      <ModaleDetailPaie
        salaire={detail} onFermer={() => setDetail(null)}
        ecoleId={ecoleId} elements={elements} devise={devise}
        onChange={rechargerPaie}
      />

      <ModaleBulletin bulletin={bulletin} onFermer={() => setBulletin(null)} ecole={ecole} devise={devise} />
    </>
  );
}

function PanneauPersonnel({ personnels, contrats, devise, nbEnsNonImportes = 0, onImporter, onEditer, onSuppr }) {
  const [q, setQ] = useState("");
  const banniere = nbEnsNonImportes > 0 && (
    <Carte className="flex flex-wrap items-center justify-between gap-3 border-or-500/30 bg-or-500/5 p-4">
      <p className="text-sm text-navy-900/70">
        <b>{nbEnsNonImportes}</b> enseignant{nbEnsNonImportes > 1 ? "s" : ""} de la pédagogie {nbEnsNonImportes > 1 ? "ne sont" : "n'est"} pas encore dans le personnel (donc absent{nbEnsNonImportes > 1 ? "s" : ""} de la paie).
      </p>
      <Bouton variante="or" onClick={onImporter}>➕ Les ajouter au personnel</Bouton>
    </Carte>
  );
  if (personnels.length === 0) {
    return (
      <div className="space-y-3">
        {banniere}
        <Carte className="p-8 text-sm text-navy-900/50">Aucun personnel. Ajoute ton équipe avec « + Personnel »{nbEnsNonImportes > 0 ? " ou importe tes enseignants ci-dessus" : ""}.</Carte>
      </div>
    );
  }
  const liste = filtreTexte(personnels, q, ["prenom", "nom", "fonction", "telephone", "email"]);
  return (
    <div className="space-y-3">
    {banniere}
    <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un membre du personnel…" className="max-w-sm" />
    {liste.length === 0 ? (
      <Carte className="p-8 text-sm text-navy-900/50">Aucun résultat pour « {q} ».</Carte>
    ) : (
      <Table
        keyField="id"
        rows={liste}
        onRowClick={(p) => onEditer(p)}
        columns={[
          { key: "nom", label: "Nom", render: (p) => <span className="font-medium text-navy-900">{p.prenom} {p.nom}</span> },
          { key: "fonction", label: "Fonction", hideMobile: true, render: (p) => <span className="text-navy-900/70">{p.fonction || "—"}</span> },
          { key: "contact", label: "Contact", hideMobile: true, render: (p) => <span className="text-navy-900/60">{p.telephone || p.email || "—"}</span> },
          { key: "contrat", label: "Contrat", hideMobile: true, render: (p) => <span className="text-navy-900/60">{contrats[p.id]?.type || "—"}</span> },
          { key: "salaire", label: "Salaire base", align: "right", render: (p) => (contrats[p.id] ? `${fmt(contrats[p.id].salaire_base)} ${devise}` : "—") },
          { key: "actions", label: "", align: "right", render: (p) => (
            <div className="flex items-center justify-end gap-3">
              <button onClick={(e) => { e.stopPropagation(); onEditer(p); }} className="text-xs text-navy-700 hover:text-or-500">éditer</button>
              <button onClick={(e) => { e.stopPropagation(); onSuppr(p.id); }} className="text-xs text-danger-500 hover:underline">suppr.</button>
            </div>
          ) },
        ]}
      />
    )}
    </div>
  );
}

function PanneauPaie({ periode, setPeriode, salaires, personnels, contrats, devise, ecole, comptes, reglement, setReglement, onDetail, onValider, onDevalider, onValiderTout, onPayer, onAnnuler, onSuppr, onBulletin }) {
  // Fusion : chaque personnel actif figure automatiquement — avec sa fiche si
  // elle existe, sinon une ligne « à générer » pré-remplie du salaire de base.
  // On garde aussi les fiches existantes dont le personnel n'est plus « actif »
  // (contrat terminé ce mois) pour ne pas les faire disparaître.
  const bySal = new Map(salaires.map((s) => [s.personnel_id, s]));
  const idsActifs = new Set((personnels || []).map((p) => p.id));
  const lignes = (personnels || []).map((p) => {
    const s = bySal.get(p.id);
    if (s) return s;
    const base = Number(contrats?.[p.id]?.salaire_base || 0);
    return { _nouveau: true, id: `new-${p.id}`, personnel_id: p.id,
      personnels: { prenom: p.prenom, nom: p.nom, fonction: p.fonction },
      periode, montant_brut: base, prime: 0, retenue: 0, montant_net: base, paye: false };
  });
  const orphelines = salaires.filter((s) => !idsActifs.has(s.personnel_id));
  const toutes = [...lignes, ...orphelines];
  const totalNet = toutes.reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const totalPaye = toutes.filter((s) => s.paye).reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const [etatOuvert, setEtatOuvert] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Période</span>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-navy-900/50">Masse salariale : <b className="font-mono text-navy-900">{fmt(totalNet)} {devise}</b></span>
          <span className="text-emerald-700">Payé : <b className="font-mono">{fmt(totalPaye)} {devise}</b></span>
          {salaires.some((s) => s.statut === "brouillon") && (
            <Bouton variante="fantome" onClick={onValiderTout}>✓ Valider la paie</Bouton>
          )}
          <Bouton variante="fantome" onClick={() => setEtatOuvert(true)} disabled={toutes.length === 0}>🖨️ État</Bouton>
        </div>
      </div>

      <Modale ouvert={etatOuvert} onFermer={() => setEtatOuvert(false)} titre="État de la masse salariale" large>
        <div className="zone-impression text-navy-900">
          <div className="mb-3 flex items-center gap-3 border-b border-navy-900/15 pb-2">
            {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-11 w-11 object-contain" />}
            <div className="flex-1">
              <p className="font-display text-base font-bold">{ecole?.nom}</p>
              <p className="text-xs text-navy-900/50">{[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="text-right text-xs text-navy-900/60">Période : {libellePeriode(periode)}<br />Édité le {new Date().toLocaleDateString("fr-FR")}</p>
          </div>
          <h1 className="mb-3 text-center font-display text-lg font-bold uppercase tracking-wide">État de la masse salariale</h1>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-navy-900/25 text-navy-900/60">
                <th className="px-2 py-1.5 text-left">N°</th>
                <th className="px-2 py-1.5 text-left">Nom et prénom</th>
                <th className="px-2 py-1.5 text-left">Fonction</th>
                <th className="px-2 py-1.5 text-center">Payé</th>
                <th className="px-2 py-1.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {toutes.map((s, k) => (
                <tr key={s.id} className="border-b border-navy-900/10">
                  <td className="px-2 py-1.5">{k + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{s.personnels?.nom} {s.personnels?.prenom}</td>
                  <td className="px-2 py-1.5">{s.personnels?.fonction || "—"}</td>
                  <td className="px-2 py-1.5 text-center">{s.paye ? "Oui" : "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(s.montant_net)} {devise}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy-900/30 font-bold">
                <td className="px-2 py-2" colSpan={4}>Masse salariale ({toutes.length} personne{toutes.length > 1 ? "s" : ""})</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalNet)} {devise}</td>
              </tr>
              <tr className="text-emerald-700"><td className="px-2 py-1" colSpan={4}>dont payé</td><td className="px-2 py-1 text-right font-mono">{fmt(totalPaye)} {devise}</td></tr>
              <tr className="text-rose-600"><td className="px-2 py-1" colSpan={4}>restant à payer</td><td className="px-2 py-1 text-right font-mono">{fmt(totalNet - totalPaye)} {devise}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="no-print mt-4 flex justify-end">
          <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
        </div>
      </Modale>
      {comptes.length > 0 && (
        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Payer depuis</span>
            <select value={reglement.compte_id} onChange={(e) => setReglement((r) => ({ ...r, compte_id: e.target.value }))}
              className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Aucun compte —</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.libelle}{c.numero ? ` (${c.numero})` : ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Mode</span>
            <select value={reglement.mode} onChange={(e) => setReglement((r) => ({ ...r, mode: e.target.value }))}
              className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Non précisé —</option>
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <p className="flex-1 text-xs text-navy-900/40">
            Chaque salaire réglé crée une dépense (catégorie <b>Salaires</b>) imputée sur ce compte de trésorerie ;
            « annuler » la retire. Le solde du compte est mis à jour dans Comptabilité.
          </p>
        </Carte>
      )}
      {comptes.length === 0 && (
        <p className="text-xs text-navy-900/40">
          💡 « Payer » crée automatiquement une dépense en comptabilité (catégorie Salaires) ; « annuler » la retire.
          Crée un compte de trésorerie dans <b>Comptabilité</b> pour rattacher les salaires à une caisse ou une banque.
        </p>
      )}

      {toutes.length === 0 ? (
        <Carte className="p-8 text-sm text-navy-900/50">
          Aucun personnel avec un contrat actif pour {libellePeriode(periode)}. Ajoute du personnel (avec un salaire de base) dans l'onglet « Personnel ».
        </Carte>
      ) : (
        <Carte className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Personnel</th>
                <th className="px-4 py-3 text-right font-medium">Net à payer</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {toutes.map((s) => (
                <LignePaie key={s.id} s={s} devise={devise}
                  onDetail={onDetail} onValider={onValider} onDevalider={onDevalider}
                  onPayer={onPayer} onAnnuler={onAnnuler} onSuppr={onSuppr} onBulletin={onBulletin} />
              ))}
            </tbody>
          </table>
        </Carte>
      )}
    </div>
  );
}

function LignePaie({ s, devise, onDetail, onValider, onDevalider, onPayer, onAnnuler, onSuppr, onBulletin }) {
  // Le net vient de la base (trigger sur les lignes). Le statut pilote les actions :
  // brouillon (éditable) → validé (verrouillé) → payé.
  const net = Number(s.montant_net || 0);
  const statut = s._nouveau ? "nouveau" : (s.statut || (s.paye ? "paye" : "brouillon"));
  const badge = {
    nouveau: ["bg-navy-900/5 text-navy-900/50", "À générer"],
    brouillon: ["bg-navy-900/5 text-navy-900/60", "Brouillon"],
    valide: ["bg-sky-500/10 text-sky-700", "Validé"],
    paye: ["bg-emerald-500/10 text-emerald-700", "Payé"],
    archive: ["bg-navy-900/10 text-navy-900/50", "Archivé"],
  }[statut] || ["bg-navy-900/5 text-navy-900/60", statut];
  return (
    <tr className="border-t border-navy-900/5">
      <td className="px-4 py-3">
        <p className="font-medium text-navy-900">{s.personnels?.prenom} {s.personnels?.nom}</p>
        <p className="text-xs text-navy-900/40">{s.personnels?.fonction || ""}</p>
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-navy-900">{fmt(net)} <span className="text-xs font-normal text-navy-900/40">{devise}</span></td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[0]}`}>{badge[1]}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
          <button onClick={() => onDetail(s)} className="font-medium text-navy-700 hover:text-or-500">détails</button>
          {!s._nouveau && <button onClick={() => onBulletin(s)} className="text-navy-700 hover:text-or-500">bulletin</button>}
          {statut === "brouillon" && <button onClick={() => onValider(s.id)} className="font-medium text-sky-700 hover:underline">valider</button>}
          {statut === "valide" && <button onClick={() => onPayer(s)} className="font-medium text-emerald-700 hover:underline">payer</button>}
          {statut === "valide" && <button onClick={() => onDevalider(s.id)} className="text-navy-900/50 hover:underline">dévalider</button>}
          {statut === "paye" && <button onClick={() => onAnnuler(s.id)} className="text-navy-900/50 hover:underline">annuler paiement</button>}
          {statut === "brouillon" && <button onClick={() => onSuppr(s.id)} className="text-rose-500 hover:underline">suppr.</button>}
        </div>
      </td>
    </tr>
  );
}

function ModalePersonnel({ edition, onFermer, onEnregistrer }) {
  const vide = {
    prenom: "", nom: "", fonction: "Enseignant", telephone: "", email: "", date_embauche: "",
    type: "CDI", salaire_base: "", debut: "", fin: "",
    matricule: "", categorie: "", n_ipres: "", situation_familiale: "", part_ir: "1", part_trimf: "1",
  };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const enEdition = !!(edition && edition.id);

  // (Re)pré-remplit le formulaire à chaque ouverture / changement de cible.
  useEffect(() => {
    if (!edition) return;
    const c = edition.contrat || {};
    setF({
      prenom: edition.prenom || "", nom: edition.nom || "", fonction: edition.fonction || "Enseignant",
      telephone: edition.telephone || "", email: edition.email || "", date_embauche: edition.date_embauche || "",
      type: c.type || "CDI", salaire_base: c.salaire_base != null ? String(c.salaire_base) : "",
      debut: c.debut || "", fin: c.fin || "",
      matricule: edition.matricule || "", categorie: edition.categorie || "", n_ipres: edition.n_ipres || "",
      situation_familiale: edition.situation_familiale || "",
      part_ir: edition.part_ir != null ? String(edition.part_ir) : "1",
      part_trimf: edition.part_trimf != null ? String(edition.part_trimf) : "1",
    });
  }, [edition]);

  return (
    <Modale ouvert={!!edition} onFermer={onFermer} titre={enEdition ? "Modifier le personnel" : "Nouveau personnel"} large>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!f.prenom.trim() || !f.nom.trim()) return;
        onEnregistrer(
          { prenom: f.prenom.trim(), nom: f.nom.trim(), fonction: f.fonction, telephone: f.telephone, email: f.email, date_embauche: f.debut || f.date_embauche || null,
            matricule: f.matricule, categorie: f.categorie, n_ipres: f.n_ipres, situation_familiale: f.situation_familiale, part_ir: f.part_ir, part_trimf: f.part_trimf },
          { type: f.type, salaire_base: f.salaire_base, debut: f.debut || f.date_embauche || null, fin: f.fin || null }
        );
        if (!enEdition) setF(vide);
      }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          <Champ label="Nom *" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Fonction</span>
            <select value={f.fonction} onChange={(e) => maj("fonction", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {api.FONCTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <Champ label="Téléphone" type="tel" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          <Champ label="Email" type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} />
        </div>

        <div className="rounded-xl border border-navy-900/10 bg-creme/40 p-4">
          <p className="mb-3 text-sm font-medium text-navy-900/70">Contrat & salaire {enEdition ? "" : "(optionnel)"}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
              <select value={f.type} onChange={(e) => maj("type", e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                {api.TYPES_CONTRAT.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <Champ label="Salaire de base (net)" value={f.salaire_base} onChange={(e) => maj("salaire_base", e.target.value.replace(/[^0-9]/g, ""))} />
            <Champ label="Début / embauche" type="date" value={f.debut || f.date_embauche} onChange={(e) => maj("debut", e.target.value)} />
            <Champ label="Fin (optionnel)" type="date" value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
          </div>
          {enEdition && <p className="mt-2 text-xs text-navy-900/40">Le salaire de base est traité comme un net ; il alimente la paie du mois.</p>}
        </div>

        <details className="rounded-xl border border-navy-900/10 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-navy-900/70">Fiscal & paie (régime complet)</summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Matricule" value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
            <Champ label="Catégorie" value={f.categorie} onChange={(e) => maj("categorie", e.target.value)} placeholder="Ex. 2e classe 1er éch." />
            <Champ label="N° IPRES" value={f.n_ipres} onChange={(e) => maj("n_ipres", e.target.value)} />
            <Champ label="Situation familiale" value={f.situation_familiale} onChange={(e) => maj("situation_familiale", e.target.value)} placeholder="Marié(e), célibataire…" />
            <Champ label="Part IR" type="number" step="0.5" value={f.part_ir} onChange={(e) => maj("part_ir", e.target.value)} />
            <Champ label="Part TRIMF" type="number" step="0.5" value={f.part_trimf} onChange={(e) => maj("part_trimf", e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-navy-900/40">Les parts (quotient familial) servent au calcul de l'IR/TRIMF en mode complet.</p>
        </details>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleBulletin({ bulletin, onFermer, ecole, devise }) {
  const [lignes, setLignes] = useState([]);
  useEffect(() => {
    if (!bulletin?.id) { setLignes([]); return; }
    let vivant = true;
    api.getLignesSalaire(bulletin.id).then((l) => { if (vivant) setLignes(l); }).catch(() => {});
    return () => { vivant = false; };
  }, [bulletin]);
  if (!bulletin) return null;
  const gains = lignes.filter((l) => l.sens === "gain");
  const retenues = lignes.filter((l) => l.sens === "retenue");
  const totalGains = gains.reduce((s, l) => s + Number(l.montant || 0), 0);
  const totalRetenues = retenues.reduce((s, l) => s + Number(l.montant || 0), 0);
  const net = Number(bulletin.montant_net ?? totalGains - totalRetenues);
  const p = bulletin.personnels || {};
  return (
    <Modale ouvert={!!bulletin} onFermer={onFermer} titre="Bulletin de paie" large>
      <div className="space-y-5">
        <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {ecole?.logo_url
                ? <img src={ecole.logo_url} alt="" className="h-12 w-12 shrink-0 object-contain" />
                : <Cachet size={48} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
              <div>
                <p className="font-display text-lg font-bold text-navy-900">{ecole?.nom}</p>
                <p className="text-xs text-navy-900/50">Bulletin de paie — {libellePeriode(bulletin.periode)}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-navy-900">{p.prenom} {p.nom}</p>
              <p className="text-xs text-navy-900/50">{p.fonction || ""}</p>
            </div>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-navy-900/40">Rémunération</p>
          <table className="mt-1 w-full text-left text-sm">
            <tbody>
              {gains.map((l) => <LigneB key={l.id} l={l.libelle} v={`${fmt(l.montant)} ${devise}`} />)}
            </tbody>
          </table>
          <div className="mt-1 flex justify-between border-t border-navy-900/10 pt-1 text-sm font-semibold">
            <span className="text-navy-900/70">Total brut</span><span className="font-mono">{fmt(totalGains)} {devise}</span>
          </div>

          {retenues.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-navy-900/40">Retenues</p>
              <table className="mt-1 w-full text-left text-sm">
                <tbody>
                  {retenues.map((l) => <LigneB key={l.id} l={l.libelle} v={`− ${fmt(l.montant)} ${devise}`} />)}
                </tbody>
              </table>
              <div className="mt-1 flex justify-between border-t border-navy-900/10 pt-1 text-sm font-semibold">
                <span className="text-navy-900/70">Total retenues</span><span className="font-mono">− {fmt(totalRetenues)} {devise}</span>
              </div>
            </>
          )}

          <div className="mt-3 flex justify-between border-t-2 border-navy-900/15 pt-3">
            <span className="font-display font-bold text-navy-900">NET À PAYER</span>
            <span className="font-display text-xl font-bold text-navy-900">{fmt(net)} {devise}</span>
          </div>

          <div className="mt-6 flex justify-between text-xs text-navy-900/50">
            <span>{bulletin.paye ? `Payé le ${bulletin.date_paiement || ""}` : "Non payé"}</span>
            <span>Signature & cachet</span>
          </div>
        </div>

        <div className="no-print flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          <Bouton onClick={() => window.print()}>Imprimer</Bouton>
        </div>
      </div>
    </Modale>
  );
}


function LigneB({ l, v }) {
  return (
    <tr className="border-b border-navy-900/5">
      <td className="py-2 text-navy-900/70">{l}</td>
      <td className="py-2 text-right font-mono text-navy-900">{v}</td>
    </tr>
  );
}

// --- Documents RH (attestation de travail, certificat de fin de contrat) ---
const MODELES_RH = [
  { id: "travail", titre: "Attestation de travail",
    corps: (c) => `atteste que ${c.nomComplet} est employé(e) au sein de notre établissement en qualité de ${c.fonction}${c.depuis ? `, depuis le ${c.depuis}` : ""}${c.typeContrat ? ` (contrat ${c.typeContrat})` : ""}. La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.` },
  { id: "fin_contrat", titre: "Certificat de fin de contrat",
    corps: (c) => `certifie que ${c.nomComplet} a été employé(e) au sein de notre établissement en qualité de ${c.fonction}${c.debut ? `, du ${c.debut}` : ""} au ${c.fin}. Nous lui délivrons le présent certificat, libre de tout engagement, pour servir et valoir ce que de droit.` },
  { id: "mission", titre: "Ordre de mission",
    corps: (c) => `donne ordre à ${c.nomComplet}, ${c.fonction}, d'effectuer une mission${c.destination ? ` à ${c.destination}` : ""}${c.du ? `, du ${c.du}` : ""}${c.au ? ` au ${c.au}` : ""}, ayant pour objet : ${c.objet || "…"}. Les autorités compétentes sont priées de lui faciliter l'accomplissement de cette mission.` },
];

function PanneauDocumentsRH({ personnels, contrats, signataires, ecole, ecoleId, onEnvoye }) {
  const dateLisible = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");
  const [persId, setPersId] = useState("");
  const [modeleId, setModeleId] = useState("travail");
  const [ville, setVille] = useState(ecole?.ville || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [objet, setObjet] = useState("");         // ordre de mission
  const [destination, setDestination] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [sigIdx, setSigIdx] = useState(0);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const p = personnels.find((x) => x.id === persId);
  const c = contrats[persId];
  const modele = MODELES_RH.find((m) => m.id === modeleId);
  const sig = signataires[sigIdx];
  const ctx = p && {
    nomComplet: `${p.prenom} ${p.nom}`,
    fonction: p.fonction || "—",
    depuis: p.date_embauche ? dateLisible(p.date_embauche) : (c?.debut ? dateLisible(c.debut) : ""),
    typeContrat: c?.type || "",
    debut: c?.debut ? dateLisible(c.debut) : (p.date_embauche ? dateLisible(p.date_embauche) : ""),
    fin: c?.fin ? dateLisible(c.fin) : "ce jour",
    objet, destination,
    du: du ? dateLisible(du) : "",
    au: au ? dateLisible(au) : "",
  };

  async function envoyer() {
    setErreur("");
    if (!p) return setErreur("Choisissez un membre du personnel.");
    if (!sig) return setErreur("Aucun signataire. Ajoutez-en dans Paramètres → Signataires.");
    if (!sig.profil_id) return setErreur(`« ${sig.fonction} » n'a pas de compte lié : impossible de lui envoyer pour validation.`);
    setEnvoi(true);
    try {
      await creerDocument(ecoleId, {
        type: modeleId, titre: modele.titre, corps: modele.corps(ctx),
        ville, date_doc: date, reference,
        famille: "rh", cible_type: "personnel", cible_id: p.id, cible_libelle: `${p.nom} ${p.prenom}`,
        signataire_fonction: sig.fonction, signataire_nom: sig.nom, signataire_profil: sig.profil_id, signature_url: sig.signature_url,
      });
      setPersId(""); setReference("");
      onEnvoye?.();
    } catch (e) { setErreur(e.message); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Carte className="p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Générer un document RH</h3>
        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Membre du personnel</span>
            <select value={persId} onChange={(e) => setPersId(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {personnels.map((x) => <option key={x.id} value={x.id}>{x.nom} {x.prenom}{x.fonction ? ` — ${x.fonction}` : ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de document</span>
            <select value={modeleId} onChange={(e) => setModeleId(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {MODELES_RH.map((m) => <option key={m.id} value={m.id}>{m.titre}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
            <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Champ label="Référence (optionnel)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° du document" />
          {modeleId === "mission" && (
            <>
              <Champ label="Objet de la mission" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. formation, réunion académique…" />
              <Champ label="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex. Thiès" />
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
                <Champ label="Au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
              </div>
            </>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Signataire</span>
            <select value={sigIdx} onChange={(e) => setSigIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {signataires.length === 0 && <option value={0}>Aucun signataire configuré</option>}
              {signataires.map((s, i) => <option key={i} value={i}>{s.fonction} — {s.nom}</option>)}
            </select>
          </label>
          <Bouton onClick={envoyer} disabled={envoi || !p}>{envoi ? "…" : "Envoyer pour validation"}</Bouton>
        </div>
      </Carte>

      <Carte className="p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Aperçu</h3>
        {ctx ? (
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-navy-900/10">
            <DocumentOfficiel ecole={ecole} titre={modele.titre} corps={modele.corps(ctx)}
              signataire={sig?.nom} signatureUrl={sig?.signature_url} ville={ville} date={date} reference={reference} signature={false} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-navy-900/10 px-4 py-10 text-center text-sm text-navy-900/40">
            Choisissez un membre du personnel pour prévisualiser le document.
          </p>
        )}
      </Carte>
    </div>
  );
}

// --- PHASE C : gestionnaire du catalogue d'éléments de paie ---
function ModaleElementsPaie({ ouvert, onFermer, ecoleId, elements, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [ajout, setAjout] = useState({ gain: "", retenue: "" });

  const run = async (fn) => {
    try { await fn(); await onChange(); }
    catch (e) { toast.erreur(e.message || "Erreur."); }
  };

  // Fonction (pas un composant) → pas de perte de focus sur le champ d'ajout.
  const renderSection = (sens, titre, aide) => {
    const liste = (elements || []).filter((x) => x.sens === sens)
      .sort((a, b) => (a.ordre - b.ordre) || a.libelle.localeCompare(b.libelle));
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-navy-900">{titre}</p>
        <p className="text-xs text-navy-900/45">{aide}</p>
        <ul className="space-y-1.5">
          {liste.map((el) => (
            <li key={el.id} className="flex flex-wrap items-center gap-2">
              <input
                defaultValue={el.libelle}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== el.libelle) run(() => api.modifierElementPaie(el.id, { libelle: v })); }}
                className={`min-w-[8rem] flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500 ${el.actif === false ? "text-navy-900/40 line-through" : ""}`}
              />
              <button type="button" onClick={() => run(() => api.modifierElementPaie(el.id, { recurrent: !el.recurrent }))}
                className={`rounded-lg border px-2 py-1.5 text-xs ${el.recurrent ? "border-or-500/40 bg-or-500/10 text-or-700" : "border-navy-900/10 text-navy-900/50"}`}
                title="Repris automatiquement chaque mois">{el.recurrent ? "récurrent" : "ponctuel"}</button>
              <button type="button" onClick={() => run(() => api.modifierElementPaie(el.id, { actif: !(el.actif !== false) }))}
                className="rounded-lg border border-navy-900/10 px-2 py-1.5 text-xs text-navy-900/60 hover:bg-navy-900/5">{el.actif === false ? "activer" : "masquer"}</button>
              <button type="button" onClick={async () => { if (await confirmer(`Supprimer l'élément « ${el.libelle} » ?`)) run(() => api.supprimerElementPaie(el.id)); }}
                className="rounded-lg border border-danger-500/20 px-2 py-1.5 text-xs text-danger-500 hover:bg-danger-500/5">suppr.</button>
            </li>
          ))}
          {liste.length === 0 && <li className="text-xs text-navy-900/40">Aucun élément.</li>}
        </ul>
        <div className="flex gap-2 pt-1">
          <input value={ajout[sens]} onChange={(e) => setAjout((a) => ({ ...a, [sens]: e.target.value }))}
            placeholder={sens === "gain" ? "Nouveau gain (ex. Prime de caisse)…" : "Nouvelle retenue…"}
            className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
          <Bouton variante="fantome" onClick={() => { const v = ajout[sens].trim(); if (!v) return; run(() => api.creerElementPaie(ecoleId, { sens, libelle: v, mode: "fixe", recurrent: false, ordre: liste.length })); setAjout((a) => ({ ...a, [sens]: "" })); }}>
            + Ajouter
          </Bouton>
        </div>
      </div>
    );
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Éléments de paie" large>
      <div className="space-y-6">
        <p className="text-xs text-navy-900/50">
          Définis les gains (primes, indemnités, heures sup.…) et retenues utilisables dans la paie.
          Un élément <b>récurrent</b> sera repris chaque mois pour l'employé ; un élément <b>ponctuel</b> s'ajoute au besoin.
          « Masquer » retire un élément des choix sans toucher aux bulletins déjà émis.
        </p>
        {renderSection("gain", "Gains", "Primes, indemnités, heures supplémentaires, bonus…")}
        {renderSection("retenue", "Retenues", "Cotisations, retards, retenues diverses (avances et prêts auront leur module).")}
        <div className="flex justify-end">
          <Bouton onClick={onFermer}>Terminé</Bouton>
        </div>
      </div>
    </Modale>
  );
}

// --- PHASE D : éditeur de composition d'un bulletin (lignes gains/retenues) ---
function ModaleDetailPaie({ salaire, onFermer, ecoleId, elements, devise, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [lignes, setLignes] = useState([]);
  const [nouv, setNouv] = useState({ elementId: "", libelle: "", sens: "gain", montant: "" });
  const salaireId = salaire?.id || null;
  const verrouille = !!salaire && salaire.statut && salaire.statut !== "brouillon";

  const recharger = async () => {
    if (!salaireId) return;
    try { setLignes(await api.getLignesSalaire(salaireId)); } catch (e) { toast.erreur(e.message || "Erreur."); }
  };
  useEffect(() => { setNouv({ elementId: "", libelle: "", sens: "gain", montant: "" }); recharger(); /* eslint-disable-next-line */ }, [salaireId]);

  const run = async (fn) => {
    try { await fn(); await recharger(); onChange && onChange(); }
    catch (e) { toast.erreur(e.message || "Erreur."); }
  };

  const gains = lignes.filter((l) => l.sens === "gain");
  const retenues = lignes.filter((l) => l.sens === "retenue");
  const totalGains = gains.reduce((s, l) => s + Number(l.montant || 0), 0);
  const totalRetenues = retenues.reduce((s, l) => s + Number(l.montant || 0), 0);
  const net = totalGains - totalRetenues;
  const actifs = (elements || []).filter((e) => e.actif !== false);

  const ajouter = () => {
    const el = actifs.find((e) => e.id === nouv.elementId);
    const libelle = el ? el.libelle : nouv.libelle.trim();
    const sens = el ? el.sens : nouv.sens;
    if (!libelle) { toast.erreur("Choisis un élément ou saisis un libellé."); return; }
    run(() => api.ajouterLigneSalaire(ecoleId, salaireId, { element_id: el?.id || null, libelle, sens, montant: nouv.montant, ordre: lignes.length }));
    setNouv({ elementId: "", libelle: "", sens: "gain", montant: "" });
  };

  const rendreLignes = (liste, titre, signe) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">{titre}</p>
      {liste.length === 0 && <p className="text-xs text-navy-900/40">Aucune ligne.</p>}
      {liste.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <span className="flex-1 text-sm text-navy-900">{l.libelle}</span>
          <span className="text-navy-900/40">{signe}</span>
          {verrouille
            ? <span className="w-28 px-2 py-1.5 text-right font-mono text-sm text-navy-900">{fmt(l.montant)}</span>
            : <input defaultValue={l.montant} inputMode="numeric"
                onBlur={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); if (Number(v) !== Number(l.montant)) run(() => api.majLigneSalaire(l.id, v)); }}
                className="w-28 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500" />}
          {!verrouille && (
            <button type="button" onClick={async () => { if (await confirmer(`Retirer « ${l.libelle} » ?`)) run(() => api.supprimerLigneSalaire(l.id)); }}
              className="text-xs text-danger-500 hover:underline">×</button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Modale ouvert={!!salaire} onFermer={onFermer} titre="Composition du salaire" large>
      <div className="space-y-5">
        {verrouille && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-2.5 text-xs text-sky-800">
            Bulletin <b>{salaire.statut === "paye" ? "payé" : "validé"}</b> — en lecture seule. {salaire.statut === "paye" ? "Annulez le paiement puis dévalidez" : "Dévalidez-le"} pour le modifier.
          </div>
        )}
        {rendreLignes(gains, "Gains", "+")}
        <div className="flex justify-between border-t border-navy-900/10 pt-1 text-sm font-semibold">
          <span className="text-navy-900/70">Total brut</span><span className="font-mono">{fmt(totalGains)} {devise}</span>
        </div>

        {rendreLignes(retenues, "Retenues", "−")}
        {retenues.length > 0 && (
          <div className="flex justify-between border-t border-navy-900/10 pt-1 text-sm font-semibold">
            <span className="text-navy-900/70">Total retenues</span><span className="font-mono">− {fmt(totalRetenues)} {devise}</span>
          </div>
        )}

        <div className="flex justify-between rounded-xl bg-navy-900/5 px-4 py-3">
          <span className="font-display font-bold text-navy-900">NET À PAYER</span>
          <span className="font-display text-lg font-bold text-navy-900">{fmt(net)} {devise}</span>
        </div>

        {/* Ajout d'une ligne (uniquement en brouillon) */}
        {!verrouille && (
        <div className="rounded-xl border border-navy-900/10 bg-creme/40 p-4">
          <p className="mb-2 text-sm font-medium text-navy-900/70">Ajouter un élément</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Élément</span>
              <select value={nouv.elementId} onChange={(e) => setNouv((n) => ({ ...n, elementId: e.target.value }))}
                className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="">— Libre —</option>
                <optgroup label="Gains">
                  {actifs.filter((e) => e.sens === "gain").map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
                </optgroup>
                <optgroup label="Retenues">
                  {actifs.filter((e) => e.sens === "retenue").map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
                </optgroup>
              </select>
            </label>
            {!nouv.elementId && (
              <>
                <div className="w-40"><Champ label="Libellé" value={nouv.libelle} onChange={(e) => setNouv((n) => ({ ...n, libelle: e.target.value }))} /></div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Sens</span>
                  <select value={nouv.sens} onChange={(e) => setNouv((n) => ({ ...n, sens: e.target.value }))}
                    className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                    <option value="gain">Gain</option>
                    <option value="retenue">Retenue</option>
                  </select>
                </label>
              </>
            )}
            <div className="w-28"><Champ label="Montant" value={nouv.montant} onChange={(e) => setNouv((n) => ({ ...n, montant: e.target.value.replace(/[^0-9]/g, "") }))} /></div>
            <Bouton variante="or" onClick={ajouter}>Ajouter</Bouton>
          </div>
        </div>
        )}

        <div className="flex justify-end">
          <Bouton onClick={onFermer}>Terminé</Bouton>
        </div>
      </div>
    </Modale>
  );
}

// --- PHASE D-bis : régime de paie (mode + cotisations + barème IR) ---
function ModaleRegimePaie({ ouvert, onFermer, ecoleId, regime, devise, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [libelle, setLibelle] = useState("");
  const cots = regime?.cotisations || [];
  const mode = regime?.mode || "simplifie";
  const bar = regime?.bareme || { mensuel: 0, annuel: 0 };

  const run = async (fn) => {
    try { await fn(); await onChange(); }
    catch (e) { toast.erreur(e.message || "Erreur."); }
  };
  const pct = (t) => (Number(t) * 100).toString().replace(/\.0+$/, "");

  // Import du barème (fichier Excel/CSV → lignes bareme_ir).
  const [wbRef, setWbRef] = useState(null);
  const [feuilles, setFeuilles] = useState([]);
  const [mapSheet, setMapSheet] = useState({ mensuel: "", annuel: "" });
  const [importMsg, setImportMsg] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const choisirFichier = async (file) => {
    setImportMsg(""); setFeuilles([]); setWbRef(null);
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      setWbRef(wb); setFeuilles(wb.SheetNames);
      const parNom = (re) => wb.SheetNames.find((n) => re.test(n)) || "";
      setMapSheet({ mensuel: parNom(/mensuel/i), annuel: parNom(/annuel/i) });
    } catch (e) { setImportMsg("Lecture impossible : " + (e.message || e)); }
  };

  const importerBareme = async () => {
    if (!wbRef) return;
    setImportBusy(true); setImportMsg("");
    try {
      const XLSX = await import("xlsx");
      let total = 0, detail = [];
      for (const per of ["mensuel", "annuel"]) {
        const sheet = mapSheet[per];
        if (!sheet) continue;
        const matrix = XLSX.utils.sheet_to_json(wbRef.Sheets[sheet], { header: 1, blankrows: false, defval: "" });
        const { rows } = parserFeuilleBareme(matrix);
        const r = await api.importerBareme(ecoleId, per, rows);
        total += r.importes; detail.push(`${per} : ${r.importes}`);
      }
      if (total === 0) { setImportMsg("Aucune feuille sélectionnée."); }
      else { setImportMsg(`✓ Importé — ${detail.join(" · ")}`); setWbRef(null); setFeuilles([]); await onChange(); }
    } catch (e) { setImportMsg("Erreur : " + (e.message || e)); }
    finally { setImportBusy(false); }
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Régime de paie" large>
      <div className="space-y-6">
        {/* Mode */}
        <div>
          <p className="mb-2 text-sm font-semibold text-navy-900">Mode de calcul</p>
          <div className="inline-flex rounded-xl bg-navy-900/5 p-1">
            {[["simplifie", "Simplifié"], ["complet", "Complet (cotisations + IR)"]].map(([v, l]) => (
              <button key={v} onClick={() => run(() => api.setModePaie(ecoleId, v))}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === v ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>{l}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-navy-900/45">
            {mode === "simplifie"
              ? "Paie simple : net = gains − retenues (pas de cotisations ni d'impôt automatiques)."
              : "Paie statutaire : cotisations, IR (barème) et TRIMF calculés automatiquement (moteur en cours d'activation)."}
          </p>
        </div>

        {/* Cotisations */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-navy-900">Cotisations</p>
          <p className="text-xs text-navy-900/45">Taux en % ; laisse un plafond vide pour « aucun ». Un forfait (montant fixe) l'emporte sur le taux.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-navy-900/50">
                <tr>
                  <th className="py-1 pr-2 font-medium">Libellé</th>
                  <th className="py-1 px-1 text-right font-medium">% sal.</th>
                  <th className="py-1 px-1 text-right font-medium">% patr.</th>
                  <th className="py-1 px-1 text-right font-medium">Plafond</th>
                  <th className="py-1 px-1 text-right font-medium">Forf. sal.</th>
                  <th className="py-1 px-1 text-right font-medium">Forf. patr.</th>
                  <th className="py-1 pl-1"></th>
                </tr>
              </thead>
              <tbody>
                {cots.map((c) => {
                  const champ = "w-16 rounded border border-navy-900/15 bg-white px-1.5 py-1 text-right font-mono outline-none focus:border-or-500";
                  const commit = (patch) => run(() => api.modifierCotisation(c.id, patch));
                  return (
                    <tr key={c.id} className={`border-t border-navy-900/5 ${c.actif === false ? "opacity-40" : ""}`}>
                      <td className="py-1 pr-2">
                        <input defaultValue={c.libelle} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.libelle) commit({ libelle: v }); }}
                          className="w-40 rounded border border-navy-900/15 bg-white px-2 py-1 outline-none focus:border-or-500" />
                      </td>
                      <td className="py-1 px-1 text-right"><input defaultValue={pct(c.taux_salarial)} onBlur={(e) => commit({ taux_salarial: (Number(e.target.value) || 0) / 100 })} className={champ} /></td>
                      <td className="py-1 px-1 text-right"><input defaultValue={pct(c.taux_patronal)} onBlur={(e) => commit({ taux_patronal: (Number(e.target.value) || 0) / 100 })} className={champ} /></td>
                      <td className="py-1 px-1 text-right"><input defaultValue={c.plafond ?? ""} onBlur={(e) => commit({ plafond: e.target.value })} className={champ} /></td>
                      <td className="py-1 px-1 text-right"><input defaultValue={c.forfait_salarial || ""} onBlur={(e) => commit({ forfait_salarial: e.target.value })} className={champ} /></td>
                      <td className="py-1 px-1 text-right"><input defaultValue={c.forfait_patronal || ""} onBlur={(e) => commit({ forfait_patronal: e.target.value })} className={champ} /></td>
                      <td className="py-1 pl-1 text-right whitespace-nowrap">
                        <button type="button" onClick={() => commit({ actif: !(c.actif !== false) })} className="text-navy-900/50 hover:underline">{c.actif === false ? "on" : "off"}</button>
                        {" "}
                        <button type="button" onClick={async () => { if (await confirmer(`Supprimer « ${c.libelle} » ?`)) run(() => api.supprimerCotisation(c.id)); }} className="text-danger-500 hover:underline">×</button>
                      </td>
                    </tr>
                  );
                })}
                {cots.length === 0 && <tr><td colSpan={7} className="py-2 text-navy-900/40">Aucune cotisation.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 pt-1">
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Nouvelle cotisation…"
              className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <Bouton variante="fantome" onClick={() => { const v = libelle.trim(); if (!v) return; run(() => api.creerCotisation(ecoleId, { libelle: v, ordre: cots.length })); setLibelle(""); }}>+ Ajouter</Bouton>
          </div>
        </div>

        {/* Barème IR — import */}
        <div className="rounded-xl border border-navy-900/10 bg-creme/40 p-4 space-y-2">
          <p className="text-sm font-semibold text-navy-900">Barème IR + TRIMF</p>
          <p className="text-xs text-navy-900/60">Chargé : <b>{bar.mensuel}</b> ligne(s) mensuelles · <b>{bar.annuel}</b> annuelles. La déduction est mensuelle ; régularisation annuelle en fin d'année.</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => choisirFichier(e.target.files?.[0] || null)}
            className="block w-full text-xs text-navy-900/70 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-xs file:text-navy-900 hover:file:bg-navy-900/10" />
          {feuilles.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              {["mensuel", "annuel"].map((per) => (
                <label key={per} className="block">
                  <span className="mb-1 block text-xs font-medium text-navy-900/50">Feuille {per}</span>
                  <select value={mapSheet[per]} onChange={(e) => setMapSheet((m) => ({ ...m, [per]: e.target.value }))}
                    className="rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-or-500">
                    <option value="">— ignorer —</option>
                    {feuilles.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              ))}
              <Bouton variante="or" onClick={importerBareme} disabled={importBusy}>{importBusy ? "Import…" : "Importer le barème"}</Bouton>
            </div>
          )}
          {importMsg && <p className="text-xs text-navy-900/70">{importMsg}</p>}
          <p className="text-xs text-navy-900/40">Format attendu : colonnes « Revenu brut », « TRIMF », puis « 1 part », « 1,5 parts »… (barème officiel).</p>
        </div>

        <div className="flex justify-end"><Bouton onClick={onFermer}>Terminé</Bouton></div>
      </div>
    </Modale>
  );
}
