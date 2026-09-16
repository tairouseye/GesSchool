import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/superieur.js";
import { TYPES_UE, DIPLOMES, totalCredits, ecartCreditsSemestre } from "@/lib/lmd.js";

const libelleDiplome = (d) => DIPLOMES.find(([v]) => v === d)?.[1] || d;
const libelleTypeUe = (t) => TYPES_UE.find(([v]) => v === t)?.[1] || t;

// --- Formulaire générique (ajout / édition) pour chaque niveau LMD ---
const CHAMPS = {
  faculte: [["nom", "Nom", "text", true], ["sigle", "Sigle", "text"]],
  departement: [["nom", "Nom du département", "text", true]],
  filiere: [["nom", "Nom de la filière / mention", "text", true], ["sigle", "Sigle", "text"], ["diplome", "Diplôme", "diplome"]],
  semestre: [["libelle", "Libellé", "text", true], ["niveau", "Niveau (L1…M2)", "text"], ["numero", "N° de semestre", "number"], ["credits_requis", "Crédits requis", "number"]],
  ue: [["code", "Code", "text"], ["intitule", "Intitulé de l'UE", "text", true], ["credits", "Crédits", "number", true], ["coefficient", "Coefficient", "number"], ["type_ue", "Type", "type_ue"]],
  ecue: [["code", "Code", "text"], ["intitule", "Intitulé de l'ECUE", "text", true], ["credits", "Crédits", "number"], ["coefficient", "Coefficient", "number"]],
};
const TITRES = { faculte: "Faculté / UFR / Institut", departement: "Département", filiere: "Filière", semestre: "Semestre", ue: "Unité d'enseignement (UE)", ecue: "Élément constitutif (ECUE)" };

