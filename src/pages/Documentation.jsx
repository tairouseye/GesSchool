import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Carte, Bouton, Champ, Modale } from "@/composants/ui.jsx";
import DocumentOfficiel from "@/composants/DocumentOfficiel.jsx";
import { getDocuments } from "@/lib/documents.js";
import { getFichiers, televerserFichier, supprimerFichier, lienFichier, poids, CATEGORIES, CATEGORIES_TEXTES,
         libCategorie, libPortee, PORTEES, estTexteReference, TAILLE_MAX,
         verserAuRayon, retirerDuRayon, peutEtreVerse,
         AUDIENCES, audienceExigeEntite, CHAMP_AUDIENCE } from "@/lib/fichiers.js";
import { getCycles, getNiveaux, getClasses, getAnneeCourante } from "@/lib/academique.js";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";

// Documentation (Pilotage) — hub central de tous les documents de l'école.
// Phase 1 : catalogue par famille (accès rapide aux générateurs) + liste des
// documents déjà enregistrés (certificats/attestations) avec aperçu.
// L'archivage automatique des autres types (factures, bulletins, paie…) sera
// branché en Phase 2 et viendra remplir la section « Documents enregistrés ».

const FAMILLES = [
  {
    id: "scolarite", label: "Scolarité & administratif", icone: "🎓",
    docs: [
      { label: "Certificat de scolarité", to: "/certificats", statut: "dispo" },
      { label: "Attestation d'inscription", to: "/certificats", statut: "dispo" },
      { label: "Attestation de fréquentation", to: "/certificats", statut: "dispo" },
      { label: "Certificat de radiation / transfert", to: "/certificats", statut: "dispo" },
      { label: "Attestation de résultats", to: "/certificats", statut: "dispo" },
      { label: "Carte scolaire", to: "/eleves", statut: "dispo" },
      { label: "Convocation", to: "/certificats", statut: "dispo" },
      { label: "Registre / liste d'élèves", to: "/eleves", statut: "dispo" },
    ],
  },
  {
    id: "pedagogie", label: "Pédagogie", icone: "📚",
    docs: [
      { label: "Bulletins de notes", to: "/bulletins", statut: "dispo" },
      { label: "Bulletin annuel / relevé", statut: "a_venir" },
      { label: "Classement / palmarès", to: "/classement", statut: "dispo" },
      { label: "Emploi du temps", to: "/emploi-du-temps", statut: "dispo" },
      { label: "Feuille de présence", to: "/eleves", statut: "dispo" },
      { label: "PV de conseil de classe", to: "/bulletins", statut: "dispo" },
    ],
  },
  {
    id: "finances", label: "Finances", icone: "💰",
    docs: [
      { label: "Factures", to: "/paiements", statut: "dispo" },
      { label: "Reçus de paiement", to: "/paiements", statut: "dispo" },
      { label: "Factures cantine", to: "/cantine", statut: "dispo" },
      { label: "Attestation de paiement", to: "/certificats", statut: "dispo" },
      { label: "État des impayés", to: "/recouvrement", statut: "dispo" },
    ],
  },
  {
    id: "rh", label: "RH & Paie", icone: "🧑‍💼",
    docs: [
      { label: "Bulletins de salaire", to: "/rh", statut: "dispo" },
      { label: "Attestation de travail", to: "/rh", statut: "dispo" },
      { label: "Certificat de fin de contrat", to: "/rh", statut: "dispo" },
      { label: "Ordre de mission", to: "/rh", statut: "dispo" },
      { label: "État de la masse salariale", to: "/rh", statut: "dispo" },
    ],
  },
];

const STATUT = {
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  rejete: { label: "Rejeté", cls: "bg-rose-100 text-rose-700" },
  archive: { label: "Archivé", cls: "bg-navy-900/10 text-navy-900/60" },
  genere: { label: "Généré", cls: "bg-navy-900/10 text-navy-900/60" },
};

