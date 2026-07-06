import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import * as api from "@/lib/paiements.js";
import { getEleves } from "@/lib/eleves.js";
import { getAnneeCourante, getNiveaux, getCycles } from "@/lib/academique.js";
import { useToast } from "@/composants/Feedback.jsx";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export default function Paiements() {
  const { ecoleId, ecole, utilisateur } = useAuth();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [onglet, setOnglet] = useState("factures");
  const [annee, setAnnee] = useState(null);
  const [factures, setFactures] = useState([]);
  const [frais, setFrais] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [inscrits, setInscrits] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [mobileInfos, setMobileInfos] = useState({});
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [modaleNouvelle, setModaleNouvelle] = useState(false);
  const [modaleLot, setModaleLot] = useState(false);
  const [factureId, setFactureId] = useState(null);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [fac, fr, els, niv, cyc, ins, decl, mob] = await Promise.all([
        api.getFactures(ecoleId, an?.id),
        api.getFrais(ecoleId, an?.id),
        getEleves(ecoleId),
        getNiveaux(ecoleId),
        getCycles(ecoleId),
        api.getInscritsAvecNiveau(ecoleId, an?.id),
        api.getDeclarations(ecoleId, "en_attente"),
        api.getPaiementMobile(ecoleId),
      ]);
      setFactures(fac);
      setFrais(fr);
      setEleves(els);
      setNiveaux(niv);
      setCycles(cyc);
      setInscrits(ins);
      setDeclarations(decl);
      setMobileInfos(mob);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
  };

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
            <div className="flex flex-wrap gap-2">
              <Bouton variante="fantome" onClick={() => setModaleLot(true)} disabled={inscrits.length === 0 || frais.length === 0}>
                ⚡ Générer en lot
              </Bouton>
              <Bouton onClick={() => setModaleNouvelle(true)} disabled={eleves.length === 0}>
                + Nouvelle facture
              </Bouton>
            </div>
          )
        }
      />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Onglets */}
        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["factures", "Factures"], ["declarations", `Déclarations${declarations.length ? ` (${declarations.length})` : ""}`], ["frais", "Grille tarifaire"], ["mobile", "Paiement mobile"]].map(([k, l]) => (
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
        ) : onglet === "declarations" ? (
          <PanneauDeclarations
            declarations={declarations} devise={devise}
            onValider={(id) => wrap(() => api.validerDeclaration(id), "Paiement validé.")}
            onRejeter={(id) => wrap(() => api.rejeterDeclaration(id), "Déclaration rejetée.")}
          />
        ) : onglet === "mobile" ? (
          <PanneauMobile
            infos={mobileInfos}
            onSave={(v) => wrap(() => api.setPaiementMobile(ecoleId, v), "Numéros enregistrés.")}
          />
        ) : (
          <PanneauFrais
            ecoleId={ecoleId} annee={annee} frais={frais} niveaux={niveaux} cycles={cycles} devise={devise}
            onChange={recharger} onErreur={setErreur}
          />
        )}
      </div>

      <ModaleNouvelleFacture
        ouvert={modaleNouvelle}
        onFermer={() => setModaleNouvelle(false)}
        ecoleId={ecoleId} annee={annee} eleves={eleves} frais={frais} devise={devise}
        onCree={() => { setModaleNouvelle(false); recharger(); toast.succes("Facture créée."); }}
        onErreur={setErreur}
      />

      <ModaleFacturationLot
        ouvert={modaleLot}
        onFermer={() => setModaleLot(false)}
        ecoleId={ecoleId} annee={annee} frais={frais} niveaux={niveaux} cycles={cycles} inscrits={inscrits} devise={devise}
        onTermine={() => { setModaleLot(false); recharger(); toast.succes("Factures générées."); }}
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

// Libellé de la cible d'un frais (cycle / niveau / tous).
function cibleFrais(fr) {
  if (fr.cycles?.libelle) return `cycle ${fr.cycles.libelle}`;
  if (fr.niveaux?.libelle) return fr.niveaux.libelle;
  return "toute l'école";
}