function ModaleForm({ kind, edit, onFermer, onValider }) {
  const champs = CHAMPS[kind] || [];
  const [f, setF] = useState({});
  useEffect(() => {
    const init = {};
    for (const [k] of champs) init[k] = edit?.[k] ?? "";
    if (kind === "filiere" && !edit) init.diplome = "licence";
    if (kind === "ue" && !edit) init.type_ue = "fondamentale";
    if (kind === "semestre" && !edit && (init.credits_requis === "" || init.credits_requis == null)) init.credits_requis = 30;
    if ((kind === "ue" || kind === "ecue") && !edit && (init.coefficient === "" || init.coefficient == null)) init.coefficient = 1;
    setF(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, edit]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modale ouvert={!!kind} onFermer={onFermer} titre={`${edit ? "Modifier" : "Ajouter"} — ${TITRES[kind] || ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onValider(f); }}>
        {champs.map(([k, label, type, requis]) => (
          type === "diplome" ? (
            <label key={k} className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>
              <select value={f[k] || "licence"} onChange={(e) => maj(k, e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                {DIPLOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ) : type === "type_ue" ? (
            <label key={k} className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>
              <select value={f[k] || "fondamentale"} onChange={(e) => maj(k, e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                {TYPES_UE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ) : (
            <Champ key={k} label={label + (requis ? " *" : "")} type={type === "number" ? "number" : "text"}
              value={f[k] ?? ""} onChange={(e) => maj(k, e.target.value)} />
          )
        ))}
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">{edit ? "Enregistrer" : "Ajouter"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}

// Sélecteur d'un niveau de la hiérarchie + actions (ajouter / modifier / supprimer).
function Cascade({ label, items, valeur, onChoisir, onAjouter, onModifier, onSupprimer, rendu, vide }) {
  const courant = items.find((x) => x.id === valeur);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-[180px] flex-1">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">{label}</span>
        <select value={valeur || ""} onChange={(e) => onChoisir(e.target.value || null)}
          className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
          <option value="">{items.length ? "— Choisir —" : vide}</option>
          {items.map((x) => <option key={x.id} value={x.id}>{rendu(x)}</option>)}
        </select>
      </label>
      <div className="flex gap-1.5 pb-0.5">
        <button type="button" onClick={onAjouter} title={`Ajouter ${label}`}
          className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-creme hover:bg-navy-800">＋</button>
        {courant && (
          <>
            <button type="button" onClick={() => onModifier(courant)} title="Modifier"
              className="rounded-lg border border-navy-900/15 px-3 py-2 text-sm hover:border-or-500">✎</button>
            <button type="button" onClick={() => onSupprimer(courant)} title="Supprimer"
              className="rounded-lg border border-navy-900/15 px-3 py-2 text-sm text-rose-500 hover:border-rose-400">🗑</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Filieres() {
  const { ecoleId, typeEtablissement } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();

  const [facultes, setFacultes] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [maquette, setMaquette] = useState([]);

  const [faculteId, setFaculteId] = useState(null);
  const [departementId, setDepartementId] = useState(null);
  const [filiereId, setFiliereId] = useState(null);
  const [semestreId, setSemestreId] = useState(null);

  const [modal, setModal] = useState(null); // { kind, edit }
  const [erreur, setErreur] = useState("");

  const wrap = async (fn, ok) => {
    setErreur("");
    try { await fn(); if (ok) toast.succes(ok); }
    catch (e) { setErreur(e.message); toast.erreur(e.message || "Erreur."); }
  };

  // Chargements en cascade
  useEffect(() => { if (ecoleId) api.getFacultes(ecoleId).then(setFacultes).catch((e) => setErreur(e.message)); }, [ecoleId]);
  useEffect(() => {
    if (!faculteId) { setDepartements([]); return; }
    api.getDepartements(ecoleId, faculteId).then(setDepartements).catch((e) => setErreur(e.message));
  }, [ecoleId, faculteId]);
  useEffect(() => {
    if (!departementId) { setFilieres([]); return; }
    api.getFilieres(ecoleId, departementId).then(setFilieres).catch((e) => setErreur(e.message));
  }, [ecoleId, departementId]);
  useEffect(() => {
    if (!filiereId) { setSemestres([]); return; }
    api.getSemestres(ecoleId, filiereId).then(setSemestres).catch((e) => setErreur(e.message));
  }, [ecoleId, filiereId]);
  const rechargerMaquette = useCallback(() => {
    if (!semestreId) { setMaquette([]); return; }
    api.getMaquette(ecoleId, semestreId).then(setMaquette).catch((e) => setErreur(e.message));
  }, [ecoleId, semestreId]);
  useEffect(() => { rechargerMaquette(); }, [rechargerMaquette]);

  // Réinitialise les niveaux inférieurs quand un parent change.
  const choisirFaculte = (id) => { setFaculteId(id); setDepartementId(null); setFiliereId(null); setSemestreId(null); };
  const choisirDepartement = (id) => { setDepartementId(id); setFiliereId(null); setSemestreId(null); };
  const choisirFiliere = (id) => { setFiliereId(id); setSemestreId(null); };

  // Soumission du formulaire générique
  async function valider(v) {
    const k = modal.kind, edit = modal.edit;
    await wrap(async () => {
      if (k === "faculte") edit ? await api.modifierFaculte(edit.id, v) : await api.creerFaculte(ecoleId, v);
      else if (k === "departement") edit ? await api.modifierDepartement(edit.id, v) : await api.creerDepartement(ecoleId, faculteId, v);
      else if (k === "filiere") edit ? await api.modifierFiliere(edit.id, v) : await api.creerFiliere(ecoleId, departementId, v);
      else if (k === "semestre") edit ? await api.modifierSemestre(edit.id, v) : await api.creerSemestre(ecoleId, filiereId, v);
      else if (k === "ue") edit ? await api.modifierUE(edit.id, v) : await api.creerUE(ecoleId, filiereId, semestreId, v);
      else if (k === "ecue") edit ? await api.modifierECUE(edit.id, v) : await api.creerECUE(ecoleId, modal.parentId, v);

      // Recharge le niveau concerné
      if (k === "faculte") setFacultes(await api.getFacultes(ecoleId));
      else if (k === "departement") setDepartements(await api.getDepartements(ecoleId, faculteId));
      else if (k === "filiere") setFilieres(await api.getFilieres(ecoleId, departementId));
      else if (k === "semestre") setSemestres(await api.getSemestres(ecoleId, filiereId));
      else rechargerMaquette();
    }, edit ? "Modifié." : "Ajouté.");
    setModal(null);
  }

  async function supprimer(kind, row, apres) {
    const q = { faculte: "cette faculté", departement: "ce département", filiere: "cette filière", semestre: "ce semestre", ue: "cette UE", ecue: "cet ECUE" }[kind];
    if (!(await confirmer(`Supprimer ${q} ? Tout ce qu'elle contient sera aussi supprimé.`))) return;
    const fn = { faculte: api.supprimerFaculte, departement: api.supprimerDepartement, filiere: api.supprimerFiliere, semestre: api.supprimerSemestre, ue: api.supprimerUE, ecue: api.supprimerECUE }[kind];
    await wrap(() => fn(row.id), "Supprimé.");
    apres?.();
  }

  const semestre = semestres.find((s) => s.id === semestreId);
  const total = totalCredits(maquette);
  const requis = semestre?.credits_requis ?? 30;
  const ecart = ecartCreditsSemestre(maquette, requis);

  return (
    <>
      <EnTete titre="Filières & maquettes" sousTitre="Structure académique LMD — UE, ECUE et crédits par semestre" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {typeEtablissement !== "superieur" && (
          <Alerte ton="info">
            Cet établissement n'est pas encore en mode « Supérieur ». Vous pouvez préparer la structure ici ;
            pour l'activer, passez le <b>type d'établissement</b> sur « Enseignement supérieur » dans Paramètres → Établissement.
          </Alerte>
        )}

        {/* Cascade de sélection */}
        <Carte className="space-y-3 p-5">
          <Cascade label="Faculté / UFR" items={facultes} valeur={faculteId}
            vide="Aucune faculté — ajoutez-en une"
            rendu={(x) => `${x.nom}${x.sigle ? ` (${x.sigle})` : ""}`}
            onChoisir={choisirFaculte}
            onAjouter={() => setModal({ kind: "faculte" })}
            onModifier={(row) => setModal({ kind: "faculte", edit: row })}
            onSupprimer={(row) => supprimer("faculte", row, () => choisirFaculte(null))} />

          {faculteId && (
            <Cascade label="Département" items={departements} valeur={departementId}
              vide="Aucun département — ajoutez-en un"
              rendu={(x) => x.nom}
              onChoisir={choisirDepartement}
              onAjouter={() => setModal({ kind: "departement" })}
              onModifier={(row) => setModal({ kind: "departement", edit: row })}
              onSupprimer={(row) => supprimer("departement", row, () => choisirDepartement(null))} />
          )}

          {departementId && (
            <Cascade label="Filière / Mention" items={filieres} valeur={filiereId}
              vide="Aucune filière — ajoutez-en une"
              rendu={(x) => `${x.nom} — ${libelleDiplome(x.diplome)}`}
              onChoisir={choisirFiliere}
              onAjouter={() => setModal({ kind: "filiere" })}
              onModifier={(row) => setModal({ kind: "filiere", edit: row })}
              onSupprimer={(row) => supprimer("filiere", row, () => choisirFiliere(null))} />
          )}
        </Carte>

        {/* Semestres + maquette */}
        {filiereId && (
          <Carte className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-navy-900/45">Semestres</span>
              {semestres.map((s) => (
                <button key={s.id} type="button" onClick={() => setSemestreId(s.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${semestreId === s.id ? "bg-navy-900 text-creme" : "border border-navy-900/15 text-navy-900/70 hover:border-or-500"}`}>
                  {s.libelle}
                </button>
              ))}
              <button type="button" onClick={() => setModal({ kind: "semestre" })}
                className="rounded-full border border-dashed border-navy-900/25 px-3 py-1.5 text-sm text-navy-900/60 hover:border-or-500">＋ semestre</button>
            </div>

            {!semestre ? (
              <EtatVide icone="🎓" titre="Choisissez un semestre">Ajoutez un semestre puis composez sa maquette (UE &amp; ECUE).</EtatVide>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-creme/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-navy-900">{semestre.libelle}</span>
                    <button type="button" onClick={() => setModal({ kind: "semestre", edit: semestre })} className="text-xs text-navy-900/50 hover:text-or-600">✎ modifier</button>
                    <button type="button" onClick={() => supprimer("semestre", semestre, () => setSemestreId(null))} className="text-xs text-rose-500 hover:underline">🗑 suppr.</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ecart === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {total} / {requis} crédits {ecart === 0 ? "✓" : ecart > 0 ? `(+${ecart})` : `(${ecart})`}
                    </span>
                    <Bouton onClick={() => setModal({ kind: "ue" })}>＋ UE</Bouton>
                  </div>
                </div>

                {maquette.length === 0 ? (
                  <EtatVide icone="📘" titre="Maquette vide">Ajoutez les unités d'enseignement de ce semestre.</EtatVide>
                ) : (
                  <div className="space-y-3">
                    {maquette.map((u) => (
                      <div key={u.id} className="rounded-xl border border-navy-900/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-navy-900">
                              {u.code ? <span className="mr-2 font-mono text-xs text-navy-900/50">{u.code}</span> : null}
                              {u.intitule}
                            </p>
                            <p className="mt-0.5 text-xs text-navy-900/50">
                              {libelleTypeUe(u.type_ue)} · <b>{Number(u.credits)}</b> crédits · coef. {Number(u.coefficient)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button type="button" onClick={() => setModal({ kind: "ecue", parentId: u.id })} className="text-navy-700 hover:text-or-600">＋ ECUE</button>
                            <button type="button" onClick={() => setModal({ kind: "ue", edit: u })} className="text-navy-700 hover:text-or-600">✎</button>
                            <button type="button" onClick={() => supprimer("ue", u, rechargerMaquette)} className="text-rose-500 hover:underline">🗑</button>
                          </div>
                        </div>

                        {u.ecues.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-t border-navy-900/5 pt-3">
                            {u.ecues.map((ec) => (
                              <li key={ec.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-navy-900/80">
                                  {ec.code ? <span className="mr-2 font-mono text-xs text-navy-900/40">{ec.code}</span> : null}
                                  {ec.intitule}
                                  <span className="ml-2 text-xs text-navy-900/45">{Number(ec.credits)} cr. · coef. {Number(ec.coefficient)}</span>
                                </span>
                                <span className="flex gap-2 text-xs">
                                  <button type="button" onClick={() => setModal({ kind: "ecue", parentId: u.id, edit: ec })} className="text-navy-700 hover:text-or-600">✎</button>
                                  <button type="button" onClick={() => supprimer("ecue", ec, rechargerMaquette)} className="text-rose-500 hover:underline">🗑</button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Carte>
        )}
      </div>

      {modal && (
        <ModaleForm kind={modal.kind} edit={modal.edit} onFermer={() => setModal(null)} onValider={valider} />
      )}
    </>
  );
}
