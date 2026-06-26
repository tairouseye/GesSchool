import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/eleves.js";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { peutEditerEleves } from "@/lib/permissions.js";

// Phase 1 — Module Élèves & inscriptions : liste, recherche, création.
export default function Eleves() {
  const { ecoleId, ecole, roles } = useAuth();
  const peutEditer = peutEditerEleves(roles);
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [classes, setClasses] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtreClasse, setFiltreClasse] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [els, insc, cls] = await Promise.all([
        api.getEleves(ecoleId),
        api.getInscriptionsParEleve(ecoleId, an?.id),
        getClasses(ecoleId, an?.id),
      ]);
      setEleves(els);
      setInscriptions(insc);
      setClasses(cls);
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
            <Bouton onClick={() => setModale(true)} disabled={!annee}>
              + Nouvel élève
            </Bouton>
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
            <div className="p-8 text-sm text-navy-900/50">Chargement…</div>
          ) : filtres.length === 0 ? (
            <div className="p-8 text-sm text-navy-900/50">
              {eleves.length === 0 ? "Aucun élève. Créez le premier avec « + Nouvel élève »." : "Aucun résultat."}
            </div>
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
                          {e.photo_url ? (
                            <img src={e.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900/10 text-xs font-semibold text-navy-900/60">
                              {(e.prenom?.[0] || "").toUpperCase()}{(e.nom?.[0] || "").toUpperCase()}
                            </span>
                          )}
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
    </>
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
            <Champ label="Téléphone" value={f.t_tel} onChange={(e) => maj("t_tel", e.target.value)} />
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
