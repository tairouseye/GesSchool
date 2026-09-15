import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Logo from "@/composants/Logo.jsx";
import { GESPRO } from "@/lib/gespro.js";
import { verifierDocument } from "@/lib/verification.js";

const fmtMontant = (n, devise) =>
  n == null ? null : `${new Intl.NumberFormat("fr-FR").format(Number(n))} ${devise || ""}`.trim();

const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

function Ligne({ label, valeur }) {
  if (valeur == null || valeur === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-navy-900/5 py-2 text-sm last:border-0">
      <span className="shrink-0 text-navy-900/50">{label}</span>
      <span className="text-right font-medium text-navy-900">{valeur}</span>
    </div>
  );
}

// Page PUBLIQUE de vérification d'un document (scan du QR code). Accessible sans
// compte : interroge la RPC `verifier_document` et atteste (ou non) le document.
export default function Verifier() {
  const [params, setParams] = useSearchParams();
  const codeUrl = params.get("d") || "";
  const [saisie, setSaisie] = useState(codeUrl);
  const [etat, setEtat] = useState(codeUrl ? "chargement" : "attente"); // attente | chargement | ok | absent
  const [res, setRes] = useState(null);

  async function lancer(code) {
    if (!code) return;
    setEtat("chargement");
    setRes(null);
    try {
      const r = await verifierDocument(code);
      if (r?.ok) { setRes(r); setEtat("ok"); }
      else setEtat("absent");
    } catch {
      setEtat("absent");
    }
  }

  useEffect(() => {
    if (codeUrl) { setSaisie(codeUrl); lancer(codeUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeUrl]);

  const ex = res?.extra || {};

  return (
    <div className="min-h-dscreen bg-gradient-to-b from-navy-900 to-navy-800 px-4 py-10 text-creme">
      <div className="mx-auto w-full max-w-md">
        <header className="flex flex-col items-center text-center">
          <Logo size={64} fond className="rounded-2xl shadow-lg" />
          <h1 className="mt-4 font-display text-2xl font-bold">Vérification de document</h1>
          <p className="mt-1 text-sm text-creme/60">
            Authenticité des documents officiels émis via GesSchool
          </p>
        </header>

        {/* Résultat */}
        <div className="mt-8 overflow-hidden rounded-2xl bg-white text-navy-900 shadow-xl">
          {etat === "chargement" && (
            <div className="flex flex-col items-center gap-3 p-10 text-navy-900/50">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-navy-900/15 border-t-or-500" />
              <p className="text-sm">Vérification en cours…</p>
            </div>
          )}

          {etat === "ok" && res && (
            <>
              <div className="flex items-center gap-3 bg-emerald-500 px-5 py-4 text-white">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-display text-lg font-bold leading-tight">Document authentique</p>
                  <p className="text-xs text-white/80">Émis par {res.ecole || "l'établissement"}</p>
                </div>
              </div>
              <div className="px-5 py-3">
                <p className="mb-1 font-display text-base font-semibold text-navy-900">{res.titre}</p>
                <Ligne label="Établissement" valeur={res.ecole} />
                <Ligne label="Bénéficiaire" valeur={res.beneficiaire} />
                <Ligne label="Classe" valeur={ex.classe} />
                <Ligne label="Fonction" valeur={ex.fonction} />
                <Ligne label="Référence" valeur={res.reference} />
                <Ligne label="Date" valeur={fmtDate(res.date)} />
                <Ligne label="Montant" valeur={fmtMontant(res.montant, res.devise)} />
                <Ligne label="Moyenne générale" valeur={ex.moyenne != null ? `${Number(ex.moyenne).toFixed(2)}` : null} />
                <Ligne label="Mention" valeur={ex.mention} />
                <Ligne
                  label="Rang"
                  valeur={ex.rang != null ? `${ex.rang}${ex.effectif ? " / " + ex.effectif : ""}` : null}
                />
                <Ligne label="Statut" valeur={res.statut} />
              </div>
              <p className="border-t border-navy-900/5 px-5 py-3 text-[11px] text-navy-900/40">
                Ces informations proviennent directement du registre de l'établissement. Comparez-les
                au document papier : toute divergence indique un document falsifié.
              </p>
            </>
          )}

          {etat === "absent" && (
            <div className="p-6 text-center">
              <span className="text-3xl">⚠️</span>
              <p className="mt-2 font-display text-lg font-bold text-rose-600">Document non reconnu</p>
              <p className="mt-1 text-sm text-navy-900/60">
                Ce code ne correspond à aucun document officiel valide. Le document pourrait être
                falsifié, supprimé, ou non encore validé par l'établissement.
              </p>
            </div>
          )}

          {etat === "attente" && (
            <div className="p-6 text-center text-sm text-navy-900/60">
              <span className="text-3xl">🔎</span>
              <p className="mt-2">
                Scannez le QR code figurant sur un document GesSchool, ou saisissez son code
                de vérification ci-dessous.
              </p>
            </div>
          )}

          {/* Saisie manuelle */}
          <form
            onSubmit={(e) => { e.preventDefault(); const c = saisie.trim(); if (c) { setParams({ d: c }); lancer(c); } }}
            className="flex gap-2 border-t border-navy-900/10 bg-creme/40 p-3"
          >
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Code de vérification"
              className="min-w-0 flex-1 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-creme hover:bg-navy-800"
            >
              Vérifier
            </button>
          </form>
        </div>

        <footer className="mt-8 text-center text-xs text-creme/50">
          <Link to="/connexion" className="hover:text-or-500">Accéder à GesSchool</Link>
          <span className="mx-2">·</span>
          <a href={GESPRO.contacts.site} target="_blank" rel="noreferrer" className="hover:text-or-500">
            {GESPRO.nom}
          </a>
        </footer>
      </div>
    </div>
  );
}
