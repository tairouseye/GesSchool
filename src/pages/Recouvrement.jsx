import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte, EtatVide, SkeletonListe, Bouton, Modale, Table, Badge } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/recouvrement.js";
import * as relancesApi from "@/lib/relances.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export default function Recouvrement() {
  const { ecoleId, ecole } = useAuth();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(null);
  const [impayes, setImpayes] = useState([]);
  const [contacts, setContacts] = useState({});
  const [relances, setRelances] = useState([]);
  const [vue, setVue] = useState("impayes"); // 'impayes' | 'historique'
  const [filtre, setFiltre] = useState("retard"); // 'retard' | 'tous'
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(null); // eleve_id en cours de relance push
  const [etatOuvert, setEtatOuvert] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [imp, ct, rel] = await Promise.all([
        api.getImpayes(ecoleId, an?.id),
        api.getContactsPaiement(ecoleId),
        relancesApi.getRelances(ecoleId),
      ]);
      setImpayes(imp);
      setContacts(ct);
      setRelances(rel);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const liste = impayes.filter((i) => (filtre === "retard" ? i.enRetard : true));
  const totalDu = impayes.reduce((s, i) => s + i.reste, 0);
  const totalRetard = impayes.filter((i) => i.enRetard).reduce((s, i) => s + i.reste, 0);

  // Relance WhatsApp (manuelle, lien pré-rempli)
  function relancerWhatsApp(i) {
    const c = contacts[i.eleve_id];
    const msg =
      `Bonjour, rappel de l'établissement ${ecole?.nom || ""} : ` +
      `un solde de ${fmt(i.reste)} ${devise} reste dû pour l'élève ${i.eleve?.prenom} ${i.eleve?.nom}` +
      `${i.echeance ? ` (échéance ${i.echeance})` : ""}. Merci de régulariser. Cordialement.`;
    const lien = api.lienWhatsApp(c?.telephone, msg);
    if (lien) window.open(lien, "_blank");
    else {
      navigator.clipboard?.writeText(msg);
      toast.info("Aucun téléphone enregistré — le message a été copié dans le presse-papier.");
    }
  }

  // Relance push/in-app (notification au parent connecté)
  async function relancerPush(i) {
    setErreur(""); setInfo(""); setEnCours(i.eleve_id);
    try {
      await relancesApi.relancerEleve(i.eleve_id);
      setInfo(`Rappel envoyé pour ${i.eleve?.prenom} ${i.eleve?.nom}.`);
      setRelances(await relancesApi.getRelances(ecoleId));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <EnTete titre="Recouvrement & relances" sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={<Bouton variante="fantome" onClick={() => setEtatOuvert(true)} disabled={impayes.length === 0}>🖨️ État des impayés</Bouton>} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {info && <Alerte ton="succes">{info}</Alerte>}

        {/* Synthèse */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Carte className="p-5">
            <p className="text-sm text-navy-900/50">Total dû</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-900">{fmt(totalDu)} <span className="text-sm font-normal">{devise}</span></p>
          </Carte>
          <Carte className="p-5">
            <p className="text-sm text-navy-900/50">Dont en retard</p>
            <p className="mt-1 font-display text-2xl font-bold text-rose-600">{fmt(totalRetard)} <span className="text-sm font-normal">{devise}</span></p>
          </Carte>
          <Carte className="p-5">
            <p className="text-sm text-navy-900/50">Élèves concernés</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-900">{impayes.length}</p>
          </Carte>
        </div>

        {/* Vue : impayés / historique */}
        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["impayes", "Impayés"], ["historique", "Historique des relances"]].map(([k, l]) => (
            <button key={k} onClick={() => setVue(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${vue === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {vue === "impayes" ? (
          <>
            {/* Filtre */}
            <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
              {[["retard", "En retard"], ["tous", "Tous les impayés"]].map(([k, l]) => (
                <button key={k} onClick={() => setFiltre(k)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filtre === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
                  {l}
                </button>
              ))}
            </div>

            {chargement ? (
              <SkeletonListe lignes={5} />
            ) : liste.length === 0 ? (
              <EtatVide icone={filtre === "retard" ? "🎉" : "✅"} titre={filtre === "retard" ? "Aucun impayé en retard" : "Aucun impayé"}>
                {filtre === "retard" ? "Toutes les échéances passées sont réglées." : "Aucune scolarité impayée pour ce filtre."}
              </EtatVide>
            ) : (
              <Table
                keyField="eleve_id"
                rows={liste}
                columns={[
                  { key: "eleve", label: "Élève", render: (i) => (
                    <><div className="font-medium text-navy-900">{i.eleve?.prenom} {i.eleve?.nom}</div>
                    <div className="font-mono text-[11px] text-navy-900/40">{i.eleve?.matricule}</div></>
                  ) },
                  { key: "echeance", label: "Échéance", render: (i) => i.echeance ? (
                    <span className={i.enRetard ? "text-danger-600" : "text-navy-900/60"}>
                      {i.echeance}{i.enRetard && <span className="ml-1 text-xs">(+{i.joursRetard} j)</span>}
                    </span>
                  ) : "—" },
                  { key: "reste", label: "Reste dû", align: "right", tdClassName: "font-semibold", render: (i) => `${fmt(i.reste)} ${devise}` },
                  { key: "contact", label: "Contact", hideMobile: true, render: (i) => {
                    const c = contacts[i.eleve_id];
                    return c ? (<span className="text-navy-900/60">{c.prenom} {c.nom}<div className="font-mono text-xs text-navy-900/40">{c.telephone || "—"}</div></span>) : "—";
                  } },
                  { key: "actions", label: "", align: "right", render: (i) => (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => relancerPush(i)} disabled={enCours === i.eleve_id}
                        className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-creme hover:bg-navy-800 disabled:opacity-50">
                        {enCours === i.eleve_id ? "…" : "Relancer (push)"}
                      </button>
                      <button onClick={() => relancerWhatsApp(i)}
                        className="rounded-lg bg-success-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-success-600">
                        WhatsApp
                      </button>
                    </div>
                  ) },
                ]}
              />
            )}
            <p className="text-xs text-navy-900/40">
              « Relancer (push) » envoie une notification + push au parent connecté.
              « WhatsApp » ouvre un message pré-rempli (ou le copie si aucun numéro).
            </p>
          </>
        ) : (
          relances.length === 0 ? (
            <EtatVide icone="🔔" titre="Aucune relance">Aucune relance envoyée pour l'instant.</EtatVide>
          ) : (
            <Table
              keyField="id"
              rows={relances}
              columns={[
                { key: "date", label: "Date", render: (r) => <span className="font-mono text-xs text-navy-900/60">{new Date(r.envoye_le).toLocaleDateString("fr-FR")}</span> },
                { key: "eleve", label: "Élève", render: (r) => (r.eleves ? `${r.eleves.prenom} ${r.eleves.nom}` : "—") },
                { key: "canal", label: "Canal", render: (r) => <Badge ton={r.canal === "auto" ? "neutre" : "or"}>{r.canal}</Badge> },
                { key: "montant", label: "Montant dû", align: "right", render: (r) => `${fmt(r.montant_du)} ${devise}` },
                { key: "message", label: "Message", hideMobile: true, render: (r) => <span className="text-navy-900/60">{r.message}</span> },
              ]}
            />
          )
        )}
      </div>

      {/* État des impayés (imprimable) */}
      <Modale ouvert={etatOuvert} onFermer={() => setEtatOuvert(false)} titre="État des impayés" large>
        <div className="zone-impression text-navy-900">
          <div className="mb-3 flex items-center gap-3 border-b border-navy-900/15 pb-2">
            {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-11 w-11 object-contain" />}
            <div className="flex-1">
              <p className="font-display text-base font-bold">{ecole?.nom}</p>
              <p className="text-xs text-navy-900/50">{[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="text-right text-xs text-navy-900/60">
              {annee?.libelle ? `Année ${annee.libelle}` : ""}<br />Édité le {new Date().toLocaleDateString("fr-FR")}
            </p>
          </div>
          <h1 className="mb-1 text-center font-display text-lg font-bold uppercase tracking-wide">État des impayés</h1>
          <p className="mb-3 text-center text-xs text-navy-900/50">{filtre === "retard" ? "Échéances en retard uniquement" : "Tous les soldes dus"}</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-navy-900/25 text-navy-900/60">
                <th className="px-2 py-1.5 text-left">N°</th>
                <th className="px-2 py-1.5 text-left">Élève</th>
                <th className="px-2 py-1.5 text-left">Échéance</th>
                <th className="px-2 py-1.5 text-center">Retard</th>
                <th className="px-2 py-1.5 text-right">Montant dû</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((i, k) => (
                <tr key={i.eleve_id} className="border-b border-navy-900/10">
                  <td className="px-2 py-1.5">{k + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{i.eleve?.nom} {i.eleve?.prenom}</td>
                  <td className="px-2 py-1.5">{i.echeance ? new Date(i.echeance).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-2 py-1.5 text-center">{i.enRetard ? "Oui" : "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(i.reste)} {devise}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy-900/30 font-bold">
                <td className="px-2 py-2" colSpan={4}>Total dû ({liste.length} élève{liste.length > 1 ? "s" : ""})</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(liste.reduce((s, i) => s + i.reste, 0))} {devise}</td>
              </tr>
              {filtre !== "retard" && (
                <tr className="text-rose-600">
                  <td className="px-2 py-1" colSpan={4}>dont en retard</td>
                  <td className="px-2 py-1 text-right font-mono">{fmt(totalRetard)} {devise}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        <div className="no-print mt-4 flex justify-end">
          <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
        </div>
      </Modale>
    </>
  );
}
