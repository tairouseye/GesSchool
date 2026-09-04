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
  const [bulletin, setBulletin] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [signataires, setSignataires] = useState([]);
  // Compte de trésorerie + mode utilisés pour régler les salaires de la période.
  const [reglement, setReglement] = useState({ compte_id: "", mode: "" });

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [pers, con, sig, nbEns] = await Promise.all([api.getPersonnels(ecoleId), api.getContratsActifs(ecoleId), getSignataires(ecoleId), api.compterEnseignantsNonImportes(ecoleId).catch(() => 0)]);
      setPersonnels(pers);
      setContrats(con);
      setSignataires(sig);
      setNbEnsNonImportes(nbEns);
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
    : <Bouton onClick={() => wrap(async () => { await api.genererPaie(ecoleId, periode); }, true)} disabled={personnels.length === 0}>⚡ Générer les fiches</Bouton>;

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
            onMaj={(ligne, v) => wrap(async () => {
              if (ligne._nouveau) await api.ajouterFichePaie(ecoleId, ligne.personnel_id, periode, v);
              else await api.majSalaire(ligne.id, v);
            }, true)}
            onPayer={(ligne, v) => wrap(async () => {
              let id = ligne.id;
              if (ligne._nouveau) { const s = await api.ajouterFichePaie(ecoleId, ligne.personnel_id, periode, v); id = s.id; }
              await api.marquerPaye(id, { compte_id: reglement.compte_id, mode: reglement.mode });
            }, true)}
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

function PanneauPaie({ periode, setPeriode, salaires, personnels, contrats, devise, ecole, comptes, reglement, setReglement, onMaj, onPayer, onAnnuler, onSuppr, onBulletin }) {
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
                <th className="px-4 py-3 text-right font-medium">Salaire de base</th>
                <th className="px-4 py-3 text-right font-medium">Prime</th>
                <th className="px-4 py-3 text-right font-medium">Retenue</th>
                <th className="px-4 py-3 text-right font-medium">Net à payer</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {toutes.map((s) => (
                <LignePaie key={s.id} s={s} devise={devise}
                  onMaj={onMaj} onPayer={onPayer} onAnnuler={onAnnuler} onSuppr={onSuppr} onBulletin={onBulletin} />
              ))}
            </tbody>
          </table>
        </Carte>
      )}
    </div>
  );
}

function LignePaie({ s, devise, onMaj, onPayer, onAnnuler, onSuppr, onBulletin }) {
  const [brut, setBrut] = useState(String(s.montant_brut ?? 0));
  const [prime, setPrime] = useState(String(s.prime ?? 0));
  const [retenue, setRetenue] = useState(String(s.retenue ?? 0));
  const net = (Number(brut) || 0) + (Number(prime) || 0) - (Number(retenue) || 0);
  const champNum = "w-24 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500 disabled:bg-navy-900/5";

  // L'édition reste possible même après paiement : le net est recalculé et la
  // dépense comptable liée est resynchronisée (cf. majSalaire → RPC maj_salaire).
  const elements = { montant_brut: brut, prime, retenue };
  const commit = () => {
    if (Number(brut) !== Number(s.montant_brut) || Number(prime) !== Number(s.prime) || Number(retenue) !== Number(s.retenue)) {
      onMaj(s, elements);
    }
  };

  return (
    <tr className="border-t border-navy-900/5">
      <td className="px-4 py-3">
        <p className="font-medium text-navy-900">{s.personnels?.prenom} {s.personnels?.nom}</p>
        <p className="text-xs text-navy-900/40">{s.personnels?.fonction || ""}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <input value={brut} onChange={(e) => setBrut(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right">
        <input value={prime} onChange={(e) => setPrime(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right">
        <input value={retenue} onChange={(e) => setRetenue(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-navy-900">{fmt(net)}</td>
      <td className="px-4 py-3">
        {s.paye
          ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Payé</span>
          : s._nouveau
            ? <span className="rounded-full bg-or-500/10 px-2.5 py-0.5 text-xs font-medium text-or-700">À générer</span>
            : <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/60">À payer</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3 text-xs">
          <button onClick={() => onBulletin(s)} className="text-navy-700 hover:text-or-500">bulletin</button>
          {s.paye
            ? <button onClick={() => onAnnuler(s.id)} className="text-navy-900/50 hover:underline">annuler</button>
            : <button onClick={() => onPayer(s, elements)} className="font-medium text-emerald-700 hover:underline">payer</button>}
          {!s.paye && !s._nouveau && <button onClick={() => onSuppr(s.id)} className="text-rose-500 hover:underline">suppr.</button>}
        </div>
      </td>
    </tr>
  );
}

function ModalePersonnel({ edition, onFermer, onEnregistrer }) {
  const vide = {
    prenom: "", nom: "", fonction: "Enseignant", telephone: "", email: "", date_embauche: "",
    type: "CDI", salaire_base: "", debut: "", fin: "",
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
    });
  }, [edition]);

  return (
    <Modale ouvert={!!edition} onFermer={onFermer} titre={enEdition ? "Modifier le personnel" : "Nouveau personnel"} large>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!f.prenom.trim() || !f.nom.trim()) return;
        onEnregistrer(
          { prenom: f.prenom.trim(), nom: f.nom.trim(), fonction: f.fonction, telephone: f.telephone, email: f.email, date_embauche: f.debut || f.date_embauche || null },
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

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleBulletin({ bulletin, onFermer, ecole, devise }) {
  if (!bulletin) return null;
  const net = Number(bulletin.montant_net || 0);
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

          <table className="mt-5 w-full text-left text-sm">
            <tbody>
              <LigneB l="Salaire de base" v={`${fmt(bulletin.montant_brut)} ${devise}`} />
              <LigneB l="Primes / indemnités" v={`+ ${fmt(bulletin.prime)} ${devise}`} />
              <LigneB l="Retenues" v={`− ${fmt(bulletin.retenue)} ${devise}`} />
            </tbody>
          </table>
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