// Famille d'un document enregistré (colonne `famille`, sinon déduite du type).
const TYPE_FAMILLE = {
  facture: "finances", recu: "finances", bulletin: "pedagogie", classement: "pedagogie",
  paie: "rh", salaire: "rh", scolarite: "scolarite", inscription: "scolarite", frequentation: "scolarite",
};
const familleDe = (d) => d.famille || TYPE_FAMILLE[d.type] || "scolarite";
const FAMILLE_LABEL = { scolarite: "Scolarité", pedagogie: "Pédagogie", finances: "Finances", rh: "RH & Paie" };

// Audience d'un texte du rayon, telle qu'on la lit : « CM1 », « Élémentaire »…
// Rien pour un texte qui vaut pour tout l'établissement — le silence est là la
// bonne information (migration 159). Résolue depuis les listes chargées par la
// page, et non par un embed : voir la note dans `getFichiers`.
function libAudience(x, { cycles = [], niveaux = [], classes = [] } = {}) {
  const trouve = (liste, id) => liste.find((e) => e.id === id)?.libelle;
  if (x?.cible === "classe") return trouve(classes, x.classe_id) || "Une classe";
  if (x?.cible === "niveau") return trouve(niveaux, x.niveau_id) || "Un niveau";
  if (x?.cible === "cycle") return trouve(cycles, x.cycle_id) || "Un cycle";
  return null;
}

