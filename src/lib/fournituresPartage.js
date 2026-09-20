// GesSchool — partage de la liste de fournitures À ACHETER.
//
// Le parent reçoit une liste où certains articles sont fournis par l'école et
// d'autres non. Ce sont les AUTRES qu'il doit se procurer — et c'est cette
// liste-là qu'il veut envoyer, à une boutique ou à son conjoint, pour faire
// les achats. Jusqu'ici il la recopiait à la main.
//
// Module PUR : aucun accès réseau, aucun composant. Testé.

// Un article est « fourni par l'école » si la case l'indique. Repli sur la
// note pour les listes saisies avant la migration 105, qui posait la case.
export function fourniParEcole(f) {
  return f?.fourni_ecole === true || (f?.note || "").toLowerCase().includes("école");
}

// Ce qu'il reste à acheter.
export function aAcheter(items = []) {
  return items.filter((f) => !fourniParEcole(f));
}

// Message WhatsApp. Volontairement en texte simple : WhatsApp n'affiche pas
// de tableau, et un message qu'on peut relire dans un rayon de magasin vaut
// mieux qu'un message bien formaté.
export function messageFournitures(items = [], { enfant = null, classe = null, ecole = null } = {}) {
  const lignes = items.map((f) => {
    const q = Number(f.quantite) > 1 ? `${f.quantite} × ` : "";
    const opt = f.obligatoire === false ? " (optionnel)" : "";
    // La note porte souvent la précision utile en magasin (format, couleur).
    const note = f.note ? ` — ${f.note}` : "";
    return `• ${q}${f.libelle}${opt}${note}`;
  });

  const entete = ["Fournitures à acheter", enfant, classe].filter(Boolean).join(" — ");
  const pied = ecole ? `\n(${ecole})` : "";

  if (lignes.length === 0) {
    return `${entete}\n\nRien à acheter : tout est fourni par l'école.${pied}`;
  }
  return `${entete}\n\n${lignes.join("\n")}${pied}`;
}

// Lien WhatsApp SANS destinataire : le parent choisit lui-même le contact —
// sa boutique, son conjoint, lui-même. Imposer un numéro n'aurait pas de sens
// ici, contrairement aux relances de l'école vers une famille.
export function lienPartageWhatsApp(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
