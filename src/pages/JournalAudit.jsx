import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, Badge, SkeletonListe } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/journal.js";

const TAILLE = 25;
const quand = (d) => (d ? new Date(d).toLocaleString("fr-FR",
  { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const libEntite = (e) => api.ENTITES.find(([v]) => v === e)?.[1] || e;
const court = (v) => {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
};

// Pilotage — journal des actes sensibles, et restauration d'une suppression.
//
// Cet écran existe parce que la fonction `restaurer_depuis_journal` (migration
// 135) n'avait AUCUNE porte d'entrée : elle exige `auth.uid()`, qui est NULL
// dans l'éditeur SQL de Supabase. Une capacité sans écran est une capacité
// inexistante — c'est le défaut que l'audit relève ailleurs, il ne fallait pas
// le reproduire ici.
export default function JournalAudit() {
  const { ecole } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [entite, setEntite] = useState("");
  const [operation, setOperation] = useState("");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ lignes: [], total: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);

  const recharger = useCallback(async () => {
    if (!ecole?.id) return;
    setChargement(true); setErreur("");
    try {
      setRes(await api.getJournal(ecole.id, {
        entite: entite || undefined, operation: operation || undefined, page, taille: TAILLE,
      }));
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecole?.id, entite, operation, page]);
  useEffect(() => { recharger(); }, [recharger]);

  async function restaurer(l) {
    if (!(await confirmer({
      titre: "Restaurer cet enregistrement",
      message: `La ligne supprimée sera réinsérée telle qu'elle était. Attention : seule CETTE ligne revient — `
        + `les enregistrements partis en cascade (inscriptions, notes, pièces jointes…) ne sont pas restaurés.`,
      confirmer: "Restaurer", danger: false,
    }))) return;
    try {
      await api.restaurer(l.id);
      toast.succes("Enregistrement restauré.");
      recharger();
    } catch (e) { toast.erreur(e); }
  }

  const pages = api.nbPages(res.total, TAILLE);

  return (
    <>
      <EnTete titre="Journal des actes" sousTitre="Modifications et suppressions sur les données sensibles" />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Alerte ton="info">
          Sont tracées les <b>modifications</b> et <b>suppressions</b> de notes, relevés, bulletins,
          factures, paiements, élèves, inscriptions et rôles. Les créations ne le sont pas :
          elles sont rarement contestées et rendraient ce journal illisible.
        </Alerte>

        <Carte className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Donnée</span>
            <select value={entite} onChange={(e) => { setEntite(e.target.value); setPage(0); }}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Toutes</option>
              {api.ENTITES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy-900/45">Acte</span>
            <select value={operation} onChange={(e) => { setOperation(e.target.value); setPage(0); }}
              className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Tous</option>
              {Object.entries(api.OPERATIONS).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
            </select>
          </label>
          <span className="ml-auto self-center text-sm text-navy-900/50">
            {res.total} entrée{res.total > 1 ? "s" : ""}
          </span>
        </Carte>

        {chargement ? <SkeletonListe lignes={6} /> : res.lignes.length === 0 ? (
          <EtatVide icone="🗒️" titre="Aucun acte enregistré">
            Le journal se remplira dès qu&apos;une donnée sensible sera modifiée ou supprimée.
          </EtatVide>
        ) : (
          <div className="space-y-2">
            {res.lignes.map((l) => {
              const op = api.OPERATIONS[l.operation] || { label: l.operation, ton: "neutre" };
              const champs = api.lireDetails(l.details);
              const ouvre = ouvert === l.id;
              return (
                <Carte key={l.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900">
                        {libEntite(l.entite)}
                        <span className="ml-2 font-mono text-xs text-navy-900/40">
                          {String(l.entite_id || "").slice(0, 8)}
                        </span>
                      </p>
                      <p className="text-xs text-navy-900/55">
                        {quand(l.created_at)}
                        {l.profils
                          ? ` · par ${l.profils.prenom || ""} ${l.profils.nom || ""}`.trimEnd()
                          : " · auteur non identifié"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge ton={op.ton}>{op.label}</Badge>
                      {champs.length > 0 && (
                        <button onClick={() => setOuvert(ouvre ? null : l.id)}
                          className="text-xs font-medium text-navy-700 hover:text-or-600">
                          {ouvre ? "masquer" : `détail (${champs.length})`}
                        </button>
                      )}
                      {l.operation === "DELETE" && (
                        <Bouton variante="fantome" onClick={() => restaurer(l)}>Restaurer</Bouton>
                      )}
                    </div>
                  </div>

                  {ouvre && (
                    <table className="mt-3 w-full text-left text-xs">
                      <thead className="text-navy-900/45">
                        <tr>
                          <th className="py-1 font-medium">Champ</th>
                          <th className="py-1 font-medium">Avant</th>
                          <th className="py-1 font-medium">Après</th>
                        </tr>
                      </thead>
                      <tbody>
                        {champs.map((c, i) => (
                          <tr key={i} className="border-t border-navy-900/5">
                            <td className="py-1 pr-3 font-mono text-navy-900/70">{c.champ}</td>
                            <td className="py-1 pr-3 text-rose-600">{court(c.avant)}</td>
                            <td className="py-1 text-emerald-700">{court(c.apres)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Carte>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Bouton variante="fantome" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Précédent</Bouton>
            <span className="text-navy-900/60">Page {page + 1} / {pages}</span>
            <Bouton variante="fantome" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Suivant →</Bouton>
          </div>
        )}
      </div>
    </>
  );
}
