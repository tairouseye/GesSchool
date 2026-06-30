import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { getEleves, getInscriptionsParEleve } from "@/lib/eleves.js";
import { getAnneeCourante, getSignataires } from "@/lib/academique.js";

const auj = () => new Date().toISOString().slice(0, 10);
const dateLisible = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

// Modèles de documents. `corps(ctx)` renvoie le texte (avec accords m/f).
const MODELES = [
  {
    id: "scolarite",
    titre: "Certificat de scolarité",
    corps: (c) =>
      `certifie que l'élève ${c.nomComplet}, ${c.nee} le ${c.dateNaiss}${c.lieuNaiss ? ` à ${c.lieuNaiss}` : ""}, ` +
      `matricule ${c.matricule}, est régulièrement ${c.inscrit} dans notre établissement en classe de ${c.classe} ` +
      `au titre de l'année scolaire ${c.annee}.`,
  },
  {
    id: "inscription",
    titre: "Attestation d'inscription",
    corps: (c) =>
      `atteste que l'élève ${c.nomComplet}, ${c.nee} le ${c.dateNaiss}${c.lieuNaiss ? ` à ${c.lieuNaiss}` : ""}, ` +
      `a été ${c.inscrit} en classe de ${c.classe} pour l'année scolaire ${c.annee}.`,
  },
  {
    id: "frequentation",
    titre: "Attestation de fréquentation",
    corps: (c) =>
      `atteste que l'élève ${c.nomComplet}, matricule ${c.matricule}, ` +
      `fréquente régulièrement notre établissement en classe de ${c.classe} durant l'année scolaire ${c.annee}.`,
  },
];

export default function Certificats() {
  const { ecoleId, ecole } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [inscriptions, setInscriptions] = useState({});
  const [eleveId, setEleveId] = useState("");
  const [modeleId, setModeleId] = useState("scolarite");
  const [ville, setVille] = useState("");
  const [signataire, setSignataire] = useState("Le Directeur");
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [signataires, setSignataires] = useState([]);
  const [date, setDate] = useState(auj());
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [els, insc, sig] = await Promise.all([
          getEleves(ecoleId), getInscriptionsParEleve(ecoleId, an?.id), getSignataires(ecoleId),
        ]);
        setEleves(els);
        setInscriptions(insc);
        setSignataires(sig);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId]);

  const choisirSignataire = (idx) => {
    const s = signataires[idx];
    if (!s) return;
    setSignataire(s.nom ? `${s.fonction} — ${s.nom}` : s.fonction);
    setSignatureUrl(s.signature_url || null);
  };

  useEffect(() => { if (ecole?.ville && !ville) setVille(ecole.ville); }, [ecole]); // eslint-disable-line

  const eleve = eleves.find((e) => e.id === eleveId);
  const modele = MODELES.find((m) => m.id === modeleId);
  const f = eleve?.sexe === "F";
  const ctx = eleve && {
    nomComplet: `${eleve.prenom} ${eleve.nom}`,
    nee: f ? "née" : "né",
    inscrit: f ? "inscrite" : "inscrit",
    dateNaiss: eleve.date_naissance ? dateLisible(eleve.date_naissance) : "—",
    lieuNaiss: eleve.lieu_naissance,
    matricule: eleve.matricule || "—",
    classe: inscriptions[eleve.id]?.classes?.libelle || "—",
    annee: annee?.libelle || "—",
  };

  return (
    <>
      <EnTete titre="Certificats & attestations" sousTitre="Documents officiels imprimables" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Carte className="no-print p-6">
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
            <Champ label="Fait à" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Dakar" />
            <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {signataires.length > 0 && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Signataire enregistré</span>
                <select onChange={(e) => choisirSignataire(Number(e.target.value))} defaultValue=""
                  className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                  <option value="">— Choisir —</option>
                  {signataires.map((s, i) => <option key={i} value={i}>{s.fonction}{s.nom ? ` — ${s.nom}` : ""}</option>)}
                </select>
              </label>
            )}
            <Champ label="Signataire" value={signataire} onChange={(e) => { setSignataire(e.target.value); setSignatureUrl(null); }} placeholder="Le Directeur" />
            <Champ label="Référence (optionnel)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° 014/2026" />
          </div>
          <div className="mt-4 flex justify-end">
            <Bouton onClick={() => window.print()} disabled={!eleve}>Imprimer / PDF</Bouton>
          </div>
        </Carte>

        {eleve ? (
          <Document ecole={ecole} titre={modele.titre} corps={modele.corps(ctx)}
            signataire={signataire} signatureUrl={signatureUrl} ville={ville} date={date} reference={reference} />
        ) : (
          <Carte className="no-print p-8 text-sm text-navy-900/40">Choisis un élève pour générer le document.</Carte>
        )}
      </div>
    </>
  );
}

function Document({ ecole, titre, corps, signataire, signatureUrl, ville, date, reference }) {
  return (
    <div className="zone-impression relative mx-auto max-w-3xl overflow-hidden rounded-xl border border-navy-900/10 bg-white p-10">
      <Cachet size={240} sigle={ecole?.sigle || "GS"} className="pointer-events-none absolute -right-10 top-1/3 text-or-500/5" />

      {/* En-tête établissement */}
      <div className="flex items-center gap-4 border-b border-navy-900/10 pb-5">
        {ecole?.logo_url
          ? <img src={ecole.logo_url} alt="" className="h-14 w-14 object-contain" />
          : <Cachet size={56} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />}
        <div>
          <p className="font-display text-xl font-bold text-navy-900">{ecole?.nom}</p>
          <p className="text-xs text-navy-900/50">
            {[ecole?.adresse, ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}
            {ecole?.telephone ? ` · ${ecole.telephone}` : ""}
          </p>
        </div>
      </div>

      {reference && <p className="mt-4 text-xs text-navy-900/50">Réf. : {reference}</p>}

      <h1 className="mt-6 text-center font-display text-2xl font-bold uppercase tracking-wide text-navy-900">{titre}</h1>

      <p className="mt-8 text-sm leading-7 text-navy-900/80">
        Je soussigné(e), <b>{signataire}</b> de l'établissement <b>{ecole?.nom}</b>, {corps}
      </p>
      <p className="mt-4 text-sm leading-7 text-navy-900/80">
        En foi de quoi le présent document est délivré à l'intéressé(e) pour servir et valoir ce que de droit.
      </p>

      <div className="mt-12 flex items-end justify-between">
        <span className="text-xs text-navy-900/40">Document généré via GesSchool</span>
        <div className="text-center">
          <p className="text-sm text-navy-900/70">Fait à {ville || "…"}, le {dateLisible(date)}</p>
          <p className="mt-1 text-sm font-medium text-navy-900">{signataire}</p>
          <div className="mt-1 flex h-16 items-center justify-center">
            {signatureUrl
              ? <img src={signatureUrl} alt="" className="max-h-16 object-contain" />
              : <Cachet size={64} sigle={ecole?.sigle || "GS"} className="text-navy-900/20" />}
          </div>
          <p className="text-[10px] text-navy-900/30">Signature et cachet</p>
        </div>
      </div>
    </div>
  );
}