function PanneauFrais({ ecoleId, annee, frais, niveaux, cycles, devise, onChange, onErreur }) {
  const vide = { libelle: "", montant: "", recurrent: false, obligatoire: true, cible: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Grille tarifaire</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Un frais peut viser un <b>cycle</b> entier (scolarité identique pour tout le cycle), un <b>niveau</b> précis
        (ex. classe d'examen à tarif différent) ou toute l'école. Les frais <b>obligatoires</b> sont facturés
        automatiquement à la génération en lot.
      </p>
      <div className="space-y-2">
        {frais.length === 0 && <p className="text-sm text-navy-900/40">Aucun frais défini.</p>}
        {frais.map((fr) => (
          <div key={fr.id} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-3">
            <div>
              <span className="font-medium text-navy-900">{fr.libelle}</span>
              {fr.recurrent && <span className="ml-2 text-xs text-or-500">mensuel</span>}
              {fr.obligatoire ? (
                <span className="ml-2 rounded bg-navy-900/5 px-1.5 py-0.5 text-[10px] text-navy-900/50">obligatoire</span>
              ) : (
                <span className="ml-2 rounded bg-navy-900/5 px-1.5 py-0.5 text-[10px] text-navy-900/40">optionnel</span>
              )}
              <span className="ml-2 text-xs text-navy-900/40">({cibleFrais(fr)})</span>
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
          const niveau_id = f.cible.startsWith("n:") ? f.cible.slice(2) : null;
          const cycle_id = f.cible.startsWith("c:") ? f.cible.slice(2) : null;
          try {
            await api.creerFrais(ecoleId, {
              libelle: f.libelle.trim(), montant: Number(f.montant),
              recurrent: f.recurrent, obligatoire: f.obligatoire,
              niveau_id, cycle_id, annee_id: annee?.id || null,
            });
            setF(vide);
            onChange();
          } catch (er) { onErreur(er.message); }
        }}
      >
        <div className="min-w-44 flex-1"><Champ label="Libellé" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="Scolarité, Inscription…" /></div>
        <div className="w-32"><Champ label={`Montant (${devise})`} value={f.montant} onChange={(e) => maj("montant", e.target.value.replace(/[^0-9]/g, ""))} /></div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">S'applique à</span>
          <select value={f.cible} onChange={(e) => maj("cible", e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">Toute l'école</option>
            <optgroup label="Par cycle (scolarité)">
              {cycles.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.libelle}</option>)}
            </optgroup>
            <optgroup label="Par niveau (classe d'examen…)">
              {niveaux.map((n) => <option key={n.id} value={`n:${n.id}`}>{n.libelle}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.recurrent} onChange={(e) => maj("recurrent", e.target.checked)} /> Mensuel
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.obligatoire} onChange={(e) => maj("obligatoire", e.target.checked)} /> Obligatoire
        </label>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}

function PanneauDeclarations({ declarations, devise, onValider, onRejeter }) {
  const modeLabel = (m) => (api.MODES.find((x) => x[0] === m) || [])[1] || m;
  if (declarations.length === 0) {
    return <EtatVide icone="📲" titre="Aucune déclaration">Aucun paiement mobile déclaré par les parents en attente.</EtatVide>;
  }
  return (
    <Carte className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50">
          <tr>
            <th className="px-5 py-3 font-medium">Élève</th>
            <th className="px-5 py-3 font-medium">Facture</th>
            <th className="px-5 py-3 font-medium">Mode</th>
            <th className="px-5 py-3 font-medium">Référence</th>
            <th className="px-5 py-3 text-right font-medium">Montant</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {declarations.map((d) => (
            <tr key={d.id} className="border-t border-navy-900/5">
              <td className="px-5 py-3 font-medium text-navy-900">{d.eleves?.prenom} {d.eleves?.nom}</td>
              <td className="px-5 py-3 font-mono text-xs text-navy-900/70">{d.factures?.numero || "—"}</td>
              <td className="px-5 py-3">{modeLabel(d.mode)}</td>
              <td className="px-5 py-3 font-mono text-xs">{d.reference_tx || "—"}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(d.montant)} {devise}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-3 text-xs">
                  <button onClick={() => onValider(d.id)} className="font-medium text-emerald-700 hover:underline">valider</button>
                  <button onClick={() => onRejeter(d.id)} className="text-rose-500 hover:underline">rejeter</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-navy-900/10 p-4 text-xs text-navy-900/40">
        « Valider » enregistre l'encaissement et solde la facture automatiquement.
      </p>
    </Carte>
  );
}

function PanneauMobile({ infos, onSave }) {
  const [f, setF] = useState({ wave: "", orange_money: "", free_money: "" });
  useEffect(() => { setF({ wave: infos.wave || "", orange_money: infos.orange_money || "", free_money: infos.free_money || "" }); }, [infos]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="max-w-xl p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Coordonnées de paiement mobile</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Numéros affichés aux parents pour régler les factures. Ils paient depuis leur appli mobile money,
        déclarent le paiement, puis vous validez dans l'onglet « Déclarations ».
      </p>
      <div className="space-y-3">
        {api.MODES_MOBILE.map(([k, label]) => (
          <Champ key={k} label={label} value={f[k]} onChange={(e) => maj(k, e.target.value)} placeholder="77 123 45 67" />
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Bouton onClick={() => onSave(f)}>Enregistrer</Bouton>
      </div>
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
  const toast = useToast();
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
      toast.succes("Encaissement enregistré.");
    } catch (er) { setErreur(er.message); toast.erreur(er.message); }
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

function ModaleFacturationLot({ ouvert, onFermer, ecoleId, annee, frais, niveaux, cycles, inscrits, devise, onTermine, onErreur }) {
  const [niveauId, setNiveauId] = useState("");
  const [echeance, setEcheance] = useState("");
  const [choisis, setChoisis] = useState({}); // frais_id -> bool
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  // Cycle du niveau choisi (pour appliquer les frais définis par cycle).
  const cycleId = niveaux.find((n) => n.id === niveauId)?.cycle_id || null;
  // Un frais s'applique s'il vise : ce niveau, le cycle du niveau, ou rien (tous).
  const sApplique = (fr) =>
    (!fr.niveau_id && !fr.cycle_id) || fr.niveau_id === niveauId || (fr.cycle_id && fr.cycle_id === cycleId);
  const applicables = frais.filter(sApplique);
  const elevesNiveau = niveauId ? inscrits.filter((i) => i.niveau_id === niveauId) : [];

  // À chaque changement de niveau : pré-cocher les frais obligatoires.
  useEffect(() => {
    if (!ouvert) return;
    const init = {};
    for (const fr of frais) {
      if (sApplique(fr) && fr.obligatoire) init[fr.id] = true;
    }
    setChoisis(init);
    setResultat(null);
  }, [niveauId, ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const fraisChoisis = applicables.filter((fr) => choisis[fr.id]);
  const totalParEleve = fraisChoisis.reduce((s, fr) => s + Number(fr.montant), 0);

  async function lancer() {
    if (!niveauId || elevesNiveau.length === 0 || fraisChoisis.length === 0) return;
    setEnCours(true);
    onErreur("");
    try {
      const ids = elevesNiveau.map((e) => e.eleve_id);
      const r = await api.genererFacturesEnLot(ecoleId, annee?.id, ids, fraisChoisis, echeance);
      setResultat(r);
    } catch (e) {
      onErreur(e.message);
      onFermer();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Générer les factures en lot" large>
      <div className="space-y-4">
        <p className="text-sm text-navy-900/50">
          Crée une facture par élève d'un niveau à partir des frais sélectionnés.
          Les frais déjà facturés à un élève cette année sont automatiquement ignorés (pas de doublon).
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Niveau *</span>
            <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle}</option>)}
            </select>
          </label>
          <Champ label="Échéance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </div>

        {niveauId && (
          <>
            <div className="rounded-xl border border-navy-900/10 p-4">
              <p className="mb-2 text-sm font-medium text-navy-900/70">Frais à facturer</p>
              {applicables.length === 0 ? (
                <p className="text-sm text-navy-900/40">Aucun frais applicable à ce niveau.</p>
              ) : (
                <div className="space-y-1.5">
                  {applicables.map((fr) => (
                    <label key={fr.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-creme/60">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={!!choisis[fr.id]}
                          onChange={(e) => setChoisis((s) => ({ ...s, [fr.id]: e.target.checked }))} />
                        {fr.libelle}
                        {fr.recurrent && <span className="text-xs text-or-500">mensuel</span>}
                        <span className="text-xs text-navy-900/40">({cibleFrais(fr)})</span>
                      </span>
                      <span className="font-mono text-navy-900/70">{fmt(fr.montant)} {devise}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-creme/50 px-4 py-3 text-sm">
              <span className="text-navy-900/60">
                {elevesNiveau.length} élève{elevesNiveau.length > 1 ? "s" : ""} ·{" "}
                {fraisChoisis.length} frais
              </span>
              <span className="text-navy-900/60">
                <span className="font-mono font-semibold text-navy-900">{fmt(totalParEleve)} {devise}</span> / élève
              </span>
            </div>
          </>
        )}

        {resultat ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✅ {resultat.crees} facture{resultat.crees > 1 ? "s" : ""} créée{resultat.crees > 1 ? "s" : ""}
            {resultat.ignores > 0 && <> · {resultat.ignores} élève(s) ignoré(s) (déjà facturés)</>}.
            <div className="mt-3 text-right">
              <Bouton onClick={onTermine}>Fermer</Bouton>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
            <Bouton type="button" variante="or" onClick={lancer}
              disabled={enCours || !niveauId || elevesNiveau.length === 0 || fraisChoisis.length === 0}>
              {enCours ? "Génération…" : `Générer ${elevesNiveau.length || ""} facture(s)`}
            </Bouton>
          </div>
        )}
      </div>
    </Modale>
  );
}

function Ligne({ l, v }) {
  return <div className="flex justify-between text-navy-900/70"><span>{l}</span><span className="font-mono">{v}</span></div>;
}
