import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Champ, Carte, Alerte, EtatVide, Bouton, Modale } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { getElevesClasse } from "@/lib/bulletins.js";
import { getAbsencesPeriode, STATUTS_JUSTIF } from "@/lib/viescolaire.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "—");
const LIB_TYPE = { absence: "Absence", retard: "Retard" };

export default function Assiduite() {
  const { ecoleId, ecole, utilisateur, profil, roles } = useAuth();
  const [detail, setDetail] = useState(null);   // élève dont on ouvre le détail
  const [recap, setRecap] = useState(false);    // récapitulatif imprimable
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState(new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        if (an?.date_debut && !debut) setDebut(an.date_debut);
        const toutes = voitToutesClasses(roles);
        const ens = toutes ? null : await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        const cls = toutes ? await getClasses(ecoleId, an?.id) : await getMesClasses(ecoleId, an?.id, ens?.id);
        setClasses(cls);
        if (cls.length) setClasseId(cls[0].id);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId]); // eslint-disable-line

  const recharger = useCallback(async () => {
    if (!classeId || !annee) { setLignes([]); return; }
    setErreur("");
    try {
      const [els, abs] = await Promise.all([
        getElevesClasse(ecoleId, classeId, annee.id),
        getAbsencesPeriode(ecoleId, classeId, debut, fin),
      ]);
      const par = {};
      for (const a of abs) {
        const m = (par[a.eleve_id] ||= { absence: 0, retard: 0 });
        if (a.type === "retard") m.retard++; else m.absence++;
      }
      // On GARDE les lignes brutes par élève : le détail au clic n'appelle
      // donc aucune requête de plus — elles sont déjà là.
      const detail = {};
      for (const a of abs) (detail[a.eleve_id] ||= []).push(a);
      for (const k of Object.keys(detail)) {
        detail[k].sort((x, y) => String(y.date_abs).localeCompare(String(x.date_abs)));
      }
      const data = els.map((e) => ({
        eleve: e, absences: par[e.id]?.absence || 0, retards: par[e.id]?.retard || 0,
        items: detail[e.id] || [],
      })).sort((a, b) => (b.absences + b.retards) - (a.absences + a.retards));
      setLignes(data);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId, annee, debut, fin]);

  useEffect(() => { recharger(); }, [recharger]);

  const totAbs = lignes.reduce((s, l) => s + l.absences, 0);
  const totRet = lignes.reduce((s, l) => s + l.retards, 0);

  return (
    <>
      <EnTete titre="Assiduité" sousTitre="Absences & retards par élève sur une période" />
      <div className="space-y-4 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Classe</span>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>
          <div className="w-40"><Champ label="Du" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></div>
          <div className="w-40"><Champ label="Au" type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Élèves" valeur={String(lignes.length)} />
          <Kpi label="Absences (période)" valeur={String(totAbs)} ton="rouge" />
          <Kpi label="Retards (période)" valeur={String(totRet)} ton="or" />
        </div>

        <div className="flex justify-end">
          <Bouton variante="fantome" onClick={() => setRecap(true)} disabled={totAbs + totRet === 0}>
            🖨️ Récapitulatif de la période
          </Bouton>
        </div>

        {classes.length === 0 ? (
          <EtatVide icone="📊" titre="Aucune classe à afficher">Aucune classe ne vous est rattachée pour le moment.</EtatVide>
        ) : (
          <Carte className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Élève</th>
                  <th className="px-6 py-3 text-right font-medium">Absences</th>
                  <th className="px-6 py-3 text-right font-medium">Retards</th>
                  <th className="px-6 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const total = l.absences + l.retards;
                  return (
                    <tr key={l.eleve.id} className={`border-t border-navy-900/5 ${total >= 5 ? "bg-rose-500/5" : ""}`}>
                      <td className="px-6 py-2.5 font-medium text-navy-900">{l.eleve.prenom} {l.eleve.nom}</td>
                      {/* Le nombre devient le chemin vers le détail : c'est la
                          question que le responsable se pose en le lisant. */}
                      <td className="px-6 py-2.5 text-right font-mono text-rose-600">
                        {l.absences ? (
                          <button onClick={() => setDetail(l)} className="underline decoration-dotted hover:text-rose-700">{l.absences}</button>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-or-600">
                        {l.retards ? (
                          <button onClick={() => setDetail(l)} className="underline decoration-dotted hover:text-or-700">{l.retards}</button>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono font-semibold">
                        {total ? (
                          <button onClick={() => setDetail(l)} className="underline decoration-dotted hover:text-navy-700">{total}</button>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {lignes.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-navy-900/40">Aucun élève / aucune absence.</td></tr>}
              </tbody>
            </table>
          </Carte>
        )}
        <p className="text-xs text-navy-900/40">Les élèves cumulant 5 incidents ou plus sont surlignés.</p>
      </div>

      <ModaleDetail ligne={detail} onFermer={() => setDetail(null)} />
      <ModaleRecap
        ouvert={recap} onFermer={() => setRecap(false)}
        ecole={ecole} annee={annee} lignes={lignes}
        classe={classes.find((c) => c.id === classeId)?.libelle} debut={debut} fin={fin}
      />
    </>
  );
}

// Détail des absences d'un élève sur la période affichée.
//
// ⚠️ Ni matière ni créneau : `absences` ne porte que (date, heures, motif,
// statut). Les rattacher à une séance demande une colonne et un correctif
// préalable de la feuille de présence — ce n'est pas inventé ici.
function ModaleDetail({ ligne, onFermer }) {
  if (!ligne) return null;
  return (
    <Modale ouvert={!!ligne} onFermer={onFermer} titre={`${ligne.eleve.prenom} ${ligne.eleve.nom}`} large>
      <div className="space-y-3">
        <p className="text-sm text-navy-900/60">
          <b className="text-navy-900">{ligne.absences}</b> absence{ligne.absences > 1 ? "s" : ""} ·{" "}
          <b className="text-navy-900">{ligne.retards}</b> retard{ligne.retards > 1 ? "s" : ""} sur la période affichée.
        </p>
        {ligne.items.length === 0 ? (
          <p className="rounded-xl bg-creme/60 px-4 py-3 text-sm text-navy-900/50">Aucun incident sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-xs text-navy-900/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Horaire</th>
                  <th className="px-3 py-2 font-medium">Motif</th>
                  <th className="px-3 py-2 font-medium">Justification</th>
                </tr>
              </thead>
              <tbody>
                {ligne.items.map((a) => {
                  const st = STATUTS_JUSTIF[a.statut] || { label: a.statut, ton: "neutre" };
                  const cls = { vert: "text-emerald-700", or: "text-or-600", rouge: "text-rose-600" }[st.ton] || "text-navy-900/60";
                  return (
                    <tr key={a.id} className="border-t border-navy-900/5">
                      <td className="px-3 py-2 font-mono text-xs">{dateFr(a.date_abs)}</td>
                      <td className="px-3 py-2">{LIB_TYPE[a.type] || a.type}</td>
                      <td className="px-3 py-2 font-mono text-xs text-navy-900/50">
                        {a.heure_debut ? `${String(a.heure_debut).slice(0, 5)}${a.heure_fin ? `–${String(a.heure_fin).slice(0, 5)}` : ""}` : "journée"}
                      </td>
                      <td className="px-3 py-2 text-navy-900/70">{a.motif || "—"}</td>
                      <td className={`px-3 py-2 font-medium ${cls}`}>{st.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modale>
  );
}

// Récapitulatif imprimable — « Absences du 1er trimestre » se fabrique en
// choisissant les dates de la période puis en imprimant. On reprend le patron
// d'impression de la liste d'élèves : en-tête à logo, `.zone-impression`.
function ModaleRecap({ ouvert, onFermer, ecole, annee, lignes, classe, debut, fin }) {
  if (!ouvert) return null;
  const avec = lignes.filter((l) => l.absences + l.retards > 0);
  const totA = avec.reduce((s, l) => s + l.absences, 0);
  const totR = avec.reduce((s, l) => s + l.retards, 0);
  const jour = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Récapitulatif des absences" large>
      <div className="zone-impression text-navy-900">
        <div className="mb-3 flex items-center gap-3 border-b border-navy-900/15 pb-2">
          {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-11 w-11 object-contain" />}
          <div className="flex-1">
            <p className="font-display text-base font-bold">{ecole?.nom}</p>
            <p className="text-xs text-navy-900/50">{[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
          </div>
          <p className="text-right text-xs text-navy-900/60">
            Classe : <b>{classe || "—"}</b><br />
            {annee?.libelle ? `Année ${annee.libelle}` : ""}
          </p>
        </div>
        <h1 className="text-center font-display text-lg font-bold uppercase tracking-wide">Récapitulatif des absences</h1>
        <p className="mb-3 text-center text-xs text-navy-900/60">Du {jour(debut)} au {jour(fin)}</p>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-navy-900/50">
              <th className="border border-navy-900/25 px-1 py-1">N°</th>
              <th className="border border-navy-900/25 px-2 py-1 text-left">Nom et prénom</th>
              <th className="border border-navy-900/25 px-2 py-1">Absences</th>
              <th className="border border-navy-900/25 px-2 py-1">Retards</th>
              <th className="border border-navy-900/25 px-2 py-1">Justifiées</th>
              <th className="border border-navy-900/25 px-2 py-1 text-left">Dates</th>
            </tr>
          </thead>
          <tbody>
            {avec.map((l, i) => (
              <tr key={l.eleve.id}>
                <td className="border border-navy-900/20 px-1 py-1 text-center">{i + 1}</td>
                <td className="border border-navy-900/20 px-2 py-1 font-medium">{l.eleve.nom} {l.eleve.prenom}</td>
                <td className="border border-navy-900/20 px-2 py-1 text-center font-mono">{l.absences || "—"}</td>
                <td className="border border-navy-900/20 px-2 py-1 text-center font-mono">{l.retards || "—"}</td>
                <td className="border border-navy-900/20 px-2 py-1 text-center font-mono">
                  {l.items.filter((a) => a.statut === "justifie").length || "—"}
                </td>
                <td className="border border-navy-900/20 px-2 py-1 text-[10px] text-navy-900/70">
                  {l.items.map((a) => new Date(a.date_abs).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })).join(" · ")}
                </td>
              </tr>
            ))}
            {avec.length === 0 && (
              <tr><td colSpan={6} className="border border-navy-900/20 px-2 py-4 text-center text-navy-900/40">Aucune absence sur la période.</td></tr>
            )}
          </tbody>
          {avec.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="border border-navy-900/25 px-2 py-1 text-right" colSpan={2}>Total</td>
                <td className="border border-navy-900/25 px-2 py-1 text-center font-mono">{totA}</td>
                <td className="border border-navy-900/25 px-2 py-1 text-center font-mono">{totR}</td>
                <td className="border border-navy-900/25 px-2 py-1" colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
        <p className="mt-2 text-[10px] text-navy-900/40">
          {avec.length} élève(s) concerné(s) sur {lignes.length}.
        </p>
        <div className="mt-8 flex justify-between text-sm">
          <span>Le responsable pédagogique<br /><span className="text-navy-900/30">_____________________</span></span>
          <span className="text-right">Visa de la direction<br /><span className="text-navy-900/30">_____________________</span></span>
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end">
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
    </Modale>
  );
}

function Kpi({ label, valeur, ton }) {
  const tons = { navy: "text-navy-900", rouge: "text-rose-600", or: "text-or-600" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tons[ton] || tons.navy}`}>{valeur}</p>
    </Carte>
  );
}
