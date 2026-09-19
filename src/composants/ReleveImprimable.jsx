import Cachet from "@/composants/Cachet.jsx";
import SceauVerification from "@/composants/SceauVerification.jsx";
import { codeReleve } from "@/lib/verification.js";

// Relevé de notes officiel, imprimable — PARTAGÉ entre l'espace personnel
// (après délibération) et l'espace étudiant (téléchargement autonome).
//
// Il vivait dans `Deliberations.jsx`, donc inaccessible à l'étudiant. Plutôt
// que d'en écrire un second qui aurait divergé, il est extrait ici : un
// relevé imprimé par l'étudiant est rigoureusement identique à celui du
// secrétariat — même en-tête, même tableau, même QR d'authentification.
//
// La classe `zone-impression` est indispensable : la feuille de style globale
// masque tout le reste à l'impression.

const arr2 = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(2));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const libSession = (s) => (s === "rattrapage" ? "Session de rattrapage" : "Session normale");

export function EnTeteEcole({ ecole }) {
  return (
    <div className="flex items-center gap-3 border-b border-navy-900/10 pb-4">
      {ecole?.logo_url
        ? <img src={ecole.logo_url} alt="" className="h-12 w-12 object-contain" />
        : <Cachet size={48} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
      <div>
        <p className="font-display text-lg font-bold text-navy-900">{ecole?.nom}</p>
        <p className="text-xs text-navy-900/50">
          {[ecole?.adresse, ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

//  ecole    : { nom, sigle, logo_url, adresse, ville, pays }
//  etudiant : { nom, matricule }
//  contexte : { filiere, niveau, semestre, session, annee, dateDelib }
//  releve   : { id, moyenne, credits_acquis, credits_total, decision, mention, details[] }
export default function ReleveImprimable({ ecole, etudiant, contexte = {}, releve }) {
  const lignes = Array.isArray(releve?.details) ? releve.details : [];
  return (
    <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-8 text-navy-900">
      <EnTeteEcole ecole={ecole} />
      <h1 className="mt-5 text-center font-display text-xl font-bold uppercase tracking-wide">Relevé de notes</h1>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p><span className="text-navy-900/50">Étudiant :</span> <b>{etudiant?.nom || "—"}</b></p>
        <p><span className="text-navy-900/50">Matricule :</span> {etudiant?.matricule || "—"}</p>
        <p><span className="text-navy-900/50">Filière :</span> {contexte.filiere || "—"}</p>
        <p><span className="text-navy-900/50">Niveau :</span> {contexte.niveau || "—"}</p>
        <p><span className="text-navy-900/50">Semestre :</span> {contexte.semestre || "—"}</p>
        <p>
          <span className="text-navy-900/50">Session :</span> {libSession(contexte.session)}
          {contexte.annee ? ` · ${contexte.annee}` : ""}
        </p>
      </div>

      <table className="mt-5 w-full text-left text-sm">
        <thead className="border-b border-navy-900/15 text-navy-900/50">
          <tr>
            <th className="py-2 font-medium">Unité d&apos;enseignement</th>
            <th className="py-2 text-center font-medium">Moyenne</th>
            <th className="py-2 text-center font-medium">Crédits</th>
            <th className="py-2 text-center font-medium">Résultat</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-navy-900/5">
              <td className="py-2">
                {l.code ? <span className="mr-2 font-mono text-xs text-navy-900/40">{l.code}</span> : null}
                {l.intitule}
              </td>
              <td className="py-2 text-center font-mono">{arr2(l.moyenne)}</td>
              <td className="py-2 text-center font-mono">{Number(l.credits)}</td>
              <td className="py-2 text-center">
                {l.acquise
                  ? <span className="text-emerald-700">Acquise</span>
                  : <span className="text-rose-600">Non acquise</span>}
              </td>
            </tr>
          ))}
          {lignes.length === 0 && <tr><td colSpan={4} className="py-3 text-navy-900/40">—</td></tr>}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-navy-900 p-4 text-creme">
          <p className="text-xs text-creme/60">Moyenne générale</p>
          <p className="font-display text-2xl font-bold">{arr2(releve?.moyenne)}<span className="text-sm font-normal">/20</span></p>
        </div>
        <div className="rounded-xl bg-or-500 p-4 text-navy-900">
          <p className="text-xs text-navy-900/60">Crédits acquis</p>
          <p className="font-display text-2xl font-bold">
            {releve?.credits_acquis}<span className="text-sm font-normal">/{releve?.credits_total}</span>
          </p>
        </div>
        <div className="rounded-xl border border-navy-900/15 p-4">
          <p className="text-xs text-navy-900/50">Décision · Mention</p>
          <p className="font-display text-lg font-bold text-navy-900">{releve?.decision}</p>
          <p className="text-sm text-navy-900/60">{releve?.mention || "—"}</p>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between text-xs text-navy-900/50">
        <span>Fait à {ecole?.ville || "—"}, le {dateFr(contexte.dateDelib)}</span>
        <span className="text-right">Le Chef d&apos;établissement<br /><br />Signature &amp; cachet</span>
      </div>

      <SceauVerification code={codeReleve(releve?.id)} reference={contexte.semestre} />
    </div>
  );
}
