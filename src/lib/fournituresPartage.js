// GesSchool — regroupement et partage de la liste de fournitures.
//
// Le parent reçoit une liste où certains articles sont fournis par l'école et
// d'autres non. Ce sont les AUTRES qu'il doit se procurer — et c'est cette
// liste-là qu'il veut envoyer, à une boutique ou à son conjoint, pour faire
// les achats. Jusqu'ici il la recopiait à la main.
//
// ⚠️ Constat sur les vraies listes : les écoles écrivent DÉJÀ la catégorie
// dans le libellé — « Livres — Bled CM1/CM2 », « Petit matériel — Gomme ».
// Elles rangent leur liste à la main faute de champ pour le faire. On honore
// donc leur classement quand il existe, et on ne devine que sinon. Un jour,
// une colonne `categorie` rendra cela explicite — exactement l'évolution
// qu'a connue `fourni_ecole` avec la migration 105.
//
// Module PUR : aucun accès réseau, aucun composant. Testé.

// --- Catégories devinées, dans l'ordre d'affichage demandé ----------------
const DEVINETTE = [
  { id: "cahiers", label: "Cahiers",
    motifs: ["cahier", "protege-cahier", "bloc", "ramette", "rame de papier", "papier",
             "feuille", "classeur", "chemise", "intercalaire", "porte-document", "repertoire"] },
  { id: "livres", label: "Livres & manuels",
    motifs: ["livre", "manuel", "dictionnaire", "bled", "bescherelle", "fascicule",
             "roman", "lecture", "larousse"] },
  { id: "ecriture", label: "Stylos & crayons",
    motifs: ["stylo", "bic", "crayon", "feutre", "marqueur", "surligneur", "gomme",
             "taille-crayon", "effaceur", "encre", "craie", "plume"] },
];
const DIVERS = { id: "divers", label: "Divers" };

// Minuscules sans accents : « Protège-cahier » doit rencontrer « protege ».
const sansAccent = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Les écoles écrivent « Catégorie — Article ». Le séparateur est un tiret
// CADRATIN entouré d'espaces, jamais un trait d'union : sinon « Taille-crayon »
// serait coupé en deux.
const PREFIXE = /^\s*([^—–]{2,28}?)\s+[—–]\s+(.+)$/;

// Découpe un libellé en { categorie (ou null), libelle nettoyé }.
export function separerPrefixe(libelle) {
  const m = PREFIXE.exec(String(libelle || ""));
  if (!m) return { categorie: null, libelle: String(libelle || "").trim() };
  return { categorie: m[1].trim(), libelle: m[2].trim() };
}

// Certaines catégories écrites par les écoles désignent le fourre-tout : on
// les ramène à « Divers » pour qu'elles se rangent en dernier.
const EST_FOURRE_TOUT = (c) => ["autres", "autre", "divers", "reste"].includes(sansAccent(c));

const groupeEcole = (c) =>
  EST_FOURRE_TOUT(c) ? DIVERS : { id: "ecole:" + sansAccent(c), label: String(c).trim() };

// Catégorie d'un article, par ordre d'autorité décroissante :
//   1. la colonne `categorie` saisie par l'école (migration 144) ;
//   2. le préfixe « Catégorie — Article » qu'elle écrivait avant, faute de
//      champ — encore présent dans les listes non rattrapées ;
//   3. la devinette par mot-clé.
// Accepte un article ou, par commodité, un simple libellé.
export function categoriser(f) {
  const item = typeof f === "string" ? { libelle: f } : (f || {});
  const saisie = String(item.categorie || "").trim();
  if (saisie) return groupeEcole(saisie);

  const { categorie, libelle: net } = separerPrefixe(item.libelle);
  if (categorie) return groupeEcole(categorie);

  const t = sansAccent(net);
  for (const c of DEVINETTE) {
    if (c.motifs.some((m) => t.includes(m))) return { id: c.id, label: c.label };
  }
  return DIVERS;
}

// Un article est « fourni par l'école » si la case l'indique. Repli sur la
// note pour les listes saisies avant la migration 105, qui posait la case.
export function fourniParEcole(f) {
  return f?.fourni_ecole === true || (f?.note || "").toLowerCase().includes("école");
}

// Ce qu'il reste à acheter.
export function aAcheter(items = []) {
  return items.filter((f) => !fourniParEcole(f));
}

// Regroupe par catégorie. Ordre : les groupes devinés dans l'ordre demandé
// (Cahiers, Livres, Stylos & crayons), puis les catégories propres à l'école
// dans leur ordre d'apparition, et « Divers » toujours en dernier — c'est ce
// qu'on parcourt le plus vite en magasin.
export function grouperFournitures(items = []) {
  const groupes = new Map();
  for (const f of items) {
    const c = categoriser(f);
    if (!groupes.has(c.id)) groupes.set(c.id, { ...c, items: [] });
    // Le préfixe est retiré du libellé affiché : une fois sous son titre de
    // groupe, « Petit matériel — Gomme » n'a plus à répéter sa catégorie.
    groupes.get(c.id).items.push({ ...f, libelle: separerPrefixe(f.libelle).libelle });
  }
  const rang = (id) => {
    const i = DEVINETTE.findIndex((c) => c.id === id);
    if (i >= 0) return i;                 // 0,1,2 : les groupes devinés
    if (id === "divers") return 1000;     // toujours en queue
    return 100;                           // catégories de l'école, ordre conservé
  };
  return [...groupes.values()].sort((a, b) => rang(a.id) - rang(b.id));
}

// --- Message WhatsApp ------------------------------------------------------
// Volontairement en texte simple : WhatsApp n'affiche pas de tableau, et un
// message qu'on peut relire dans un rayon de magasin vaut mieux qu'un message
// bien formaté. Les titres de groupe sont en gras WhatsApp (*texte*).
function ligne(f) {
  const q = Number(f.quantite) > 1 ? `${f.quantite} × ` : "";
  const opt = f.obligatoire === false ? " (optionnel)" : "";
  // La note porte souvent la précision utile en magasin (format, couleur).
  const note = f.note ? ` — ${f.note}` : "";
  return `• ${q}${f.libelle}${opt}${note}`;
}

export function messageFournitures(items = [], { enfant = null, classe = null, ecole = null } = {}) {
  const entete = ["Fournitures à acheter", enfant, classe].filter(Boolean).join(" — ");
  const pied = ecole ? `\n(${ecole})` : "";

  if (items.length === 0) {
    return `${entete}\n\nRien à acheter : tout est fourni par l'école.${pied}`;
  }

  const groupes = grouperFournitures(items);
  // Un seul groupe : le titre n'apprendrait rien, on l'omet.
  const corps = groupes.length === 1
    ? groupes[0].items.map(ligne).join("\n")
    : groupes.map((g) => `*${g.label}*\n${g.items.map(ligne).join("\n")}`).join("\n\n");

  return `${entete}\n\n${corps}${pied}`;
}

// Lien WhatsApp SANS destinataire : le parent choisit lui-même le contact —
// sa boutique, son conjoint, lui-même. Imposer un numéro n'aurait pas de sens
// ici, contrairement aux relances de l'école vers une famille.
export function lienPartageWhatsApp(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
