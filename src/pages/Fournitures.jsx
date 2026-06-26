import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";
import { getNiveaux, getFournitures, creerFourniture, supprimerFourniture } from "@/lib/academique.js";

export default function Fournitures() {
  const { ecoleId } = useAuth();
  const [niveaux, setNiveaux] = useState([]);
  const [items, setItems] = useState([]);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [niv, four] = await Promise.all([getNiveaux(ecoleId), getFournitures(ecoleId)]);
      setNiveaux(niv);
      setItems(four);
    } catch (e) { setErreur(e.message); }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn) => {
    setErreur("");
    try { await fn(); await recharger(); } catch (e) { setErreur(e.message); }
  };

  // Groupes : un par niveau + « Tous niveaux »
  const groupes = [
    { id: null, libelle: "Tous niveaux", items: items.filter((f) => !f.niveau_id) },
    ...niveaux.map((n) => ({ id: n.id, libelle: n.libelle, items: items.filter((f) => f.niveau_id === n.id) })),
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <EnTete titre="Fournitures scolaires" sousTitre="Liste par niveau, visible par les parents" />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <FormFourniture niveaux={niveaux} onAjout={(f) => wrap(() => creerFourniture(ecoleId, f))} />

        {groupes.length === 0 ? (
          <Carte className="p-8 text-sm text-navy-900/50">Aucune fourniture. Ajoute la première ci-dessus.</Carte>
        ) : (
          groupes.map((g) => (
            <Carte key={g.id || "tous"} className="p-6">
              <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">{g.libelle}</h3>
              <ul className="divide-y divide-navy-900/5">
                {g.items.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-navy-900">
                      <span className="font-mono text-xs text-or-600">×{f.quantite}</span>{" "}
                      <span className="font-medium">{f.libelle}</span>
                      {!f.obligatoire && <span className="ml-2 text-xs text-navy-900/40">(optionnel)</span>}
                      {f.note && <span className="ml-2 text-xs text-navy-900/50">— {f.note}</span>}
                    </span>
                    <button onClick={() => wrap(() => supprimerFourniture(f.id))} className="text-xs text-rose-500 hover:underline">
                      supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </Carte>
          ))
        )}
      </div>
    </>
  );
}

function FormFourniture({ niveaux, onAjout }) {
  const vide = { libelle: "", quantite: "1", obligatoire: true, niveau_id: "", note: "" };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Ajouter une fourniture</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); if (!f.libelle.trim()) return; onAjout({ ...f, libelle: f.libelle.trim() }); setF(vide); }}
      >
        <div className="min-w-44 flex-1"><Champ label="Article" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="Cahier 200 pages" /></div>
        <div className="w-20"><Champ label="Qté" value={f.quantite} onChange={(e) => maj("quantite", e.target.value.replace(/\D/g, ""))} /></div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Niveau</span>
          <select value={f.niveau_id} onChange={(e) => maj("niveau_id", e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">Tous niveaux</option>
            {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle}</option>)}
          </select>
        </label>
        <div className="min-w-36 flex-1"><Champ label="Note (optionnel)" value={f.note} onChange={(e) => maj("note", e.target.value)} placeholder="grand format…" /></div>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.obligatoire} onChange={(e) => maj("obligatoire", e.target.checked)} /> Obligatoire
        </label>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
    </Carte>
  );
}
