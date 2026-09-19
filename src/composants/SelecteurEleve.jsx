import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { chercherEleves } from "@/lib/eleves.js";

// Sélecteur d'élève cherchant CÔTÉ SERVEUR.
//
// Il remplace les menus déroulants qui rendaient un `<option>` par élève.
// Indolore à 96 élèves, impraticable à 10 000 : autant de nœuds dans le DOM,
// et une liste qu'on ne peut pas parcourir à la main. Ici on tape, le serveur
// renvoie au plus huit résultats.
//
// `exclure` permet d'écarter des élèves déjà traités (déjà abonnés à la
// cantine, déjà inscrits…) sans que l'appelant ait à charger toute la liste.
export default function SelecteurEleve({
  ecoleId: ecoleIdProp = null, anneeId = null, value = "", onChange,
  exclure = null, label = "Élève", placeholder = "Nom, prénom ou matricule…", requis = false,
}) {
  // L'établissement est lu dans le contexte, pas exigé de l'appelant : ces
  // sélecteurs vivent souvent dans des modales où `ecoleId` n'est pas en
  // portée. Le prop reste possible pour les rares cas particuliers.
  const { ecoleId: ecoleIdCtx } = useAuth();
  const ecoleId = ecoleIdProp || ecoleIdCtx;

  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState([]);
  const [choisi, setChoisi] = useState(null);
  const [cherche, setCherche] = useState(false);

  // `exclure` est un Set que l'appelant reconstruit souvent à chaque rendu.
  // Le mettre en dépendance d'effet relancerait la recherche en boucle : on
  // le lit par référence au moment de filtrer.
  const exclureRef = useRef(exclure);
  exclureRef.current = exclure;

  // L'appelant peut réinitialiser la sélection (fermeture de modale) :
  // le composant doit suivre, sinon il afficherait un élève déjà validé.
  useEffect(() => { if (!value) setChoisi(null); }, [value]);

  useEffect(() => {
    const q = saisie.trim();
    if (choisi || q.length < 2) { setResultats([]); return undefined; }
    let vivant = true;
    setCherche(true);
    const t = setTimeout(async () => {
      try {
        const r = await chercherEleves(ecoleId, q, { anneeId, limite: 8 });
        const ex = exclureRef.current;
        if (vivant) setResultats(ex ? r.filter((e) => !ex.has(e.id)) : r);
      } catch { if (vivant) setResultats([]); }
      finally { if (vivant) setCherche(false); }
    }, 250);
    return () => { vivant = false; clearTimeout(t); };
  }, [ecoleId, anneeId, saisie, choisi]);

  function selectionner(e) {
    setChoisi(e);
    setResultats([]);
    setSaisie("");
    onChange?.(e.id, e);
  }

  function effacer() {
    setChoisi(null);
    onChange?.("", null);
  }

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}{requis ? " *" : ""}</span>}

      {choisi ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-or-500/40 bg-or-500/5 px-3 py-2.5 text-sm">
          <span className="min-w-0 truncate text-navy-900">
            {choisi.prenom} {choisi.nom}
            {choisi.matricule ? <span className="ml-2 font-mono text-xs text-navy-900/50">{choisi.matricule}</span> : null}
          </span>
          <button type="button" onClick={effacer}
            className="shrink-0 text-xs text-navy-900/50 hover:text-navy-900">changer</button>
        </div>
      ) : (
        <>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500"
          />
          {saisie.trim().length >= 2 && (
            <div className="mt-1 space-y-1">
              {cherche && <p className="px-1 text-xs text-navy-900/40">Recherche…</p>}
              {!cherche && resultats.length === 0 && (
                <p className="px-1 text-xs text-navy-900/40">Aucun résultat.</p>
              )}
              {resultats.map((e) => (
                <button key={e.id} type="button" onClick={() => selectionner(e)}
                  className="w-full rounded-lg border border-navy-900/10 px-3 py-2 text-left text-sm hover:border-or-500">
                  {e.prenom} {e.nom}
                  {e.matricule ? <span className="ml-2 font-mono text-xs text-navy-900/45">{e.matricule}</span> : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </label>
  );
}
