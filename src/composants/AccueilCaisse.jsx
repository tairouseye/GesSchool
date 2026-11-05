import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Alerte, SkeletonListe } from "@/composants/ui.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { statsGestion } from "@/lib/dashboard.js";
import { getAnneeCourante, compterAdoption } from "@/lib/academique.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { ouvrirEncaisser } from "@/lib/encaisser.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

//  L'ACCUEIL DE LA SECRÉTAIRE / CAISSE, sur le modèle de l'espace parent
//  (05/11/2026). Elle travaille au guichet, un parent devant elle : chercher
//  un élève et encaisser d'abord, puis ce qui attend, puis la caisse du jour.
export default function AccueilCaisse() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [stats, setStats] = useState(null);
  const [demandes, setDemandes] = useState(0);
  const [adoption, setAdoption] = useState(null);
  const [erreur, setErreur] = useState("");
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [s, dem] = await Promise.all([statsGestion(ecoleId, an), compterDemandesEnAttente(ecoleId).catch(() => 0)]);
        if (!vivant) return;
        setStats(s); setDemandes(dem);
        compterAdoption(ecoleId).then((a) => { if (vivant) setAdoption(a); }).catch(() => {});
      } catch (e) { if (vivant) setErreur(e.message); }
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  //  La fenêtre de recherche globale vit dans la coque : même geste que Ctrl+K.
  const chercher = () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  const jourLong = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const parentsSansCode = adoption ? Math.max(adoption.tuteurs - adoption.tuteursRelies, 0) : 0;
  const aTraiter = [
    ouvert("paiements") && stats?.declEnAttente > 0 && {
      to: "/paiements?onglet=declarations", fond: "bg-amber-50", ton: "text-amber-800", action: "Vérifier",
      titre: `${pl(stats.declEnAttente, "paiement déclaré", "paiements déclarés")} par les parents`, detail: "Preuve jointe, à valider" },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", fond: "bg-sky-50", ton: "text-sky-800", action: "Préparer",
      titre: `${pl(demandes, "document demandé", "documents demandés")}`, detail: "Par les familles, depuis leur téléphone" },
    ouvert("codes_parents") && parentsSansCode > 0 && {
      to: "/codes-parents", fond: "bg-white ring-1 ring-inset ring-navy-900/10", ton: "text-navy-900", action: "Distribuer",
      titre: `${pl(parentsSansCode, "parent")} pas encore connecté${parentsSansCode > 1 ? "s" : ""}`, detail: "Leur remettre leur code" },
  ].filter(Boolean);
  const carte = "flex min-h-[6.5rem] items-center gap-3.5 rounded-3xl p-4 text-left transition active:scale-[.98]";
  const pastille = "grid h-14 w-14 shrink-0 place-items-center rounded-2xl";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-navy-900/60 first-letter:uppercase">{jourLong}</p>
          <h1 className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">Bonjour{profil?.prenom ? ` ${profil.prenom}` : ""}</h1>
        </div>
        <button type="button" onClick={chercher}
          className="flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border-2 border-or-500 bg-white px-4 text-left text-navy-900/70 sm:w-[28rem]">
          <Icone name="eleves" className="h-5 w-5 shrink-0" />
          Chercher un élève ou un parent
        </button>
      </div>
      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="grid gap-3 sm:grid-cols-3">
        {ouvert("paiements") && (
          <button type="button" onClick={() => ouvrirEncaisser()} className={`${carte} bg-navy-900 text-creme`}>
            <span className={`${pastille} bg-white/15`}><Icone name="paiements" className="h-8 w-8" /></span>
            <span><span className="block font-display text-xl font-bold">Encaisser</span><span className="block text-sm">Un paiement, un reçu</span></span>
          </button>
        )}
        {ouvert("eleves") && (
          <Link to="/eleves" className={`${carte} bg-sky-50 text-navy-900`}>
            <span className={`${pastille} bg-white`}><Icone name="eleves" className="h-8 w-8 text-sky-700" /></span>
            <span><span className="block font-display text-xl font-bold">Inscrire un élève</span><span className="block text-sm text-navy-900/70">Nouveau ou réinscription</span></span>
          </Link>
        )}
        {ouvert("certificats") && (
          <Link to="/certificats" className={`${carte} bg-emerald-50 text-navy-900`}>
            <span className={`${pastille} bg-white`}><Icone name="documents" className="h-8 w-8 text-emerald-700" /></span>
            <span><span className="block font-display text-xl font-bold">Faire un document</span><span className="block text-sm text-navy-900/70">Certificat, attestation</span></span>
          </Link>
        )}
      </div>

      {!stats && !erreur ? (
        <div role="status" aria-label="Chargement"><SkeletonListe lignes={3} /></div>
      ) : stats && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section aria-labelledby="titre-traiter" className="space-y-2">
            <h2 id="titre-traiter" className="font-display text-lg font-bold text-navy-900">À traiter</h2>
            {aTraiter.length === 0 ? (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Rien en attente pour l&apos;instant.</p>
            ) : aTraiter.map((t) => (
              <Link key={t.to} to={t.to} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl p-3.5 ${t.fond}`}>
                <span className="min-w-0">
                  <span className="block font-semibold text-navy-900">{t.titre}</span>
                  <span className="block text-sm text-navy-900/70">{t.detail}</span>
                </span>
                <span className={`shrink-0 text-sm font-bold ${t.ton}`}>{t.action}</span>
              </Link>
            ))}
          </section>

          {ouvert("paiements") && (
            <section aria-labelledby="titre-caisse" className="space-y-2">
              <h2 id="titre-caisse" className="font-display text-lg font-bold text-navy-900">La caisse aujourd&apos;hui</h2>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-navy-900/10">
                <p className="font-display text-2xl font-bold tabular-nums text-navy-900">{fmt(stats.encJour)} <span className="text-sm font-medium">{devise}</span></p>
                <p className="mt-1 text-sm text-navy-900/60">Cette semaine : <span className="tabular-nums">{fmt(stats.encSemaine)}</span> {devise}</p>
                <Link to="/paiements" className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-navy-700">Voir les paiements</Link>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
