import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, EtatVide } from "@/composants/ui.jsx";
import { getNiveaux, getFournitures, creerFourniture, modifierFourniture, supprimerFourniture } from "@/lib/academique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";

export default function Fournitures() {
  const { ecoleId } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
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

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
  };

  // Les catégories déjà employées par l'école alimentent la saisie : on
  // suggère son propre vocabulaire plutôt que d'en imposer un.
  const categories = [...new Set([
    ...items.map((f) => (f.categorie || "").trim()).filter(Boolean),
    "Cahiers", "Livres & manuels", "Stylos & crayons", "Divers",
  ])].sort();

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

        <FormFourniture niveaux={niveaux} categories={categories}
          onAjout={(f) => wrap(() => creerFourniture(ecoleId, f), "Fourniture ajoutée.")} />

        {items.length === 0 ? (
          <EtatVide icone="🎒" titre="Aucune fourniture">Ajoutez la première fourniture avec le formulaire ci-dessus.</EtatVide>
        ) : (
          groupes.map((g) => (
            <Carte key={g.id || "tous"} className="p-6">
              <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">{g.libelle}</h3>
              <ul className="divide-y divide-navy-900/5">
                {g.items.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className={f.fourni_ecole ? "text-rose-600" : "text-navy-900"}>
                      <span className={`font-mono text-xs ${f.fourni_ecole ? "text-rose-600" : "text-or-600"}`}>×{f.quantite}</span>{" "}
                      <span className={f.fourni_ecole ? "font-bold" : "font-medium"}>{f.libelle}</span>
                      {!f.obligatoire && <span className="ml-2 text-xs text-navy-900/40">(optionnel)</span>}
                      {f.note && <span className={`ml-2 text-xs ${f.fourni_ecole ? "font-semibold text-rose-600" : "text-navy-900/50"}`}>— {f.note}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                      {/* Le rattrapage de la migration 144 a rangé les
                          articles d'après le préfixe : il doit rester
                          corrigible sans repasser par la base. */}
                      <select value={f.categorie || ""} title="Catégorie"
                        onChange={(e) => wrap(() => modifierFourniture(f.id, { categorie: e.target.value }), "Catégorie modifiée.")}
                        className="max-w-36 truncate rounded-full border border-navy-900/15 bg-white px-2 py-0.5 text-xs text-navy-900/60 outline-none focus:border-or-500">
                        <option value="">— sans catégorie —</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => wrap(() => modifierFourniture(f.id, { fourni_ecole: !f.fourni_ecole }), f.fourni_ecole ? "Retiré de « fourni par l'école »." : "Marqué « fourni par l'école ».")}
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${f.fourni_ecole ? "border-rose-500/40 bg-rose-500/10 text-rose-600" : "border-navy-900/15 text-navy-900/50"}`}
                        title="Fourni ou disponible à l'école (affiché en rouge chez le parent)">
                        {f.fourni_ecole ? "✓ école" : "école ?"}
                      </button>
                      <button onClick={async () => { if (await confirmer("Supprimer cette fourniture ?")) wrap(() => supprimerFourniture(f.id), "Fourniture supprimée."); }} className="text-xs text-rose-500 hover:underline">
                        supprimer
                      </button>
                    </span>
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

function FormFourniture({ niveaux, categories, onAjout }) {
  const vide = { libelle: "", quantite: "1", obligatoire: true, fourni_ecole: false, niveau_id: "", categorie: "", note: "" };
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
        {/* Liste ouverte : les suggestions couvrent le cas courant, mais une
            école qui range autrement (« Petit matériel », « Maison ») garde
            son vocabulaire — c'est ainsi qu'elles font déjà. */}
        <div className="min-w-40">
          <Champ label="Catégorie" list="categories-fournitures" value={f.categorie}
            onChange={(e) => maj("categorie", e.target.value)} placeholder="Cahiers" />
        </div>
        <div className="min-w-36 flex-1"><Champ label="Note (optionnel)" value={f.note} onChange={(e) => maj("note", e.target.value)} placeholder="grand format…" /></div>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70">
          <input type="checkbox" checked={f.obligatoire} onChange={(e) => maj("obligatoire", e.target.checked)} /> Obligatoire
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm text-navy-900/70" title="Sera affiché en rouge chez le parent">
          <input type="checkbox" checked={f.fourni_ecole} onChange={(e) => maj("fourni_ecole", e.target.checked)} /> Fourni par l'école
        </label>
        <Bouton type="submit">+ Ajouter</Bouton>
      </form>
      <datalist id="categories-fournitures">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
    </Carte>
  );
}
