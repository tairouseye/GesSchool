import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import * as api from "@/lib/paiements.js";
import { getEleves } from "@/lib/eleves.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export default function Paiements() {
  const { ecoleId, ecole, utilisateur } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [onglet, setOnglet] = useState("factures");
  const [annee, setAnnee] = useState(null);
  const [factures, setFactures] = useState([]);
  const [frais, setFrais] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [modaleNouvelle, setModaleNouvelle] = useState(false);
  const [factureId, setFactureId] = useState(null);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [fac, fr, els] = await Promise.all([
        api.getFactures(ecoleId, an?.id),
        api.getFrais(ecoleId, an?.id),
        getEleves(ecoleId),
      ]);
      setFactures(fac);
      setFrais(fr);
      setEleves(els);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const facturesFiltrees = factures.filter((f) => {
    const q = recherche.toLowerCase();
    const nom = `${f.eleves?.prenom || ""} ${f.eleves?.nom || ""}`.toLowerCase();
    return !q || nom.includes(q) || (f.numero || "").toLowerCase().includes(q);
  });

  return (
    <>
      <EnTete
        titre="Paiements"
        sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={
          onglet === "factures" && (
            <Bouton onClick={() => setModaleNouvelle(true)} disabled={eleves.length === 0}>
              + Nouvelle facture
            </Bouton>
          )
        }
      />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Onglets */}
        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["factures", "Factures"], ["frais", "Grille tarifaire"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {onglet === "factures" ? (
          <Carte className="overflow-hidden">
            <div className="border-b border-navy-900/10 p-4">
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher (élève, n° facture)…"
                className="w-full max-w-md rounded-xl border border-navy-900/15 bg-creme px-4 py-2 text-sm outline-none focus:border-or-500"
              />
            </div>
            {facturesFiltrees.length === 0 ? (
              <p className="p-8 text-sm text-navy-900/50">
                {factures.length === 0 ? "Aucune facture. Créez-en une avec « + Nouvelle facture »." : "Aucun résultat."}
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-creme text-navy-900/50">
                  <tr>
                    <th className="px-6 py-3 font-medium">N°</th>
                    <th className="px-6 py-3 font-medium">Élève</th>
                    <th className="px-6 py-3 font-medium">Échéance</th>
                    <th className="px-6 py-3 text-right font-medium">Total</th>
                    <th className="px-6 py-3 text-right font-medium">Payé</th>
                    <th className="px-6 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {facturesFiltrees.map((f) => {
                    const s = api.STATUTS[f.statut] || api.STATUTS.emise;
                    return (
                      <tr key={f.id} onClick={() => setFactureId(f.id)} className="cursor-pointer border-t border-navy-900/5 hover:bg-creme/60">
                        <td className="px-6 py-3 font-mono text-xs text-navy-900/70">{f.numero}</td>
                        <td className="px-6 py-3 font-medium text-navy-900">{f.eleves?.prenom} {f.eleves?.nom}</td>
                        <td className="px-6 py-3 font-mono text-xs">{f.date_echeance || "—"}</td>
                        <td className="px-6 py-3 text-right font-mono">{fmt(f.montant_total)}</td>
                        <td className="px-6 py-3 text-right font-mono">{fmt(f.montant_paye)}</td>
                        <td className="px-6 py-3"><Pastille ton={s.ton}>{s.label}</Pastille></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Carte>
        ) : (
          <PanneauFrais
            ecoleId={ecoleId} annee={annee} frais={frais} devise={devise}
            onChange={recharger} onErreur={setErreur}
          />
        )}
      </div>

      <ModaleNouvelleFacture
        ouvert={modaleNouvelle}
        onFermer={() => setModaleNouvelle(false)}
        ecoleId={ecoleId} annee={annee} eleves={eleves} frais={frais} devise={devise}
        onCree={() => { setModaleNouvelle(false); recharger(); }}
        onErreur={setErreur}
      />

      <ModaleFacture
        factureId={factureId}
        onFermer={() => setFactureId(null)}
        ecoleId={ecoleId} ecole={ecole} devise={devise} utilisateur={utilisateur}
        onChange={recharger}
      />
    </>
  );
}

function Pastille({ children, ton }) {
  const tons = {
    or: "bg-or-500/15 text-or-600 border-or-500/30",
    vert: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    rouge: "bg-rose-500/10 text-rose-700 border-rose-500/30",
    navy: "bg-navy-900/5 text-navy-900/70 border-navy-900/15",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tons[ton]}`}>{children}</span>;
}

function PanneauFrais({ ecoleId, annee, frais, devise, onChange, onErreur }) {
  const [f, setF] = useState({ libelle: "", montant: "", recurrent: false });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Grille tarifaire</h3>
      <div className="space-y-2">
        {frais.length === 0 && <p className="text-sm text-navy-900/40">Aucun frais défini.</p>}
        {frais.map((fr) => (
          <div key={fr.id} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-3">
            <div>
              <span className="font-medium text-navy-900">{fr.libelle}</span>
              {fr.recurrent && <span className="ml-2 text-xs text-or-500">mensuel</span>}
              {fr.niveaux?.libelle && <span className="ml-2 text-xs text-navy-900/40">({fr.niveaux.libelle})</span>}
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm">{fmt(fr.montant)} {devise}</span>
              <button onClick={async () => { try { await api.supprimerFrais(fr.id); onChange(); } catch (e) { onErreur(e.message); } }}
                className="text-xs text-rose-500 hover:underline">supprimer</button>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.libelle.trim() || !f.montant) return;
          try {
            await api.creerFrais(ecoleId, {
              libelle: f.libelle.trim(), montant: Number(f.montant),
              recurrent: f.recurrent, annee_id: annee?.id || null,
            });
            setF({ libelle: "", montant: "", recurrent: false });
            onChange();
          } catch (er) { onErreur(er.message); }
        }}
      >
        <div className="min-w-48 flex-1"><Champ label="Libellé" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="Scolarité, Inscription…" /></div>
        <div className="w-36"><Champ label={`Montant (${devise})`} value={f.montant} onChange={(e) => maj("montant", e.target.value.replace(/[^0-9]/g, ""))} /></div>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.recurrent} onChange={(e) => maj("recurrent", e.target.checked)} /> Mensuel
        </label>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}

function ModaleNouvelleFacture({ ouvert, onFermer, ecoleId, annee, eleves, frais, devise, onCree, onErreur }) {
  const [eleveId, setEleveId] = useState("");
  const [echeance, setEcheance] = useState("");
  const [lignes, setLignes] = useState([{ libelle: "", quantite: "1", prix_unitaire: "", frais_id: "" }]);
  const [enCours, setEnCours] = useState(false);

  const total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const majLigne = (i, patch) => setLignes((s) => s.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ajouterLigne = () => setLignes((s) => [...s, { libelle: "", quantite: "1", prix_unitaire: "", frais_id: "" }]);
  const retirerLigne = (i) => setLignes((s) => s.filter((_, j) => j !== i));

  function choisirFrais(i, fraisId) {
    const fr = frais.find((x) => x.id === fraisId);
    majLigne(i, fr ? { frais_id: fr.id, libelle: fr.libelle, prix_unitaire: String(fr.montant) } : { frais_id: "" });
  }

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    onErreur("");
    try {
      const valides = lignes.filter((l) => l.libelle.trim() && l.prix_unitaire);
      if (!eleveId || valides.length === 0) throw new Error("Choisissez un élève et au moins une ligne.");
      await api.creerFacture(ecoleId, { eleve_id: eleveId, annee_id: annee?.id, date_echeance: echeance, lignes: valides });
      setEleveId(""); setEcheance(""); setLignes([{ libelle: "", quantite: "1", prix_unitaire: "", frais_id: "" }]);
      onCree();
    } catch (er) {
      onErreur(er.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvelle facture" large>
      <form onSubmit={soumettre} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élève *</span>
            <select value={eleveId} onChange={(e) => setEleveId(e.target.value)} required
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {eleves.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.matricule}</option>)}
            </select>
          </label>
          <Champ label="Échéance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-navy-900/70">Lignes</p>
          {lignes.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <select value={l.frais_id} onChange={(e) => choisirFrais(i, e.target.value)}
                className="w-40 rounded-lg border border-navy-900/15 bg-white px-2 py-2 text-xs outline-none focus:border-or-500">
                <option value="">Frais…</option>
                {frais.map((fr) => <option key={fr.id} value={fr.id}>{fr.libelle}</option>)}
              </select>
              <input value={l.libelle} onChange={(e) => majLigne(i, { libelle: e.target.value })} placeholder="Libellé"
                className="flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
              <input value={l.quantite} onChange={(e) => majLigne(i, { quantite: e.target.value.replace(/[^0-9]/g, "") })}
                className="w-14 rounded-lg border border-navy-900/15 bg-white px-2 py-2 text-center text-sm outline-none focus:border-or-500" />
              <input value={l.prix_unitaire} onChange={(e) => majLigne(i, { prix_unitaire: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Prix" className="w-28 rounded-lg border border-navy-900/15 bg-white px-2 py-2 text-right font-mono text-sm outline-none focus:border-or-500" />
              <button type="button" onClick={() => retirerLigne(i)} className="pb-2 text-navy-900/30 hover:text-rose-500">✕</button>
            </div>
          ))}
          <button type="button" onClick={ajouterLigne} className="text-sm text-navy-700 hover:text-or-500">+ Ajouter une ligne</button>
        </div>

        <div className="flex items-center justify-between border-t border-navy-900/10 pt-3">
          <span className="text-sm text-navy-900/50">Total</span>
          <span className="font-display text-xl font-bold text-navy-900">{fmt(total)} {devise}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={enCours}>{enCours ? "…" : "Créer la facture"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleFacture({ factureId, onFermer, ecoleId, ecole, devise, utilisateur, onChange }) {
  const [facture, setFacture] = useState(null);
  const [pay, setPay] = useState({ montant: "", mode: "wave", reference: "", date_paiement: "" });
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    if (!factureId) { setFacture(null); return; }
    try {
      const f = await api.getFacture(factureId);
      setFacture(f);
      const reste = (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0);
      setPay((p) => ({ ...p, montant: reste > 0 ? String(Math.round(reste)) : "" }));
    } catch (e) { setErreur(e.message); }
  }, [factureId]);

  useEffect(() => { setErreur(""); recharger(); }, [recharger]);

  if (!factureId) return null;
  const reste = facture ? (Number(facture.montant_total) || 0) - (Number(facture.montant_paye) || 0) : 0;
  const s = facture ? (api.STATUTS[facture.statut] || api.STATUTS.emise) : null;

  async function encaisser(e) {
    e.preventDefault();
    setErreur("");
    try {
      if (!pay.montant) throw new Error("Montant requis.");
      await api.encaisser(ecoleId, facture.id, pay, utilisateur?.id);
      setPay((p) => ({ ...p, reference: "" }));
      await recharger();
      onChange();
    } catch (er) { setErreur(er.message); }
  }

  return (
    <Modale ouvert={!!factureId} onFermer={onFermer} titre={facture ? `Facture ${facture.numero}` : "Facture"} large>
      {!facture ? (
        <p className="text-sm text-navy-900/50">Chargement…</p>
      ) : (
        <div className="space-y-5">
          <Alerte ton="erreur">{erreur}</Alerte>

          {/* Reçu imprimable */}
          <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Cachet size={48} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />
                <div>
                  <p className="font-display text-lg font-bold text-navy-900">{ecole?.nom}</p>
                  <p className="text-xs text-navy-900/50">Reçu / Facture {facture.numero}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-navy-900">{facture.eleves?.prenom} {facture.eleves?.nom}</p>
                <p className="font-mono text-xs text-navy-900/50">{facture.eleves?.matricule}</p>
                <p className="text-xs text-navy-900/40">Émise {facture.date_emission}</p>
              </div>
            </div>

            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-navy-900/15 text-navy-900/50">
                <tr><th className="py-2 font-medium">Désignation</th><th className="py-2 text-center font-medium">Qté</th><th className="py-2 text-right font-medium">PU</th><th className="py-2 text-right font-medium">Montant</th></tr>
              </thead>
              <tbody>
                {facture.facture_lignes.map((l) => (
                  <tr key={l.id} className="border-b border-navy-900/5">
                    <td className="py-2 text-navy-900">{l.libelle}</td>
                    <td className="py-2 text-center font-mono text-navy-900/60">{l.quantite}</td>
                    <td className="py-2 text-right font-mono">{fmt(l.prix_unitaire)}</td>
                    <td className="py-2 text-right font-mono">{fmt(l.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <Ligne l="Total" v={`${fmt(facture.montant_total)} ${devise}`} />
                <Ligne l="Payé" v={`${fmt(facture.montant_paye)} ${devise}`} />
                <div className="flex justify-between border-t border-navy-900/15 pt-1 font-semibold">
                  <span>Reste</span><span className="font-mono">{fmt(reste)} {devise}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statut + encaissements (non imprimé) */}
          <div className="no-print space-y-4">
            <div className="flex items-center justify-between">
              <Pastille ton={s.ton}>{s.label}</Pastille>
              <Bouton variante="fantome" onClick={() => window.print()}>Imprimer le reçu</Bouton>
            </div>

            {facture.paiements.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-navy-900/70">Encaissements</p>
                <ul className="space-y-1">
                  {facture.paiements.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
                      <span className="font-mono">{p.date_paiement}</span>
                      <span className="capitalize">{(api.MODES.find((m) => m[0] === p.mode) || [])[1] || p.mode}</span>
                      <span className="font-mono">{fmt(p.montant)} {devise}</span>
                      <button onClick={async () => { try { await api.supprimerPaiement(p.id); await recharger(); onChange(); } catch (e) { setErreur(e.message); } }}
                        className="text-xs text-rose-500 hover:underline">annuler</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reste > 0 && (
              <form onSubmit={encaisser} className="rounded-xl border border-navy-900/10 bg-creme/40 p-4">
                <p className="mb-3 text-sm font-medium text-navy-900/70">Encaisser un paiement</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-32"><Champ label={`Montant`} value={pay.montant} onChange={(e) => setPay((p) => ({ ...p, montant: e.target.value.replace(/[^0-9]/g, "") }))} /></div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Mode</span>
                    <select value={pay.mode} onChange={(e) => setPay((p) => ({ ...p, mode: e.target.value }))}
                      className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                      {api.MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <div className="w-36"><Champ label="Référence" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} /></div>
                  <div className="w-40"><Champ label="Date" type="date" value={pay.date_paiement} onChange={(e) => setPay((p) => ({ ...p, date_paiement: e.target.value }))} /></div>
                  <Bouton type="submit" variante="or">Encaisser</Bouton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Modale>
  );
}

function Ligne({ l, v }) {
  return <div className="flex justify-between text-navy-900/70"><span>{l}</span><span className="font-mono">{v}</span></div>;
}
