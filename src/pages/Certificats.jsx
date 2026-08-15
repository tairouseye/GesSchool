import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, EtatVide } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import DocumentOfficiel from "@/composants/DocumentOfficiel.jsx";
import { getEleves, getInscriptionsParEleve } from "@/lib/eleves.js";
import { getAnneeCourante, getSignataires } from "@/lib/academique.js";
import { getDernierBulletin } from "@/lib/bulletins.js";
import { getResumePaiementEleve } from "@/lib/paiements.js";
import * as api from "@/lib/documents.js";

const auj = () => new Date().toISOString().slice(0, 10);
const dateLisible = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");
const STATUTS = {
  en_attente: { label: "En attente de signature", cls: "bg-or-500/15 text-or-600" },
  valide: { label: "Validé / signé", cls: "bg-emerald-500/10 text-emerald-700" },
  rejete: { label: "Rejeté", cls: "bg-rose-500/10 text-rose-700" },
};

const MODELES = [
  { id: "scolarite", titre: "Certificat de scolarité",
    corps: (c) => `certifie que l'élève ${c.nomComplet}, ${c.nee} le ${c.dateNaiss}${c.lieuNaiss ? ` à ${c.lieuNaiss}` : ""}, matricule ${c.matricule}, est régulièrement ${c.inscrit} dans notre établissement en classe de ${c.classe} au titre de l'année scolaire ${c.annee}.` },
  { id: "inscription", titre: "Attestation d'inscription",
    corps: (c) => `atteste que l'élève ${c.nomComplet}, ${c.nee} le ${c.dateNaiss}${c.lieuNaiss ? ` à ${c.lieuNaiss}` : ""}, a été ${c.inscrit} en classe de ${c.classe} pour l'année scolaire ${c.annee}.` },
  { id: "frequentation", titre: "Attestation de fréquentation",
    corps: (c) => `atteste que l'élève ${c.nomComplet}, matricule ${c.matricule}, fréquente régulièrement notre établissement en classe de ${c.classe} durant l'année scolaire ${c.annee}.` },
  { id: "radiation", titre: "Certificat de radiation",
    corps: (c) => `certifie que l'élève ${c.nomComplet}, ${c.nee} le ${c.dateNaiss}${c.lieuNaiss ? ` à ${c.lieuNaiss}` : ""}, matricule ${c.matricule}, précédemment ${c.inscrit} en classe de ${c.classe}, a été ${c.radie} des effectifs de notre établissement au titre de l'année scolaire ${c.annee}. Le présent certificat lui est délivré pour servir et valoir ce que de droit, notamment en vue d'un transfert.` },
  { id: "resultats", titre: "Attestation de résultats",
    corps: (c) => `atteste que l'élève ${c.nomComplet}, matricule ${c.matricule}, ${c.inscrit} en classe de ${c.classe} au titre de l'année scolaire ${c.annee}, a obtenu une moyenne générale de ${c.moyenne}${c.mention !== "—" ? ` (mention ${c.mention})` : ""}${c.rang ? `, se classant ${c.rang}` : ""}.${c.decision ? ` Décision du conseil de classe : ${c.decision}.` : ""} La présente attestation lui est délivrée pour servir et valoir ce que de droit.` },
  { id: "paiement", titre: "Attestation de paiement",
    corps: (c) => `atteste que, pour l'élève ${c.nomComplet}${c.classe !== "—" ? ` (classe de ${c.classe})` : ""}, au titre de l'année scolaire ${c.annee}, un montant total de ${c.paye} ${c.devise} a été réglé à notre établissement${c.solde > 0 ? `, laissant un solde restant dû de ${c.soldeFmt} ${c.devise}` : `, soldant l'intégralité des frais dus`}. La présente attestation est délivrée pour servir et valoir ce que de droit.` },
  { id: "convocation", titre: "Convocation",
    corps: (c) => `convoque le responsable légal de l'élève ${c.nomComplet}${c.classe !== "—" ? ` (classe de ${c.classe})` : ""} à se présenter dans nos locaux le ${c.rdvDate || "…"}${c.rdvHeure ? ` à ${c.rdvHeure}` : ""}, au sujet suivant : ${c.motif || "…"}. Nous comptons sur votre présence.` },
];

export default function Certificats() {
  const { ecoleId, ecole } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [annee, setAnnee] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [signataires, setSignataires] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [eleveId, setEleveId] = useState("");
  const [modeleId, setModeleId] = useState("scolarite");
  const [ville, setVille] = useState("");
  const [date, setDate] = useState(auj());
  const [reference, setReference] = useState("");
  const [motif, setMotif] = useState("");        // convocation : objet
  const [rdvDate, setRdvDate] = useState("");     // convocation : date du rendez-vous
  const [rdvHeure, setRdvHeure] = useState("");   // convocation : heure
  const [sigIdx, setSigIdx] = useState(0);
  const [apercu, setApercu] = useState(null);
  const [extra, setExtra] = useState({ resultat: null, paiement: null }); // résultats + paiement de l'élève sélectionné
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      setAnnee(an);
      const [els, insc, sig, docs] = await Promise.all([
        getEleves(ecoleId), getInscriptionsParEleve(ecoleId, an?.id), getSignataires(ecoleId), api.getDocuments(ecoleId),
      ]);
      setEleves(els); setInscriptions(insc); setSignataires(sig); setDocuments(docs);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  // Sélectionne le « Directeur » par défaut.
  useEffect(() => {
    if (!signataires.length) return;
    const i = signataires.findIndex((s) => /directeur|directrice/i.test(s.fonction || ""));
    setSigIdx(i >= 0 ? i : 0);
  }, [signataires]);

  useEffect(() => { if (ecole?.ville && !ville) setVille(ecole.ville); }, [ecole]); // eslint-disable-line

  // Résultats + paiement de l'élève (pour les attestations de résultats / paiement).
  useEffect(() => {
    if (!eleveId || !annee) { setExtra({ resultat: null, paiement: null }); return; }
    let vivant = true;
    Promise.all([
      getDernierBulletin(eleveId, annee.id).catch(() => null),
      getResumePaiementEleve(ecoleId, eleveId, annee.id).catch(() => null),
    ]).then(([resultat, paiement]) => { if (vivant) setExtra({ resultat, paiement }); });
    return () => { vivant = false; };
  }, [eleveId, annee, ecoleId]);

  const eleve = eleves.find((e) => e.id === eleveId);
  const modele = MODELES.find((m) => m.id === modeleId);
  const sig = signataires[sigIdx];

  const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("fr-FR"));
  const rangLisible = (r, eff) => (r ? `${r}${r === 1 ? "er" : "e"}${eff ? ` sur ${eff}` : ""}` : "");
  const ctx = eleve && {
    nomComplet: `${eleve.prenom} ${eleve.nom}`,
    nee: eleve.sexe === "F" ? "née" : "né",
    inscrit: eleve.sexe === "F" ? "inscrite" : "inscrit",
    radie: eleve.sexe === "F" ? "radiée" : "radié",
    dateNaiss: eleve.date_naissance ? dateLisible(eleve.date_naissance) : "—",
    lieuNaiss: eleve.lieu_naissance,
    matricule: eleve.matricule || "—",
    classe: inscriptions[eleve.id]?.classes?.libelle || "—",
    annee: annee?.libelle || "—",
    devise: ecole?.devise || "XOF",
    moyenne: extra.resultat?.moyenne_generale != null ? fmt(extra.resultat.moyenne_generale) : "—",
    mention: extra.resultat?.mention || "—",
    rang: rangLisible(extra.resultat?.rang, extra.resultat?.effectif),
    decision: extra.resultat?.decision || "",
    paye: fmt(extra.paiement?.paye ?? 0),
    solde: extra.paiement?.solde ?? 0,
    soldeFmt: fmt(extra.paiement?.solde ?? 0),
    motif,
    rdvDate: rdvDate ? dateLisible(rdvDate) : "",
    rdvHeure,
  };

  async function envoyer() {
    setErreur("");
    if (!eleve) return setErreur("Choisissez un élève.");
    if (!sig) return setErreur("Aucun signataire. Ajoutez-en dans Paramètres → Signataires.");
    if (!sig.profil_id) return setErreur(`« ${sig.fonction} » n'a pas de compte lié : impossible de lui envoyer pour validation (Paramètres → Signataires).`);
    setEnvoi(true);
    try {
      await api.creerDocument(ecoleId, {
        eleve_id: eleve.id, type: modeleId, titre: modele.titre, corps: modele.corps(ctx),
        ville, date_doc: date, reference,
        signataire_fonction: sig.fonction, signataire_nom: sig.nom, signataire_profil: sig.profil_id, signature_url: sig.signature_url,
      });
      toast.succes("Document envoyé au signataire pour validation.");
      setEleveId(""); setReference("");
      await recharger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
    finally { setEnvoi(false); }
  }

  return (
    <>
      <EnTete titre="Documents officiels" sousTitre="Certificats & attestations — validés par le signataire avant impression" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* Création */}
        <Carte className="no-print p-6">
          <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Nouveau document</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Élève</span>
              <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="">— Choisir —</option>
                {eleves.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.matricule}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de document</span>
              <select value={modeleId} onChange={(e) => setModeleId(e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                {MODELES.map((m) => <option key={m.id} value={m.id}>{m.titre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Signataire</span>
              <select value={sigIdx} onChange={(e) => setSigIdx(Number(e.target.value))}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                {signataires.length === 0 && <option value={0}>— Aucun (Paramètres → Signataires) —</option>}
                {signataires.map((s, i) => (
                  <option key={i} value={i}>{s.fonction}{s.nom ? ` — ${s.nom}` : ""}{s.profil_id ? "" : " (sans compte)"}</option>
                ))}
              </select>
            </label>
            <Champ label="Fait à" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Dakar" />
            <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Champ label="Référence (optionnel)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° 014/2026" />
            {modeleId === "convocation" && (
              <>
                <Champ label="Objet / motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. comportement, retards, réunion…" />
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Date du rendez-vous" type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} />
                  <Champ label="Heure" type="time" value={rdvHeure} onChange={(e) => setRdvHeure(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Bouton onClick={envoyer} disabled={envoi || !eleve || !sig}>
              {envoi ? "Envoi…" : "Envoyer pour validation"}
            </Bouton>
          </div>
          <p className="mt-2 text-right text-xs text-navy-900/40">Le signataire reçoit une alerte et doit valider avant l'impression.</p>
        </Carte>

        {/* Liste des documents */}
        {documents.length === 0 ? (
          <EtatVide icone="🧾" titre="Aucun document">Créez un premier document et envoyez‑le au signataire pour validation.</EtatVide>
        ) : (
          <Carte className="no-print overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr><th className="px-5 py-3 font-medium">Élève</th><th className="px-5 py-3 font-medium">Document</th><th className="px-5 py-3 font-medium">Signataire</th><th className="px-5 py-3 font-medium">Statut</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-t border-navy-900/5">
                    <td className="px-5 py-3 font-medium text-navy-900">{d.eleves ? `${d.eleves.prenom} ${d.eleves.nom}` : "—"}</td>
                    <td className="px-5 py-3 text-navy-900/70">{d.titre}<div className="text-xs text-navy-900/40">{dateLisible(d.date_doc)}</div></td>
                    <td className="px-5 py-3 text-navy-900/60">{d.signataire_fonction}{d.signataire_nom ? ` — ${d.signataire_nom}` : ""}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUTS[d.statut]?.cls}`}>{STATUTS[d.statut]?.label}</span>
                      {d.statut === "rejete" && d.motif_rejet && <div className="mt-1 text-xs text-rose-500">{d.motif_rejet}</div>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setApercu(d)} className="text-xs text-navy-700 hover:text-or-500">{d.statut === "valide" ? "imprimer" : "aperçu"}</button>
                      <button onClick={async () => { if (await confirmer("Supprimer ce document ?")) { try { await api.supprimerDocument(d.id); toast.succes("Document supprimé."); await recharger(); } catch (e) { toast.erreur(e.message); } } }}
                        className="ml-3 text-xs text-rose-500 hover:underline">suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        )}
      </div>

      {/* Aperçu / impression */}
      <Modale ouvert={!!apercu} onFermer={() => setApercu(null)} titre={apercu?.titre} large>
        {apercu && (
          <>
            {apercu.statut !== "valide" && (
              <div className="no-print mb-3 rounded-xl bg-or-500/10 px-4 py-2 text-sm text-or-700">
                Document <b>non validé</b> — l'impression n'est possible qu'une fois signé par le signataire.
              </div>
            )}
            <DocumentOfficiel
              ecole={ecole} titre={apercu.titre} corps={apercu.corps}
              signataire={apercu.signataire_nom ? `${apercu.signataire_fonction} — ${apercu.signataire_nom}` : apercu.signataire_fonction}
              signatureUrl={apercu.signature_url} ville={apercu.ville} date={apercu.date_doc} reference={apercu.reference}
              signature={apercu.statut === "valide"} />
            {apercu.statut === "valide" && (
              <div className="no-print mt-4 flex justify-end"><Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton></div>
            )}
          </>
        )}
      </Modale>
    </>
  );
}
