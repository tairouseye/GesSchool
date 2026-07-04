import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Champ, Carte, Alerte, EtatVide } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { getElevesClasse } from "@/lib/bulletins.js";
import { getAbsencesPeriode } from "@/lib/viescolaire.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";

export default function Assiduite() {
  const { ecoleId, utilisateur, profil, roles } = useAuth();
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
      const data = els.map((e) => ({
        eleve: e, absences: par[e.id]?.absence || 0, retards: par[e.id]?.retard || 0,
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
                      <td className="px-6 py-2.5 text-right font-mono text-rose-600">{l.absences || "—"}</td>
                      <td className="px-6 py-2.5 text-right font-mono text-or-600">{l.retards || "—"}</td>
                      <td className="px-6 py-2.5 text-right font-mono font-semibold">{total || "—"}</td>
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
    </>
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
