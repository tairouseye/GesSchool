import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, EtatVide, SkeletonListe, SansAnnee } from "@/composants/ui.jsx";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { situationPaiements } from "@/lib/paiements.js";
import { etat as etatPaiement, resume, phrase, ORDRE } from "@/lib/paiementStatut.js";
import GrilleMensualites from "@/composants/GrilleMensualites.jsx";

// GesSchool — la situation de paiement de chaque élève, d'un coup d'œil
// (mig. 203).
//
// Demandé pour le responsable pédagogique : voir RAPIDEMENT où en est
// n'importe quel élève de son périmètre, sans passer par la caisse ni
// choisir d'abord une classe. On tape un nom, on a la réponse.
//
// ⚠️ LECTURE SEULE. On ne montre ni numéro de facture ni détail des
// paiements, et aucun bouton n'encaisse ou ne relance : ces actes restent à
// la caisse. La base en est garante (RPC `situation_paiements`), pas cet écran.
//
// Deux vues : la liste, et le « suivi des mensualités » (mig. 213), une grille
// mois par mois à l'image du fichier tenu à la main par l'école, exportable
// en Excel et en PDF.

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");

const TONS = {
  success: "bg-success-50 text-success-600 ring-success-500/25",
  danger: "bg-danger-50 text-danger-600 ring-danger-500/25",
  info: "bg-sky-50 text-sky-700 ring-sky-500/25",
  neutre: "bg-navy-900/5 text-navy-900/50 ring-navy-900/10",
};

//  Le dû d'une ligne : celui de l'échéancier (mig. 210) quand il existe —
//  les mois dus n'y sont pas forcément facturés —, sinon le reste échu des
//  factures (avant la 210).
const duDe = (l) => (l.du != null ? Number(l.du) : Number(l.echu) || 0);

