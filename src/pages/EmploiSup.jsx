import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/emploiSup.js";
import { getFilieres, getSemestres, getMaquette } from "@/lib/superieur.js";
import { getEnseignants } from "@/lib/enseignants.js";
import { getAnneeCourante } from "@/lib/academique.js";

// Pédagogie — emploi du temps du supérieur.
// On planifie par filière et semestre : c'est la maille réelle d'une
// université, qui n'a pas de classes (cf. migration 138).
export default function EmploiSup() {
  const { ecoleId } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [annee, setAnnee] = useState(null);
  const [filieres, setFilieres] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [filiereId, setFiliereId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [seances, setSeances] = useState([]);
  const [maquette, setMaquette] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [edite, setEdite] = useState(null);

  useEffect(() => {
    if (!ecoleId) return;
    getAnneeCourante(ecoleId).then(setAnnee).catch(() => {});
    getEnseignants(ecoleId).then(setEnseignants).catch(() => {});
    getFilieres(ecoleId)
      .then((f) => {
        setFilieres(f);
        setFiliereId((cur) => cur || f[0]?.id || "");
      })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, [ecoleId]);

  useEffect(() => {
    if (!ecoleId || !filiereId) { setSemestres([]); setSemestreId(""); return; }
    getSemestres(ecoleId, filiereId)
      .then((s) => {
        setSemestres(s);
        setSemestreId((cur) => (s.some((x) => x.id === cur) ? cur : (s[0]?.id || "")));
      })
      .catch((e) => setErreur(e.message));
  }, [ecoleId, filiereId]);

  const recharger = useCallback(async () => {
    if (!ecoleId || !semestreId) { setSeances([]); setMaquette([]); return; }
    try {
      const [s, m] = await Promise.all([
        api.getSeances(ecoleId, semestreId, annee?.id),
        getMaquette(ecoleId, semestreId),
      ]);
      setSeances(s);
      setMaquette(m);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, semestreId, annee?.id]);
  useEffect(() => { recharger(); }, [recharger]);

  async function supprimer(s) {
    if (!(await confirmer("Supprimer cette séance de l'emploi du temps ?"))) return;
    try {
      await api.supprimerSeance(s.id);
      toast.succes("Séance supprimée.");
      recharger();
    } catch (e) { toast.erreur(e); }
  }

  const conflits = useMemo(() => api.chevauchements(seances), [seances]);
  const jours = useMemo(() => api.parJour(seances), [seances]);

  return (
    <>
      <EnTete
        titre="Emploi du temps"
        sousTitre="Séances par filière et semestre"
        action={<Bouton onClick={() => setEdite({})} disabled={!semestreId}>+ Nouvelle séance</Bouton>}
      />

      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Filière</span>
            <select value={filiereId} onChange={(e) => setFiliereId(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {filieres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Semestre</span>
            <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {semestres.length === 0 && <option value="">—</option>}
              {semestres.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
            </select>
          </label>
          <span className="ml-auto self-center text-sm text-navy-900/50">
            {seances.length} séance{seances.length > 1 ? "s" : ""}
            {annee?.libelle ? ` · ${annee.libelle}` : ""}
          </span>
        </Carte>

        {conflits.size > 0 && (
          <Alerte ton="or">
            {conflits.size} séances se chevauchent dans la semaine. Un créneau en double ne se voit
            pas à la lecture d&apos;une liste : il est encadré en rouge ci-dessous.
          </Alerte>
        )}

        {chargement ? <SkeletonListe lignes={4} /> : filieres.length === 0 ? (
          <EtatVide icone="🏛️" titre="Aucune filière">
            Créez d&apos;abord une filière et ses semestres dans « Filières & maquettes ».
          </EtatVide>
        ) : !semestreId ? (
          <EtatVide icone="🗂️" titre="Aucun semestre">
            Cette filière n&apos;a pas encore de semestre : ajoutez-en un dans « Filières & maquettes ».
          </EtatVide>
        ) : jours.length === 0 ? (
          <EtatVide icone="🗓️" titre="Aucune séance">
            Ajoutez les créneaux de ce semestre : ils apparaîtront aussitôt dans l&apos;espace
            des étudiants inscrits dans cette filière.
          </EtatVide>
        ) : (
          <div className="space-y-4">
            {jours.map((j) => (
              <Carte key={j.jour} className="p-5">
                <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">{j.libelle}</h3>
                <div className="space-y-2">
                  {j.seances.map((s) => (
                    <div key={s.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                        conflits.has(s.id) ? "border-rose-300 bg-rose-50/60" : "border-navy-900/10"}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-navy-900">
                          <span className="mr-2 font-mono text-sm text-navy-900/60">
                            {api.heure(s.heure_debut)}–{api.heure(s.heure_fin)}
                          </span>
                          {s.ue?.code ? <span className="mr-2 font-mono text-xs text-navy-900/45">{s.ue.code}</span> : null}
                          {s.ecue?.intitule || s.ue?.intitule || "Séance"}
                        </p>
                        <p className="text-xs text-navy-900/55">
                          {[
                            s.enseignants ? `${s.enseignants.prenom || ""} ${s.enseignants.nom || ""}`.trim() : null,
                            s.salle ? `salle ${s.salle}` : null,
                          ].filter(Boolean).join(" · ") || "Enseignant et salle à préciser"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <Badge ton={s.type_seance === "CM" ? "navy" : s.type_seance === "TP" ? "or" : "neutre"}>
                          {s.type_seance}
                        </Badge>
                        <button type="button" onClick={() => setEdite(s)}
                          className="text-navy-900/50 hover:text-navy-900">modifier</button>
                        <button type="button" onClick={() => supprimer(s)}
                          className="text-rose-500 hover:underline">supprimer</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Carte>
            ))}
          </div>
        )}
      </div>

      {edite && (
        <ModaleSeance
          seance={edite} ecoleId={ecoleId} filiereId={filiereId} semestreId={semestreId}
          anneeId={annee?.id} maquette={maquette} enseignants={enseignants}
          onFermer={() => setEdite(null)}
          onEnregistre={() => { setEdite(null); recharger(); }}
        />
      )}
    </>
  );
}

function ModaleSeance({ seance, ecoleId, filiereId, semestreId, anneeId, maquette, enseignants, onFermer, onEnregistre }) {
  const toast = useToast();
  const [f, setF] = useState({
    ue_id: seance.ue_id || "",
    ecue_id: seance.ecue_id || "",
    enseignant_id: seance.enseignant_id || "",
    type_seance: seance.type_seance || "CM",
    jour: String(seance.jour || 1),
    heure_debut: seance.heure_debut ? api.heure(seance.heure_debut) : "08:00",
    heure_fin: seance.heure_fin ? api.heure(seance.heure_fin) : "10:00",
    salle: seance.salle || "",
  });
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Les ECUE dépendent de l'UE : proposer ceux d'une autre UE n'aurait pas de sens.
  const ecues = maquette.find((u) => u.id === f.ue_id)?.ecues || [];

  function changerUE(e) {
    const ue_id = e.target.value;
    setF((x) => ({ ...x, ue_id, ecue_id: "" }));
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (f.heure_fin <= f.heure_debut) {
      toast.erreur("L'heure de fin doit suivre l'heure de début.");
      return;
    }
    setBusy(true);
    try {
      await api.enregistrerSeance(ecoleId, {
        ...(seance.id ? { id: seance.id } : {}),
        filiere_id: filiereId,
        semestre_id: semestreId,
        annee_id: anneeId || null,
        ue_id: f.ue_id || null,
        ecue_id: f.ecue_id || null,
        enseignant_id: f.enseignant_id || null,
        type_seance: f.type_seance,
        jour: Number(f.jour),
        heure_debut: f.heure_debut,
        heure_fin: f.heure_fin,
        salle: f.salle.trim() || null,
      });
      toast.succes("Séance enregistrée.");
      onEnregistre();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre={seance.id ? "Modifier la séance" : "Nouvelle séance"}>
      <form onSubmit={enregistrer} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Unité d&apos;enseignement</span>
          <select value={f.ue_id} onChange={changerUE}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Aucune —</option>
            {maquette.map((u) => (
              <option key={u.id} value={u.id}>{u.code ? `${u.code} — ` : ""}{u.intitule}</option>
            ))}
          </select>
        </label>

        {ecues.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élément constitutif (facultatif)</span>
            <select value={f.ecue_id} onChange={maj("ecue_id")}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">— Toute l&apos;UE —</option>
              {ecues.map((ec) => <option key={ec.id} value={ec.id}>{ec.intitule}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de séance</span>
            <select value={f.type_seance} onChange={maj("type_seance")}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {api.TYPES_SEANCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Jour</span>
            <select value={f.jour} onChange={maj("jour")}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {api.JOURS.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Champ label="Début" type="time" value={f.heure_debut} onChange={maj("heure_debut")} required />
          <Champ label="Fin" type="time" value={f.heure_fin} onChange={maj("heure_fin")} required />
          <Champ label="Salle" value={f.salle} onChange={maj("salle")} placeholder="Amphi A" />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Enseignant</span>
          <select value={f.enseignant_id} onChange={maj("enseignant_id")}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Non affecté —</option>
            {enseignants.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Enregistrer"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
