import { createContext, useContext, useEffect, useState } from "react";
import { Bouton } from "@/composants/ui.jsx";
import { useToast } from "@/composants/Feedback.jsx";

// =====================================================================
//  Modifications non enregistrées (page Paramètres, audit d'ergonomie P2)
//
//  Chaque rubrique sait si son formulaire diffère de ce qui est enregistré
//  (`useFormulaire`), le montre dans son pied (`PiedEnregistrer`) et le
//  signale à la page (`useSignalModif`), qui demande confirmation avant de
//  changer de rubrique. Avant, rien ne disait qu'une saisie était en attente,
//  ni à quel bouton « Enregistrer » elle correspondait.
// =====================================================================

// Valeur du formulaire + valeur enregistrée. `source` peut changer (profil
// rechargé, configuration lue après coup) : le formulaire repart alors de la
// nouvelle valeur. Comparée par contenu, pas par référence — l'appelant
// reconstruit souvent l'objet à chaque rendu.
export function useFormulaire(source) {
  const cle = JSON.stringify(source);
  const [base, setBase] = useState(source);
  const [valeur, setValeur] = useState(source);
  useEffect(() => {
    const s = JSON.parse(cle);
    setBase(s);
    setValeur(s);
  }, [cle]);
  return {
    valeur,
    setValeur,
    maj: (k, v) => setValeur((s) => ({ ...s, [k]: v })),
    modifie: JSON.stringify(valeur) !== JSON.stringify(base),
    base,
    annuler: () => setValeur(base),
    // Après un enregistrement réussi : ce qui est à l'écran devient la référence.
    valider: (v) => { const n = v === undefined ? valeur : v; setBase(n); setValeur(n); },
  };
}

const ModifCtx = createContext(() => {});
export const FournisseurModif = ModifCtx.Provider;

// La rubrique prévient la page qu'elle a (ou n'a plus) une saisie en attente.
export function useSignalModif(modifie) {
  const signaler = useContext(ModifCtx);
  useEffect(() => {
    signaler(modifie);
    return () => signaler(false);
  }, [modifie, signaler]);
}

// Pied de rubrique. Tant que le formulaire est modifié, il devient une barre
// collée en bas de l'écran : le bouton reste à portée, même en bas d'un long
// formulaire sur téléphone. « Enregistré ✓ » s'affiche ICI, à côté du bouton,
// et plus en haut de la page.
export function PiedEnregistrer({ modifie, onEnregistrer, onAnnuler, libelle = "Enregistrer", desactive = false }) {
  const toast = useToast();
  const [etat, setEtat] = useState(""); // "" | "envoi" | "ok"
  useSignalModif(modifie);
  useEffect(() => { if (modifie && etat === "ok") setEtat(""); }, [modifie]); // eslint-disable-line

  async function enregistrer() {
    setEtat("envoi");
    try { await onEnregistrer(); setEtat("ok"); }
    catch (e) { toast.erreur(e); setEtat(""); }
  }

  if (modifie) {
    return (
      <div className="sticky bottom-0 z-10 -mx-1 mt-4 pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm text-creme shadow-lg">
          <span className="mr-auto flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
            Modifications non enregistrées
          </span>
          {onAnnuler && (
            <button type="button" onClick={onAnnuler} disabled={etat === "envoi"}
              className="rounded-lg border border-creme/30 px-3 py-1.5 text-sm font-medium hover:bg-creme/10">
              Annuler
            </button>
          )}
          <Bouton variante="or" onClick={enregistrer} disabled={etat === "envoi" || desactive}>
            {etat === "envoi" ? "Enregistrement…" : libelle}
          </Bouton>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      {etat === "ok" && <span role="status" className="text-sm font-medium text-emerald-700">Enregistré ✓</span>}
      <Bouton disabled>{libelle}</Bouton>
    </div>
  );
}
