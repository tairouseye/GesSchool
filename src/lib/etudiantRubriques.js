// Import relatif (pas d'alias `@/`) : le module est aussi chargé par les tests Node.
import { moduleActif } from "./modules.js";

// Rubriques de l'espace étudiant : tuiles de l'accueil ET barre de rubriques
// de l'en-tête. Une seule liste, pour que les deux ne divergent jamais.
//
// 🔴 `cle` N'EST PAS DÉCORATIF. Il portait jusqu'ici l'icône et la pastille,
// et rien d'autre : l'étudiant voyait donc « Bibliothèque » et « Mon dépôt »
// même si l'établissement n'avait acheté ni l'un ni l'autre — la tuile
// s'ouvrait sur un écran vide, la RLS faisant son travail trop tard. Le même
// champ sert maintenant de verrou (`moduleActif`), comme dans le menu du
// personnel. Une clé inconnue de `MODULES` reste une page « cœur », toujours
// ouverte : c'est le cas de `_documentation` et de `carte_etudiant`.
export const RUBRIQUES_ETUDIANT = [
  { to: "/etudiant/notes", cle: "notes", label: "Mes résultats" },
  { to: "/etudiant/emploi", cle: "emploi_sup", label: "Emploi du temps" },
  { to: "/etudiant/messagerie", cle: "messagerie", label: "Messagerie" },
  { to: "/etudiant/textes", cle: "_documentation", label: "Textes de référence" },
  { to: "/etudiant/scolarite", cle: "paiements", label: "Ma scolarité" },
  { to: "/etudiant/documents", cle: "certificats", label: "Mes documents" },
  { to: "/etudiant/actualites", cle: "annonces", label: "Actualités" },
  { to: "/etudiant/bibliotheque", cle: "bibliotheque", label: "Bibliothèque" },
  { to: "/etudiant/depots", cle: "biblio_depots", label: "Mon dépôt" },
  { to: "/etudiant/carte", cle: "carte_etudiant", label: "Ma carte" },
];

// Les rubriques que l'établissement a réellement achetées.
export const rubriquesEtudiant = (modulesActifs) =>
  RUBRIQUES_ETUDIANT.filter((r) => moduleActif(modulesActifs, r.cle));

// Rubrique ouverte d'après l'adresse (/etudiant/notes/… → « notes »), ou null.
export function rubriqueEtudiantActive(pathname) {
  const r = RUBRIQUES_ETUDIANT.find((x) => pathname === x.to || pathname.startsWith(`${x.to}/`));
  return r ? r.cle : null;
}
