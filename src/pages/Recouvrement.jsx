import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Alerte } from "@/composants/ui.jsx";
import * as api from "@/lib/recouvrement.js";
import { getAnneeCourante } from "@/lib/academique.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export default function Recouvrement() {
  const { ecoleId, ecole } = useAuth();
  const devise = ecole?.devise || "XOF";
  const [annee, setAnnee] = useState(null);
  const [impayes, setImpayes] = useState([]);
  const [contacts, setContacts] = useState({});
  const [filtre, setFiltre] = useState("retard"); // 'retard' | 'tous'
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [imp, ct] = await Promise.all([api.getImpayes(ecoleId, an?.id), api.getContactsPaiement(ecoleId)]);
      setImpayes(imp);
      setContacts(ct);
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

  function relancer(i) {
    const c = contacts[i.eleve_id];
    const msg =
      `Bonjour, rappel de l'établissement ${ecole?.nom || ""} : ` +
      `un solde de ${fmt(i.reste)} ${devise} reste dû pour l'élève ${i.eleve?.prenom} ${i.eleve?.nom}` +
      `${i.echeance ? ` (échéance ${i.echeance})` : ""}. Merci de régulariser. Cordialement.`;
    const lien = api.lienWhatsApp(c?.telephone, msg);
    if (lien) window.open(lien, "_blank");
    else { navigator.clipboard?.writeText(msg); alert("Aucun téléphone enregistré — message copié dans le presse-papier."); }
  }

  return (
    <>
      <EnTete titre="Recouvrement & relances" sousTitre={annee ? `Année ${annee.libelle}` : ""} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

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

        {/* Filtre */}
        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["retard", "En retard"], ["tous", "Tous les impayés"]].map(([k, l]) => (
            <button key={k} onClick={() => setFiltre(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filtre === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        <Carte className="overflow-hidden">
          {chargement ? (
            <p className="p-8 text-sm text-navy-900/50">Chargement…</p>
          ) : liste.length === 0 ? (
            <p className="p-8 text-sm text-navy-900/40">
              {filtre === "retard" ? "Aucun impayé en retard 🎉" : "Aucun impayé."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Élève</th>
                  <th className="px-6 py-3 font-medium">Échéance</th>
                  <th className="px-6 py-3 text-right font-medium">Reste dû</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {liste.map((i) => {
                  const c = contacts[i.eleve_id];
                  return (
                    <tr key={i.eleve_id} className="border-t border-navy-900/5 hover:bg-creme/60">
                      <td className="px-6 py-3">
                        <div className="font-medium text-navy-900">{i.eleve?.prenom} {i.eleve?.nom}</div>
                        <div className="font-mono text-[11px] text-navy-900/40">{i.eleve?.matricule}</div>
                      </td>
                      <td className="px-6 py-3">
                        {i.echeance ? (
                          <span className={i.enRetard ? "text-rose-600" : "text-navy-900/60"}>
                            {i.echeance}{i.enRetard && <span className="ml-1 text-xs">(+{i.joursRetard} j)</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-semibold">{fmt(i.reste)} {devise}</td>
                      <td className="px-6 py-3 text-navy-900/60">
                        {c ? <>{c.prenom} {c.nom}<div className="font-mono text-xs text-navy-900/40">{c.telephone || "—"}</div></> : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => relancer(i)}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                        >
                          Relancer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Carte>
        <p className="text-xs text-navy-900/40">
          « Relancer » ouvre WhatsApp avec un message pré-rempli (ou copie le message si aucun numéro).
        </p>
      </div>
    </>
  );
}
