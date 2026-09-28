import { useEffect, useState } from "react";
import { Carte, Alerte, SkeletonListe, EtatVide } from "@/composants/ui.jsx";
import { textesReference, lienFichier, libCategorie, poids } from "@/lib/fichiers.js";

// Les textes que l'établissement a publiés aux familles : règlement
// intérieur, codes et décrets, conventions, chartes (migration 151).
//
// Composant partagé par l'espace parent et l'espace étudiant : le contenu est
// le même, seul l'endroit où on le consulte change. Le tri vient du serveur —
// règlement d'abord, puis procédures, conventions, textes officiels.
export default function TextesReference({ titre = "Textes de référence" }) {
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    textesReference()
      .then(setItems)
      .catch((e) => { setErreur(e.message); setItems([]); });
  }, []);

  async function ouvrir(t) {
    const url = await lienFichier(t.chemin).catch(() => null);
    if (url) window.open(url, "_blank", "noopener");
    else setErreur("Ce document n'est plus disponible.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">⚖️ {titre}</p>
        <p className="text-sm text-creme/70">Règlement intérieur et textes officiels de l&apos;établissement</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      {items === null ? <SkeletonListe lignes={3} /> : items.length === 0 ? (
        <EtatVide icone="⚖️" titre="Aucun texte publié">
          L&apos;établissement n&apos;a pas encore mis de texte à votre disposition.
          Le règlement intérieur apparaîtra ici dès sa publication.
        </EtatVide>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <Carte key={t.id} className="p-4">
              <button type="button" onClick={() => ouvrir(t)} className="w-full text-left">
                <p className="flex flex-wrap items-center gap-2 font-medium text-navy-900">
                  ⚖️ {t.titre}
                  {/* Un règlement peut n'appartenir qu'à un cycle : sans le
                      dire, un parent d'enfants dans deux cycles ne saurait
                      pas lequel le concerne (migration 159). */}
                  {t.portee_libelle && (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-normal text-sky-700">
                      {t.portee_libelle}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-navy-900/55">
                  {[libCategorie(t.categorie), t.reference,
                    t.date_texte ? new Date(t.date_texte).toLocaleDateString("fr-FR") : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-or-600">
                  Ouvrir le document <span className="text-navy-900/35">({poids(t.taille)})</span>
                </p>
              </button>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
