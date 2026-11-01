import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import { chercherPartout, chercherPages } from "@/lib/recherche.js";
import { ouvrirEncaisser } from "@/lib/encaisser.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

// Fenêtre de recherche globale (Ctrl+K) — lot 2 de l'audit du 31/10/2026.
// `pages` : les écrans du menu ouverts à ce rôle [{ to, label, espace, icone }].
// Flèches ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.
export default function RechercheGlobale({ ouvert, onFermer, pages = [] }) {
  const { ecoleId, ecole, roles, modulesActifs } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ eleves: [], parents: [], factures: [] });
  const [enCours, setEnCours] = useState(false);
  const [actif, setActif] = useState(0);
  const champ = useRef(null);
  const demande = useRef(0);
  const devise = ecole?.devise || "XOF";

  const ouvre = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);
  const voir = useMemo(() => ({ eleves: ouvre("eleves"), parents: ouvre("eleves"), factures: ouvre("paiements") }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles, modulesActifs]);

  // À l'ouverture : champ vide et focus ; à la fermeture, rien ne traîne.
  useEffect(() => {
    if (!ouvert) return;
    setQ(""); setRes({ eleves: [], parents: [], factures: [] }); setActif(0);
    const t = setTimeout(() => champ.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [ouvert]);

  // Recherche en base 250 ms après la dernière frappe ; une réponse
  // dépassée par une saisie plus récente est ignorée.
  useEffect(() => {
    if (!ouvert) return;
    const n = ++demande.current;
    if (q.trim().length < 2) { setRes({ eleves: [], parents: [], factures: [] }); setEnCours(false); return; }
    setEnCours(true);
    const t = setTimeout(async () => {
      const r = await chercherPartout(ecoleId, q, voir).catch(() => ({ eleves: [], parents: [], factures: [] }));
      if (n === demande.current) { setRes(r); setEnCours(false); setActif(0); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, ouvert, ecoleId, voir]);

  //  Une liste unique, dans l'ordre d'affichage, pour la navigation au clavier.
  const groupes = [
    { titre: "Élèves", items: res.eleves.map((e) => {
      const insc = (e.inscriptions || []).find((i) => i.annees_scolaires?.courante) || e.inscriptions?.[0];
      return { cle: `e${e.id}`, to: `/eleves/${e.id}`, icone: "👤", titre: `${e.prenom} ${e.nom}`,
        detail: [insc?.classes?.libelle, e.matricule].filter(Boolean).join(" · "),
        //  Au guichet, on cherche l'élève POUR encaisser : le geste est sur la ligne.
        encaisser: voir.factures ? { id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule } : null };
    }) },
    { titre: "Parents", items: res.parents.flatMap((t) => {
      const enfants = (t.eleve_tuteurs || []).map((x) => x.eleves).filter(Boolean);
      //  Un parent mène à la fiche de son (premier) enfant, où sont ses coordonnées.
      return enfants.length ? [{ cle: `t${t.id}`, to: `/eleves/${enfants[0].id}`, icone: "👪", titre: `${t.prenom || ""} ${t.nom || ""}`.trim(),
        detail: [t.telephone, enfants.map((e) => e.prenom).join(", ")].filter(Boolean).join(" · ") }] : [];
    }) },
    { titre: "Factures", items: res.factures.map((f) => ({
      cle: `f${f.id}`, to: `/eleves/${f.eleve_id}?onglet=paiements`, icone: "🧾", titre: `Facture ${f.numero}`,
      detail: `${f.eleves?.prenom || ""} ${f.eleves?.nom || ""} · reste ${fmt(Math.max(0, f.montant_total - f.montant_paye))} ${devise}`.trim(),
    })) },
    { titre: "Écrans", items: chercherPages(pages, q).map((p) => ({ cle: `p${p.to}`, to: p.to, icone: p.icone, titre: p.label, detail: p.espace })) },
  ].filter((g) => g.items.length > 0);
  const tous = groupes.flatMap((g) => g.items);

  const ouvrir = (it) => { if (!it) return; onFermer(); navigate(it.to); };
  const clavier = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActif((a) => Math.min(tous.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); ouvrir(tous[actif]); }
    else if (e.key === "Escape") { e.preventDefault(); onFermer(); }
  };

  if (!ouvert) return null;
  let index = -1;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy-900/50 px-3 pt-[8vh] backdrop-blur-sm" onMouseDown={onFermer}>
      <div role="dialog" aria-modal="true" aria-label="Recherche" onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-navy-900/10 px-4">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-navy-900/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={clavier}
            placeholder="Élève, matricule, parent, téléphone, facture, écran…" aria-label="Rechercher"
            className="min-w-0 flex-1 bg-transparent py-4 text-base text-navy-900 outline-none placeholder:text-navy-900/40" />
          <button type="button" onClick={onFermer} className="rounded-md border border-navy-900/15 px-2 py-0.5 text-xs text-navy-900/60">Échap</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox" aria-label="Résultats">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-navy-900/55">
              Tapez au moins deux lettres. Un numéro de téléphone retrouve le parent, un numéro de facture la facture.
            </p>
          ) : tous.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-navy-900/55">{enCours ? "Recherche…" : "Aucun résultat."}</p>
          ) : groupes.map((g) => (
            <div key={g.titre} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-navy-900/50">{g.titre}</p>
              {g.items.map((it) => {
                index += 1;
                const i = index;
                return (
                  <div key={it.cle} className={`flex items-center rounded-xl ${i === actif ? "bg-or-500/15" : "hover:bg-navy-900/[0.04]"}`}
                    onMouseEnter={() => setActif(i)}>
                    <button type="button" role="option" aria-selected={i === actif} onClick={() => ouvrir(it)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                      <span className="w-6 text-center text-base" aria-hidden="true">{it.icone}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-navy-900">{it.titre}</span>
                        {it.detail && <span className="block truncate text-xs text-navy-900/60">{it.detail}</span>}
                      </span>
                      {i === actif && !it.encaisser && <span className="text-xs text-navy-900/50" aria-hidden="true">↵</span>}
                    </button>
                    {it.encaisser && (
                      <button type="button" onClick={() => { onFermer(); ouvrirEncaisser(it.encaisser); }}
                        className="mr-2 shrink-0 rounded-lg border border-or-500/50 bg-white px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-or-500/20">
                        Encaisser
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
