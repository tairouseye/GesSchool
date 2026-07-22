import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, Kpi, SkeletonListe } from "@/composants/ui.jsx";
import { MODULES } from "@/lib/modules.js";
import { FORMULES, formuleDeModules, infoModule } from "@/lib/formules.js";
import { monAbonnement, occupation, joursRestants, LIBELLES_STATUT } from "@/lib/abonnement.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const date = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");

export default function Abonnement() {
  const { ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [abo, setAbo] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    monAbonnement()
      .then(setAbo)
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  const occ = occupation(abo);
  const jours = joursRestants(abo);
  const modules = abo?.modules_actifs ?? null; // null = tous les modules

  return (
    <>
      <EnTete titre="Mon abonnement" sousTitre={ecole?.nom} />
      <div className="max-w-3xl space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {chargement ? (
          <SkeletonListe lignes={3} />
        ) : !abo?.plan_code ? (
          <Carte className="p-8">
            <p className="font-display text-base font-semibold text-navy-900">Aucun abonnement enregistré</p>
            <p className="mt-1 text-sm text-navy-900/60">
              Votre établissement fonctionne sans plan défini. Contactez GesPro pour choisir la
              formule adaptée à votre effectif.
            </p>
            <ContactGesPro />
          </Carte>
        ) : (
          <>
            {/* Alertes : échéance proche, palier presque atteint */}
            {jours !== null && jours <= 30 && (
              <Alerte ton={jours < 0 ? "erreur" : "or"}>
                {jours < 0
                  ? `Votre abonnement a expiré le ${date(abo.fin)}. Contactez GesPro pour le renouveler.`
                  : `Votre abonnement arrive à échéance dans ${jours} jour(s), le ${date(abo.fin)}.`}
              </Alerte>
            )}
            {occ?.proche && (
              <Alerte ton={occ.depasse ? "erreur" : "or"}>
                {occ.depasse
                  ? `Vous dépassez le palier « ${abo.plan_libelle} » (${fmt(occ.effectif)} élèves pour ${fmt(occ.max)}).`
                  : `Vous approchez du palier « ${abo.plan_libelle} » (${fmt(occ.effectif)} élèves sur ${fmt(occ.max)}).`}
                {" "}Aucun accès n'est restreint — contactez GesPro pour passer au palier supérieur.
              </Alerte>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi label="Formule" valeur={abo.plan_libelle} sous={LIBELLES_STATUT[abo.statut] || abo.statut} />
              <Kpi label="Élèves inscrits" valeur={fmt(abo.effectif)}
                sous={abo.max_eleves ? `palier : ${fmt(abo.max_eleves)}` : "palier illimité"}
                ton={occ?.depasse ? "rouge" : occ?.proche ? "or" : undefined} />
              <Kpi label="Classes" valeur={fmt(abo.nb_classes)} sous="année courante" />
            </div>

            {/* Jauge d'occupation du palier */}
            {occ && (
              <Carte className="p-6">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-navy-900/70">Occupation du palier</span>
                  <span className="font-mono text-sm text-navy-900/60">{Math.round(occ.ratio * 100)} %</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-navy-900/10">
                  <div
                    className={`h-full rounded-full transition-all ${occ.depasse ? "bg-rose-500" : occ.proche ? "bg-or-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, occ.ratio * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-navy-900/40">
                  Le palier détermine le forfait, pas une limite technique : aucun élève ne peut être
                  refusé et aucune fonction n'est coupée en cours d'année.
                </p>
              </Carte>
            )}

            <Carte className="p-6">
              <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Contrat</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Ligne label="Statut" valeur={LIBELLES_STATUT[abo.statut] || abo.statut} />
                <Ligne label="Début" valeur={date(abo.debut)} />
                <Ligne label="Échéance" valeur={date(abo.fin)} />
                <Ligne label="Forfait annuel"
                  valeur={Number(abo.prix_annuel) > 0 ? `${fmt(abo.prix_annuel)} ${devise}` : "sur devis"} />
              </dl>
            </Carte>

            <Carte className="p-6">
              <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Modules inclus</h3>
              <p className="mb-3 text-xs text-navy-900/40">
                {modules === null
                  ? "Tous les modules sont actifs pour votre établissement."
                  : "Les modules non inclus peuvent être ajoutés à votre formule."}
              </p>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => {
                  const actif = modules === null || modules.includes(m.id);
                  return (
                    <span key={m.id} title={m.desc}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        actif ? "bg-emerald-500/10 text-emerald-700" : "bg-navy-900/5 text-navy-900/35"
                      }`}>
                      {actif ? "✓" : "🔒"} {m.label}
                    </span>
                  );
                })}
              </div>
            </Carte>

            <Upsell modules={modules} />

            <ContactGesPro />
          </>
        )}
      </div>
    </>
  );
}

