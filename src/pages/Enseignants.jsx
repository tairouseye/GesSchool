import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Recherche, filtreTexte } from "@/composants/ui.jsx";
import * as api from "@/lib/enseignants.js";
import { getAnneeCourante, getClasses, getMatieres } from "@/lib/academique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";

export default function Enseignants() {
  const { ecoleId } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const [onglet, setOnglet] = useState("enseignants");
  const [annee, setAnnee] = useState(null);
  const [enseignants, setEnseignants] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(null); // null | 'new' | enseignant
  const [codes, setCodes] = useState({}); // enseignant_id -> code d'accès
  const [q, setQ] = useState("");

  const ensFiltres = filtreTexte(enseignants, q, ["prenom", "nom", "specialite", "telephone", "email"]);

  async function genererCode(id) {
    try { const code = await api.genererCodeEnseignant(id); setCodes((s) => ({ ...s, [id]: code })); }
    catch (e) { toast.erreur(e.message); }
  }

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

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
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

        {onglet === "enseignants" && enseignants.length > 8 && (
          <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un enseignant…" className="max-w-sm" />
        )}

        {onglet === "enseignants" ? (
          <Carte className="overflow-hidden">
            {enseignants.length === 0 ? (
              <EtatVide icone="🧑‍🏫" titre="Aucun enseignant"
                action={<Bouton onClick={() => setModale("new")}>+ Nouvel enseignant</Bouton>}>
                Ajoutez vos enseignants, puis reliez leur compte avec un code d'accès.
              </EtatVide>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-creme text-navy-900/50">
                  <tr>
                    <th className="px-6 py-3 font-medium">Enseignant</th>
                    <th className="px-6 py-3 font-medium">Spécialité</th>
                    <th className="px-6 py-3 font-medium">Contact</th>
                    <th className="px-6 py-3 font-medium">Compte</th>
                    <th className="px-6 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {ensFiltres.map((e) => (
                    <tr key={e.id} className="border-t border-navy-900/5">
                      <td className="px-6 py-3 font-medium text-navy-900">{e.prenom} {e.nom}</td>
                      <td className="px-6 py-3 text-navy-900/70">{e.specialite || "—"}</td>
                      <td className="px-6 py-3 text-navy-900/60">{e.telephone || e.email || "—"}</td>
                      <td className="px-6 py-3">
                        {e.profil_id ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ compte lié</span>
                        ) : codes[e.id] ? (
                          <span className="rounded-lg bg-or-500/15 px-2 py-1 font-mono text-xs font-bold tracking-widest text-or-600">{codes[e.id]}</span>
                        ) : (
                          <button onClick={() => genererCode(e.id)} className="text-xs text-navy-700 hover:text-or-500">Code d'accès</button>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setModale(e)} className="text-xs text-navy-700 hover:text-or-500">modifier</button>
                        <button onClick={async () => { if (await confirmer("Supprimer cet enseignant ?")) wrap(() => api.supprimerEnseignant(e.id), "Enseignant supprimé."); }} className="ml-3 text-xs text-rose-500 hover:underline">supprimer</button>
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
          }, "Enseignant enregistré.")
        }
      />
    </>
  );
}

function PanneauAffectations({ ecoleId, annee, enseignants, classes, matieres, affectations, onChange, onErreur }) {
  const toast = useToast();
  const [f, setF] = useState({ enseignant_id: "", matiere_id: "", coefficient: "1" });
  const [sel, setSel] = useState(() => new Set()); // classes cochées
  const [envoi, setEnvoi] = useState(false);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const pretAjout = enseignants.length && classes.length && matieres.length && annee;

  const basculer = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toutes = () => setSel((s) => (s.size === classes.length ? new Set() : new Set(classes.map((c) => c.id))));

  // Une matière déjà affectée dans une classe (unicité classe × matière × année).
  const dejaPrise = (classeId) => affectations.some((a) => a.classe_id === classeId && a.matiere_id === f.matiere_id);

  async function ajouter(e) {
    e.preventDefault();
    onErreur("");
    if (!f.enseignant_id || !f.matiere_id) return onErreur("Choisissez l'enseignant et la matière.");
    if (sel.size === 0) return onErreur("Cochez au moins une classe.");
    setEnvoi(true);
    let faites = 0, ignorees = 0;
    try {
      for (const classe_id of sel) {
        try { await api.creerAffectation(ecoleId, { ...f, classe_id, annee_id: annee.id }); faites += 1; }
        catch (er) {
          if (/duplicate|unique|existe/i.test(er.message)) ignorees += 1; else throw er;
        }
      }
      setF({ enseignant_id: "", matiere_id: "", coefficient: "1" });
      setSel(new Set());
      onChange();
      toast.succes(`${faites} affectation(s) créée(s)${ignorees ? ` · ${ignorees} déjà existante(s)` : ""}.`);
    } catch (er) { onErreur(er.message); }
    finally { setEnvoi(false); }
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
          <form onSubmit={ajouter} className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <Sel label="Enseignant" value={f.enseignant_id} onChange={(v) => maj("enseignant_id", v)}
                options={enseignants.map((e) => [e.id, `${e.prenom} ${e.nom}`])} />
              <Sel label="Matière" value={f.matiere_id} onChange={(v) => maj("matiere_id", v)}
                options={matieres.map((m) => [m.id, m.libelle])} />
              <div className="w-24"><Champ label="Coef." value={f.coefficient} onChange={(e) => maj("coefficient", e.target.value.replace(/[^0-9.]/g, ""))} /></div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-navy-900/50">
                  Classes — cochez-en autant que nécessaire {sel.size > 0 && <b className="text-navy-900">({sel.size})</b>}
                </span>
                <button type="button" onClick={toutes} className="text-xs font-medium text-navy-700 hover:text-or-600">
                  {sel.size === classes.length ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {classes.map((c) => {
                  const prise = f.matiere_id && dejaPrise(c.id);
                  return (
                    <label key={c.id}
                      title={prise ? "Cette matière est déjà affectée dans cette classe" : ""}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        sel.has(c.id) ? "border-or-500 bg-or-500/5" : "border-navy-900/10"
                      } ${prise ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={sel.has(c.id)} onChange={() => basculer(c.id)}
                        className="h-4 w-4 rounded border-navy-900/30 accent-navy-900" />
                      <span className="truncate">{c.libelle}</span>
                      {prise && <span className="ml-auto text-[10px] text-navy-900/40">déjà</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Bouton type="submit" disabled={envoi || sel.size === 0}>
                {envoi ? "Affectation…" : `Affecter à ${sel.size || ""} classe(s)`}
              </Bouton>
            </div>
          </form>
        )}
      </Carte>

      {Object.keys(parClasse).length === 0 ? (
        <EtatVide icone="🗂️" titre="Aucune affectation">Affectez des matières aux enseignants avec le formulaire ci-dessus.</EtatVide>
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
          <Champ label="Téléphone" type="tel" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
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
