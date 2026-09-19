import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Logo from "@/composants/Logo.jsx";
import { GESPRO } from "@/lib/gespro.js";
import { campagnePublique, deposerCandidature, suivreCandidature, libStatut } from "@/lib/admissions.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : null);
const montant = (n, devise) => (n == null ? null : `${new Intl.NumberFormat("fr-FR").format(Number(n))} ${devise || ""}`.trim());

function Champ({ label, requis = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}{requis ? " *" : ""}</span>
      {children}
    </label>
  );
}
const cls = "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none focus:border-or-500";

// Page PUBLIQUE de candidature. Accessible SANS COMPTE : exiger une création
// de compte avant même de postuler est le premier point d'abandon d'un
// portail d'admission. Deux usages : déposer un dossier, ou suivre le sien.
export default function Candidature() {
  const [params] = useSearchParams();
  const ecoleId = params.get("ecole") || "";
  const codeUrl = params.get("code") || "";

  const [mode, setMode] = useState(codeUrl ? "suivi" : "depot");
  const [pub, setPub] = useState(null);
  const [etat, setEtat] = useState(ecoleId ? "chargement" : "sans_ecole");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!ecoleId) return;
    campagnePublique(ecoleId)
      .then((d) => { setPub(d); setEtat(d?.ecole ? "pret" : "inconnue"); })
      .catch((e) => { setErreur(e.message); setEtat("inconnue"); });
  }, [ecoleId]);

  const ecole = pub?.ecole;

  return (
    <div className="min-h-dscreen bg-gradient-to-b from-navy-900 to-navy-800 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex flex-col items-center text-center text-creme">
          {ecole?.logo_url
            ? <img src={ecole.logo_url} alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1 shadow-lg" />
            : <Logo size={64} fond className="rounded-2xl shadow-lg" />}
          <h1 className="mt-4 font-display text-2xl font-bold">
            {ecole?.nom || "Candidature en ligne"}
          </h1>
          <p className="mt-1 text-sm text-creme/60">Admission — dépôt et suivi de dossier</p>
        </header>

        <div className="mt-6 flex justify-center gap-2">
          {[["depot", "Déposer un dossier"], ["suivi", "Suivre mon dossier"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMode(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                mode === v ? "bg-or-500 text-navy-900" : "border border-creme/20 text-creme/70 hover:text-creme"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 shadow-xl sm:p-7">
          {mode === "suivi" ? (
            <Suivi codeInitial={codeUrl} />
          ) : etat === "sans_ecole" ? (
            <p className="text-center text-sm text-navy-900/60">
              Ce lien est incomplet. Demandez à l&apos;établissement le lien exact de sa campagne
              de candidature.
            </p>
          ) : etat === "chargement" ? (
            <p className="text-center text-sm text-navy-900/40">Chargement…</p>
          ) : etat === "inconnue" ? (
            <p className="text-center text-sm text-navy-900/60">
              {erreur || "Établissement introuvable. Vérifiez le lien reçu."}
            </p>
          ) : pub.campagnes.length === 0 ? (
            <div className="text-center">
              <p className="text-3xl">🔒</p>
              <p className="mt-2 font-display text-lg font-semibold text-navy-900">
                Les candidatures sont fermées
              </p>
              <p className="mt-1 text-sm text-navy-900/55">
                Aucune campagne n&apos;est ouverte pour le moment. Revenez à l&apos;ouverture
                de la prochaine session.
              </p>
            </div>
          ) : (
            <Formulaire pub={pub} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-creme/40">
          {GESPRO?.nom ? `Propulsé par ${GESPRO.nom}` : "Propulsé par GesPro"} ·{" "}
          <Link to="/connexion" className="underline hover:text-creme/70">Espace connexion</Link>
        </p>
      </div>
    </div>
  );
}

function Formulaire({ pub }) {
  const [campagneId, setCampagneId] = useState(pub.campagnes[0]?.id || "");
  const [f, setF] = useState({
    prenom: "", nom: "", sexe: "", date_naissance: "", lieu_naissance: "", nationalite: "",
    telephone: "", email: "", adresse: "", filiere_id: "", filiere_2_id: "",
    dernier_diplome: "", annee_diplome: "", etablissement_origine: "", mention: "",
    moyenne: "", motivation: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [recu, setRecu] = useState(null);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const campagne = pub.campagnes.find((c) => c.id === campagneId);

  async function envoyer(e) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      setRecu(await deposerCandidature(campagneId, f));
    } catch (er) {
      setErreur(er.message || "L'envoi a échoué.");
    } finally { setEnvoi(false); }
  }

  // Le code de suivi n'est montré qu'une fois : il doit être impossible à
  // manquer, et le candidat doit pouvoir le copier sans le retaper.
  if (recu) {
    return (
      <div className="text-center">
        <p className="text-4xl">✅</p>
        <p className="mt-2 font-display text-xl font-bold text-navy-900">Dossier reçu</p>
        <p className="mt-1 text-sm text-navy-900/60">
          Votre candidature porte le numéro <b className="font-mono">{recu.numero}</b>.
        </p>
        <div className="mt-5 rounded-2xl border-2 border-dashed border-or-500/50 bg-or-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/50">
            Votre code de suivi
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-navy-900">{recu.code_suivi}</p>
          <button type="button"
            onClick={() => navigator.clipboard?.writeText(recu.code_suivi)}
            className="mt-3 rounded-lg border border-navy-900/15 bg-white px-3 py-1.5 text-xs font-medium hover:border-or-500">
            Copier le code
          </button>
        </div>
        <p className="mt-4 text-sm text-navy-900/60">
          <b>Notez-le</b> : c&apos;est avec ce code, dans l&apos;onglet « Suivre mon dossier »,
          que vous connaîtrez la décision de l&apos;établissement.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="space-y-5">
      {pub.campagnes.length > 1 && (
        <Champ label="Campagne" requis>
          <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={cls}>
            {pub.campagnes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </Champ>
      )}

      {campagne && (campagne.message_accueil || campagne.date_cloture || campagne.frais_dossier != null) && (
        <div className="rounded-xl bg-creme/70 px-4 py-3 text-sm text-navy-900/70">
          {campagne.message_accueil && <p className="whitespace-pre-line">{campagne.message_accueil}</p>}
          <p className="mt-1 text-xs text-navy-900/55">
            {[campagne.niveau ? `Niveau ${campagne.niveau}` : null,
              campagne.date_cloture ? `Clôture le ${dateFr(campagne.date_cloture)}` : null,
              campagne.frais_dossier != null ? `Frais de dossier : ${montant(campagne.frais_dossier, pub.ecole?.devise)}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900/45">Identité</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Prénom" requis><input value={f.prenom} onChange={maj("prenom")} className={cls} required maxLength={80} /></Champ>
          <Champ label="Nom" requis><input value={f.nom} onChange={maj("nom")} className={cls} required maxLength={80} /></Champ>
          <Champ label="Sexe">
            <select value={f.sexe} onChange={maj("sexe")} className={cls}>
              <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option>
            </select>
          </Champ>
          <Champ label="Nationalité"><input value={f.nationalite} onChange={maj("nationalite")} className={cls} maxLength={60} /></Champ>
          <Champ label="Date de naissance"><input type="date" value={f.date_naissance} onChange={maj("date_naissance")} className={cls} /></Champ>
          <Champ label="Lieu de naissance"><input value={f.lieu_naissance} onChange={maj("lieu_naissance")} className={cls} maxLength={120} /></Champ>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900/45">Contact</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Téléphone" requis><input value={f.telephone} onChange={maj("telephone")} className={cls} required maxLength={40} /></Champ>
          <Champ label="E-mail" requis><input type="email" value={f.email} onChange={maj("email")} className={cls} required maxLength={160} /></Champ>
        </div>
        <Champ label="Adresse"><input value={f.adresse} onChange={maj("adresse")} className={cls} maxLength={240} /></Champ>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900/45">Vœux</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Filière souhaitée" requis>
            <select value={f.filiere_id} onChange={maj("filiere_id")} className={cls} required>
              <option value="">— Choisir —</option>
              {pub.filieres.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Second choix">
            <select value={f.filiere_2_id} onChange={maj("filiere_2_id")} className={cls}>
              <option value="">— Aucun —</option>
              {pub.filieres.filter((x) => x.id !== f.filiere_id).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          </Champ>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900/45">Parcours</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Dernier diplôme"><input value={f.dernier_diplome} onChange={maj("dernier_diplome")} className={cls} placeholder="Baccalauréat S2" maxLength={120} /></Champ>
          <Champ label="Année d'obtention"><input type="number" min="1950" max="2100" value={f.annee_diplome} onChange={maj("annee_diplome")} className={cls} /></Champ>
          <Champ label="Établissement d'origine"><input value={f.etablissement_origine} onChange={maj("etablissement_origine")} className={cls} maxLength={160} /></Champ>
          <Champ label="Mention"><input value={f.mention} onChange={maj("mention")} className={cls} placeholder="Assez bien" maxLength={40} /></Champ>
          <Champ label="Moyenne obtenue"><input type="number" step="0.01" min="0" max="20" value={f.moyenne} onChange={maj("moyenne")} className={cls} /></Champ>
        </div>
        <Champ label="Motivation">
          <textarea rows={4} value={f.motivation} onChange={maj("motivation")} maxLength={4000}
            placeholder="Pourquoi cette filière ? Quel est votre projet ?" className={cls} />
        </Champ>
      </section>

      {erreur && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erreur}</p>}

      <button type="submit" disabled={envoi}
        className="w-full rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-creme transition hover:bg-navy-800 disabled:opacity-50">
        {envoi ? "Envoi…" : "Envoyer ma candidature"}
      </button>
      <p className="text-center text-xs text-navy-900/45">
        Un seul dossier par adresse e-mail et par campagne.
      </p>
    </form>
  );
}

function Suivi({ codeInitial }) {
  const [code, setCode] = useState(codeInitial || "");
  const [etat, setEtat] = useState("attente"); // attente | chargement | ok | absent
  const [res, setRes] = useState(null);

  async function lancer(c) {
    const v = (c || "").trim();
    if (!v) return;
    setEtat("chargement");
    try {
      const r = await suivreCandidature(v);
      if (r) { setRes(r); setEtat("ok"); } else setEtat("absent");
    } catch { setEtat("absent"); }
  }

  useEffect(() => { if (codeInitial) lancer(codeInitial); }, [codeInitial]);

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); lancer(code); }} className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Votre code de suivi" maxLength={16}
          className={`${cls} font-mono tracking-widest`} />
        <button type="submit"
          className="shrink-0 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-creme hover:bg-navy-800">
          Vérifier
        </button>
      </form>

      {etat === "chargement" && <p className="text-center text-sm text-navy-900/40">Recherche…</p>}

      {etat === "absent" && (
        <p className="rounded-xl bg-creme/70 px-4 py-3 text-center text-sm text-navy-900/60">
          Aucun dossier ne correspond à ce code. Vérifiez la saisie — le code vous a été
          affiché juste après l&apos;envoi de votre candidature.
        </p>
      )}

      {etat === "ok" && res && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-navy-900/10 p-4">
            <p className="font-display text-lg font-semibold text-navy-900">{res.prenom} {res.nom}</p>
            <p className="font-mono text-xs text-navy-900/45">{res.numero}</p>
            <p className="mt-1 text-sm text-navy-900/60">
              {[res.ecole, res.campagne, res.filiere].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className={`rounded-2xl p-5 text-center ${
            res.statut === "admise" || res.statut === "inscrite" ? "bg-emerald-50 text-emerald-800"
            : res.statut === "refusee" ? "bg-rose-50 text-rose-800"
            : "bg-creme text-navy-900"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Statut du dossier</p>
            <p className="mt-1 font-display text-2xl font-bold">{libStatut(res.statut)}</p>
            {res.decision_le && (
              <p className="mt-1 text-xs opacity-70">Décision du {dateFr(res.decision_le)}</p>
            )}
            {res.motif && <p className="mt-3 whitespace-pre-line text-sm">{res.motif}</p>}
            {res.statut === "soumise" && (
              <p className="mt-2 text-sm opacity-70">
                Votre dossier est enregistré et attend d&apos;être examiné.
              </p>
            )}
            {res.statut === "inscrite" && (
              <p className="mt-2 text-sm opacity-80">
                Votre inscription est enregistrée. Présentez-vous à la scolarité pour retirer
                vos identifiants d&apos;accès.
              </p>
            )}
          </div>

          <p className="text-center text-xs text-navy-900/40">
            Déposé le {dateFr(res.depose_le)}
          </p>
        </div>
      )}
    </div>
  );
}
