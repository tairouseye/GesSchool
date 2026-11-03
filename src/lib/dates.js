// GesSchool — affichage des dates.
//
// Les dates SQL arrivent en AAAA-MM-JJ. Affichées telles quelles
// (« 2026-08-07 »), elles se lisent comme un code, pas comme une échéance :
// une secrétaire lit 07/08/2026 (audit de prise en main, 03/11/2026).
//
// Découpage de la chaîne plutôt que `new Date()` : une date seule est lue en
// UTC par le navigateur, et pouvait reculer d'un jour selon le fuseau.
export function dateFr(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}
