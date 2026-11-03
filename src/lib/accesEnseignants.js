// GesSchool — donner leur accès aux enseignants (prise en main, lot 3).
// Module PUR (éprouvé par test/accesEnseignants.test.mjs).
//
// 🔴 LE CONSTAT (03/11/2026) : à Tut'Tank, aucun des 10 enseignants n'avait
// de compte — ni code généré, ni téléphone, ni e-mail sur leur fiche. Le code
// se générait ligne par ligne, puis se recopiait à la main dans un message.
// Depuis la mig. 228, un enseignant se connecte comme un parent : son NUMÉRO
// et le CODE remis par l'école, puis un mot de passe de son choix.

const echapper = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

//  Les trois gestes de l'enseignant, dans le vocabulaire de l'écran de connexion.
export function etapesConnexion(origin) {
  return [
    `Ouvrez ${origin}`,
    "Touchez « Mon numéro », puis « J'ai un code »",
    "Saisissez votre numéro, ce code et un mot de passe de votre choix",
  ];
}

export function messageEnseignant(origin, ecoleNom, enseignant, code) {
  const etapes = etapesConnexion(origin).map((e, i) => `${i + 1}) ${e}`).join("\n");
  return (
    `Bonjour ${enseignant.prenom || ""}, voici votre accès à l'espace enseignant GesSchool`
    + (ecoleNom ? ` (${ecoleNom})` : "")
    + " : feuille de présence, cahier de textes et notes de vos classes.\n\n"
    + `${etapes}\n\nVotre code : ${code}`
  );
}

//  Où en est chaque enseignant : 'connecte' (compte relié), 'pret' (code et
//  numéro : il peut se connecter), 'sans_tel' (code mais pas de numéro sur la
//  fiche : la connexion par numéro est impossible), 'sans_code'.
export function etatAcces(e, code) {
  if (e.profil_id) return "connecte";
  if (!code) return "sans_code";
  return e.telephone ? "pret" : "sans_tel";
}

//  Une fiche par enseignant, à découper et remettre en main propre : c'est
//  le seul canal quand la fiche ne porte pas de numéro WhatsApp.
export function fichesImprimables(origin, ecoleNom, lignes) {
  const etapes = etapesConnexion(origin).map((e) => `<li>${echapper(e)}</li>`).join("");
  const fiches = lignes.map(({ enseignant: e, code }) => `
    <div class="fiche">
      <p class="ecole">${echapper(ecoleNom)} · Espace enseignant GesSchool</p>
      <p class="nom">${echapper(`${e.prenom || ""} ${e.nom || ""}`.trim())}</p>
      <ol>${etapes}</ol>
      <p class="code">Votre code : <b>${echapper(code)}</b></p>
      <p class="note">Le code ne sert qu'une fois. Votre numéro doit être celui que l'école a enregistré${e.telephone ? ` (${echapper(e.telephone)})` : ""}.</p>
    </div>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Codes d'accès des enseignants</title>
<style>
  body { font-family: system-ui, sans-serif; color: #0b1f3a; margin: 16px; }
  .fiche { border: 1px dashed #94a3b8; border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; break-inside: avoid; }
  .ecole { font-size: 11px; color: #64748b; margin: 0; }
  .nom { font-size: 18px; font-weight: 700; margin: 4px 0 8px; }
  ol { margin: 0 0 8px; padding-left: 20px; font-size: 13px; }
  .code { font-size: 15px; margin: 0; }
  .code b { font-family: ui-monospace, monospace; letter-spacing: 2px; font-size: 18px; }
  .note { font-size: 11px; color: #64748b; margin: 6px 0 0; }
</style></head><body>${fiches}</body></html>`;
}
