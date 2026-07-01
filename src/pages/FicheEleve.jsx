import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/eleves.js";
import { genererCodeTuteur } from "@/lib/parent.js";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { peutEditerEleves, peutGererParents } from "@/lib/permissions.js";
import Photo from "@/composants/Photo.jsx";

export default function FicheEleve() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ecoleId, roles } = useAuth();
  const peutEditer = peutEditerEleves(roles);
  const gereParents = peutGererParents(roles); // responsable pédagogique : codes parents
  const [eleve, setEleve] = useState(null);
  const [tuteurs, setTuteurs] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modaleTuteur, setModaleTuteur] = useState(false);
  const [modaleInscr, setModaleInscr] = useState(false);
  const [modaleEdit, setModaleEdit] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [codes, setCodes] = useState({}); // tuteur_id -> code parent

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [el, tut, insc, cls] = await Promise.all([
        api.getEleve(id),
        api.getTuteursEleve(id),
        api.getInscriptionsEleve(id),
        getClasses(ecoleId, an?.id),
      ]);
      setEleve(el);
      setTuteurs(tut);
      setInscriptions(insc);
      setClasses(cls);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [id, ecoleId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const wrap = async (fn) => {
    setErreur("");
    try {
      await fn();
      await recharger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  if (chargement) return (<><EnTete titre="Fiche élève" /><div className="p-8 text-navy-900/50">Chargement…</div></>);
  if (!eleve) return (<><EnTete titre="Fiche élève" /><div className="p-8 text-navy-900/50">Élève introuvable.</div></>);

  return (
    <>
      <EnTete
        titre={`${eleve.prenom} ${eleve.nom}`}
        sousTitre={eleve.matricule}
        action={<Bouton variante="fantome" onClick={() => navigate("/eleves")}>← Liste</Bouton>}
      />
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-3">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Infos */}
        <Carte className="p-6 lg:col-span-1">
          {/* Photo */}
          <div className="mb-5 flex flex-col items-center">
            <Photo
              bucket="eleves"
              valeur={eleve.photo_url}
              alt=""
              className="h-24 w-24 rounded-full object-cover ring-2 ring-or-500/40"
              fallback={
                <span className="grid h-24 w-24 place-items-center rounded-full bg-navy-900/10 font-display text-2xl font-bold text-navy-900/50">
                  {(eleve.prenom?.[0] || "").toUpperCase()}{(eleve.nom?.[0] || "").toUpperCase()}
                </span>
              }
            />
            {peutEditer && (
              <label className="mt-3 cursor-pointer text-xs text-navy-700 hover:text-or-500">
                {photoEnCours ? "Envoi…" : eleve.photo_url ? "Changer la photo" : "Ajouter une photo"}
                <input
                  type="file" accept="image/*" className="hidden" disabled={photoEnCours}
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    setPhotoEnCours(true);
                    await wrap(async () => {
                      const url = await api.televerserPhoto(ecoleId, eleve.id, file);
                      await api.majEleve(eleve.id, { photo_url: url });
                    });
                    setPhotoEnCours(false);
                  }}
                />
              </label>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-navy-900">État civil</h3>
            {peutEditer && (
              <button onClick={() => setModaleEdit(true)} className="text-xs text-navy-700 hover:text-or-500">
                Modifier
              </button>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <Info label="Matricule" valeur={eleve.matricule} mono />
            <Info label="Sexe" valeur={eleve.sexe === "M" ? "Masculin" : eleve.sexe === "F" ? "Féminin" : "—"} />
            <Info label="Naissance" valeur={eleve.date_naissance || "—"} />
            <Info label="Lieu" valeur={eleve.lieu_naissance || "—"} />
            <Info label="Nationalité" valeur={eleve.nationalite || "—"} />
            <Info label="Adresse" valeur={eleve.adresse || "—"} />
          </dl>
          {peutEditer && (
            <Bouton
              variante="fantome"
              className="mt-5 w-full text-rose-600"
              onClick={() => {
                if (confirm("Supprimer définitivement cet élève ?")) {
                  wrap(async () => {
                    await api.supprimerEleve(eleve.id);
                    navigate("/eleves");
                  });
                }
              }}
            >
              Supprimer l'élève
            </Bouton>
          )}
        </Carte>

        <div className="space-y-6 lg:col-span-2">
          {/* Tuteurs */}
          <Carte className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-navy-900">Responsables</h3>
              {peutEditer && <Bouton variante="fantome" onClick={() => setModaleTuteur(true)}>+ Ajouter</Bouton>}
            </div>
            {tuteurs.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun responsable enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {tuteurs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-3">
                    <div>
                      <p className="font-medium text-navy-900">
                        {t.tuteurs.prenom} {t.tuteurs.nom}
                        {t.lien_parente && <span className="ml-2 text-xs text-navy-900/50">({t.lien_parente})</span>}
                      </p>
                      <p className="text-xs text-navy-900/50">
                        {t.tuteurs.telephone || "—"}
                        {t.responsable_paiement && <span className="ml-2 text-or-500">• paiement</span>}
                        {t.responsable_legal && <span className="ml-2 text-navy-900/40">• légal</span>}
                      </p>
                    </div>
                    {(peutEditer || gereParents) && (
                    <div className="flex flex-col items-end gap-1">
                      {codes[t.tuteurs.id] ? (
                        <span className="rounded-lg bg-or-500/15 px-2 py-1 font-mono text-xs font-bold tracking-widest text-or-600">
                          {codes[t.tuteurs.id]}
                        </span>
                      ) : (
                        <button
                          onClick={async () => {
                            setErreur("");
                            try {
                              const code = await genererCodeTuteur(t.tuteurs.id);
                              setCodes((s) => ({ ...s, [t.tuteurs.id]: code }));
                            } catch (e) { setErreur(e.message); }
                          }}
                          className="text-xs text-navy-700 hover:text-or-500"
                        >
                          Code parent
                        </button>
                      )}
                      {peutEditer && (
                        <button onClick={() => wrap(() => api.retirerLienTuteur(t.id))} className="text-xs text-rose-500 hover:underline">
                          retirer
                        </button>
                      )}
                    </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          {/* Inscriptions */}
          <Carte className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-navy-900">Inscriptions</h3>
              {peutEditer && (
                <Bouton onClick={() => setModaleInscr(true)} disabled={!annee || classes.length === 0}>
                  {inscriptions.some((i) => i.annee_id === annee?.id) ? "Changer de classe" : "Inscrire"}
                </Bouton>
              )}
            </div>
            {inscriptions.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucune inscription.</p>
            ) : (
              <ul className="space-y-2">
                {inscriptions.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-3 text-sm">
                    <span className="font-medium text-navy-900">{i.classes?.libelle || "—"}</span>
                    <span className="text-navy-900/50">{i.annees_scolaires?.libelle}</span>
                    <span className="rounded-full border border-navy-900/15 bg-navy-900/5 px-2.5 py-0.5 text-xs">{i.statut}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      </div>

      {/* Modale édition élève */}
      <ModaleEditEleve
        ouvert={modaleEdit}
        onFermer={() => setModaleEdit(false)}
        eleve={eleve}
        onEnregistrer={(maj) => wrap(async () => { await api.majEleve(eleve.id, maj); setModaleEdit(false); })}
      />

      {/* Modale ajout tuteur */}
      <ModaleTuteur
        ouvert={modaleTuteur}
        onFermer={() => setModaleTuteur(false)}
        onAjout={(t, lien) => wrap(async () => { await api.ajouterTuteur(ecoleId, id, t, lien); setModaleTuteur(false); })}
      />

      {/* Modale inscription */}
      <ModaleInscription
        ouvert={modaleInscr}
        onFermer={() => setModaleInscr(false)}
        classes={classes}
        annee={annee}
        onInscrire={(classeId, redoublant) =>
          wrap(async () => { await api.inscrire(ecoleId, id, classeId, annee.id, "inscrit", redoublant); setModaleInscr(false); })
        }
      />
    </>
  );
}

function Info({ label, valeur, mono }) {
  return (
    <div className="flex justify-between border-b border-navy-900/5 pb-1.5">
      <dt className="text-navy-900/50">{label}</dt>
      <dd className={`font-medium text-navy-900 ${mono ? "font-mono text-xs" : ""}`}>{valeur}</dd>
    </div>
  );
}

function ModaleEditEleve({ ouvert, onFermer, eleve, onEnregistrer }) {
  const [f, setF] = useState({});
  useEffect(() => {
    if (eleve) setF({
      prenom: eleve.prenom || "", nom: eleve.nom || "", sexe: eleve.sexe || "",
      date_naissance: eleve.date_naissance || "", lieu_naissance: eleve.lieu_naissance || "",
      nationalite: eleve.nationalite || "", adresse: eleve.adresse || "",
    });
  }, [eleve, ouvert]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Modifier l'élève" large>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onEnregistrer({
            prenom: f.prenom.trim(), nom: f.nom.trim(), sexe: f.sexe || null,
            date_naissance: f.date_naissance || null, lieu_naissance: f.lieu_naissance || null,
            nationalite: f.nationalite || null, adresse: f.adresse || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={f.prenom || ""} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={f.nom || ""} onChange={(e) => maj("nom", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Sexe</span>
            <select
              value={f.sexe || ""} onChange={(e) => maj("sexe", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </label>
          <Champ label="Naissance" type="date" value={f.date_naissance || ""} onChange={(e) => maj("date_naissance", e.target.value)} />
          <Champ label="Lieu" value={f.lieu_naissance || ""} onChange={(e) => maj("lieu_naissance", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Nationalité" value={f.nationalite || ""} onChange={(e) => maj("nationalite", e.target.value)} />
          <Champ label="Adresse" value={f.adresse || ""} onChange={(e) => maj("adresse", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!f.prenom?.trim() || !f.nom?.trim()}>Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleTuteur({ ouvert, onFermer, onAjout }) {
  const [t, setT] = useState({ prenom: "", nom: "", telephone: "", email: "", profession: "", lien: "Parent" });
  const maj = (k, v) => setT((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Ajouter un responsable">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAjout(
            { prenom: t.prenom.trim(), nom: t.nom.trim(), telephone: t.telephone, email: t.email, profession: t.profession },
            { lien_parente: t.lien, responsable_legal: true, responsable_paiement: true }
          );
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Champ label="Prénom *" value={t.prenom} onChange={(e) => maj("prenom", e.target.value)} required />
          <Champ label="Nom *" value={t.nom} onChange={(e) => maj("nom", e.target.value)} required />
          <Champ label="Téléphone" value={t.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          <Champ label="Lien" value={t.lien} onChange={(e) => maj("lien", e.target.value)} />
          <Champ label="E-mail" value={t.email} onChange={(e) => maj("email", e.target.value)} />
          <Champ label="Profession" value={t.profession} onChange={(e) => maj("profession", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!t.prenom.trim() || !t.nom.trim()}>Ajouter</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleInscription({ ouvert, onFermer, classes, annee, onInscrire }) {
  const [classeId, setClasseId] = useState("");
  const [redoublant, setRedoublant] = useState(false);
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre={`Inscription — ${annee?.libelle || ""}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (classeId) onInscrire(classeId, redoublant);
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Classe *</span>
          <select
            value={classeId} onChange={(e) => setClasseId(e.target.value)} required
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          >
            <option value="">— Choisir —</option>
            {classes.map((c) => (<option key={c.id} value={c.id}>{c.libelle}</option>))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-navy-900/70">
          <input type="checkbox" checked={redoublant} onChange={(e) => setRedoublant(e.target.checked)} />
          Redoublant
        </label>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={!classeId}>Valider</Bouton>
        </div>
      </form>
    </Modale>
  );
}
