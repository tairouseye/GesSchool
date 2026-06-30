import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte } from "@/composants/ui.jsx";
import { getAnneeCourante } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { getElevesClasse } from "@/lib/bulletins.js";
import { getAbsencesJour, enregistrerAppel } from "@/lib/viescolaire.js";

const ETATS = [
  ["present", "Présent", "bg-emerald-500 text-white", "text-emerald-700"],
  ["absence", "Absent", "bg-rose-500 text-white", "text-rose-600"],
  ["retard", "Retard", "bg-or-500 text-navy-900", "text-or-600"],
];
const auj = () => new Date().toISOString().slice(0, 10);
const dateLisible = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });

export default function Appel() {
  const { ecoleId, utilisateur, profil } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [enseignant, setEnseignant] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [eleves, setEleves] = useState([]);
  const [etats, setEtats] = useState({}); // eleve_id -> etat
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  // Initialisation : année, fiche enseignant, classes du prof
  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const ens = await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        setEnseignant(ens);
        if (ens) {
          const cls = await getMesClasses(ecoleId, an?.id, ens.id);
          setClasses(cls);
          if (cls.length) setClasseId(cls[0].id);
        }
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email]);

  // Charge le roster + l'appel déjà saisi du jour
  const chargerClasse = useCallback(async () => {
    if (!classeId || !annee) return;
    setErreur(""); setInfo("");
    try {
      const [els, abs] = await Promise.all([
        getElevesClasse(ecoleId, classeId, annee.id),
        getAbsencesJour(ecoleId, classeId, auj()),
      ]);
      setEleves(els);
      const map = {};
      for (const e of els) map[e.id] = "present";
      for (const a of abs) map[a.eleve_id] = a.type; // 'absence' | 'retard'
      setEtats(map);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId, annee]);

  useEffect(() => { chargerClasse(); }, [chargerClasse]);

  const setEtat = (eleveId, etat) => setEtats((s) => ({ ...s, [eleveId]: etat }));

  const compteurs = eleves.reduce(
    (a, e) => { const t = etats[e.id] || "present"; a[t] = (a[t] || 0) + 1; return a; },
    { present: 0, absence: 0, retard: 0 }
  );

  async function valider() {
    setEnCours(true); setErreur(""); setInfo("");
    try {
      const entries = eleves.map((e) => ({ eleve_id: e.id, etat: etats[e.id] || "present", motif: null }));
      await enregistrerAppel(ecoleId, classeId, auj(), entries, utilisateur?.id);
      setInfo(`Appel validé ✓ ${compteurs.absence} absent(s), ${compteurs.retard} retard(s). Transmis à l'administration et aux parents concernés.`);
    } catch (e) { setErreur(e.message); }
    finally { setEnCours(false); }
  }

  if (chargement) return (<><EnTete titre="Appel" /><div className="p-8 text-navy-900/50">Chargement…</div></>);

  if (!enseignant) {
    return (
      <>
        <EnTete titre="Appel" />
        <div className="p-8">
          <Carte className="p-6 text-sm text-navy-900/60">
            Ton compte n'est pas encore relié à une fiche enseignant.
            Demande à l'administration de renseigner ton <b>e-mail</b> ({utilisateur?.email}) sur ta fiche
            dans <b>RH → Enseignants</b>, et de te désigner sur une classe.
          </Carte>
        </div>
      </>
    );
  }

  return (
    <>
      <EnTete
        titre="Appel"
        sousTitre={`${dateLisible()}`}
        action={classes.length > 1 && (
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        )}
      />
      <div className="space-y-4 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {info && <Alerte ton="succes">{info}</Alerte>}

        {classes.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            Aucune classe ne t'est attribuée pour cette année. (Prof principal ou affectation matière dans <b>Structure / RH</b>.)
          </Carte>
        ) : (
          <>
            <Carte className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-700">Présents : <b>{compteurs.present}</b></span>
                <span className="text-rose-600">Absents : <b>{compteurs.absence}</b></span>
                <span className="text-or-600">Retards : <b>{compteurs.retard}</b></span>
              </div>
              <span className="text-xs text-navy-900/40">{eleves.length} élève(s)</span>
            </Carte>

            <Carte className="divide-y divide-navy-900/5">
              {eleves.length === 0 ? (
                <p className="p-6 text-sm text-navy-900/40">Aucun élève inscrit dans cette classe.</p>
              ) : eleves.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5">
                  <span className="font-medium text-navy-900">{e.prenom} {e.nom}</span>
                  <div className="flex gap-1.5">
                    {ETATS.map(([val, label, actif]) => (
                      <button key={val} onClick={() => setEtat(e.id, val)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          (etats[e.id] || "present") === val ? actif : "bg-navy-900/5 text-navy-900/50"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </Carte>

            <div className="sticky bottom-3 flex justify-end">
              <Bouton onClick={valider} disabled={enCours || eleves.length === 0} className="px-6 py-3 shadow-lg">
                {enCours ? "Validation…" : "Valider l'appel"}
              </Bouton>
            </div>
          </>
        )}
      </div>
    </>
  );
}
