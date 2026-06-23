import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/enseignants.js";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";

export default function Enseignants() {
  const { ecoleId } = useAuth();
  const [onglet, setOnglet] = useState("enseignants");
  const [annee, setAnnee] = useState(null);
  const [enseignants, setEnseignants] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(null); // null | 'new' | enseignant

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [ens, aff, cls, mat] = await Promise.all([
        api.getEnseignants(ecoleId),
        api.getAffectations(ecoleId, an?.id),
        getClasses(ecoleId, an?.id),
        getMatieres(ecoleId),
      ]);
      setEnseignants(ens);
      setAffectations(aff);
      setClasses(cls);
      setMatieres(mat);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn) => {
    setErreur("");
    try { await fn(); await recharger(); } catch (e) { setErreur(e.message); }
  };

  return (
    <>
      <EnTete
        titre="Enseignants & affectations"
        sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={onglet === "enseignants" && <Bouton onClick={() => setModale("new")}>+ Nouvel enseignant</Bouton>}
      />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["enseignants", "Enseignants"], ["affectations", "Affectations"]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {onglet === "enseignants" ? (
          <Carte className="overflow-hidden">
            {enseignants.length === 0 ? (
              <p className="p-8 text-sm text-navy-900/50">Aucun enseignant. Ajoutez-en avec « + Nouvel enseignant ».</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-creme text-navy-900/50">
                  <tr>
                    <th className="px-6 py-3 font-medium">Enseignant</th>
                    <th className="px-6 py-3 font-medium">Spécialité</th>
                    <th className="px-6 py-3 font-medium">Contact</th>
                    <th className="px-6 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {enseignants.map((e) => (
                    <tr key={e.id} className="border-t border-navy-900/5">
                      <td className="px-6 py-3 font-medium text-navy-900">{e.prenom} {e.nom}</td>
                      <td className="px-6 py-3 text-navy-900/70">{e.specialite || "—"}</td>
                      <td className="px-6 py-3 text-navy-900/60">{e.telephone || e.email || "—"}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setModale(e)} className="text-xs text-navy-700 hover:text-or-500">modifier</button>
                        <button onClick={() => wrap(() => api.supprimerEnseignant(e.id))} className="ml-3 text-xs text-rose-500 hover:underline">supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Carte>
        ) : (
          <PanneauAffectations
            ecoleId={ecoleId} annee={annee}
            enseignants={enseignants} classes={classes} matieres={matieres} affectations={affectations}
            onChange={recharger} onErreur={setErreur}
          />
        )}
      </div>

      <ModaleEnseignant
        ouvert={!!modale}
        enseignant={modale === "new" ? null : modale}
        onFermer={() => setModale(null)}
        onValider={(data) =>
          wrap(async () => {
            if (modale === "new") await api.creerEnseignant(ecoleId, data);
            else await api.majEnseignant(modale.id, data);
            setModale(null);
          })
        }
      />
    </>
  );
}

