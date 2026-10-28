// GesSchool — le fond de l'écran de connexion change chaque mois (28/10/2026).
//
// Une photo par mois, calée sur le calendrier scolaire sénégalais, et un
// message éducatif par défaut dans l'encart du bas. Photos libres de droits
// (licence Unsplash : usage commercial permis, sans attribution obligatoire),
// recadrées à 1 600 px en WebP dans public/fonds/MM.webp.
//
// ⚠️ Elles ne sont PAS précachées par le service worker (globPatterns de
// vite.config.js n'inclut ni webp ni jpg) : un parent ne télécharge que la
// photo du mois, à l'ouverture de la connexion — pas les douze.
//
// `position` = object-position : sur un téléphone, la photo paysage est
// coupée sur les côtés ; on garde le sujet dans le cadre.

export const FONDS_CONNEXION = {
  1: { theme: "Bulletins du 1er trimestre", position: "45% center", type: "Pratique",
    message: "Les bulletins du premier trimestre se consultent dans l'appli, rubrique Notes." },
  2: { theme: "Le goût de la lecture", position: "35% center", type: "Conseil",
    message: "Un quart d'heure de lecture chaque soir fait plus qu'une longue séance le week-end." },
  3: { theme: "Semaine de la Francophonie", position: "30% center", type: "Éducation",
    message: "20 mars, Journée de la Francophonie : un mot nouveau chaque jour, en famille." },
  4: { theme: "Fête de l'Indépendance", position: "center center", type: "Éducation",
    message: "4 avril : bonne fête de l'Indépendance à toute la communauté éducative." },
  5: { theme: "Examens blancs", position: "center center", type: "Conseil",
    message: "Examens blancs : un bon sommeil vaut une révision de plus." },
  6: { theme: "CFEE et BFEM", position: "40% center", type: "Éducation",
    message: "Bonne chance à tous les candidats du CFEE et du BFEM !" },
  7: { theme: "Résultats et vacances", position: "25% center", type: "Conseil",
    message: "Bonnes vacances ! Les résultats et les bulletins restent consultables dans l'appli." },
  8: { theme: "Lire en vacances", position: "center center", type: "Conseil",
    message: "Vingt minutes de lecture par jour suffisent à garder le niveau pendant l'été." },
  9: { theme: "Préparer la rentrée", position: "center center", type: "Pratique",
    message: "La liste des fournitures de la classe de votre enfant est dans l'appli." },
  10: { theme: "Rentrée scolaire", position: "70% center", type: "Pratique",
    message: "Bonne rentrée ! Emploi du temps, cahier de textes et paiements sont dans l'appli." },
  11: { theme: "Droits de l'enfant", position: "center center", type: "Éducation",
    message: "20 novembre, Journée internationale des droits de l'enfant." },
  12: { theme: "Compositions du 1er trimestre", position: "35% center", type: "Conseil",
    message: "Compositions du premier trimestre : révisez un peu chaque jour, pas tout la veille." },
};

// Le fond du mois (1 à 12) ; `date` pour les essais.
export function fondDuMois(date = new Date()) {
  const mois = date.getMonth() + 1;
  return {
    mois,
    ...FONDS_CONNEXION[mois],
    image: `${import.meta.env?.BASE_URL || "/"}fonds/${String(mois).padStart(2, "0")}.webp`,
  };
}
