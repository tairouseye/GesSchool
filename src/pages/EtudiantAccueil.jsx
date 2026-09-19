import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Carte, Alerte } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { mesDemandesAcces, deciderAcces } from "@/lib/etudiant.js";

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");
const LIB = { en_attente: "En attente", autorise: "Autorisé", refuse: "Refusé", revoque: "Révoqué" };

// Menu principal en tuiles — même traitement que l'espace parent
// (navy sombre, icône dorée), pour que les deux espaces se ressemblent.
const TUILES = [
  { to: "/etudiant/notes", cle: "notes", label: "Mes résultats" },
  { to: "/etudiant/scolarite", cle: "paiements", label: "Ma scolarité" },
  { to: "/etudiant/documents", cle: "certificats", label: "Mes documents" },
  { to: "/etudiant/actualites", cle: "annonces", label: "Actualités" },
  { to: "/etudiant/bibliotheque", cle: "bibliotheque", label: "Bibliothèque" },
  { to: "/etudiant/depots", cle: "biblio_depots", label: "Mon dépôt" },
  { to: "/etudiant/carte", cle: "carte_etudiant", label: "Ma carte" },
];

// Accueil étudiant : gestion du consentement d'accès parent aux notes.
export default function EtudiantAccueil() {
  const { profil } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setChargement(true); setErreur("");
    try { setDemandes(await mesDemandesAcces()); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  async function decider(d, decision) {
    if (decision === "revoque" && !(await confirmer(`Révoquer l'accès de ${d.parent} à vos notes ?`))) return;
    try { await deciderAcces(d.id, decision); toast.succes("Enregistré."); recharger(); }
    catch (e) { toast.erreur(e.message); }
  }

  const enAttente = demandes.filter((d) => d.statut === "en_attente");
  const traitees = demandes.filter((d) => d.statut !== "en_attente");

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-creme">
        <p className="text-sm text-creme/60">Bonjour 👋</p>
        <p className="font-display text-2xl font-bold">{profil ? `${profil.prenom} ${profil.nom}` : "Étudiant"}</p>
        <p className="mt-1 text-sm text-creme/70">Bienvenue dans votre espace GesSchool.</p>
      </div>

      {/* Menu en tuiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TUILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-white/5 bg-navy-800 p-4 text-left shadow-md ring-1 ring-inset ring-white/5 transition hover:bg-navy-700 hover:ring-or-500/30 active:scale-[.98]"
          >
            <Icone name={t.cle} className="h-7 w-7 text-or-500" />
            <span className="text-sm font-semibold text-creme">{t.label}</span>
          </Link>
        ))}

        {/* Demandes parentales en attente : la décision est ci-dessous, mais
            elle doit se voir dès l'accueil — sinon personne n'y répond. */}
        {enAttente.length > 0 && (
          <a href="#consentement"
            className="relative flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-or-500/40 bg-or-500/10 p-4 text-left shadow-md transition hover:bg-or-500/15 active:scale-[.98]">
            <Icone name="documents" className="h-7 w-7 text-or-600" />
            <span className="text-sm font-semibold text-navy-900">Demandes d&apos;accès</span>
            <span className="absolute right-2.5 top-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-or-500 px-1.5 text-[11px] font-bold text-navy-900 shadow">
              {enAttente.length}
            </span>
          </a>
        )}
      </div>

      <Carte id="consentement" className="p-6">
        <h2 className="font-display text-lg font-semibold text-navy-900">Accès de mes parents à mes notes</h2>
        <p className="mt-1 text-sm text-navy-900/60">
          En tant qu'étudiant majeur, <b>vous contrôlez</b> qui peut consulter vos notes. Autorisez ou refusez chaque demande ; vous pouvez révoquer un accès à tout moment.
        </p>

        <Alerte ton="erreur">{erreur}</Alerte>

        {chargement ? (
          <p className="mt-4 text-sm text-navy-900/40">Chargement…</p>
        ) : demandes.length === 0 ? (
          <p className="mt-3 rounded-xl bg-creme/60 px-4 py-3 text-sm text-navy-900/50">Aucune demande d'accès pour le moment.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {enAttente.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">À décider</p>
                {enAttente.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-or-500/40 bg-or-500/5 p-3">
                    <div className="text-sm">
                      <p className="font-medium text-navy-900">{d.parent}</p>
                      <p className="text-xs text-navy-900/50">Demandé le {dateFr(d.demande_le)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Bouton onClick={() => decider(d, "autorise")}>Autoriser</Bouton>
                      <Bouton variante="fantome" onClick={() => decider(d, "refuse")}>Refuser</Bouton>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {traitees.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/45">Historique</p>
                {traitees.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-900/10 p-3 text-sm">
                    <div>
                      <span className="font-medium text-navy-900">{d.parent}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.statut === "autorise" ? "bg-emerald-100 text-emerald-700" : "bg-navy-900/10 text-navy-900/60"
                      }`}>{LIB[d.statut] || d.statut}</span>
                    </div>
                    {d.statut === "autorise"
                      ? <button onClick={() => decider(d, "revoque")} className="text-xs text-rose-500 hover:underline">Révoquer</button>
                      : <button onClick={() => decider(d, "autorise")} className="text-xs text-emerald-600 hover:underline">Autoriser</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Carte>
    </div>
  );
}
