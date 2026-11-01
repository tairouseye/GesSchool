import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import SelecteurEleve from "@/composants/SelecteurEleve.jsx";
import { Bouton, Champ, Alerte, Modale } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/paiements.js";
import { getComptes } from "@/lib/comptabilite.js";
import { objetFacture } from "@/lib/paiementStatut.js";
import { facturesAEncaisser, resteFacture, verifierMontant, EVENEMENT_ENCAISSE } from "@/lib/encaisser.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const date = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");

// Fenêtre « Encaisser » — ouvrable de partout (lot 3 de l'audit du 31/10/2026).
// Trois gestes : l'élève, la facture (la plus ancienne est choisie d'office),
// le montant et le mode. Le reçu s'ouvre ensuite dans Paiements, où il
// s'imprime avec la mise en page de l'école.
export default function FenetreEncaisser({ ouvert, eleve: eleveInitial = null, onFermer }) {
  const { ecoleId, ecole, utilisateur } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [eleve, setEleve] = useState(null);
  const [factures, setFactures] = useState(null); // null = pas encore chargé
  const [factureId, setFactureId] = useState("");
  const [pay, setPay] = useState({ montant: "", mode: "especes", reference: "", compte_id: "" });
  const [comptes, setComptes] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(null); // { facture, montant }

  //  À chaque ouverture : on repart de l'élève transmis, ou de zéro.
  useEffect(() => {
    if (!ouvert) return;
    setEleve(eleveInitial?.id ? eleveInitial : null);
    setFait(null); setErreur("");
    setPay((p) => ({ ...p, montant: "", reference: "" }));
  }, [ouvert, eleveInitial]);

  //  Comptes de trésorerie : facultatifs, invisibles sans droit compta.
  useEffect(() => {
    if (!ouvert) return undefined;
    let vivant = true;
    getComptes(ecoleId)
      .then((cs) => { if (!vivant) return; const a = cs.filter((c) => c.actif !== false); setComptes(a); setPay((p) => (p.compte_id ? p : { ...p, compte_id: a[0]?.id || "" })); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [ouvert, ecoleId]);

  useEffect(() => {
    if (!ouvert || !eleve?.id) { setFactures(null); setFactureId(""); return undefined; }
    let vivant = true;
    setFactures(null);
    api.facturesOuvertesEleve(ecoleId, eleve.id)
      .then((l) => {
        if (!vivant) return;
        const dues = facturesAEncaisser(l);
        setFactures(dues);
        setFactureId(dues[0]?.id || "");
        setPay((p) => ({ ...p, montant: dues[0] ? String(resteFacture(dues[0])) : "" }));
      })
      .catch((e) => { if (vivant) { setFactures([]); setErreur(e.message); } });
    return () => { vivant = false; };
  }, [ouvert, ecoleId, eleve?.id]);

  const facture = (factures || []).find((f) => f.id === factureId) || null;
  const totalDu = (factures || []).reduce((s, f) => s + resteFacture(f), 0);

  function choisir(f) {
    setFactureId(f.id);
    setPay((p) => ({ ...p, montant: String(resteFacture(f)) }));
  }

  async function valider(e) {
    e.preventDefault();
    const pb = verifierMontant(pay.montant, facture);
    if (pb) { setErreur(pb); return; }
    setEnvoi(true); setErreur("");
    try {
      await api.encaisser(ecoleId, facture.id, pay, utilisateur?.id);
      setFait({ facture, montant: Number(pay.montant) });
      window.dispatchEvent(new CustomEvent(EVENEMENT_ENCAISSE, { detail: { eleveId: eleve.id, factureId: facture.id } }));
      toast.succes("Encaissement enregistré.");
    } catch (er) { setErreur(er.message); }
    finally { setEnvoi(false); }
  }

  function autre() {
    setFait(null); setEleve(null); setErreur("");
    setPay((p) => ({ ...p, montant: "", reference: "" }));
  }

  if (!ouvert) return null;
  const nom = eleve ? `${eleve.prenom || ""} ${eleve.nom || ""}`.trim() : "";

  return (
    <Modale ouvert onFermer={onFermer} titre="Encaisser">
      {fait ? (
        <div className="space-y-4 text-center">
          <p className="text-4xl" aria-hidden="true">✅</p>
          <p className="text-navy-900">
            <b>{fmt(fait.montant)} {devise}</b> encaissés pour <b>{nom}</b>
            <span className="block text-sm text-navy-900/60">Facture {fait.facture.numero}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Bouton variante="or" onClick={() => { onFermer(); navigate(`/paiements?facture=${fait.facture.id}`); }}>
              🧾 Voir et imprimer le reçu
            </Bouton>
            <Bouton variante="fantome" onClick={autre}>Encaisser pour un autre élève</Bouton>
          </div>
        </div>
      ) : (
        <form onSubmit={valider} className="space-y-4">
          <Alerte ton="erreur">{erreur}</Alerte>

          {eleve ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-or-500/40 bg-or-500/5 px-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-navy-900">
                <b>{nom}</b>
                {eleve.matricule ? <span className="ml-2 font-mono text-xs text-navy-900/55">{eleve.matricule}</span> : null}
              </span>
              <button type="button" onClick={() => setEleve(null)} className="shrink-0 text-xs text-navy-900/60 hover:text-navy-900">changer</button>
            </div>
          ) : (
            <SelecteurEleve value="" label="Élève" requis onChange={(id, e) => id && setEleve(e)} />
          )}

          {eleve && factures === null && <p className="text-sm text-navy-900/60">Recherche des factures…</p>}

          {eleve && factures?.length === 0 && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Aucune facture à régler pour {nom} : tout est payé, ou rien n&apos;a encore été facturé.
              Un paiement d&apos;avance se saisit dans Paiements → « Encaisser une avance ».
            </p>
          )}

          {factures?.length > 0 && (
            <>
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 flex w-full justify-between text-sm font-medium text-navy-900/70">
                  <span>Facture</span>
                  {factures.length > 1 && <span className="font-normal text-navy-900/60">Total dû {fmt(totalDu)} {devise}</span>}
                </legend>
                {factures.map((f) => (
                  <label key={f.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${f.id === factureId ? "border-or-500 bg-or-500/5" : "border-navy-900/15"}`}>
                    <input type="radio" name="facture" checked={f.id === factureId} onChange={() => choisir(f)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900">{objetFacture(f.facture_lignes, f.notes)}</span>
                      <span className="block text-xs text-navy-900/60">
                        {f.numero}{f.date_echeance ? ` · échéance ${date(f.date_echeance)}` : ""}
                        {f.statut === "en_retard" && <span className="text-rose-700"> · en retard</span>}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-navy-900">{fmt(resteFacture(f))}</span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <Champ label={`Montant (${devise})`} inputMode="numeric" value={pay.montant}
                    onChange={(e) => setPay((p) => ({ ...p, montant: e.target.value.replace(/[^0-9]/g, "") }))} />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Mode</span>
                  <select value={pay.mode} onChange={(e) => setPay((p) => ({ ...p, mode: e.target.value }))}
                    className="rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                    {api.MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                {pay.mode !== "especes" && (
                  <div className="w-36"><Champ label="Référence" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} /></div>
                )}
                {comptes.length > 1 && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Encaissé dans</span>
                    <select value={pay.compte_id} onChange={(e) => setPay((p) => ({ ...p, compte_id: e.target.value }))}
                      className="rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                      <option value="">— Aucun compte —</option>
                      {comptes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
            <Bouton type="submit" variante="or" disabled={envoi || !facture}>
              {envoi ? "Encaissement…" : facture && pay.montant ? `Encaisser ${fmt(pay.montant)} ${devise}` : "Encaisser"}
            </Bouton>
          </div>
        </form>
      )}
    </Modale>
  );
}