// Propose la formule supérieure : liste ce qui reste verrouillé et le regroupe
// par formule qui le débloque. Rien à afficher si tout est déjà actif.
function Upsell({ modules }) {
  if (modules === null) return null; // déjà tout inclus
  const actifs = new Set(modules);
  const actuelle = formuleDeModules(modules);
  // Formules au-dessus de la formule courante, avec leurs modules encore verrouillés.
  const idxActuel = actuelle ? FORMULES.findIndex((f) => f.id === actuelle.id) : -1;
  const superieures = FORMULES.slice(idxActuel + 1)
    .map((f) => ({ f, nouveaux: f.ajoute.filter((m) => !actifs.has(m)) }))
    .filter((x) => x.nouveaux.length > 0);
  if (superieures.length === 0) return null;

  return (
    <Carte className="border-or-500/30 bg-or-500/5 p-6">
      <h3 className="font-display text-lg font-semibold text-navy-900">Aller plus loin</h3>
      <p className="mt-1 text-sm text-navy-900/60">
        Votre formule actuelle{actuelle ? ` (${actuelle.libelle})` : ""} peut évoluer. Voici ce que
        débloquerait chaque niveau supérieur :
      </p>
      <div className="mt-4 space-y-3">
        {superieures.map(({ f, nouveaux }) => (
          <div key={f.id} className="rounded-xl border border-or-500/30 bg-white/60 p-4">
            <p className="font-display text-sm font-semibold text-navy-900">
              {f.libelle} <span className="font-normal text-navy-900/50">— {f.accroche}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nouveaux.map((id) => (
                <span key={id} className="rounded-full bg-or-500/15 px-2.5 py-0.5 text-xs font-medium text-or-600">
                  + {infoModule(id).label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <a href="https://wa.me/221773435928?text=Bonjour%2C%20je%20souhaite%20faire%20%C3%A9voluer%20ma%20formule%20GesSchool."
        target="_blank" rel="noreferrer"
        className="mt-4 inline-block rounded-xl bg-or-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-or-400">
        💬 Demander une évolution
      </a>
    </Carte>
  );
}

function Ligne({ label, valeur }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-900/5 py-1.5">
      <dt className="text-navy-900/50">{label}</dt>
      <dd className="font-medium text-navy-900">{valeur}</dd>
    </div>
  );
}

function ContactGesPro() {
  return (
    <div className="mt-4 rounded-xl bg-creme/60 px-4 py-3 text-xs text-navy-900/60">
      Une question sur votre formule ?{" "}
      <a href="https://wa.me/221773435928?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20mon%20abonnement%20GesSchool."
        target="_blank" rel="noreferrer" className="font-medium text-or-600 hover:underline">
        💬 WhatsApp +221 77 343 59 28
      </a>{" "}·{" "}
      <a href="mailto:gespro.sn@gmail.com" className="font-medium text-or-600 hover:underline">gespro.sn@gmail.com</a>
    </div>
  );
}
