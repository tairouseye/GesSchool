import { useEffect, useState, useCallback } from "react";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide, Badge, SkeletonListe, Kpi } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import { mesFactures, mesDeclarations, declarerMonPaiement, mesInfosPaiement, monDossier } from "@/lib/etudiant.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const reste = (f) => Math.max(0, (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0));

const TONS = { payee: "success", partielle: "warning", impayee: "danger", annulee: "neutre" };
const MODES = [["wave", "Wave"], ["orange_money", "Orange Money"], ["free_money", "Free Money"], ["virement", "Virement"], ["especes", "Espèces"]];

// Espace étudiant — scolarité. L'étudiant est majeur : il voit ses factures
// et déclare lui-même ses paiements, sans passer par un tuteur.
export default function EtudiantScolarite() {
  // La devise vient du dossier étudiant : `useAuth().ecole` est NULL pour un
  // étudiant (son `profils.ecole_id` l'est aussi), la coder en dur donnerait
  // « XOF » à un établissement en USD ou en CDF.
  const [devise, setDevise] = useState("XOF");
  const toast = useToast();
  const [factures, setFactures] = useState(null);
  const [decls, setDecls] = useState([]);
  const [infos, setInfos] = useState({});
  const [erreur, setErreur] = useState("");
  const [payer, setPayer] = useState(null);

  const recharger = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([mesFactures(), mesDeclarations()]);
      setFactures(f); setDecls(d);
    } catch (e) { setErreur(e.message); setFactures([]); }
  }, []);
  useEffect(() => {
    recharger();
    mesInfosPaiement().then(setInfos).catch(() => setInfos({}));
    monDossier().then((d) => d?.devise && setDevise(d.devise)).catch(() => {});
  }, [recharger]);

  const total = (factures || []).reduce((s, f) => s + (Number(f.montant_total) || 0), 0);
  const paye = (factures || []).reduce((s, f) => s + (Number(f.montant_paye) || 0), 0);
  const du = Math.max(0, total - paye);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">₣ Ma scolarité</p>
        <p className="text-sm text-creme/70">Factures et déclarations de paiement</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Facturé" valeur={fmt(total)} suffixe={devise} chargement={factures === null} />
        <Kpi label="Réglé" valeur={fmt(paye)} suffixe={devise} ton="vert" chargement={factures === null} />
        <Kpi label="Reste dû" valeur={fmt(du)} suffixe={devise} ton={du > 0 ? "rouge" : "vert"} chargement={factures === null} />
      </div>

      {factures === null ? <SkeletonListe lignes={3} /> : factures.length === 0 ? (
        <EtatVide icone="₣" titre="Aucune facture">Vos frais de scolarité apparaîtront ici.</EtatVide>
      ) : (
        <div className="space-y-2">
          {factures.map((f) => {
            const r = reste(f);
            const enAttente = decls.filter((d) => d.facture_id === f.id && d.statut === "en_attente").length;
            return (
              <Carte key={f.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy-900">{f.numero || "Facture"}</p>
                    <p className="text-xs text-navy-900/55">
                      Émise le {dateFr(f.date_emission)}
                      {f.date_echeance ? ` · échéance ${dateFr(f.date_echeance)}` : ""}
                    </p>
                  </div>
                  <Badge ton={TONS[f.statut] || "neutre"}>{f.statut}</Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums text-navy-900/70">
                    {fmt(f.montant_paye)} / {fmt(f.montant_total)} {devise}
                    {r > 0 && <b className="ml-2 text-rose-600">reste {fmt(r)}</b>}
                  </span>
                  {r > 0 && <Bouton onClick={() => setPayer(f)}>Déclarer un paiement</Bouton>}
                </div>

                {enAttente > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {enAttente} déclaration(s) en attente de validation par la comptabilité.
                  </p>
                )}
              </Carte>
            );
          })}
        </div>
      )}

      {decls.length > 0 && (
        <Carte className="p-4">
          <h3 className="mb-2 font-display text-base font-semibold text-navy-900">Mes déclarations</h3>
          <ul className="space-y-1.5">
            {decls.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-navy-900/70">
                  {fmt(d.montant)} {devise} · {d.mode}
                  {d.reference_tx ? <span className="ml-2 font-mono text-xs text-navy-900/45">{d.reference_tx}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-navy-900/45">{dateFr(d.created_at)}</span>
                  <Badge ton={d.statut === "valide" ? "success" : d.statut === "rejete" ? "danger" : "warning"}>
                    {d.statut}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {payer && (
        <ModalePaiement facture={payer} devise={devise} infos={infos}
          onFermer={() => setPayer(null)}
          onFait={() => { setPayer(null); recharger(); toast.succes("Déclaration envoyée. La comptabilité va la vérifier."); }} />
      )}
    </div>
  );
}

function ModalePaiement({ facture, devise, infos, onFermer, onFait }) {
  const toast = useToast();
  const [f, setF] = useState({ montant: reste(facture), mode: "wave", reference: "" });
  const [busy, setBusy] = useState(false);

  async function envoyer(e) {
    e.preventDefault();
    const m = Number(f.montant);
    if (!(m > 0)) { toast.erreur("Montant invalide."); return; }
    if (m > reste(facture)) { toast.erreur(`Le reste dû est de ${fmt(reste(facture))} ${devise}.`); return; }
    setBusy(true);
    try {
      await declarerMonPaiement(facture.id, m, f.mode, f.reference);
      onFait();
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  const numeros = Object.entries(infos || {}).filter(([, v]) => typeof v === "string" && v);

  return (
    <Modale ouvert onFermer={onFermer} titre="Déclarer un paiement">
      <form onSubmit={envoyer} className="space-y-4">
        {numeros.length > 0 && (
          <div className="rounded-xl bg-creme/70 p-3 text-sm">
            <p className="mb-1 font-medium text-navy-900">Où payer</p>
            {numeros.map(([k, v]) => (
              <p key={k} className="text-navy-900/70"><span className="capitalize">{k.replace(/_/g, " ")}</span> : <b>{v}</b></p>
            ))}
          </div>
        )}

        <Alerte ton="info">
          Déclarez ici un paiement <b>déjà effectué</b>. La comptabilité le vérifie avant de
          l&apos;encaisser — votre facture ne sera soldée qu&apos;après validation.
        </Alerte>

        <Champ label={`Montant (reste dû : ${fmt(reste(facture))} ${devise})`} type="number" min="1"
          value={f.montant} onChange={(e) => setF((s) => ({ ...s, montant: e.target.value }))} required />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Moyen de paiement</span>
          <select value={f.mode} onChange={(e) => setF((s) => ({ ...s, mode: e.target.value }))}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <Champ label="Référence de la transaction" placeholder="Identifiant reçu par SMS"
          value={f.reference} onChange={(e) => setF((s) => ({ ...s, reference: e.target.value }))} />

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" disabled={busy}>{busy ? "…" : "Envoyer la déclaration"}</Bouton>
        </div>
      </form>
    </Modale>
  );
}
