import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import * as api from "@/lib/eleves.js";
import { getAnneeCourante, getClasses, getChampsEleve } from "@/lib/academique.js";
import { peutEditerEleves } from "@/lib/permissions.js";
import Photo from "@/composants/Photo.jsx";

// Phase 1 — Module Élèves & inscriptions : liste, recherche, création.
export default function Eleves() {
  const { ecoleId, ecole, roles } = useAuth();
  const peutEditer = peutEditerEleves(roles);
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [classes, setClasses] = useState([]);
  const [champsPerso, setChampsPerso] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtreClasse, setFiltreClasse] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);
  const [modaleImport, setModaleImport] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [els, insc, cls, champs] = await Promise.all([
        api.getEleves(ecoleId),
        api.getInscriptionsParEleve(ecoleId, an?.id),
        getClasses(ecoleId, an?.id),
        getChampsEleve(ecoleId),
      ]);
      setEleves(els);
      setInscriptions(insc);
      setClasses(cls);
      setChampsPerso(champs);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const filtres = eleves.filter((e) => {
    const q = recherche.toLowerCase();
    const insc = inscriptions[e.id];
    const okRecherche =
      !q ||
      `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
      (e.matricule || "").toLowerCase().includes(q);
    const okClasse = !filtreClasse || insc?.classe_id === filtreClasse;
    const okStatut =
      !filtreStatut ||
      (filtreStatut === "non_inscrit" ? !insc : insc?.statut === filtreStatut);
    return okRecherche && okClasse && okStatut;
  });

  return (
    <>
      <EnTete
        titre="Élèves & inscriptions"
        sousTitre={annee ? `Année ${annee.libelle} · ${eleves.length} élève(s)` : "Aucune année courante"}
        action={
          peutEditer && (
            <div className="flex flex-wrap gap-2">
              <Bouton variante="fantome" onClick={() => setModaleImport(true)} disabled={!annee}>
                ↑ Importer (Excel)
              </Bouton>
              <Bouton onClick={() => setModale(true)} disabled={!annee}>
                + Nouvel élève
              </Bouton>
            </div>
          )
        }
      />
      <div className="space-y-4 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Carte className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-navy-900/10 p-4">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un élève, un matricule…"
              className="min-w-56 flex-1 rounded-xl border border-navy-900/15 bg-creme px-4 py-2 text-sm outline-none focus:border-or-500"
            />
            <select
              value={filtreClasse}
              onChange={(e) => setFiltreClasse(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.libelle}</option>
              ))}
            </select>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500"
            >
              <option value="">Tous les statuts</option>
              <option value="inscrit">Inscrit</option>
              <option value="reinscrit">Réinscrit</option>
              <option value="transfere">Transféré</option>
              <option value="abandon">Abandon</option>
              <option value="non_inscrit">Non inscrit</option>
            </select>
          </div>

          {chargement ? (
            <div className="p-4"><SkeletonListe lignes={6} /></div>
          ) : filtres.length === 0 ? (
            eleves.length === 0 ? (
              <EtatVide icone="🎓" titre="Aucun élève" className="m-4">
                Créez le premier élève avec « + Nouvel élève », ou importez une liste depuis Excel.
              </EtatVide>
            ) : (
              <EtatVide icone="🔍" titre="Aucun résultat" className="m-4">Aucun élève ne correspond à votre recherche.</EtatVide>
            )
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Matricule</th>
                  <th className="px-6 py-3 font-medium">Élève</th>
                  <th className="px-6 py-3 font-medium">Sexe</th>
                  <th className="px-6 py-3 font-medium">Classe</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((e) => {
                  const insc = inscriptions[e.id];
                  return (
                    <tr
                      key={e.id}
                      onClick={() => navigate(`/eleves/${e.id}`)}
                      className="cursor-pointer border-t border-navy-900/5 hover:bg-creme/60"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-navy-900/70">{e.matricule || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Photo
                            bucket="eleves"
                            valeur={e.photo_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                            fallback={
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900/10 text-xs font-semibold text-navy-900/60">
                                {(e.prenom?.[0] || "").toUpperCase()}{(e.nom?.[0] || "").toUpperCase()}
                              </span>
                            }
                          />
                          <span className="font-medium text-navy-900">{e.prenom} {e.nom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-navy-900/60">{e.sexe || "—"}</td>
                      <td className="px-6 py-4">{insc?.classes?.libelle || "—"}</td>
                      <td className="px-6 py-4">
                        {insc ? (
                          <span className="rounded-full border border-navy-900/15 bg-navy-900/5 px-2.5 py-0.5 text-xs">
                            {insc.statut}
                          </span>
                        ) : (
                          <span className="text-xs text-navy-900/40">non inscrit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Carte>
      </div>

      <ModaleNouvelEleve
        ouvert={modale}
        onFermer={() => setModale(false)}
        ecoleId={ecoleId}
        sigle={ecole?.sigle}
        annee={annee}
        classes={classes}
        onCree={() => {
          setModale(false);
          recharger();
        }}
      />

      <ModaleImport
        ouvert={modaleImport}
        onFermer={() => setModaleImport(false)}
        ecoleId={ecoleId}
        sigle={ecole?.sigle}
        annee={annee}
        classes={classes}
        champs={champsPerso}
        onFini={() => { setModaleImport(false); recharger(); }}
      />
    </>
  );
}

const TYPE_LABEL = { texte: "texte", nombre: "nombre", date: "date", liste: "liste" };

const CHAMPS_IMPORT = [
  ["prenom", "Prénom *", [/pr[ée]nom/i, /first/i]],
  ["nom", "Nom *", [/^nom$/i, /last|famille/i]],
  ["sexe", "Sexe", [/sexe|genre|sex/i]],
  ["date_naissance", "Date de naissance", [/naiss|birth|n[ée]\(e\)/i]],
  ["lieu_naissance", "Lieu de naissance", [/lieu/i]],
  ["matricule", "Matricule", [/matric/i]],
  ["classe", "Classe", [/classe|class/i]],
];

function deviner(entetes, patterns) {
  for (const p of patterns) {
    const h = entetes.find((e) => p.test(e));
    if (h) return h;
  }
  return "";
}

// Construit un motif de reconnaissance à partir d'un texte libre (libellé de champ).
function motifTexte(s) {
  try {
    return new RegExp((s || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  } catch {
    return /$^/;
  }
}

function ModaleImport({ ouvert, onFermer, ecoleId, sigle, annee, classes, champs = [], onFini }) {
  const [lignes, setLignes] = useState([]);
  const [entetes, setEntetes] = useState([]);
  const [mapping, setMapping] = useState({});
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  const reset = () => { setLignes([]); setEntetes([]); setMapping({}); setErreur(""); setResultat(null); };

  async function lireFichier(file) {
    setErreur(""); setResultat(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) { setErreur("Fichier vide."); return; }
      const cols = Object.keys(rows[0]);
      setEntetes(cols);
      setLignes(rows);
      const map = {};
      for (const [cle, , pats] of CHAMPS_IMPORT) map[cle] = deviner(cols, pats);
      for (const c of champs) map["perso:" + c.cle] = deviner(cols, [motifTexte(c.libelle), motifTexte(c.cle)]);
      setMapping(map);
    } catch (e) { setErreur("Lecture impossible : " + e.message); }
  }

  async function importer() {
    if (!mapping.prenom || !mapping.nom) { setErreur("Associe au moins les colonnes Prénom et Nom."); return; }
    setEnCours(true); setErreur("");
    try {
      const data = lignes.map((r) => {
        const o = {};
        for (const [cle] of CHAMPS_IMPORT) o[cle] = mapping[cle] ? r[mapping[cle]] : "";
        const cp = {};
        for (const c of champs) {
          const col = mapping["perso:" + c.cle];
          if (col && r[col] !== "" && r[col] != null) cp[c.cle] = r[col];
        }
        o.champs_perso = cp;
        return o;
      });
      const res = await api.importerEleves(ecoleId, annee?.id, data, classes, sigle, champs);
      setResultat(res);
    } catch (e) { setErreur(e.message); }
    finally { setEnCours(false); }
  }

  return (
    <Modale ouvert={ouvert} onFermer={() => { reset(); onFermer(); }} titre="Importer des élèves (Excel/CSV)" large>
      <div className="space-y-4">
        <Alerte ton="erreur">{erreur}</Alerte>

        {!resultat && (
          <>
            <div className="rounded-xl border border-dashed border-navy-900/20 p-4 text-sm">
              <input type="file" accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && lireFichier(e.target.files[0])}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm" />
              <p className="mt-2 text-xs text-navy-900/40">
                1ʳᵉ ligne = en-têtes. Colonnes reconnues : Prénom, Nom, Sexe, Date de naissance, Lieu, Matricule, Classe
                {champs.length > 0 ? ", + vos champs personnalisés" : ""}. Toutes les colonnes sont associables ci-dessous.
              </p>
            </div>

            {entetes.length > 0 && (
              <>
                <p className="text-sm text-navy-900/60">{lignes.length} ligne(s) détectée(s). Vérifie l'association des colonnes :</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CHAMPS_IMPORT.map(([cle, label]) => (
                    <label key={cle} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-navy-900/70">{label}</span>
                      <select value={mapping[cle] || ""} onChange={(e) => setMapping((s) => ({ ...s, [cle]: e.target.value }))}
                        className="w-44 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-or-500">
                        <option value="">—</option>
                        {entetes.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-navy-900/40">
                  La colonne « Classe » doit correspondre au libellé exact d'une classe existante pour inscrire l'élève.
                </p>

                {champs.length > 0 && (
                  <>
                    <p className="border-t border-navy-900/10 pt-3 text-sm font-medium text-navy-900/70">
                      Champs personnalisés de l'école
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {champs.map((c) => (
                        <label key={c.cle} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-navy-900/70">
                            {c.libelle}
                            <span className="ml-1 text-xs text-navy-900/40">({TYPE_LABEL[c.type] || c.type})</span>
                          </span>
                          <select value={mapping["perso:" + c.cle] || ""}
                            onChange={(e) => setMapping((s) => ({ ...s, ["perso:" + c.cle]: e.target.value }))}
                            className="w-44 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-or-500">
                            <option value="">—</option>
                            {entetes.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2">
                  <Bouton type="button" variante="fantome" onClick={() => { reset(); onFermer(); }}>Annuler</Bouton>
                  <Bouton type="button" onClick={importer} disabled={enCours}>
                    {enCours ? "Import en cours…" : `Importer ${lignes.length} élève(s)`}
                  </Bouton>
                </div>
              </>
            )}
          </>
        )}

        {resultat && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ {resultat.crees} élève(s) créé(s){resultat.inscrits ? ` · ${resultat.inscrits} inscrit(s)` : ""}
              {resultat.ignores ? ` · ${resultat.ignores} ignoré(s) (prénom/nom manquant)` : ""}.
            </div>
            <div className="flex justify-end">
              <Bouton onClick={() => { reset(); onFini(); }}>Terminer</Bouton>
            </div>
          </div>
        )}
      </div>
    </Modale>
  );
}

function ModaleNouvelEleve({ ouvert, onFermer, ecoleId, sigle, annee, classes, onCree }) {
  const vide = {
    prenom: "", nom: "", sexe: "", date_naissance: "", lieu_naissance: "",
    classe_id: "", t_prenom: "", t_nom: "", t_tel: "", t_lien: "Parent",
  };
  const [f, setF] = useState(vide);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const matricule = await api.genererMatricule(ecoleId, sigle);
      const eleve = await api.creerEleve(ecoleId, {
        matricule,
        prenom: f.prenom.trim(),
        nom: f.nom.trim(),
        sexe: f.sexe || null,
        date_naissance: f.date_naissance || null,
        lieu_naissance: f.lieu_naissance || null,
      });
      if (f.classe_id && annee) {
        await api.inscrire(ecoleId, eleve.id, f.classe_id, annee.id);
      }
      if (f.t_prenom.trim() && f.t_nom.trim()) {
        await api.ajouterTuteur(
          ecoleId, eleve.id,
          { prenom: f.t_prenom.trim(), nom: f.t_nom.trim(), telephone: f.t_tel.trim() },
          { lien_parente: f.t_lien, responsable_legal: true, responsable_paiement: true }
        );
      }
      setF(vide);
      onCree();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouvel élève" large>
      <form onSubmit={soumettre} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={f.nom} onChange={(e) => maj("nom", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Sexe</span>
            <select
              value={f.sexe} onChange={(e) => maj("sexe", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </label>
          <Champ label="Date de naissance" type="date" value={f.date_naissance} onChange={(e) => maj("date_naissance", e.target.value)} />
          <Champ label="Lieu de naissance" value={f.lieu_naissance} onChange={(e) => maj("lieu_naissance", e.target.value)} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Classe (inscription année courante)</span>
          <select
            value={f.classe_id} onChange={(e) => maj("classe_id", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          >
            <option value="">— Pas d'inscription pour l'instant —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.libelle}</option>
            ))}
          </select>
          {classes.length === 0 && (
            <span className="mt-1 block text-xs text-navy-900/40">
              Aucune classe : créez-en dans « Structure » pour pouvoir inscrire.
            </span>
          )}
        </label>

        <div className="rounded-xl border border-navy-900/10 bg-creme/50 p-4">
          <p className="mb-3 text-sm font-medium text-navy-900/70">Responsable (optionnel)</p>
          <div className="grid grid-cols-2 gap-4">
            <Champ label="Prénom" value={f.t_prenom} onChange={(e) => maj("t_prenom", e.target.value)} />
            <Champ label="Nom" value={f.t_nom} onChange={(e) => maj("t_nom", e.target.value)} />
            <Champ label="Téléphone" type="tel" value={f.t_tel} onChange={(e) => maj("t_tel", e.target.value)} />
            <Champ label="Lien" value={f.t_lien} onChange={(e) => maj("t_lien", e.target.value)} placeholder="Père, Mère, Tuteur…" />
          </div>
        </div>

        <Alerte ton="erreur">{erreur}</Alerte>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={enCours || !f.prenom.trim() || !f.nom.trim()}>
            {enCours ? "Création…" : "Créer l'élève"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
