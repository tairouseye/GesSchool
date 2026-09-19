import { useEffect, useState } from "react";
import { Bouton, Badge } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import * as api from "@/lib/bibliotheque.js";
import { decouperAuteurs, cleAuteur } from "@/lib/biblio.import.js";

const ROLES = [
  ["auteur", "Auteur"], ["co_auteur", "Co-auteur"], ["directeur", "Directeur"],
  ["editeur", "Éditeur scientifique"], ["traducteur", "Traducteur"],
];
const libRole = (v) => ROLES.find(([x]) => x === v)?.[1] || v;
const nomComplet = (a) => [a?.prenom, a?.nom].filter(Boolean).join(" ") || "—";

// Auteurs d'une notice. On réutilise l'auteur s'il existe déjà dans
// l'établissement (comparaison insensible à la casse et aux accents) plutôt
// que d'en créer un homonyme à chaque saisie — sinon la liste d'autorités
// devient inexploitable au bout de quelques centaines de notices.
export default function SectionAuteurs({ r, ecoleId, onChange }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [saisie, setSaisie] = useState("");
  const [role, setRole] = useState("auteur");
  const [connus, setConnus] = useState([]);
  const [busy, setBusy] = useState(false);

  const liens = [...(r.biblio_ressource_auteurs || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  // Suggestions depuis la liste d'autorités de l'établissement.
  useEffect(() => {
    const q = saisie.trim();
    if (q.length < 2) { setConnus([]); return; }
    let vivant = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.getAuteurs(ecoleId, { q, taille: 6 });
        if (vivant) setConnus(res.lignes);
      } catch { if (vivant) setConnus([]); }
    }, 250);
    return () => { vivant = false; clearTimeout(t); };
  }, [ecoleId, saisie]);

  async function lier(auteurId) {
    if (liens.some((l) => l.auteur_id === auteurId && l.role === role)) {
      toast.erreur("Cet auteur a déjà ce rôle sur la notice.");
      return;
    }
    await api.lierAuteur(ecoleId, r.id, auteurId, role, liens.length);
    setSaisie(""); setConnus([]);
    onChange();
  }

  async function ajouter(e) {
    e.preventDefault();
    const brut = saisie.trim();
    if (!brut) return;
    setBusy(true);
    try {
      const [parse] = decouperAuteurs(brut);
      if (!parse) return;
      // Déjà dans la liste d'autorités ? On le réutilise.
      const res = await api.getAuteurs(ecoleId, { q: parse.nom, taille: 20 });
      const existant = (res.lignes || []).find((a) => cleAuteur(a) === cleAuteur(parse));
      const id = existant ? existant.id : (await api.creerAuteur(ecoleId, { nom: parse.nom, prenom: parse.prenom })).id;
      await lier(id);
      toast.succes(existant ? "Auteur rattaché." : "Auteur créé et rattaché.");
    } catch (e2) { toast.erreur(e2); }
    finally { setBusy(false); }
  }

  async function retirer(l) {
    if (!(await confirmer(`Retirer ${nomComplet(l.biblio_auteurs)} de cette notice ?`))) return;
    try { await api.delierAuteur(l.id); onChange(); } catch (e) { toast.erreur(e); }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-900/45">Auteurs</p>

      {liens.length === 0 ? (
        <p className="mb-2 text-sm text-navy-900/40">Aucun auteur rattaché.</p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {liens.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-navy-900/10 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-navy-900">{nomComplet(l.biblio_auteurs)}</span>
              <span className="flex items-center gap-3">
                <Badge ton="neutre">{libRole(l.role)}</Badge>
                <button onClick={() => retirer(l)} className="text-xs text-rose-500 hover:underline">retirer</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={ajouter} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom, Prénom"
            className="min-w-48 flex-1 rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-or-500" />
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-2 py-2 text-sm outline-none focus:border-or-500">
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Bouton type="submit" variante="fantome" disabled={busy || !saisie.trim()}>Ajouter</Bouton>
        </div>

        {connus.length > 0 && (
          <ul className="space-y-1">
            {connus.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => lier(a.id)}
                  className="w-full rounded-lg border border-navy-900/10 px-3 py-1.5 text-left text-xs hover:border-or-500">
                  {nomComplet(a)}
                  {a.affiliation ? <span className="ml-2 text-navy-900/45">{a.affiliation}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
