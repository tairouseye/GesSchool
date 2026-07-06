import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import DocumentOfficiel from "@/composants/DocumentOfficiel.jsx";
import * as api from "@/lib/documents.js";

const dateLisible = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

export default function ASigner() {
  const { ecole } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [sel, setSel] = useState(null);
  const [rejet, setRejet] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try { setDocs(await api.mesDocumentsASigner()); } catch (e) { setErreur(e.message); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  async function valider(d) {
    try { await api.validerDocument(d.id); toast.succes("Document validé et signé."); setSel(null); await recharger(); }
    catch (e) { toast.erreur(e.message); }
  }
  async function rejeter(d) {
    try { await api.rejeterDocument(d.id, motif.trim()); toast.succes("Document rejeté."); setRejet(false); setMotif(""); setSel(null); await recharger(); }
    catch (e) { toast.erreur(e.message); }
  }

  return (
    <>
      <EnTete titre="Documents à signer" sousTitre="Validez les documents qui portent votre signature" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {docs.length === 0 ? (
          <EtatVide icone="✍️" titre="Rien à signer">Aucun document n'attend votre validation.</EtatVide>
        ) : (
          <Carte className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr><th className="px-5 py-3 font-medium">Élève</th><th className="px-5 py-3 font-medium">Document</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-navy-900/5">
                    <td className="px-5 py-3 font-medium text-navy-900">{d.eleves ? `${d.eleves.prenom} ${d.eleves.nom}` : "—"}</td>
                    <td className="px-5 py-3 text-navy-900/70">{d.titre}</td>
                    <td className="px-5 py-3 text-xs text-navy-900/50">{dateLisible(d.date_doc)}</td>
                    <td className="px-5 py-3 text-right">
                      <Bouton className="!py-1.5 text-xs" onClick={() => { setSel(d); setRejet(false); }}>Examiner</Bouton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        )}
      </div>

      <Modale ouvert={!!sel} onFermer={() => setSel(null)} titre={sel?.titre} large>
        {sel && (
          <>
            <div className="mb-3 rounded-xl bg-navy-900/5 px-4 py-2 text-sm text-navy-900/60">
              En <b>validant</b>, votre signature sera apposée et le document deviendra imprimable.
            </div>
            <DocumentOfficiel
              ecole={ecole} titre={sel.titre} corps={sel.corps}
              signataire={sel.signataire_nom ? `${sel.signataire_fonction} — ${sel.signataire_nom}` : sel.signataire_fonction}
              signatureUrl={sel.signature_url} ville={sel.ville} date={sel.date_doc} reference={sel.reference} signature />
            {rejet ? (
              <div className="mt-4 space-y-2">
                <Champ label="Motif du rejet" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. erreur sur la classe" />
                <div className="flex justify-end gap-2">
                  <Bouton variante="fantome" onClick={() => setRejet(false)}>Annuler</Bouton>
                  <Bouton variante="danger" onClick={() => rejeter(sel)}>Confirmer le rejet</Bouton>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex justify-end gap-2">
                <Bouton variante="fantome" className="text-rose-600" onClick={() => setRejet(true)}>Rejeter</Bouton>
                <Bouton onClick={() => valider(sel)}>✓ Valider &amp; signer</Bouton>
              </div>
            )}
          </>
        )}
      </Modale>
    </>
  );
}
