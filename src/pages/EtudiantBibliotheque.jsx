import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Carte, Alerte, EtatVide, Badge, Recherche, SkeletonListe } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/bibliotheque.js";
import { monDossier } from "@/lib/etudiant.js";
import { nbPages, joursRetard } from "@/lib/biblio.regles.js";

const TAILLE = 10;
const auj = () => new Date().toISOString().slice(0, 10);
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const libType = (t) => api.TYPES.find(([v]) => v === t)?.[1] || t;
const auteursDe = (r) => (r.biblio_ressource_auteurs || [])
  .map((l) => `${l.biblio_auteurs?.prenom || ""} ${l.biblio_auteurs?.nom || ""}`.trim())
  .filter(Boolean).join(", ");

// Espace étudiant — bibliothèque : catalogue, emprunts, réservations, favoris.
export default function EtudiantBibliotheque() {
  const { utilisateur } = useAuth();
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [onglet, setOnglet] = useState("catalogue");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    monDossier().then(setDossier).catch((e) => setErreur(e.message));
  }, []);

  const ONGLETS = [
    ["catalogue", "Catalogue"],
    ["emprunts", "Mes emprunts"],
    ["reservations", "Mes réservations"],
    ["favoris", "Mes favoris"],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">📚 Bibliothèque</p>
        <p className="text-sm text-creme/70">
          {dossier?.filiere ? `${dossier.filiere}${dossier.niveau ? ` · ${dossier.niveau}` : ""}` : "Catalogue de votre établissement"}
        </p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(([v, l]) => (
          <button key={v} onClick={() => setOnglet(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${onglet === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 text-navy-900/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {onglet === "catalogue" && <Catalogue dossier={dossier} profilId={utilisateur?.id} onErreur={setErreur} toast={toast} />}
      {onglet === "emprunts" && <MesEmprunts onErreur={setErreur} />}
      {onglet === "reservations" && <MesReservations onErreur={setErreur} toast={toast} />}
      {onglet === "favoris" && <MesFavoris onErreur={setErreur} toast={toast} />}
    </div>
  );
}

// --- Catalogue (recherche + pagination serveur) ----------------------------
function Catalogue({ dossier, profilId, onErreur, toast }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [stats, setStats] = useState({});
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    if (!dossier?.ecole_id) return;
    setChargement(true);
    try {
      const r = await api.getRessources(dossier.ecole_id, { q, visibleSeulement: true, page, taille: TAILLE });
      setRes(r);
      setStats(await api.statsExemplaires(dossier.ecole_id, r.lignes.map((x) => x.id)));
    } catch (e) { onErreur(e.message); }
    finally { setChargement(false); }
  }, [dossier?.ecole_id, q, page, onErreur]);
  useEffect(() => { recharger(); }, [recharger]);

  async function reserver(r) {
    try {
      await api.reserver(dossier.ecole_id, r.id, profilId);
      toast.succes("Réservation enregistrée.");
    } catch (e) { toast.erreur(e); }
  }
  async function ajouterFavori(r) {
    try { await api.basculerFavori(dossier.ecole_id, r.id, profilId); toast.succes("Ajouté à vos favoris."); }
    catch (e) { toast.erreur(e); }
  }
  async function ouvrirNumerique(r) {
    try {
      const fiche = await api.getRessource(r.id);
      const n = (fiche?.biblio_numeriques || [])[0];
      if (!n) { toast.info("Aucun document numérique pour cette ressource."); return; }
      const url = await api.lienDocument(n.fichier_chemin);
      if (url) window.open(url, "_blank", "noreferrer");
      else toast.erreur("Ce document ne vous est pas accessible.");
    } catch (e) { toast.erreur(e); }
  }

  if (!dossier) return <SkeletonListe lignes={4} />;
  const pages = nbPages(res.total, TAILLE);

  return (
    <div className="space-y-3">
      <Recherche valeur={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Titre, auteur, mot-clé…" />

      {chargement ? <SkeletonListe lignes={4} /> : res.lignes.length === 0 ? (
        <EtatVide icone="🔍" titre="Aucun résultat">Essayez d'autres mots-clés.</EtatVide>
      ) : (
        <>
          <p className="text-xs text-navy-900/50">{res.total} résultat{res.total > 1 ? "s" : ""}</p>
          {res.lignes.map((r) => {
            const s = stats[r.id] || { total: 0, disponibles: 0 };
            return (
              <Carte key={r.id} className="p-4">
                <p className="font-medium text-navy-900">{r.titre}</p>
                <p className="text-xs text-navy-900/55">
                  {libType(r.type_ressource)}{auteursDe(r) ? ` · ${auteursDe(r)}` : ""}{r.annee_pub ? ` · ${r.annee_pub}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {s.total > 0 && (
                    <Badge ton={s.disponibles > 0 ? "success" : "warning"}>
                      {s.disponibles > 0 ? `${s.disponibles} disponible(s)` : "tous empruntés"}
                    </Badge>
                  )}
                  <button onClick={() => ouvrirNumerique(r)} className="font-medium text-navy-700 hover:text-or-600">consulter en ligne</button>
                  {s.total > 0 && s.disponibles === 0 && (
                    <button onClick={() => reserver(r)} className="text-navy-700 hover:text-or-600">réserver</button>
                  )}
                  <button onClick={() => ajouterFavori(r)} className="text-navy-900/50 hover:text-or-600">★ favori</button>
                </div>
              </Carte>
            );
          })}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>←</Bouton>
              <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
              <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>→</Bouton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Mes emprunts -----------------------------------------------------------
function MesEmprunts({ onErreur }) {
  const [liste, setListe] = useState(null);
  useEffect(() => { api.mesEmprunts().then(setListe).catch((e) => { onErreur(e.message); setListe([]); }); }, [onErreur]);

  if (liste === null) return <SkeletonListe lignes={3} />;
  const enCours = liste.filter((e) => e.statut === "en_cours");
  if (enCours.length === 0) return <EtatVide icone="📗" titre="Aucun emprunt en cours">Vos emprunts apparaîtront ici.</EtatVide>;

  return (
    <div className="space-y-2">
      {enCours.map((e) => {
        const retard = joursRetard(e.date_echeance, auj());
        return (
          <Carte key={e.id} className={`p-4 ${retard > 0 ? "border-rose-300" : ""}`}>
            <p className="font-medium text-navy-900">{e.biblio_exemplaires?.biblio_ressources?.titre || "Ouvrage"}</p>
            <p className="text-xs text-navy-900/55">À rendre le {dateFr(e.date_echeance)}</p>
            {retard > 0 && <Badge ton="danger" className="mt-1">{retard} jour(s) de retard</Badge>}
          </Carte>
        );
      })}
    </div>
  );
}

// --- Mes réservations -------------------------------------------------------
function MesReservations({ onErreur, toast }) {
  const [liste, setListe] = useState(null);
  const charger = useCallback(() => {
    api.mesReservations().then(setListe).catch((e) => { onErreur(e.message); setListe([]); });
  }, [onErreur]);
  useEffect(() => { charger(); }, [charger]);

  async function annuler(r) {
    try { await api.annulerReservation(r.id); toast.succes("Réservation annulée."); charger(); }
    catch (e) { toast.erreur(e); }
  }

  if (liste === null) return <SkeletonListe lignes={3} />;
  if (liste.length === 0) return <EtatVide icone="🔖" titre="Aucune réservation">Réservez un ouvrage indisponible depuis le catalogue.</EtatVide>;

  return (
    <div className="space-y-2">
      {liste.map((r) => (
        <Carte key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-medium text-navy-900">{r.biblio_ressources?.titre || "Ouvrage"}</p>
            <p className="text-xs text-navy-900/55">
              {r.statut === "disponible" ? "Disponible — à retirer" : `En attente · position ${r.rang}`}
            </p>
          </div>
          <button onClick={() => annuler(r)} className="text-xs text-rose-500 hover:underline">annuler</button>
        </Carte>
      ))}
    </div>
  );
}

// --- Mes favoris ------------------------------------------------------------
function MesFavoris({ onErreur, toast }) {
  const [liste, setListe] = useState(null);
  const charger = useCallback(() => {
    api.mesFavoris().then(setListe).catch((e) => { onErreur(e.message); setListe([]); });
  }, [onErreur]);
  useEffect(() => { charger(); }, [charger]);

  async function retirer(f) {
    try { await api.basculerFavori(null, f.ressource_id, null, f.id); charger(); }
    catch (e) { toast.erreur(e); }
  }

  if (liste === null) return <SkeletonListe lignes={3} />;
  if (liste.length === 0) return <EtatVide icone="★" titre="Aucun favori">Marquez des ressources depuis le catalogue.</EtatVide>;

  return (
    <div className="space-y-2">
      {liste.map((f) => (
        <Carte key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-medium text-navy-900">{f.biblio_ressources?.titre || "Ressource"}</p>
            <p className="text-xs text-navy-900/55">
              {libType(f.biblio_ressources?.type_ressource)}{f.biblio_ressources?.annee_pub ? ` · ${f.biblio_ressources.annee_pub}` : ""}
            </p>
          </div>
          <button onClick={() => retirer(f)} className="text-xs text-rose-500 hover:underline">retirer</button>
        </Carte>
      ))}
    </div>
  );
}