export default function Documentation() {
  const { ecoleId, ecole, utilisateur } = useAuth();
  const devise = ecole?.devise || "XOF";
  const toast = useToast();
  const confirmer = useConfirm();
  const [fichiers, setFichiers] = useState([]);
  const [catF, setCatF] = useState("");
  const [qF, setQF] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [texte, setTexte] = useState({ titre: "", categorie: "reglement", reference: "", date_texte: "", portee: "familles", fichier: null });
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [fam, setFam] = useState("");
  const [typeF, setTypeF] = useState("");
  const [statutF, setStatutF] = useState("");
  const [dateDe, setDateDe] = useState("");
  const [dateA, setDateA] = useState("");
  const [apercu, setApercu] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);
  // Document en cours de versement au rayon réglementaire (migration 159).
  const [versement, setVersement] = useState(null);
  // Listes de ciblage, chargées une fois : l'audience d'un texte se choisit
  // dans le même vocabulaire que celle d'une annonce (migration 159).
  const [cycles, setCycles] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    getDocuments(ecoleId).then(setDocs).catch(() => {}).finally(() => setChargement(false));
  }, [ecoleId]);

  useEffect(() => {
    if (!ecoleId) return;
    let vivant = true;
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        const [cy, nv, cl] = await Promise.all([
          getCycles(ecoleId), getNiveaux(ecoleId), getClasses(ecoleId, an?.id)]);
        if (!vivant) return;
        setCycles(cy); setNiveaux(nv); setClasses(cl);
      } catch { /* le versement restera limité à « tout l'établissement » */ }
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  const rechargerFichiers = useCallback(() => {
    if (!ecoleId) return;
    getFichiers(ecoleId).then(setFichiers).catch(() => {});
  }, [ecoleId]);
  useEffect(() => { rechargerFichiers(); }, [rechargerFichiers]);

  // Le filtrage se fait ici : la bibliothèque d'un établissement se compte
  // en dizaines de fichiers, pas en milliers.
  const textes = fichiers.filter((x) => estTexteReference(x.categorie));
  const fichiersFiltres = fichiers.filter((x) => !estTexteReference(x.categorie)).filter((x) => {
    if (catF && x.categorie !== catF) return false;
    const m = qF.trim().toLowerCase();
    if (m && !`${x.titre} ${x.nom_fichier}`.toLowerCase().includes(m)) return false;
    return true;
  });

  async function deposer(fichier, input) {
    if (!fichier) return;
    setEnvoi(true);
    try {
      await televerserFichier(ecoleId, fichier, { categorie: "autre", auteurId: utilisateur?.id });
      toast.succes("Fichier déposé.");
      rechargerFichiers();
    } catch (e) { toast.erreur(e); }
    finally {
      setEnvoi(false);
      // Sans cela, redéposer le même fichier ne déclencherait pas `change`.
      if (input) input.value = "";
    }
  }

  async function deposerTexte(e) {
    e.preventDefault();
    if (!texte.fichier) { toast.erreur("Choisissez le fichier du texte."); return; }
    if (!texte.titre.trim()) { toast.erreur("Donnez un intitulé au texte."); return; }
    setEnvoi(true);
    try {
      await televerserFichier(ecoleId, texte.fichier, {
        titre: texte.titre, categorie: texte.categorie, portee: texte.portee,
        reference: texte.reference, dateTexte: texte.date_texte || null, auteurId: utilisateur?.id,
      });
      toast.succes(texte.portee === "familles" ? "Texte publié — visible des familles." : "Texte enregistré.");
      setTexte({ titre: "", categorie: "reglement", reference: "", date_texte: "", portee: "familles", fichier: null });
      rechargerFichiers();
    } catch (er) { toast.erreur(er); }
    finally { setEnvoi(false); }
  }

  async function ouvrirFichier(x) {
    try {
      const url = await lienFichier(x.chemin);
      if (url) window.open(url, "_blank", "noopener");
      else toast.erreur("Fichier introuvable.");
    } catch (e) { toast.erreur(e); }
  }

  async function retirer(x) {
    const suite = x.annonce_id
      ? "Ce fichier est joint à une annonce : il disparaîtra aussi de celle-ci."
      : "Cette suppression est définitive.";
    if (!(await confirmer({ titre: "Supprimer le fichier", message: `« ${x.titre} » — ${suite}`, confirmer: "Supprimer" }))) return;
    try { await supprimerFichier(x); toast.succes("Fichier supprimé."); rechargerFichiers(); }
    catch (e) { toast.erreur(e); }
  }

  // Verser un document au rayon : deux champs à la fois (portée ET catégorie),
  // via une RPC — c'est ce double geste qui distingue une publication voulue
  // d'une portée « familles » posée par accident.
  async function verser(f, champs) {
    try {
      await verserAuRayon(f.id, champs);
      toast.succes("Document versé au rayon — visible de toutes les familles.");
      setVersement(null);
      rechargerFichiers();
    } catch (e) { toast.erreur(e); }
  }

  async function sortirDuRayon(x) {
    if (!(await confirmer({ titre: "Retirer du rayon",
      message: `« ${x.titre} » ne sera plus consultable par les familles.`, confirmer: "Retirer" }))) return;
    try { await retirerDuRayon(x.id); toast.succes("Document retiré du rayon."); rechargerFichiers(); }
    catch (e) { toast.erreur(e); }
  }

  const dateDoc = (d) => (d.date_doc || d.created_at || "").toString().slice(0, 10);
  const typesPresents = [...new Set(docs.map((d) => d.type).filter(Boolean))].sort();

  const filtres = docs.filter((d) => {
    if (fam && familleDe(d) !== fam) return false;
    if (typeF && d.type !== typeF) return false;
    if (statutF && d.statut !== statutF) return false;
    const dd = dateDoc(d);
    if (dateDe && dd < dateDe) return false;
    if (dateA && dd > dateA) return false;
    if (!q) return true;
    const t = `${d.titre || ""} ${d.type || ""} ${d.reference || ""} ${d.cible_libelle || ""} ${d.eleves?.prenom || ""} ${d.eleves?.nom || ""}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  async function exporterExcel() {
    if (!filtres.length) return;
    setExportEnCours(true);
    try {
      const XLSX = await import("xlsx");
      const lignes = filtres.map((d) => ({
        Date: dateDoc(d),
        Famille: FAMILLE_LABEL[familleDe(d)] || "",
        Type: d.type || "",
        Titre: d.titre || "",
        Cible: d.eleves ? `${d.eleves.nom} ${d.eleves.prenom}` : (d.cible_libelle || ""),
        "Référence": d.reference || "",
        Montant: d.montant != null ? Number(d.montant) : "",
        Statut: STATUT[d.statut]?.label || d.statut || "",
      }));
      const ws = XLSX.utils.json_to_sheet(lignes);
      ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Documents");
      XLSX.writeFile(wb, `documents-${ecole?.sigle || "ecole"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExportEnCours(false); }
  }

  return (
    <>
      <EnTete titre="Documentation" sousTitre="Tous les documents officiels de l'école, au même endroit" />
      <div className="space-y-6 p-4 sm:p-8">
        <p className="rounded-xl bg-creme/60 px-4 py-2.5 text-xs text-navy-900/60">
          Retrouvez ici tous les documents de l'établissement, classés par famille. Cliquez sur un type pour le générer.
          Les documents validés s'affichent dans « Documents enregistrés » ci-dessous. Les fichiers déposés — pièces
          jointes des annonces comprises — sont conservés dans « Bibliothèque de fichiers ».
        </p>

        {/* Catalogue par famille */}
        <div className="grid gap-5 lg:grid-cols-2">
          {FAMILLES.map((f) => (
            <Carte key={f.id} className="p-5">
              <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">
                <span className="mr-2">{f.icone}</span>{f.label}
              </h3>
              <div className="flex flex-wrap gap-2">
                {f.docs.map((d) =>
                  d.to && d.statut === "dispo" ? (
                    <Link
                      key={d.label}
                      to={d.to}
                      className="group inline-flex items-center gap-1.5 rounded-lg border border-navy-900/10 bg-white px-3 py-1.5 text-sm text-navy-900 hover:border-or-500 hover:text-or-600"
                    >
                      {d.label}
                      <span className="text-navy-900/30 group-hover:text-or-500">→</span>
                    </Link>
                  ) : (
                    <span
                      key={d.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-navy-900/10 bg-navy-900/[0.02] px-3 py-1.5 text-sm text-navy-900/40"
                      title="Bientôt disponible"
                    >
                      {d.label}
                      <span className="rounded bg-navy-900/5 px-1 text-[10px] uppercase tracking-wide">à venir</span>
                    </span>
                  )
                )}
              </div>
            </Carte>
          ))}
        </div>

        {/* ── Textes de référence ────────────────────────────────────────
            Les textes qui RÉGISSENT l'établissement : on y revient, on les
            cite, ils survivent aux années scolaires. Un rayon à part, pour
            ne pas les perdre dans le tout-venant. */}
        <Carte className="p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              ⚖️ Textes de référence
              {textes.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/40">({textes.length})</span>}
            </h3>
          </div>
          <p className="mb-4 text-xs text-navy-900/50">
            Règlement intérieur, codes et décrets relatifs à l'enseignement, arrêtés, conventions,
            chartes. Un texte publié aux familles apparaît dans l'espace parent et dans l'espace étudiant.
          </p>

          {textes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-900/15 px-4 py-6 text-center text-sm text-navy-900/45">
              Aucun texte déposé. Commencez par votre règlement intérieur.
            </p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {textes.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <button type="button" onClick={() => ouvrirFichier(x)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-navy-900">
                      ⚖️ {x.titre}
                      {x.portee === "familles" && (
                        <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          publié
                        </span>
                      )}
                      {/* L'audience doit se lire sur l'étagère : un règlement
                          d'un seul cycle n'est pas un règlement d'école. */}
                      {libAudience(x, { cycles, niveaux, classes }) && (
                        <span className="ml-2 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                          {libAudience(x, { cycles, niveaux, classes })}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-navy-900/50">
                      {[libCategorie(x.categorie), x.reference,
                        x.date_texte ? new Date(x.date_texte).toLocaleDateString("fr-FR") : null,
                        poids(x.taille)].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Dépublier doit être possible sans passer par la base :
                        un document mis aux familles par erreur ne doit pas
                        y rester faute de bouton (migration 159). */}
                    {x.portee === "familles" && (
                      <button onClick={() => sortirDuRayon(x)} className="text-xs text-navy-700 hover:text-or-600">
                        retirer du rayon
                      </button>
                    )}
                    <button onClick={() => retirer(x)} className="text-xs text-rose-500 hover:underline">
                      supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={deposerTexte} className="mt-4 space-y-3 rounded-xl border border-dashed border-navy-900/15 bg-creme/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">Déposer un texte</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Champ label="Intitulé *" value={texte.titre}
                onChange={(e) => setTexte((t) => ({ ...t, titre: e.target.value }))}
                placeholder="Règlement intérieur 2026-2027" />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Nature</span>
                <select value={texte.categorie} onChange={(e) => setTexte((t) => ({ ...t, categorie: e.target.value }))}
                  className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                  {CATEGORIES_TEXTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Champ label="Référence" value={texte.reference}
                onChange={(e) => setTexte((t) => ({ ...t, reference: e.target.value }))}
                placeholder="Décret n° 2024-1234" />
              <Champ label="Date du texte" type="date" value={texte.date_texte}
                onChange={(e) => setTexte((t) => ({ ...t, date_texte: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Qui peut le consulter</span>
                <select value={texte.portee} onChange={(e) => setTexte((t) => ({ ...t, portee: e.target.value }))}
                  className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                  {PORTEES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block flex-1">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Fichier *</span>
                <input type="file" accept=".pdf,.doc,.docx" required
                  onChange={(e) => setTexte((t) => ({ ...t, fichier: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-navy-900/70 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-creme" />
              </label>
              <Bouton type="submit" disabled={envoi}>{envoi ? "Envoi…" : "Déposer le texte"}</Bouton>
            </div>
          </form>
        </Carte>

        {/* Bibliothèque de fichiers — dépôts directs ET pièces jointes des
            annonces. Une seule table, pour qu'elles ne divergent jamais. */}
        <Carte className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              Bibliothèque de fichiers
              {fichiers.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/40">({fichiersFiltres.length}/{fichiers.length})</span>}
            </h3>
            <label className="cursor-pointer rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-creme hover:bg-navy-800">
              {envoi ? "Envoi…" : "+ Déposer un fichier"}
              <input type="file" className="hidden" disabled={envoi}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => deposer(e.target.files?.[0], e.target)} />
            </label>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <input value={qF} onChange={(e) => setQF(e.target.value)} placeholder="🔍 Rechercher un fichier…"
              className="min-w-48 flex-1 rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <select value={catF} onChange={(e) => setCatF(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {fichiersFiltres.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-900/15 px-4 py-8 text-center text-sm text-navy-900/45">
              {fichiers.length === 0
                ? "Aucun fichier. Déposez un règlement, une circulaire — ou joignez un PDF à une annonce, il arrivera ici."
                : "Aucun fichier ne correspond à ce filtre."}
            </p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {fichiersFiltres.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <button type="button" onClick={() => ouvrirFichier(x)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-navy-900">📎 {x.titre}</p>
                    <p className="truncate text-xs text-navy-900/50">
                      {[libCategorie(x.categorie),
                        x.annonces?.titre ? `annonce « ${x.annonces.titre} »` : null,
                        poids(x.taille),
                        new Date(x.created_at).toLocaleDateString("fr-FR")].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Une pièce jointe d'annonce ciblée ne parvient qu'aux
                        familles visées et ne figure dans aucune étagère : le
                        règlement de Tut'Tank a échappé à 45 élèves du
                        Préscolaire (migration 159). */}
                    {peutEtreVerse(x) && (
                      <button onClick={() => setVersement(x)} className="text-xs font-medium text-navy-700 hover:text-or-600">
                        ⚖️ verser au rayon
                      </button>
                    )}
                    <button onClick={() => retirer(x)} className="text-xs text-rose-500 hover:underline">
                      supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        {/* Documents enregistrés */}
        <Carte className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              Documents enregistrés
              {docs.length > 0 && <span className="ml-2 text-sm font-normal text-navy-900/40">({filtres.length}/{docs.length})</span>}
            </h3>
            <Bouton variante="fantome" onClick={exporterExcel} disabled={exportEnCours || filtres.length === 0}>
              {exportEnCours ? "Export…" : "⬇️ Exporter (Excel)"}
            </Bouton>
          </div>
          {/* Filtres avancés */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select value={fam} onChange={(e) => setFam(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Toutes familles</option>
              {Object.entries(FAMILLE_LABEL).map(([id, lib]) => <option key={id} value={id}>{lib}</option>)}
            </select>
            <select value={typeF} onChange={(e) => setTypeF(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Tous types</option>
              {typesPresents.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statutF} onChange={(e) => setStatutF(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500">
              <option value="">Tous statuts</option>
              {Object.entries(STATUT).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
            <input type="date" value={dateDe} onChange={(e) => setDateDe(e.target.value)} title="Du"
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <input type="date" value={dateA} onChange={(e) => setDateA(e.target.value)} title="Au"
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
              className="rounded-xl border border-navy-900/15 bg-creme px-3 py-2 text-sm outline-none focus:border-or-500" />
          </div>

          {chargement ? (
            <p className="py-6 text-sm text-navy-900/40">Chargement…</p>
          ) : filtres.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-900/10 px-4 py-8 text-center text-sm text-navy-900/40">
              {docs.length === 0
                ? "Aucun document enregistré pour l'instant. Générez un certificat ou une attestation, et il apparaîtra ici."
                : "Aucun document ne correspond à la recherche."}
            </p>
          ) : (
            <ul className="divide-y divide-navy-900/5">
              {filtres.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{d.titre || d.type}</p>
                    <p className="text-xs text-navy-900/50">
                      <span className="rounded bg-navy-900/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{FAMILLE_LABEL[familleDe(d)]}</span>
                      {" · "}
                      {d.eleves ? `${d.eleves.prenom} ${d.eleves.nom}` : (d.cible_libelle || "—")}
                      {d.reference ? ` · ${d.reference}` : ""}
                      {d.montant != null ? ` · ${Number(d.montant).toLocaleString("fr-FR")} ${devise}` : ""}
                      {` · ${(d.date_doc || d.created_at || "").toString().slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {STATUT[d.statut] && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT[d.statut].cls}`}>
                        {STATUT[d.statut].label}
                      </span>
                    )}
                    <button onClick={() => setApercu(d)} className="text-xs font-medium text-navy-700 hover:text-or-500">
                      Aperçu
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* Aperçu d'un document */}
      <Modale ouvert={!!apercu} onFermer={() => setApercu(null)} titre={apercu?.titre || "Document"} large>
        {apercu && (
          <>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-navy-900/10">
              {apercu.corps ? (
                <DocumentOfficiel
                  ecole={ecole}
                  titre={apercu.titre}
                  corps={apercu.corps}
                  signataire={apercu.signataire_nom}
                  signatureUrl={apercu.signature_url}
                  ville={apercu.ville}
                  date={apercu.date_doc}
                  reference={apercu.reference}
                  signature={apercu.statut === "valide"}
                />
              ) : (
                <div className="p-5">
                  <p className="font-display text-lg font-semibold text-navy-900">{apercu.titre}</p>
                  <p className="mb-3 text-xs text-navy-900/50">
                    {(apercu.eleves ? `${apercu.eleves.prenom} ${apercu.eleves.nom}` : (apercu.cible_libelle || ""))}
                    {apercu.reference ? ` · ${apercu.reference}` : ""}
                    {` · ${(apercu.date_doc || apercu.created_at || "").toString().slice(0, 10)}`}
                  </p>
                  {apercu.donnees?.lignes?.length > 0 && (
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-navy-900/5">
                        {apercu.donnees.lignes.map((l, i) => (
                          <tr key={i}>
                            <td className="py-1.5 text-navy-900">{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</td>
                            <td className="py-1.5 text-right font-mono text-navy-900">{Number(l.montant).toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-navy-900/10 pt-3">
                    <span className="text-sm text-navy-900/60">
                      {apercu.donnees?.mode ? `Mode : ${apercu.donnees.mode}` : (apercu.donnees?.echeance ? `Échéance : ${apercu.donnees.echeance}` : "")}
                    </span>
                    <span className="font-display text-lg font-bold text-navy-900">
                      {Number(apercu.montant ?? apercu.donnees?.montant ?? apercu.donnees?.montant_total ?? 0).toLocaleString("fr-FR")} {devise}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-navy-900/40">
                    Instantané archivé. Pour le document détaillé imprimable, ouvrez-le depuis la page{" "}
                    <Link to="/paiements" className="text-navy-700 hover:text-or-500">Paiements</Link>.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 text-right">
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>

      <ModaleVersement fichier={versement} onFermer={() => setVersement(null)} onVerser={verser}
        cycles={cycles} niveaux={niveaux} classes={classes} />
    </>
  );
}

// Verser un document au rayon réglementaire (migration 159).
//
// C'est ici que se règle le cas réel qui a motivé la migration : Tut'Tank
// avait joint son règlement intérieur à une annonce ciblée « Élémentaire ».
// Le document ne parvenait donc qu'à 51 élèves sur 96, et n'apparaissait dans
// aucune étagère — alors qu'un règlement se consulte pendant des années.
function ModaleVersement({ fichier, onFermer, onVerser, cycles, niveaux, classes }) {
  const [categorie, setCategorie] = useState("reglement");
  const [cible, setCible] = useState("tous");
  const [entite, setEntite] = useState("");
  const [reference, setReference] = useState("");
  const [dateTexte, setDateTexte] = useState("");

  // ⚠️ L'audience est PRÉREMPLIE depuis celle de l'annonce. C'est tout l'enjeu :
  // le règlement de Tut'Tank appartient à l'Élémentaire, et verser « à toutes
  // les familles » par défaut aurait reproduit l'erreur qu'on corrige.
  useEffect(() => {
    if (!fichier) return;
    setCategorie(estTexteReference(fichier.categorie) ? fichier.categorie : "reglement");
    setReference(fichier.reference || "");
    setDateTexte(fichier.date_texte || "");
    const a = fichier.annonces;
    if (a && ["classe", "niveau", "cycle"].includes(a.cible)) {
      setCible(a.cible);
      setEntite(a[CHAMP_AUDIENCE[a.cible]] || "");
    } else {
      setCible("tous");
      setEntite("");
    }
  }, [fichier]);

  if (!fichier) return null;

  const listes = { cycle: cycles, niveau: niveaux, classe: classes };
  const liste = listes[cible] || [];
  const manque = audienceExigeEntite(cible) && !entite;
  const heritee = !!fichier.annonces && ["classe", "niveau", "cycle"].includes(fichier.annonces.cible)
    && cible === fichier.annonces.cible && entite === (fichier.annonces[CHAMP_AUDIENCE[fichier.annonces.cible]] || "");

  return (
    <Modale ouvert={!!fichier} onFermer={onFermer} titre="Verser au rayon réglementaire">
      <div className="space-y-4">
        <p className="text-sm text-navy-900/70">
          <b className="text-navy-900">{fichier.titre}</b> sera consultable en permanence dans
          « Textes de référence », par les familles que vous désignez ci-dessous.
        </p>
        {fichier.annonce_id && (
          <p className="rounded-xl border border-navy-900/10 bg-creme/60 px-3 py-2.5 text-xs text-navy-900/70">
            Joint à l&apos;annonce{fichier.annonces?.titre ? <> « <b>{fichier.annonces.titre}</b> »</> : null}.
            <b> L&apos;annonce n&apos;est pas modifiée</b> : on publie le document, pas l&apos;annonce.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs text-navy-900/50">Nature du texte</span>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
            {CATEGORIES_TEXTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-navy-900/50">Qui peut le consulter</span>
            <select value={cible} onChange={(e) => { setCible(e.target.value); setEntite(""); }}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {audienceExigeEntite(cible) && (
            <label className="block">
              <span className="mb-1.5 block text-xs text-navy-900/50">
                {cible === "cycle" ? "Cycle" : cible === "niveau" ? "Niveau" : "Classe"}
              </span>
              <select value={entite} onChange={(e) => setEntite(e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                <option value="">— à choisir —</option>
                {liste.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
              </select>
            </label>
          )}
        </div>
        {heritee && (
          <p className="text-xs text-emerald-700">
            Audience reprise de l&apos;annonce — les mêmes familles y ont accès, ni plus ni moins.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Champ label="Référence (facultatif)" value={reference} placeholder="Décret n° 2024-1234"
            onChange={(e) => setReference(e.target.value)} />
          <Champ label="Date du texte (facultatif)" type="date" value={dateTexte}
            onChange={(e) => setDateTexte(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={manque}
            onClick={() => onVerser(fichier, { categorie, cible, entite: entite || null, reference, dateTexte: dateTexte || null })}>
            Verser au rayon
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}