function PanneauAffectations({ ecoleId, annee, enseignants, classes, matieres, affectations, onChange, onErreur }) {
  const [f, setF] = useState({ enseignant_id: "", classe_id: "", matiere_id: "", coefficient: "1" });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const pretAjout = enseignants.length && classes.length && matieres.length && annee;

  async function ajouter(e) {
    e.preventDefault();
    onErreur("");
    try {
      if (!f.enseignant_id || !f.classe_id || !f.matiere_id) throw new Error("Choisissez enseignant, classe et matière.");
      await api.creerAffectation(ecoleId, { ...f, annee_id: annee.id });
      setF({ enseignant_id: "", classe_id: "", matiere_id: "", coefficient: "1" });
      onChange();
    } catch (er) { onErreur(er.message); }
  }

  // Regroupe par classe
  const parClasse = {};
  for (const a of affectations) (parClasse[a.classe_id] ||= []).push(a);

  return (
    <div className="space-y-5">
      <Carte className="p-6">
        <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Affecter une matière</h3>
        <p className="mb-4 text-xs text-navy-900/50">
          Le coefficient saisi ici sert au calcul de la <strong>moyenne générale</strong> des bulletins.
        </p>
        {!pretAjout ? (
          <p className="text-sm text-navy-900/50">
            Pré-requis : au moins un enseignant, une classe et une matière (et une année courante).
          </p>
        ) : (
          <form onSubmit={ajouter} className="flex flex-wrap items-end gap-2">
            <Sel label="Enseignant" value={f.enseignant_id} onChange={(v) => maj("enseignant_id", v)}
              options={enseignants.map((e) => [e.id, `${e.prenom} ${e.nom}`])} />
            <Sel label="Classe" value={f.classe_id} onChange={(v) => maj("classe_id", v)}
              options={classes.map((c) => [c.id, c.libelle])} />
            <Sel label="Matière" value={f.matiere_id} onChange={(v) => maj("matiere_id", v)}
              options={matieres.map((m) => [m.id, m.libelle])} />
            <div className="w-24"><Champ label="Coef." value={f.coefficient} onChange={(e) => maj("coefficient", e.target.value.replace(/[^0-9.]/g, ""))} /></div>
            <Bouton type="submit">Affecter</Bouton>
          </form>
        )}
      </Carte>

      {Object.keys(parClasse).length === 0 ? (
        <Carte className="p-6 text-sm text-navy-900/40">Aucune affectation pour l'instant.</Carte>
      ) : (
        classes
          .filter((c) => parClasse[c.id])
          .map((c) => (
            <Carte key={c.id} className="p-6">
              <h4 className="mb-3 font-display font-semibold text-navy-900">{c.libelle}</h4>
              <table className="w-full text-left text-sm">
                <thead className="text-navy-900/50">
                  <tr><th className="py-1 font-medium">Matière</th><th className="py-1 font-medium">Enseignant</th><th className="py-1 text-center font-medium">Coef.</th><th></th></tr>
                </thead>
                <tbody>
                  {parClasse[c.id].map((a) => (
                    <tr key={a.id} className="border-t border-navy-900/5">
                      <td className="py-2 font-medium text-navy-900">{a.matieres?.libelle}</td>
                      <td className="py-2 text-navy-900/70">{a.enseignants ? `${a.enseignants.prenom} ${a.enseignants.nom}` : "—"}</td>
                      <td className="py-2 text-center font-mono">{a.coefficient}</td>
                      <td className="py-2 text-right">
                        <button onClick={async () => { try { await api.supprimerAffectation(a.id); onChange(); } catch (e) { onErreur(e.message); } }}
                          className="text-xs text-rose-500 hover:underline">retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Carte>
          ))
      )}
    </div>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-900/50">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
        <option value="">— Choisir —</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function ModaleEnseignant({ ouvert, enseignant, onFermer, onValider }) {
  const [f, setF] = useState({ prenom: "", nom: "", specialite: "", telephone: "", email: "" });
  useEffect(() => {
    setF(enseignant
      ? { prenom: enseignant.prenom || "", nom: enseignant.nom || "", specialite: enseignant.specialite || "", telephone: enseignant.telephone || "", email: enseignant.email || "" }
      : { prenom: "", nom: "", specialite: "", telephone: "", email: "" });
  }, [enseignant, ouvert]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={enseignant ? "Modifier l'enseignant" : "Nouvel enseignant"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onValider({
            prenom: f.prenom.trim(), nom: f.nom.trim(),
            specialite: f.specialite.trim() || null, telephone: f.telephone.trim() || null, email: f.email.trim() || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={f.nom} onChange={(e) => maj("nom", e.target.value)} required />
        </div>
        <Champ label="Spécialité" value={f.specialite} onChange={(e) => maj("specialite", e.target.value)} placeholder="Mathématiques…" />
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Téléphone" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          <Champ label="E-mail" value={f.email} onChange={(e) => maj("email", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.prenom.trim() || !f.nom.trim()}>{enseignant ? "Enregistrer" : "Créer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