export default function SituationPaiements() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(undefined);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const [vue, setVue] = useState("liste"); // 'liste' | 'grille'
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let vivant = true;
    getAnneeCourante(ecoleId)
      .then(async (an) => {
        if (!vivant) return;
        setAnnee(an || null);
        //  La RLS de `classes` applique déjà le périmètre par cycle.
        if (an) setClasses(await getClasses(ecoleId, an.id));
      })
      .catch((e) => { if (vivant) setErreur(e.message); });
    return () => { vivant = false; };
  }, [ecoleId]);

  // La recherche part au serveur : un appel 300 ms après la dernière touche.
  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisie.trim()), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!annee?.id) { setChargement(false); return undefined; }
    let vivant = true;
    setChargement(true);
    situationPaiements(annee.id, { q: recherche, classeId })
      .then((l) => { if (vivant) { setLignes(l); setErreur(""); } })
      .catch((e) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [annee?.id, recherche, classeId]);

  const synthese = useMemo(() => resume(lignes), [lignes]);
  const totaux = useMemo(() => lignes.reduce((t, l) => ({
    reste: t.reste + Math.max(Number(l.reste) || 0, duDe(l)),
    echu: t.echu + duDe(l),
  }), { reste: 0, echu: 0 }), [lignes]);
  const visibles = filtre ? lignes.filter((l) => l.statut === filtre) : lignes;

  if (annee === null) return (<><EnTete titre="Situation des paiements" /><div className="p-8"><SansAnnee /></div></>);

  return (
    <>
      <EnTete titre="Situation des paiements" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Synthèse : ce qu'il y a à savoir avant de chercher qui que ce soit. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Carte className="p-4">
            <p className="text-xs uppercase tracking-wide text-navy-900/45">Échu impayé</p>
            <p className="mt-1 font-display text-2xl font-bold text-danger-600">{fmt(totaux.echu)} <span className="text-sm font-normal">{devise}</span></p>
            <p className="text-xs text-navy-900/50">{synthese.en_retard} élève(s) en retard</p>
          </Carte>
          <Carte className="p-4">
            <p className="text-xs uppercase tracking-wide text-navy-900/45">Reste à payer</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-900">{fmt(totaux.reste)} <span className="text-sm font-normal">{devise}</span></p>
            <p className="text-xs text-navy-900/50">échu ou non</p>
          </Carte>
          <Carte className="p-4">
            <p className="text-xs uppercase tracking-wide text-navy-900/45">Familles</p>
            <p className="mt-1 text-sm text-navy-900/70">{phrase(synthese) || "—"}</p>
          </Carte>
        </div>

        <div className="no-print inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["liste", "Liste des élèves"], ["grille", "Suivi des mensualités"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setVue(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${vue === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {vue === "grille" ? (
          <Carte className="overflow-hidden">
            <div className="no-print flex flex-wrap items-center gap-2 border-b border-navy-900/10 p-4">
              <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
                className="rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
                <option value="">Toutes mes classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
            <GrilleMensualites annee={annee} classeId={classeId} ecole={ecole} />
          </Carte>
        ) : (
        <Carte className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-navy-900/10 p-4">
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} autoFocus
              placeholder="Nom, prénom ou matricule…"
              className="w-full max-w-sm rounded-lg border border-navy-900/15 bg-white px-4 py-2 text-sm outline-none focus:border-or-500" />
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
              className="rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Toutes mes classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {[["", `Tous (${synthese.total})`], ...ORDRE.map((k) => [k, `${etatPaiement(k).label} (${synthese[k]})`])].map(([k, l]) => (
                <button key={k || "tous"} type="button" onClick={() => setFiltre(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${filtre === k ? "bg-navy-900 text-creme" : "border border-navy-900/15 text-navy-900/60"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {chargement ? (
            <div className="p-4"><SkeletonListe lignes={6} /></div>
          ) : visibles.length === 0 ? (
            <EtatVide icone="🔎" titre="Aucun élève">
              {recherche ? `Aucun élève de votre périmètre ne correspond à « ${recherche} ».` : "Aucun élève dans cette sélection."}
            </EtatVide>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-navy-900/[0.03] text-navy-900/50">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Élève</th>
                    <th className="px-4 py-2.5 font-medium">Classe</th>
                    <th className="px-4 py-2.5 font-medium">État</th>
                    <th className="px-4 py-2.5 text-right font-medium">Facturé</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payé</th>
                    <th className="px-4 py-2.5 text-right font-medium">Reste</th>
                    <th className="px-4 py-2.5 font-medium">À noter</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => {
                    const e = etatPaiement(l.statut);
                    return (
                      <tr key={l.eleve_id} className="border-t border-navy-900/5">
                        <td className={`px-4 py-2.5 font-medium ${e.texte || "text-navy-900"}`}>
                          {`${l.prenom || ""} ${l.nom || ""}`.trim()}
                          {l.matricule && <span className="ml-2 font-mono text-xs font-normal text-navy-900/45">{l.matricule}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-navy-900/70">{l.classe}</td>
                        <td className="px-4 py-2.5">
                          <span title={e.explication}
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONS[e.ton]}`}>
                            {e.court}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmt(l.total)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmt(l.paye)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${duDe(l) > 0 ? "text-danger-600" : ""}`}>
                          {fmt(Math.max(Number(l.reste) || 0, duDe(l)))}
                          {duDe(l) > 0 && duDe(l) < Number(l.reste) && (
                            <span className="block text-xs">dont {fmt(duDe(l))} échu</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-navy-900/60">
                          {[
                            l.mois_avance && `✅ Payé d'avance : ${l.mois_avance}`,
                            Number(l.avance_en_attente) > 0 && `⏳ ${fmt(l.avance_en_attente)} déclaré, à valider`,
                            l.prochaine_echeance && `Prochaine échéance ${fmtDate(l.prochaine_echeance)}`,
                            l.dernier_paiement && `Dernier paiement ${fmtDate(l.dernier_paiement)}`,
                          ].filter(Boolean).map((t) => <span key={t} className="block">{t}</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
        )}
        <p className="no-print text-xs text-navy-900/40">
          Montants en {devise}, factures annulées exclues. Pour encaisser ou relancer, voyez la caisse.
        </p>
      </div>
    </>
  );
}
