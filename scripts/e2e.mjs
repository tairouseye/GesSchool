// =====================================================================
//  GesSchool — parcours de bout en bout (lot 5 de l'audit du 31/10/2026, P2-14)
//
//  Cinq parcours réels, dans un vrai Chrome, avec les comptes de DÉMO (école
//  fictive, lecture seule : rien n'est écrit). Ce que les tests unitaires ne
//  voient pas : la connexion, le routage, le chargement des données.
//
//    npm run e2e                                  → contre le serveur local (npm run dev)
//    E2E_URL=https://gesschool.gesprosn.org npm run e2e   → contre la production
//
//  Pas dans la chaîne de déploiement : il faut Chrome et la base de démo en
//  ligne, et un réseau lent ferait échouer un déploiement sans raison.
//  À lancer avant une livraison qui touche la connexion ou l'espace parent.
// =====================================================================
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.E2E_URL || "http://localhost:5173").replace(/\/$/, "");
const CHROMES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const CHROME = CHROMES.find((c) => existsSync(c));
if (!CHROME) { console.error("Chrome introuvable (variable CHROME pour l'indiquer)."); process.exit(2); }

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(largeur, hauteur) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profil = mkdtempSync(join(tmpdir(), "gs-e2e-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, "--headless=new", `--user-data-dir=${profil}`,
    `--window-size=${largeur},${hauteur}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  let cible;
  for (let i = 0; i < 120 && !cible; i++) {
    await attendre(250);
    try { cible = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch { /* Chrome démarre */ }
  }
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const enAttente = new Map(); const erreurs = [];
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && enAttente.has(d.id)) { enAttente.get(d.id)(d); enAttente.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") erreurs.push(d.params.exceptionDetails?.exception?.description?.split("\n")[0] || "exception");
  });
  const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; enAttente.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalue = async (expr) => (await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await cmd("Emulation.setDeviceMetricsOverride", { width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: largeur < 600 });
  await cmd("Runtime.enable");
  const aller = (chemin) => cmd("Page.navigate", { url: `${BASE}/#${chemin}` });
  const texte = () => evalue("document.body.innerText");
  //  Attend qu'une condition (expression JS) devienne vraie, sans sommeil fixe.
  const jusqua = async (expr, delai = 30000) => {
    const fin = Date.now() + delai;
    while (Date.now() < fin) { if (await evalue(`!!(${expr})`)) return true; await attendre(400); }
    return false;
  };
  const cliquer = (t) => evalue(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(${JSON.stringify(t)})); if (b) { b.click(); return true; } return false; })()`);
  const fermer = () => { ws.close(); chrome.kill(); setTimeout(() => { try { rmSync(profil, { recursive: true, force: true }); } catch { /* verrou Windows */ } }, 1500); };
  return { cmd, evalue, aller, texte, jusqua, cliquer, fermer, erreurs };
}

//  Connexion « Démo » : le bouton, puis l'espace voulu ; on attend d'avoir
//  quitté l'écran de connexion (la session arrive en différé).
//  Deux essais : la session démo est partagée et son ouverture prend parfois
//  plus d'un aller-retour — un échec unique ne dit rien de l'application.
async function connexionDemo(s, espace) {
  for (let essai = 1; essai <= 2; essai++) {
    await s.aller("/connexion");
    if (!await s.jusqua(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Démo"))`)) continue;
    await s.cliquer("Démo");
    await s.jusqua(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Comme ${espace}"))`, 5000);
    await s.cliquer(`Comme ${espace}`);
    if (await s.jusqua(`!location.hash.includes("connexion") && document.body.innerText.includes("Bonjour")`, 30000)) return;
  }
  throw new Error("connexion démo non aboutie (2 essais)");
}

const PARCOURS = [
  ["Parent : l'accueil montre l'enfant et ses dernières notes", 390, 844, async (s) => {
    await connexionDemo(s, "parent");
    if (!await s.jusqua(`document.body.innerText.includes("Dernières notes") || document.body.innerText.includes("Dernière note")`)) throw new Error("aperçu de l'enfant absent");
  }],
  ["Parent : la page de l'enfant ouvre la rubrique Paiements", 390, 844, async (s) => {
    await connexionDemo(s, "parent");
    //  Les liens vers les enfants n'existent qu'une fois `mes_enfants` revenue.
    const enfant = `[...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "").find((h) => /enfant\\/[^/]+$/.test(h))`;
    await s.jusqua(enfant);
    const lien = await s.evalue(enfant);
    if (!lien) throw new Error("aucun lien vers un enfant");
    await s.aller(`${lien.replace(/^#/, "")}/paiements`);
    if (!await s.jusqua(`/Paiements|Scolarité/.test(document.body.innerText) && /réglé|payé|à régler|Aucune facture/i.test(document.body.innerText)`)) throw new Error("rubrique Paiements vide");
  }],
  ["Direction : le tableau de bord Gestion affiche ses chiffres", 1366, 900, async (s) => {
    await connexionDemo(s, "direction");
    await s.aller("/");
    if (!await s.jusqua(`document.body.innerText.includes("Élèves inscrits") && /\\d/.test(document.body.innerText)`)) throw new Error("chiffres clés absents");
  }],
  ["Direction : la recherche globale retrouve un élève", 1366, 900, async (s) => {
    await connexionDemo(s, "direction");
    await s.evalue(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })), 1`);
    if (!await s.jusqua(`document.querySelector('input[aria-label="Rechercher"]')`, 5000)) throw new Error("fenêtre de recherche absente");
    await s.evalue(`(() => { const i = document.querySelector('input[aria-label="Rechercher"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Am"); i.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`);
    if (!await s.jusqua(`document.querySelectorAll('[role=option]').length > 0`)) throw new Error("aucun résultat");
  }],
  ["Direction : la fenêtre Encaisser s'ouvre et cherche un élève", 1366, 900, async (s) => {
    await connexionDemo(s, "direction");
    await s.aller("/");
    await s.jusqua(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Encaisser un paiement"))`);
    await s.cliquer("Encaisser un paiement");
    if (!await s.jusqua(`[...document.querySelectorAll('[role=dialog]')].some((d) => d.innerText.includes("Encaisser"))`, 8000)) throw new Error("fenêtre absente");
    await s.evalue(`(() => { const i = [...document.querySelectorAll('[role=dialog] input')].find((x) => x.placeholder?.includes("Nom")); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Am"); i.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`);
    if (!await s.jusqua(`[...document.querySelectorAll('[role=dialog] button')].length > 3`)) throw new Error("le sélecteur d'élève ne répond pas");
  }],
];

let echecs = 0;
console.log(`Parcours contre ${BASE}\n`);
for (const [nom, l, h, fn] of PARCOURS) {
  const s = await session(l, h);
  const t0 = Date.now();
  try {
    await fn(s);
    if (s.erreurs.length) throw new Error(`exception JS : ${s.erreurs[0]}`);
    console.log(`  ✔ ${nom} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    echecs++;
    console.log(`  ✖ ${nom} — ${e.message}`);
  } finally { s.fermer(); }
}
console.log(`\n${PARCOURS.length - echecs}/${PARCOURS.length} parcours réussis.`);
process.exit(echecs ? 1 : 0);
