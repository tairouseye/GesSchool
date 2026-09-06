import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Table } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/comptabilite.js";
import { MODES } from "@/lib/paiements.js";
import { urlSignee } from "@/lib/stockage.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const auj = () => new Date().toISOString().slice(0, 10);
const debutAnnee = () => `${new Date().getFullYear()}-01-01`;

export default function Comptabilite() {
  const { ecoleId, ecole, utilisateur } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [onglet, setOnglet] = useState("synthese");
  const [debut, setDebut] = useState(debutAnnee());
  const [fin, setFin] = useState(auj());

  const [soldes, setSoldes] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [scolarite, setScolarite] = useState(0);
  const [creances, setCreances] = useState(0);
  const [dettes, setDettes] = useState(0);
  const [cats, setCats] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(null); // 'compte' | 'recette' | 'depense' | 'categories' | 'piece'

  // Comptabilité générale (chargée à la demande)
  const [plan, setPlan] = useState([]);
  const [journaux, setJournaux] = useState([]);
  const [pieces, setPieces] = useState([]);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [sol, rec, dep, sco, cat, cre, det] = await Promise.all([
        api.getSoldes(ecoleId),
        api.getRecettes(ecoleId, { debut, fin }),
        api.getDepenses(ecoleId, { debut, fin }),
        api.getScolaritePeriode(ecoleId, debut, fin),
        api.getCategories(ecoleId).catch(() => []),
        api.getCreancesScolarite(ecoleId).catch(() => 0),
        api.getDettesPersonnel(ecoleId).catch(() => 0),
      ]);
      setSoldes(sol);
      setRecettes(rec);
      setDepenses(dep);
      setScolarite(sco);
      setCats(cat);
      setCreances(cre);
      setDettes(det);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId, debut, fin]);

  const catsActives = (sens) => cats.filter((c) => c.sens === sens && c.actif !== false);

  useEffect(() => { recharger(); }, [recharger]);

  // Comptabilité générale : plan comptable + journaux + journal des pièces,
  // chargés à l'ouverture des onglets concernés.
  const rechargerCompta = useCallback(async () => {
    try {
      const [pl, jx, pcs] = await Promise.all([
        api.getPlanComptable(ecoleId),
        api.getJournaux(ecoleId),
        api.getPieces(ecoleId, { debut, fin }),
      ]);
      setPlan(pl); setJournaux(jx); setPieces(pcs);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, debut, fin]);

  useEffect(() => {
    if (onglet === "plan" || onglet === "journal") rechargerCompta();
  }, [onglet, rechargerCompta]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
  };

  const totalRecettes = recettes.reduce((s, r) => s + Number(r.montant || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
  const tresorerie = soldes.reduce((s, c) => s + Number(c.solde || 0), 0);
  const soldeParType = (t) => soldes.filter((c) => c.type === t).reduce((s, c) => s + Number(c.solde || 0), 0);
  const soldeCaisse = soldeParType("caisse");
  const soldeBanque = soldeParType("banque");
  const soldeMobile = soldeParType("mobile");
  const salairesMois = depenses.filter((d) => d.categorie === "Salaires").reduce((s, d) => s + Number(d.montant || 0), 0);
  // Résultat de la période : (recettes saisies + scolarité encaissée) - dépenses.
  const resultat = totalRecettes + scolarite - totalDepenses;

  const actionBtn = {
    tresorerie: <Bouton onClick={() => setModale("compte")}>+ Compte</Bouton>,
    recettes: (
      <div className="flex gap-2">
        <Bouton variante="fantome" onClick={() => setModale("categories")}>Catégories</Bouton>
        <Bouton onClick={() => setModale("recette")} disabled={soldes.length === 0}>+ Recette</Bouton>
      </div>
    ),
    depenses: (
      <div className="flex gap-2">
        <Bouton variante="fantome" onClick={() => setModale("categories")}>Catégories</Bouton>
        <Bouton onClick={() => setModale("depense")} disabled={soldes.length === 0}>+ Dépense</Bouton>
      </div>
    ),
    journal: <Bouton onClick={() => setModale("piece")} disabled={journaux.length === 0}>+ Écriture</Bouton>,
  }[onglet];

  return (
    <>
      <EnTete titre="Comptabilité" sousTitre="Livre de caisse — trésorerie, recettes & dépenses" action={actionBtn} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Onglets */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-navy-900/5 p-1">
            {[["synthese", "Synthèse"], ["tresorerie", "Trésorerie"], ["recettes", "Recettes"], ["depenses", "Dépenses"], ["plan", "Plan comptable"], ["journal", "Journal"]].map(([k, l]) => (
              <button key={k} onClick={() => setOnglet(k)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
                {l}
              </button>
            ))}
          </div>
          {onglet !== "tresorerie" && onglet !== "plan" && (
            <div className="flex items-end gap-2">
              <Champ label="Du" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
              <Champ label="Au" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          )}
        </div>

        {onglet === "synthese" && (
          <Synthese
            devise={devise} tresorerie={tresorerie} scolarite={scolarite}
            soldeCaisse={soldeCaisse} soldeBanque={soldeBanque} soldeMobile={soldeMobile} salairesMois={salairesMois}
            creances={creances} dettes={dettes}
            totalRecettes={totalRecettes} totalDepenses={totalDepenses} resultat={resultat}
            recettes={recettes} depenses={depenses}
          />
        )}

        {onglet === "tresorerie" && (
          <Tresorerie soldes={soldes} devise={devise} onSuppr={async (id) => { if (await confirmer("Supprimer ce compte ?")) wrap(() => api.supprimerCompte(id), "Compte supprimé."); }} />
        )}

        {onglet === "recettes" && (
          <Mouvements
            type="recette" items={recettes} devise={devise}
            onSuppr={async (id) => { if (await confirmer("Supprimer cette recette ?")) wrap(() => api.supprimerRecette(id), "Recette supprimée."); }}
          />
        )}

        {onglet === "depenses" && (
          <Mouvements
            type="depense" items={depenses} devise={devise}
            onSuppr={async (id) => { if (await confirmer("Supprimer cette dépense ?")) wrap(() => api.supprimerDepense(id), "Dépense supprimée."); }}
          />
        )}

        {onglet === "plan" && <PlanComptable plan={plan} />}

        {onglet === "journal" && (
          <Journal
            pieces={pieces} devise={devise}
            onSuppr={async (id) => { if (await confirmer("Supprimer cette pièce ?")) { await wrap(() => api.supprimerPiece(id)); rechargerCompta(); } }}
          />
        )}
      </div>

      <ModaleCompte
        ouvert={modale === "compte"} onFermer={() => setModale(null)} devise={devise}
        onCreer={(c) => wrap(async () => { await api.creerCompte(ecoleId, c); setModale(null); })}
      />
      <ModaleMouvement
        ouvert={modale === "recette"} type="recette" onFermer={() => setModale(null)}
        ecoleId={ecoleId} comptes={soldes} devise={devise} categories={catsActives("recette")}
        onCreer={(m) => wrap(async () => { await api.creerRecette(ecoleId, m, utilisateur?.id); setModale(null); })}
      />
      <ModaleMouvement
        ouvert={modale === "depense"} type="depense" onFermer={() => setModale(null)}
        ecoleId={ecoleId} comptes={soldes} devise={devise} categories={catsActives("depense")}
        onCreer={(m) => wrap(async () => { await api.creerDepense(ecoleId, m, utilisateur?.id); setModale(null); })}
      />
      <ModaleCategories
        ouvert={modale === "categories"} onFermer={() => setModale(null)}
        ecoleId={ecoleId} cats={cats} onChange={recharger}
      />
      <ModaleSaisiePiece
        ouvert={modale === "piece"} onFermer={() => setModale(null)}
        journaux={journaux} plan={plan} devise={devise}
        onEnregistrer={async (p) => { const ok = await wrap(() => api.comptabiliserPiece(p), "Pièce comptabilisée."); if (ok) { setModale(null); rechargerCompta(); } return ok; }}
      />
    </>
  );
}

function Synthese({ devise, tresorerie, scolarite, soldeCaisse, soldeBanque, soldeMobile, salairesMois, creances, dettes, totalRecettes, totalDepenses, resultat, recettes, depenses }) {
  const parCategorie = (items) => {
    const m = {};
    for (const it of items) m[it.categorie || "Sans catégorie"] = (m[it.categorie || "Sans catégorie"] || 0) + Number(it.montant || 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const recettesMois = totalRecettes + scolarite;

  // Liste par catégorie avec barre de proportion (graphe simple).
  const listeCategorie = (items, couleur, vide) => {
    const cats = parCategorie(items);
    if (cats.length === 0) return <p className="text-sm text-navy-900/40">{vide}</p>;
    const max = Math.max(1, ...cats.map(([, v]) => v));
    return (
      <ul className="space-y-2.5">
        {cats.map(([cat, montant]) => (
          <li key={cat}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-900/70">{cat}</span>
              <span className="font-mono tabular-nums">{fmt(montant)} {devise}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900/5">
              <div className={`h-full ${couleur}`} style={{ width: `${(montant / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-5">
      {/* Trésorerie : caisse / banque / mobile / total */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCarte label="Caisse" valeur={fmt(soldeCaisse)} suffixe={devise} ton="navy" />
        <KpiCarte label="Banque" valeur={fmt(soldeBanque)} suffixe={devise} ton="navy" />
        {soldeMobile > 0
          ? <KpiCarte label="Mobile money" valeur={fmt(soldeMobile)} suffixe={devise} ton="navy" />
          : <KpiCarte label="Trésorerie totale" valeur={fmt(tresorerie)} suffixe={devise} ton="or" />}
        {soldeMobile > 0 && <KpiCarte label="Trésorerie totale" valeur={fmt(tresorerie)} suffixe={devise} ton="or" />}
      </div>

      {/* Activité de la période */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCarte label="Recettes (période)" valeur={fmt(recettesMois)} suffixe={devise} ton="vert"
          note={scolarite > 0 ? `dont scolarité ${fmt(scolarite)}` : null} />
        <KpiCarte label="Dépenses (période)" valeur={fmt(totalDepenses)} suffixe={devise} ton="rouge"
          note={salairesMois > 0 ? `dont salaires ${fmt(salairesMois)}` : null} />
        <KpiCarte label="Résultat (période)" valeur={fmt(resultat)} suffixe={devise} ton={resultat >= 0 ? "or" : "rouge"} />
        <KpiCarte label="Salaires (période)" valeur={fmt(salairesMois)} suffixe={devise} ton="navy" />
      </div>

      {/* À recevoir / à payer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCarte label="Créances — impayés scolarité" valeur={fmt(creances)} suffixe={devise} ton={creances > 0 ? "rouge" : "vert"} note="reste dû par les familles" />
        <KpiCarte label="Dettes — salaires à payer" valeur={fmt(dettes)} suffixe={devise} ton={dettes > 0 ? "rouge" : "vert"} note="bulletins validés non réglés" />
      </div>

      {/* Répartition par catégorie (barres) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte className="p-6">
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Dépenses par catégorie</h3>
          {listeCategorie(depenses, "bg-rose-500/70", "Aucune dépense sur la période.")}
        </Carte>
        <Carte className="p-6">
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Recettes par catégorie</h3>
          {listeCategorie(recettes, "bg-emerald-500/70", "Aucune recette saisie sur la période.")}
          <p className="mt-3 border-t border-navy-900/10 pt-2 text-xs text-navy-900/40">
            La scolarité encaissée ({fmt(scolarite)} {devise}) provient du module Paiements et n'est pas listée ici.
          </p>
        </Carte>
      </div>
    </div>
  );
}

function KpiCarte({ label, valeur, suffixe, ton, note }) {
  const tons = { navy: "text-navy-900", vert: "text-emerald-700", rouge: "text-rose-600", or: "text-or-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tons[ton] || tons.navy}`}>
        {valeur}<span className="ml-1 text-sm font-normal text-navy-900/40">{suffixe}</span>
      </p>
      {note && <p className="mt-1 text-xs text-navy-900/40">{note}</p>}
    </Carte>
  );
}

function Tresorerie({ soldes, devise, onSuppr }) {
  const typeLabel = (t) => (api.TYPES_COMPTE.find((x) => x[0] === t) || [])[1] || t;
  if (soldes.length === 0) {
    return <EtatVide icone="🏦" titre="Aucun compte">Créez votre caisse ou banque avec « + Compte ».</EtatVide>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {soldes.map((c) => (
        <Carte key={c.id} className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-navy-900">{c.libelle}</p>
              <p className="text-xs text-navy-900/40">{typeLabel(c.type)}{c.numero ? ` · ${c.numero}` : ""}</p>
            </div>
            <button onClick={() => onSuppr(c.id)} className="text-xs text-rose-500 hover:underline">supprimer</button>
          </div>
          <p className="mt-4 font-display text-2xl font-bold text-navy-900">{fmt(c.solde)} <span className="text-sm font-normal text-navy-900/40">{devise}</span></p>
          <div className="mt-3 flex justify-between border-t border-navy-900/10 pt-2 text-xs text-navy-900/50">
            <span>Initial {fmt(c.solde_initial)}</span>
            <span className="text-emerald-700">+{fmt(c.entrees)}</span>
            <span className="text-rose-600">−{fmt(c.sorties)}</span>
          </div>
        </Carte>
      ))}
    </div>
  );
}

function Mouvements({ type, items, devise, onSuppr }) {
  const champDate = type === "recette" ? "date_recette" : "date_depense";
  const champTiers = type === "recette" ? "source" : "beneficiaire";
  const tiersLabel = type === "recette" ? "Source" : "Bénéficiaire";
  if (items.length === 0) {
    return <EtatVide icone="💰" titre={`Aucune ${type}`}>Rien sur la période sélectionnée.</EtatVide>;
  }
  return (
    <Table
      keyField="id"
      rows={items}
      columns={[
        { key: "date", label: "Date", render: (it) => <span className="font-mono text-xs">{it[champDate]}</span> },
        { key: "libelle", label: "Libellé", render: (it) => <span className="font-medium text-navy-900">{it.libelle}</span> },
        { key: "categorie", label: "Catégorie", hideMobile: true, render: (it) => <span className="text-navy-900/60">{it.categorie || "—"}</span> },
        { key: "tiers", label: tiersLabel, hideMobile: true, render: (it) => <span className="text-navy-900/60">{it[champTiers] || "—"}</span> },
        { key: "compte", label: "Compte", hideMobile: true, render: (it) => <span className="text-navy-900/60">{it.comptes?.libelle || "—"}</span> },
        { key: "montant", label: "Montant", align: "right", render: (it) => (
          <span className={type === "recette" ? "text-success-600" : "text-danger-600"}>
            {type === "recette" ? "+" : "−"}{fmt(it.montant)} {devise}
          </span>
        ) },
        { key: "actions", label: "", align: "right", render: (it) => (
          <div className="flex items-center justify-end gap-3">
            {it.justificatif_url && (
              <button onClick={async () => { const u = await urlSignee("justificatifs", it.justificatif_url); if (u) window.open(u, "_blank", "noreferrer"); }}
                className="text-xs text-navy-700 hover:text-or-500" title="Voir le justificatif">📎 reçu</button>
            )}
            <button onClick={() => onSuppr(it.id)} className="text-xs text-danger-500 hover:underline">suppr.</button>
          </div>
        ) },
      ]}
    />
  );
}

function ModaleCompte({ ouvert, onFermer, devise, onCreer }) {
  const vide = { libelle: "", type: "caisse", numero: "", solde_initial: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouveau compte de trésorerie">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.libelle.trim()) return; onCreer(f); setF(vide); }}>
        <Champ label="Libellé *" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="Caisse principale, Banque CBAO…" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
            <select value={f.type} onChange={(e) => maj("type", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {api.TYPES_COMPTE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <Champ label={`Solde initial (${devise})`} value={f.solde_initial}
            onChange={(e) => maj("solde_initial", e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" />
        </div>
        <Champ label="N° de compte (optionnel)" value={f.numero} onChange={(e) => maj("numero", e.target.value)} />
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Créer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleMouvement({ ouvert, type, onFermer, ecoleId, comptes, devise, categories, onCreer }) {
  const champDate = type === "recette" ? "date_recette" : "date_depense";
  const champTiers = type === "recette" ? "source" : "beneficiaire";
  const tiersLabel = type === "recette" ? "Source" : "Bénéficiaire";
  // Catégories configurées (objets {id, libelle}) ou repli sur les constantes.
  const cats = (categories && categories.length)
    ? categories
    : (type === "recette" ? api.CATEGORIES_RECETTE : api.CATEGORIES_DEPENSE).map((l) => ({ libelle: l }));
  const vide = { libelle: "", montant: "", categorie: "", mode: "", compte_id: "", [champTiers]: "", [champDate]: auj() };
  const [f, setF] = useState(vide);
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurFichier, setErreurFichier] = useState("");
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function soumettre(e) {
    e.preventDefault();
    if (!f.libelle.trim() || !f.montant) return;
    setEnCours(true);
    setErreurFichier("");
    try {
      let justificatif_url = null;
      if (fichier) justificatif_url = await api.televerserJustificatif(ecoleId, fichier);
      const cat = cats.find((c) => c.libelle === f.categorie);
      onCreer({ ...f, categorie_id: cat?.id || null, justificatif_url });
      setF(vide);
      setFichier(null);
    } catch (err) {
      setErreurFichier(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={type === "recette" ? "Nouvelle recette" : "Nouvelle dépense"} large>
      <form className="space-y-4" onSubmit={soumettre}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Libellé *" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder={type === "recette" ? "Don, location salle…" : "Achat fournitures…"} />
          <Champ label={`Montant (${devise}) *`} value={f.montant} onChange={(e) => maj("montant", e.target.value.replace(/[^0-9]/g, ""))} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Catégorie</span>
            <select value={f.categorie} onChange={(e) => maj("categorie", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {cats.map((c) => <option key={c.id || c.libelle} value={c.libelle}>{c.libelle}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Compte</span>
            <select value={f.compte_id} onChange={(e) => maj("compte_id", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Mode</span>
            <select value={f.mode} onChange={(e) => maj("mode", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">—</option>
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label={tiersLabel} value={f[champTiers]} onChange={(e) => maj(champTiers, e.target.value)} />
          <Champ label="Date" type="date" value={f[champDate]} onChange={(e) => maj(champDate, e.target.value)} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Justificatif (facture, reçu — image ou PDF)</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="block w-full text-sm text-navy-900/70 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm file:text-navy-900 hover:file:bg-navy-900/10"
          />
          {fichier && <span className="mt-1 block text-xs text-navy-900/50">{fichier.name}</span>}
          {erreurFichier && <span className="mt-1 block text-xs text-rose-500">{erreurFichier}</span>}
        </label>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" variante={type === "recette" ? "primaire" : "or"} disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

// Gestionnaire de catégories (par école) — recettes & dépenses. Mobile-first :
// une liste par sens, renommage en ligne, activation, suppression, ajout.
function ModaleCategories({ ouvert, onFermer, ecoleId, cats, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [ajout, setAjout] = useState({ recette: "", depense: "" });

  const run = async (fn) => {
    try { await fn(); await onChange(); }
    catch (e) { toast.erreur(e.message || "Erreur."); }
  };

  // Fonction (pas un composant <Section/>) pour éviter tout remontage du champ
  // d'ajout à chaque frappe (perte de focus).
  const renderSection = (sens, titre) => {
    const liste = cats.filter((c) => c.sens === sens).sort((a, b) => (a.ordre - b.ordre) || a.libelle.localeCompare(b.libelle));
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-navy-900">{titre}</p>
        <ul className="space-y-1.5">
          {liste.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                defaultValue={c.libelle}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.libelle) run(() => api.modifierCategorie(c.id, { libelle: v })); }}
                className={`flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500 ${c.actif === false ? "text-navy-900/40 line-through" : ""}`}
              />
              <button type="button" onClick={() => run(() => api.modifierCategorie(c.id, { actif: !(c.actif !== false) }))}
                className="rounded-lg border border-navy-900/10 px-2 py-1.5 text-xs text-navy-900/60 hover:bg-navy-900/5"
                title={c.actif === false ? "Réactiver" : "Désactiver"}>{c.actif === false ? "activer" : "masquer"}</button>
              <button type="button" onClick={async () => { if (await confirmer(`Supprimer la catégorie « ${c.libelle} » ? Les opérations existantes gardent leur libellé.`)) run(() => api.supprimerCategorie(c.id)); }}
                className="rounded-lg border border-danger-500/20 px-2 py-1.5 text-xs text-danger-500 hover:bg-danger-500/5">suppr.</button>
            </li>
          ))}
          {liste.length === 0 && <li className="text-xs text-navy-900/40">Aucune catégorie.</li>}
        </ul>
        <div className="flex gap-2 pt-1">
          <input value={ajout[sens]} onChange={(e) => setAjout((a) => ({ ...a, [sens]: e.target.value }))}
            placeholder="Nouvelle catégorie…" className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
          <Bouton variante="fantome" onClick={() => { const v = ajout[sens].trim(); if (!v) return; run(() => api.creerCategorie(ecoleId, { sens, libelle: v, ordre: liste.length })); setAjout((a) => ({ ...a, [sens]: "" })); }}>
            + Ajouter
          </Bouton>
        </div>
      </div>
    );
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Catégories financières" large>
      <div className="space-y-6">
        <p className="text-xs text-navy-900/50">
          Définis les catégories de recettes et de dépenses de ton école. « Masquer » retire une catégorie des choix sans toucher aux opérations déjà enregistrées.
        </p>
        {renderSection("recette", "Recettes")}
        {renderSection("depense", "Dépenses")}
        <div className="flex justify-end">
          <Bouton onClick={onFermer}>Terminé</Bouton>
        </div>
      </div>
    </Modale>
  );
}

// ---------------------------------------------------------------------
// Comptabilité générale (étape 2) : plan comptable, journal, saisie pièce
// ---------------------------------------------------------------------

const CLASSES_LIB = {
  1: "Classe 1 — Ressources durables",
  2: "Classe 2 — Immobilisations",
  3: "Classe 3 — Stocks",
  4: "Classe 4 — Tiers",
  5: "Classe 5 — Trésorerie",
  6: "Classe 6 — Charges",
  7: "Classe 7 — Produits",
  8: "Classe 8 — Autres",
};
const selCls = "w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500";

function PlanComptable({ plan }) {
  if (!plan.length) return <EtatVide icone="📚" titre="Plan comptable vide">Le plan comptable SYSCOHADA est amorcé à l'installation.</EtatVide>;
  const profondeur = (c) => plan.filter((p) => c.numero.startsWith(p.numero) && p.numero.length < c.numero.length).length;
  const classes = [...new Set(plan.map((c) => c.classe))].sort();
  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-900/50">Plan comptable de l'école (modèle SYSCOHADA). Les rubriques en gras regroupent les comptes ; seuls les comptes imputables reçoivent des écritures.</p>
      {classes.map((cl) => (
        <Carte key={cl}>
          <h3 className="mb-2 font-semibold text-navy-900">{CLASSES_LIB[cl] || `Classe ${cl}`}</h3>
          <div className="divide-y divide-navy-900/5">
            {plan.filter((c) => c.classe === cl).map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5 text-sm" style={{ paddingLeft: `${profondeur(c) * 16}px` }}>
                <span className="w-16 shrink-0 font-mono text-navy-900/60">{c.numero}</span>
                <span className={c.imputable ? "text-navy-900" : "font-semibold text-navy-900"}>{c.libelle}</span>
                {!c.actif && <span className="rounded bg-navy-900/5 px-1.5 py-0.5 text-xs text-navy-900/40">inactif</span>}
              </div>
            ))}
          </div>
        </Carte>
      ))}
    </div>
  );
}

function Journal({ pieces, devise, onSuppr }) {
  if (!pieces.length) return <EtatVide icone="📒" titre="Aucune écriture">Enregistrez une pièce avec « + Écriture », ou attendez les écritures générées par les opérations (étapes suivantes).</EtatVide>;
  return (
    <div className="space-y-3">
      {pieces.map((p) => {
        const totalD = (p.lignes || []).reduce((s, l) => s + Number(l.debit || 0), 0);
        return (
          <Carte key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-navy-900">{p.numero}</span>
                  <span className="rounded bg-navy-900/5 px-1.5 py-0.5 text-xs text-navy-900/60">{p.journal?.code}</span>
                  {p.source_type !== "manuel" && <span className="rounded bg-or-500/10 px-1.5 py-0.5 text-xs text-or-700">auto · {p.source_type}</span>}
                  {p.statut === "annulee" && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-600">annulée</span>}
                </div>
                <div className="mt-0.5 text-sm text-navy-900">{p.libelle}</div>
                <div className="text-xs text-navy-900/50">{p.date_piece}{p.reference ? ` · réf. ${p.reference}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-navy-900">{fmt(totalD)} {devise}</div>
                {p.source_type === "manuel" && (
                  <button onClick={() => onSuppr(p.id)} className="mt-1 text-xs text-red-600 hover:underline">Supprimer</button>
                )}
              </div>
            </div>
            <div className="mt-2 divide-y divide-navy-900/5 border-t border-navy-900/5 pt-1">
              {(p.lignes || []).map((l) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 py-1 text-xs">
                  <span className="col-span-2 font-mono text-navy-900/60">{l.compte?.numero}</span>
                  <span className="col-span-6 text-navy-900/80">{l.compte?.libelle}{l.libelle && l.libelle !== p.libelle ? ` — ${l.libelle}` : ""}</span>
                  <span className="col-span-2 text-right tabular-nums text-navy-900/80">{Number(l.debit) ? fmt(l.debit) : ""}</span>
                  <span className="col-span-2 text-right tabular-nums text-navy-900/80">{Number(l.credit) ? fmt(l.credit) : ""}</span>
                </div>
              ))}
            </div>
          </Carte>
        );
      })}
    </div>
  );
}

function ModaleSaisiePiece({ ouvert, onFermer, journaux, plan, devise, onEnregistrer }) {
  const ligneVide = { compte: "", libelle: "", debit: "", credit: "" };
  const [journalId, setJournalId] = useState("");
  const [date, setDate] = useState(auj());
  const [libelle, setLibelle] = useState("");
  const [reference, setReference] = useState("");
  const [lignes, setLignes] = useState([{ ...ligneVide }, { ...ligneVide }]);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (ouvert) {
      setJournalId(journaux[0]?.id || ""); setDate(auj()); setLibelle(""); setReference("");
      setLignes([{ ...ligneVide }, { ...ligneVide }]);
    }
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const imputables = plan.filter((c) => c.imputable && c.actif);
  const majLigne = (i, champ, val) => setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, [champ]: val } : l)));
  const num = (v) => v.replace(/[^0-9]/g, "");
  const sumD = lignes.reduce((s, l) => s + Number(l.debit || 0), 0);
  const sumC = lignes.reduce((s, l) => s + Number(l.credit || 0), 0);
  const equilibre = sumD === sumC && sumD > 0;
  const valides = lignes.filter((l) => l.compte && (Number(l.debit) > 0 || Number(l.credit) > 0));
  const pretPour = journalId && equilibre && valides.length >= 2;

  const soumettre = async (e) => {
    e.preventDefault();
    if (!pretPour || enCours) return;
    setEnCours(true);
    await onEnregistrer({
      journalId, date, libelle: libelle.trim() || "Écriture", reference: reference.trim() || null,
      lignes: valides.map((l) => ({
        compte: l.compte, libelle: l.libelle.trim() || null,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0),
      })),
    });
    setEnCours(false);
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle écriture (opérations diverses)" large>
      <form className="space-y-4" onSubmit={soumettre}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Journal *</span>
            <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className={selCls}>
              {journaux.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>)}
            </select>
          </label>
          <Champ label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Champ label="Référence" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° facture, reçu…" />
        </div>
        <Champ label="Libellé *" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Objet de l'opération" />

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-navy-900/40">
            <span className="col-span-5">Compte</span>
            <span className="col-span-3">Libellé</span>
            <span className="col-span-2 text-right">Débit</span>
            <span className="col-span-2 text-right">Crédit</span>
          </div>
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select value={l.compte} onChange={(e) => majLigne(i, "compte", e.target.value)} className={`col-span-5 ${selCls}`}>
                <option value="">— compte —</option>
                {imputables.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.libelle}</option>)}
              </select>
              <input value={l.libelle} onChange={(e) => majLigne(i, "libelle", e.target.value)} placeholder="(optionnel)" className={`col-span-3 ${selCls}`} />
              <input value={l.debit} onChange={(e) => { const v = num(e.target.value); majLigne(i, "debit", v); if (v) majLigne(i, "credit", ""); }} inputMode="numeric" className={`col-span-2 text-right ${selCls}`} />
              <div className="col-span-2 flex items-center gap-1">
                <input value={l.credit} onChange={(e) => { const v = num(e.target.value); majLigne(i, "credit", v); if (v) majLigne(i, "debit", ""); }} inputMode="numeric" className={`flex-1 text-right ${selCls}`} />
                {lignes.length > 2 && (
                  <button type="button" onClick={() => setLignes((ls) => ls.filter((_, k) => k !== i))} className="text-navy-900/30 hover:text-red-600" title="Retirer">✕</button>
                )}
              </div>
            </div>
          ))}
          <Bouton type="button" variante="fantome" onClick={() => setLignes((ls) => [...ls, { ...ligneVide }])}>+ Ligne</Bouton>
        </div>

        <div className={`flex items-center justify-between rounded-xl border p-3 text-sm ${equilibre ? "border-green-500/30 bg-green-500/5" : "border-navy-900/10 bg-navy-900/5"}`}>
          <span className="font-medium text-navy-900/70">Totaux</span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>Débit <b>{fmt(sumD)}</b></span>
            <span>Crédit <b>{fmt(sumC)}</b></span>
            <span className={equilibre ? "font-semibold text-green-700" : "font-semibold text-navy-900/50"}>
              {equilibre ? "✓ Équilibré" : `Écart ${fmt(Math.abs(sumD - sumC))} ${devise}`}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!pretPour || enCours}>{enCours ? "Enregistrement…" : "Comptabiliser"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
