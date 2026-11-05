// GesSchool — ce qui attend, sur les accueils Pédagogie et Gestion. Un seul
// endroit pour ces lignes : le tableau de bord et l'accueil de métier disent
// la même chose. Une action n'est proposée que si l'écran qui la traite est
// ouvert à ce rôle (`ouvert`) : un bouton qui mène à un refus ne sert à rien.
import { lignesAdoption } from "./miseEnRoute.js";

const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;

export function aTraiterPedagogie({ stats, blocs, annee, demandes = 0, aSigner = 0, sansAppel = [], adoption, ouvert, direction }) {
  if (!stats) return [];
  return [
    blocs?.horsAnnee && ouvert("structure") && {
      to: "/parametres/structure", ton: "rouge", bouton: "Corriger",
      titre: `Dates des périodes hors de l'année ${annee?.libelle || ""}`.trim() },
    ouvert("appel") && sansAppel.length > 0 && {
      to: `/appel?classe=${sansAppel[0].id}`, ton: "rouge", bouton: "Voir",
      titre: `${pl(sansAppel.length, "classe")} sans appel : ${sansAppel.slice(0, 3).map((c) => c.libelle).join(", ")}${sansAppel.length > 3 ? "…" : ""}` },
    ouvert("signatures") && aSigner > 0 && {
      to: "/a-signer", ton: "bleu", bouton: "Signer", titre: `${pl(aSigner, "document")} à signer` },
    ouvert("bulletins") && stats.bulletinsValides > 0 && {
      to: "/bulletins", ton: "violet", bouton: "Publier", titre: `${pl(stats.bulletinsValides, "bulletin")} à publier` },
    ouvert("bulletins") && stats.bulletinsBrouillon > 0 && {
      to: "/bulletins", ton: "bleu", bouton: "Relire", titre: `${pl(stats.bulletinsBrouillon, "bulletin")} en relecture` },
    ouvert("assiduite") && stats.justifEnAttente > 0 && {
      to: "/assiduite", ton: "or", bouton: "Examiner", titre: `${pl(stats.justifEnAttente, "justificatif")} d'absence` },
    ouvert("assiduite") && stats.absNonJustif > 0 && {
      to: "/assiduite", ton: "rouge", bouton: "Relancer", titre: pl(stats.absNonJustif, "absence non justifiée", "absences non justifiées") },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "navy", bouton: "Traiter", titre: `${pl(demandes, "demande")} de document` },
    //  L'enseignant n'a pas à voir combien de collègues sont connectés.
    ...(direction ? lignesAdoption(adoption, ouvert) : []),
  ].filter(Boolean);
}

export function aTraiterGestion({ stats, demandes = 0, aSigner = 0, adoption, ouvert }) {
  if (!stats) return [];
  return [
    ouvert("paiements") && stats.declEnAttente > 0 && {
      to: "/paiements?onglet=declarations", ton: "or", bouton: "Valider",
      titre: `${pl(stats.declEnAttente, "paiement mobile", "paiements mobiles")} à valider` },
    ouvert("recouvrement") && stats.nbEnRetard > 0 && {
      to: "/recouvrement", ton: "rouge", bouton: "Relancer", titre: `${pl(stats.nbEnRetard, "élève")} en impayé` },
    ouvert("recouvrement") && stats.echeanceNb > 0 && {
      to: "/recouvrement", ton: "navy", bouton: "Voir", titre: `${pl(stats.echeanceNb, "échéance")} dans les 7 jours` },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "violet", bouton: "Traiter", titre: `${pl(demandes, "demande")} de document` },
    ouvert("signatures") && aSigner > 0 && {
      to: "/a-signer", ton: "bleu", bouton: "Signer", titre: `${pl(aSigner, "document")} à signer` },
    ...lignesAdoption(adoption, ouvert),
  ].filter(Boolean);
}
