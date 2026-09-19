import { useEffect, useState } from "react";
import { Bouton, Alerte, SkeletonListe } from "@/composants/ui.jsx";
import QRCode from "@/composants/QRCode.jsx";
import { monDossier } from "@/lib/etudiant.js";
import { codeCarteEtudiant, urlVerification } from "@/lib/verification.js";

// Espace étudiant — carte d'étudiant vérifiable.
//
// Le QR pointe vers la page publique de vérification. Elle ne répond que si
// l'inscription est ACTIVE (migration 131) : une carte périmée se signale
// d'elle-même, ce qui est tout l'intérêt du contrôle à l'entrée d'un campus
// ou d'une bibliothèque.
export default function EtudiantCarte() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    monDossier().then(setD).catch((e) => { setErreur(e.message); setD(false); });
  }, []);

  if (d === null) return <SkeletonListe lignes={4} />;
  if (d === false || !d) return <Alerte ton="erreur">{erreur || "Dossier étudiant introuvable."}</Alerte>;

  const url = urlVerification(codeCarteEtudiant(d.eleve_id));
  const sansInscription = !d.filiere;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <p className="font-display text-xl font-bold text-navy-900">Ma carte d&apos;étudiant</p>
          <p className="text-sm text-navy-900/55">Présentez le QR pour faire vérifier votre inscription</p>
        </div>
        <Bouton variante="fantome" onClick={() => window.print()}>🖨 Imprimer</Bouton>
      </div>

      {sansInscription && (
        <Alerte ton="or">
          Aucune inscription active : la vérification du QR indiquera que cette carte
          n&apos;est pas valide. Rapprochez-vous de la scolarité.
        </Alerte>
      )}

      {/* La carte, au format d'une carte bancaire (ratio 85,6 × 54 mm). */}
      <div className="zone-impression mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-creme shadow-lg ring-1 ring-navy-900/20">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          {d.logo_url
            ? <img src={d.logo_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
            : <span className="grid h-9 w-9 place-items-center rounded-lg bg-or-500 font-display text-sm font-bold text-navy-900">{d.sigle || "U"}</span>}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight">{d.ecole || "Établissement"}</p>
            <p className="text-[11px] uppercase tracking-wide text-creme/60">Carte d&apos;étudiant</p>
          </div>
        </div>

        <div className="flex gap-4 p-5">
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-creme/50">Titulaire</p>
              <p className="font-display text-lg font-bold leading-tight">{d.prenom} {d.nom}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-creme/50">Matricule</p>
              <p className="font-mono text-sm">{d.matricule || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-creme/50">Filière</p>
              <p className="text-sm leading-tight">
                {d.filiere || "—"}{d.niveau ? ` · ${d.niveau}` : ""}
              </p>
            </div>
            {d.annee && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-creme/50">Année</p>
                <p className="text-sm">{d.annee}</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1">
            {d.photo_url && (
              <img src={d.photo_url} alt=""
                className="h-20 w-16 rounded-lg object-cover ring-1 ring-white/20" />
            )}
            <div className="rounded-lg bg-white p-1.5">
              <QRCode value={url} taille={84} niveau="L" />
            </div>
          </div>
        </div>

        <p className="border-t border-white/10 px-5 py-2 text-center text-[10px] text-creme/50">
          Scannez le QR pour vérifier l&apos;authenticité de cette carte
        </p>
      </div>

      <p className="text-center text-xs text-navy-900/45 print:hidden">
        La vérification confirme votre inscription <b>active</b> : nom, matricule, filière et
        établissement. Rien d&apos;autre n&apos;est exposé.
      </p>
    </div>
  );
}
