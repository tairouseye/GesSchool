import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, EtatVide, Modale } from "@/composants/ui.jsx";
import { getNiveaux, getFournitures, creerFourniture, modifierFourniture, supprimerFourniture,
         getClasses, getAnneeCourante } from "@/lib/academique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";

export default function Fournitures() {
  const { ecoleId, ecole } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const [niveaux, setNiveaux] = useState([]);
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [erreur, setErreur] = useState("");
  // Le parent raisonne en CLASSE, l'école range par NIVEAU. On filtre donc
  // par classe et on résout vers son niveau — sans colonne supplémentaire.
  const [classeId, setClasseId] = useState("");
  const [apercu, setApercu] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const an = await getAnneeCourante(ecoleId);
      const [niv, four, cls] = await Promise.all([
        getNiveaux(ecoleId), getFournitures(ecoleId), getClasses(ecoleId, an?.id)]);
      setNiveaux(niv);
      setItems(four);
      setClasses(cls);
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
  // Niveau visé par le filtre de classe, s'il y en a un.
  const niveauFiltre = classes.find((c) => c.id === classeId)?.niveau_id || null;

  // « Tous niveaux » accompagne TOUJOURS un filtre de classe : ces articles
  // concernent tout le monde, les omettre donnerait une liste incomplète au
  // parent — c'est le genre d'oubli qui se paie à la rentrée.
  const groupes = [
    { id: null, libelle: "Tous niveaux", items: items.filter((f) => !f.niveau_id) },
    ...niveaux
      .filter((n) => !niveauFiltre || n.id === niveauFiltre)
      .map((n) => ({ id: n.id, libelle: n.libelle, items: items.filter((f) => f.niveau_id === n.id) })),
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <EnTete titre="Fournitures scolaires" sousTitre="Liste par niveau, visible par les parents" />
      <div className="space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <FormFourniture niveaux={niveaux} categories={categories}
          onAjout={(f) => wrap(() => creerFourniture(ecoleId, f), "Fourniture ajoutée.")} />

        {/* Consultation : par classe, et imprimable pour les familles. */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Voir la liste d&apos;une classe</span>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
              className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              <option value="">Tous les niveaux</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>
          <Bouton variante="fantome" onClick={() => setApercu(true)} disabled={groupes.length === 0}>
            🖨️ Imprimer pour les parents
          </Bouton>
        </div>

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

      <ModaleListeParents
        ouvert={apercu} onFermer={() => setApercu(false)} ecole={ecole} groupes={groupes}
        classe={classes.find((c) => c.id === classeId)?.libelle}
      />
    </>
  );
}

// Liste à remettre aux familles. Elle ne reprend QUE ce qui les concerne :
// les quantités, les articles optionnels, et la distinction « fourni par
// l'école » — c'est elle qui évite au parent d'acheter deux fois.
function ModaleListeParents({ ouvert, onFermer, ecole, groupes, classe }) {
  if (!ouvert) return null;
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Liste de fournitures — familles" large>
      <div className="zone-impression text-navy-900">
        <div className="mb-3 flex items-center gap-3 border-b border-navy-900/15 pb-2">
          {ecole?.logo_url && <img src={ecole.logo_url} alt="" className="h-11 w-11 object-contain" />}
          <div className="flex-1">
            <p className="font-display text-base font-bold">{ecole?.nom}</p>
            <p className="text-xs text-navy-900/50">{[ecole?.ville, ecole?.pays].filter(Boolean).join(" · ")}</p>
          </div>
          <p className="text-right text-xs text-navy-900/60">{classe ? <>Classe : <b>{classe}</b></> : "Toutes les classes"}</p>
        </div>
        <h1 className="mb-3 text-center font-display text-lg font-bold uppercase tracking-wide">Liste des fournitures scolaires</h1>

        {groupes.map((g) => (
          <div key={g.id || "tous"} className="mb-4">
            <h2 className="mb-1 border-b border-navy-900/20 pb-0.5 font-display text-sm font-bold uppercase">{g.libelle}</h2>
            <ul className="text-[12px] leading-6">
              {g.items.map((f) => (
                <li key={f.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-mono text-[11px]">×{f.quantite}</span>{" "}
                    <span className={f.fourni_ecole ? "font-semibold" : ""}>{f.libelle}</span>
                    {!f.obligatoire && <span className="text-navy-900/45"> (optionnel)</span>}
                    {f.note && <span className="text-navy-900/50"> — {f.note}</span>}
                  </span>
                  {f.fourni_ecole && <span className="shrink-0 text-[11px] font-semibold">fourni par l&apos;école</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-3 border-t border-navy-900/15 pt-2 text-[11px] text-navy-900/60">
          Les articles marqués « fourni par l&apos;école » sont à la charge de l&apos;établissement :
          il est inutile de les acheter.
        </p>
      </div>
      <div className="no-print mt-4 flex justify-end">
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
    </Modale>
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
