import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, Modale } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { getMonEnseignant, getMesClasses } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
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
  const { ecoleId, ecole, utilisateur, profil, roles } = useAuth();
  //  🔴 REMONTÉ PAR L'ÉCOLE : au préscolaire et à l'élémentaire, ce sont les
  //  RESPONSABLES PÉDAGOGIQUES qui se substituent aux enseignants — tout le
  //  travail de ces derniers est fait par eux. Or cette page était la SEULE
  //  des sept pages de classe à ne pas prévoir ce cas : elle ne chargeait
  //  les classes QUE si une fiche enseignant existait. Un responsable
  //  pédagogique ne voyait donc aucune classe et ne pouvait pas faire
  //  l'appel — la tâche la plus quotidienne de l'établissement.
  const toutVoir = voitToutesClasses(roles);
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
  const [apercu, setApercu] = useState(false);   // feuille signée, imprimable

  // Initialisation : année, fiche enseignant, classes du prof
  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const ens = await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email);
        setEnseignant(ens);
        //  La direction et le responsable pédagogique font l'appel de
        //  n'importe quelle classe ; l'enseignant, seulement des siennes.
        const cls = toutVoir
          ? await getClasses(ecoleId, an?.id)
          : ens ? await getMesClasses(ecoleId, an?.id, ens.id) : [];
        setClasses(cls);
        if (cls.length) setClasseId(cls[0].id);
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email, toutVoir]);

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

  if (chargement) return (<><EnTete titre="Feuille de présence" /><div className="p-8 text-navy-900/50">Chargement…</div></>);

  //  ⚠️ Ce message ne vaut que pour un ENSEIGNANT. L'adresser au
  //  responsable pédagogique était une impasse : « demande à
  //  l'administration » — alors que c'est lui.
  if (!enseignant && !toutVoir) {
    return (
      <>
        <EnTete titre="Feuille de présence" />
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
        titre="Feuille de présence"
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
            {toutVoir
              ? <>Aucune classe n'existe pour cette année. Créez-les dans <b>Structure → Niveaux &amp; classes</b>.</>
              : <>Aucune classe ne t'est attribuée pour cette année. (Prof principal ou affectation matière dans <b>Structure / RH</b>.)</>}
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
                <EtatVide icone="✅" titre="Aucun élève inscrit">Aucun élève inscrit dans cette classe.</EtatVide>
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

            <div className="sticky bottom-3 flex justify-end gap-2">
              <Bouton variante="fantome" onClick={() => setApercu(true)} disabled={eleves.length === 0}
                className="px-4 py-3 shadow-lg">
                🖨️ Imprimer
              </Bouton>
              <Bouton onClick={valider} disabled={enCours || eleves.length === 0} className="px-6 py-3 shadow-lg">
                {enCours ? "Validation…" : "Valider l'appel"}
              </Bouton>
            </div>
          </>
        )}
      </div>

      <ModaleFeuille
        ouvert={apercu} onFermer={() => setApercu(false)} ecole={ecole}
        classe={classes.find((c) => c.id === classeId)?.libelle} annee={annee}
        eleves={eleves} etats={etats} enseignant={enseignant}
        /*  Qui a réellement fait l'appel. Au préscolaire et à l'élémentaire
            c'est le responsable pédagogique, qui n'a pas de fiche
            enseignant : la feuille portait alors un « L'enseignant(e) »
            anonyme au-dessus du trait de signature. */
        parDefaut={`${profil?.prenom || ""} ${profil?.nom || ""}`.trim()}
      />
    </>
  );
}

// La feuille du jour, telle qu'elle a été saisie — à signer et à archiver.
//
// Elle complète le registre VIERGE imprimable depuis la liste d'élèves : ici
// les états sont déjà renseignés, là-bas les colonnes sont à cocher au stylo.
// Les deux ont leur usage, et l'école choisit.
function ModaleFeuille({ ouvert, onFermer, ecole, classe, annee, eleves, etats, enseignant, parDefaut }) {
  if (!ouvert) return null;
  const etatDe = (id) => etats[id] || "present";
  const LIB = { present: "Présent", absence: "Absent", retard: "Retard" };
  const compte = (v) => eleves.filter((e) => etatDe(e.id) === v).length;

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Feuille de présence — impression" large>
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
        <h1 className="text-center font-display text-lg font-bold uppercase tracking-wide">Feuille de présence</h1>
        <p className="mb-3 text-center text-xs capitalize text-navy-900/60">{dateLisible()}</p>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-navy-900/50">
              <th className="border border-navy-900/25 px-1 py-1">N°</th>
              <th className="border border-navy-900/25 px-2 py-1 text-left">Nom et prénom</th>
              <th className="border border-navy-900/25 px-2 py-1">État</th>
              <th className="border border-navy-900/25 px-2 py-1 text-left">Observation</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((e, i) => {
              const et = etatDe(e.id);
              return (
                <tr key={e.id}>
                  <td className="border border-navy-900/20 px-1 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-navy-900/20 px-2 py-1.5 font-medium">{e.nom} {e.prenom}</td>
                  <td className={`border border-navy-900/20 px-2 py-1.5 text-center ${et === "present" ? "text-navy-900/45" : "font-semibold"}`}>
                    {LIB[et]}
                  </td>
                  <td className="border border-navy-900/20 px-2 py-1.5"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-2 text-[11px] text-navy-900/60">
          {eleves.length} élève(s) · présents <b>{compte("present")}</b> · absents <b>{compte("absence")}</b> · retards <b>{compte("retard")}</b>
        </p>
        <div className="mt-8 flex justify-between text-sm">
          <span>
            {enseignant
              ? `${enseignant.prenom} ${enseignant.nom}`
              : parDefaut || "L'enseignant(e)"}<br />
            <span className="text-navy-900/30">_____________________</span>
          </span>
          <span className="text-right">Visa de la direction<br /><span className="text-navy-900/30">_____________________</span></span>
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end">
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
    </Modale>
  );
}
