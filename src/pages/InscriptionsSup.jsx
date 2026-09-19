import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/superieur.js";
import { getEleves, creerEleve } from "@/lib/eleves.js";
import SelecteurEleve from "@/composants/SelecteurEleve.jsx";
import { getAnneeCourante } from "@/lib/academique.js";
import { creerFacture } from "@/lib/paiements.js";
import { totalCredits } from "@/lib/lmd.js";

const NIVEAUX = ["L1", "L2", "L3", "M1", "M2"];
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const nomEleve = (e) => (e ? `${e.prenom} ${e.nom}` : "—");

// --- Modale : inscription administrative (rattache un étudiant à une filière) ---
function ModaleIA({ ouvert, onFermer, filieres, eleves, filiereDefaut, niveauDefaut, devise, onValider }) {
  const [nouveau, setNouveau] = useState(false);
  const [eleveId, setEleveId] = useState("");
  const [neo, setNeo] = useState({ prenom: "", nom: "", sexe: "M" });
  const [filiereId, setFiliereId] = useState(filiereDefaut || "");
  const [niveau, setNiveau] = useState(niveauDefaut || "L1");
  const [droits, setDroits] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ouvert) { setNouveau(false); setEleveId(""); setNeo({ prenom: "", nom: "", sexe: "M" }); setFiliereId(filiereDefaut || ""); setNiveau(niveauDefaut || "L1"); setDroits(""); } }, [ouvert, filiereDefaut, niveauDefaut]);

  async function soumettre(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onValider({ nouveau, eleveId, neo, filiereId, niveau, droits: Number(droits) || 0 });
    } finally { setBusy(false); }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Inscrire un étudiant">
      <form className="space-y-4" onSubmit={soumettre}>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={() => setNouveau(false)}
            className={`rounded-lg px-3 py-1.5 font-medium ${!nouveau ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>Étudiant existant</button>
          <button type="button" onClick={() => setNouveau(true)}
            className={`rounded-lg px-3 py-1.5 font-medium ${nouveau ? "bg-navy-900 text-creme" : "border border-navy-900/15"}`}>Nouvel étudiant</button>
        </div>

        {nouveau ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Champ label="Prénom *" value={neo.prenom} onChange={(e) => setNeo((s) => ({ ...s, prenom: e.target.value }))} />
            <Champ label="Nom *" value={neo.nom} onChange={(e) => setNeo((s) => ({ ...s, nom: e.target.value }))} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Sexe</span>
              <select value={neo.sexe} onChange={(e) => setNeo((s) => ({ ...s, sexe: e.target.value }))}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="M">Masculin</option><option value="F">Féminin</option>
              </select>
            </label>
          </div>
        ) : (
          <SelecteurEleve value={eleveId}
            onChange={(id) => setEleveId(id)} label="Étudiant *" />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Filière *</span>
            <select value={filiereId} onChange={(e) => setFiliereId(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Choisir —</option>
              {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Niveau</span>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <Champ label={`Droits d'inscription (${devise}) — optionnel`} type="number" value={droits}
          onChange={(e) => setDroits(e.target.value)} placeholder="Laisser vide pour ne pas facturer" />
        <p className="text-xs text-navy-900/45">Si un montant est saisi, une facture de droits est créée automatiquement (module Paiements).</p>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Inscrire"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// --- Modale : inscription pédagogique (choix des UE) ---
function ModaleIP({ inscription, ecoleId, onFermer, onEnregistre }) {
  const toast = useToast();
  const [ues, setUes] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!inscription) return;
    setErr("");
    Promise.all([
      api.getUEFiliere(ecoleId, inscription.filiere_id, inscription.niveau),
      api.getInscriptionUE(inscription.id),
    ]).then(([u, dejaC]) => {
      setUes(u);
      setSel(new Set((dejaC || []).map((x) => x.ue_id)));
    }).catch((e) => setErr(e.message));
  }, [inscription, ecoleId]);

  if (!inscription) return null;
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const choisies = ues.filter((u) => sel.has(u.id));
  const credits = totalCredits(choisies);

  // Regroupe par semestre.
  const parSem = {};
  for (const u of ues) { const k = u.semestres?.id || "?"; (parSem[k] ||= { libelle: u.semestres?.libelle || "Semestre", ordre: u.semestres?.ordre ?? 0, items: [] }).items.push(u); }
  const groupes = Object.values(parSem).sort((a, b) => a.ordre - b.ordre);

  async function enregistrer() {
    setBusy(true); setErr("");
    try {
      await api.definirInscriptionUE(ecoleId, inscription.id, [...sel]);
      toast.succes("Inscription pédagogique enregistrée.");
      onEnregistre?.();
      onFermer();
    } catch (e) { setErr(e.message); toast.erreur(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert={!!inscription} onFermer={onFermer} titre={`Inscription pédagogique — ${nomEleve(inscription.eleves)}`} large>
      <div className="space-y-4">
        <Alerte ton="erreur">{err}</Alerte>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-creme/60 px-4 py-2.5 text-sm">
          <span className="text-navy-900/70">{inscription.filieres?.nom} · {inscription.niveau || "—"}</span>
          <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-semibold text-creme">{choisies.length} UE · {credits} crédits</span>
        </div>

        {ues.length === 0 ? (
          <EtatVide icone="📘" titre="Aucune UE">La maquette de cette filière (niveau {inscription.niveau || "?"}) est vide — composez-la dans « Filières &amp; maquettes ».</EtatVide>
        ) : (
          <div className="space-y-4">
            {groupes.map((g, i) => (
              <div key={i}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-900/45">{g.libelle}</p>
                <ul className="space-y-1">
                  {g.items.map((u) => (
                    <li key={u.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-navy-900/10 px-3 py-2 hover:border-or-500">
                        <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 accent-or-500" />
                        <span className="flex-1 text-sm text-navy-900">
                          {u.code ? <span className="mr-2 font-mono text-xs text-navy-900/40">{u.code}</span> : null}{u.intitule}
                        </span>
                        <span className="text-xs text-navy-900/45">{Number(u.credits)} cr.</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          <Bouton onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</Bouton>
        </div>
      </div>
    </Modale>
  );
}

export default function InscriptionsSup() {
  const { ecoleId, ecole, typeEtablissement } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const devise = ecole?.devise || "XOF";

  const [annee, setAnnee] = useState(null);
  const [filieres, setFilieres] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [fFiliere, setFFiliere] = useState("");
  const [fNiveau, setFNiveau] = useState("");
  const [liste, setListe] = useState([]);
  const [iaOuvert, setIaOuvert] = useState(false);
  const [ip, setIp] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    api.getFilieres(ecoleId).then(setFilieres).catch((e) => setErreur(e.message));
    getEleves(ecoleId).then(setEleves).catch(() => {});
  }, [ecoleId]);

  const recharger = useCallback(() => {
    if (!ecoleId) return;
    api.getInscriptions(ecoleId, { anneeId: annee?.id, filiereId: fFiliere || undefined, niveau: fNiveau || undefined })
      .then(setListe).catch((e) => setErreur(e.message));
  }, [ecoleId, annee?.id, fFiliere, fNiveau]);
  useEffect(() => { recharger(); }, [recharger]);

  async function inscrire({ nouveau, eleveId, neo, filiereId, niveau, droits }) {
    setErreur("");
    try {
      if (!filiereId) throw new Error("Choisissez une filière.");
      let eid = eleveId;
      if (nouveau) {
        if (!neo.prenom.trim() || !neo.nom.trim()) throw new Error("Prénom et nom requis.");
        const e = await creerEleve(ecoleId, { prenom: neo.prenom.trim(), nom: neo.nom.trim(), sexe: neo.sexe });
        eid = e.id;
        setEleves((s) => [...s, e]);
      }
      if (!eid) throw new Error("Choisissez un étudiant.");
      const insc = await api.creerInscription(ecoleId, { eleve_id: eid, filiere_id: filiereId, niveau, annee_id: annee?.id });

      if (droits > 0) {
        const fil = filieres.find((f) => f.id === filiereId);
        const facture = await creerFacture(ecoleId, {
          eleve_id: eid, annee_id: annee?.id || null, date_echeance: null,
          lignes: [{ libelle: `Droits d'inscription${fil ? ` — ${fil.nom}` : ""}${niveau ? ` (${niveau})` : ""}`, quantite: 1, prix_unitaire: droits }],
        });
        await api.modifierInscription(insc.id, { droits_facture_id: facture.id });
      }
      toast.succes("Étudiant inscrit.");
      setIaOuvert(false);
      recharger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  async function changerStatut(insc, statut) {
    try { await api.modifierInscription(insc.id, { statut }); recharger(); }
    catch (e) { toast.erreur(e.message); }
  }
  async function supprimer(insc) {
    if (!(await confirmer(`Retirer l'inscription de ${nomEleve(insc.eleves)} ? (les UE choisies seront aussi retirées)`))) return;
    try { await api.supprimerInscription(insc.id); toast.succes("Inscription retirée."); recharger(); }
    catch (e) { toast.erreur(e.message); }
  }

  return (
    <>
      <EnTete titre="Inscriptions" sousTitre={`Inscriptions administrative & pédagogique${annee?.libelle ? ` · ${annee.libelle}` : ""}`}
        action={<Bouton onClick={() => setIaOuvert(true)} disabled={filieres.length === 0}>＋ Inscrire un étudiant</Bouton>} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {typeEtablissement !== "superieur" && (
          <Alerte ton="info">Établissement non « Supérieur ». Activez-le dans Paramètres → Établissement pour utiliser les inscriptions LMD.</Alerte>
        )}
        {filieres.length === 0 && (
          <Alerte ton="info">Créez d'abord au moins une filière dans « Filières &amp; maquettes ».</Alerte>
        )}

        {/* Filtres */}
        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Filière</span>
            <select value={fFiliere} onChange={(e) => setFFiliere(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Toutes</option>
              {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Niveau</span>
            <select value={fNiveau} onChange={(e) => setFNiveau(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Tous</option>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="ml-auto self-center text-sm text-navy-900/50">{liste.length} inscription{liste.length > 1 ? "s" : ""}</span>
        </Carte>

        {liste.length === 0 ? (
          <EtatVide icone="📝" titre="Aucune inscription">Inscrivez un premier étudiant à une filière.</EtatVide>
        ) : (
          <div className="space-y-2">
            {liste.map((insc) => (
              <Carte key={insc.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900">{nomEleve(insc.eleves)}
                    {insc.eleves?.matricule && <span className="ml-2 font-mono text-xs text-navy-900/40">{insc.eleves.matricule}</span>}
                  </p>
                  <p className="text-xs text-navy-900/50">
                    {insc.filieres?.nom} · {insc.niveau || "—"} · {(insc.inscriptions_ue?.length || 0)} UE choisie{(insc.inscriptions_ue?.length || 0) > 1 ? "s" : ""}
                    {insc.statut !== "active" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{api.STATUTS_INSCRIPTION[insc.statut]}</span>}
                    {insc.droits_facture_id && <span className="ml-2 text-emerald-600">₣ droits facturés</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Bouton variante="fantome" onClick={() => setIp(insc)}>Inscription pédagogique</Bouton>
                  {insc.statut === "active"
                    ? <button onClick={() => changerStatut(insc, "suspendue")} className="text-navy-900/50 hover:text-amber-600">suspendre</button>
                    : <button onClick={() => changerStatut(insc, "active")} className="text-navy-900/50 hover:text-emerald-600">réactiver</button>}
                  <button onClick={() => supprimer(insc)} className="text-rose-500 hover:underline">suppr.</button>
                </div>
              </Carte>
            ))}
          </div>
        )}
      </div>

      <ModaleIA ouvert={iaOuvert} onFermer={() => setIaOuvert(false)}
        filieres={filieres} eleves={eleves} filiereDefaut={fFiliere} niveauDefaut={fNiveau || "L1"} devise={devise}
        onValider={inscrire} />
      <ModaleIP inscription={ip} ecoleId={ecoleId} onFermer={() => setIp(null)} onEnregistre={recharger} />
    </>
  );
}
