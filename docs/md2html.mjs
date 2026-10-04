// Convertit docs/mode-emploi.md -> public/mode-emploi.html, avec sommaire
// cliquable (remplace [SOMMAIRE]).
//
// ⚠️ LA SORTIE VA DANS `public/`, ET NON DANS `docs/`. C'est ce qui rend le
// manuel ACCESSIBLE DEPUIS L'APPLICATION : Vite recopie `public/` dans
// `dist/`, le manuel est donc servi à /mode-emploi.html et l'écran
// « Mode d'emploi » y renvoie. Tant qu'il ne vivait que dans `docs/`,
// aucune directrice ne pouvait le trouver.
//
// ⚠️ DEUX FAIBLESSES CORRIGÉES :
//
//  1. Les chemins sont RELATIFS au script. L'ancienne version portait
//     « C:/Users/… » en dur : elle n'aurait jamais tourné ailleurs que sur
//     un poste, et notamment pas dans la chaîne d'intégration.
//  2. Le style est ÉCRIT ICI, et non plus relu depuis la sortie
//     précédente. L'ancienne version extrayait le <style> de son propre
//     résultat : si le HTML était perdu, la mise en forme disparaissait
//     silencieusement. Un convertisseur ne doit pas dépendre de ce qu'il a
//     produit la fois d'avant.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(ICI, "mode-emploi.md");
const SORTIE = join(ICI, "..", "public", "mode-emploi.html");

const md = readFileSync(SOURCE, "utf8").replace(new RegExp(String.fromCharCode(13), "g"), "");
const style = `<style>
  @page { size: A4; margin: 18mm 16mm; }
  :root { --navy:#0B1F3A; --or:#C9A227; --creme:#FBF7EF; --ink:#1c2733; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: var(--ink); line-height: 1.55; font-size: 12.5px; margin: 0; }
  .cover { background: var(--navy); color: var(--creme); padding: 26px 30px; border-radius: 0 0 14px 14px;
           display:flex; align-items:center; gap:18px; }
  .seal { width:60px; height:60px; border-radius:50%; border:3px solid var(--or); color:var(--or);
          display:grid; place-items:center; font-weight:800; font-size:20px; letter-spacing:1px; flex:0 0 auto; }
  .cover h1 { margin:0; font-size:24px; }
  .cover p { margin:4px 0 0; color:rgba(251,247,239,.7); font-size:13px; }
  main { padding: 8px 30px 40px; max-width: 880px; }
  h1 { font-size:21px; color:var(--navy); border-bottom:2px solid var(--or); padding-bottom:5px; margin-top:30px; scroll-margin-top:12px; }
  h2 { font-size:17px; color:var(--navy); margin-top:24px; scroll-margin-top:12px; }
  h3 { font-size:14px; color:var(--navy); margin-top:18px; scroll-margin-top:12px; }
  h2, h3, h4 { break-after: avoid; }
  h4 { font-size:12.5px; color:var(--navy); margin-top:14px; scroll-margin-top:12px; }
  p { margin: 7px 0; }
  a { color:#1d5fb0; text-decoration:none; }
  a:hover { text-decoration:underline; }
  ul, ol { margin: 7px 0 7px 4px; padding-left: 20px; }
  li { margin: 3px 0; }
  code { background:#eef0f3; padding:1px 5px; border-radius:4px; font-family:Consolas,monospace; font-size:.92em; color:var(--navy); }
  pre { background:var(--creme); border:1px solid #e3e6ea; border-left:3px solid var(--or); border-radius:8px;
        padding:10px 14px; overflow:auto; break-inside:avoid; margin:12px 0; }
  pre code { background:none; padding:0; color:#3a4757; font-size:11.5px; line-height:1.4; white-space:pre; }
  strong { color: var(--navy); }
  hr { border:0; border-top:1px solid #e3e6ea; margin:18px 0; }
  blockquote { margin:10px 0; padding:8px 14px; background:var(--creme); border-left:3px solid var(--or);
               border-radius:0 8px 8px 0; color:#3a4757; }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; break-inside:avoid; }
  th { background:var(--navy); color:var(--creme); text-align:left; padding:7px 9px; font-weight:600; }
  td { border-bottom:1px solid #e3e6ea; padding:6px 9px; vertical-align:top; }
  tbody tr:nth-child(even){ background:#faf9f6; }
  .toc { background:var(--creme); border:1px solid #ece6d8; border-radius:12px; padding:14px 18px; margin:14px 0; break-inside:avoid; }
  .toc-t { margin:0 0 8px; font-weight:700; color:var(--navy); font-size:13px; text-transform:uppercase; letter-spacing:.5px; }
  .toc ul { list-style:none; margin:0; padding:0; columns:2; column-gap:26px; }
  .toc li { margin:2px 0; break-inside:avoid; }
  .toc li.sub { padding-left:14px; font-size:11.5px; }
  .toc li.sub a { color:#5a6675; }
  .foot { color:#8a94a0; font-size:10.5px; text-align:center; padding:14px; }
</style>`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Inline : gras, code, liens (sur texte déjà échappé).
function inline(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const lignes = md.split("\n");
const out = [];
const toc = [];
let i = 0;
const fermerListe = { ul: () => {}, };

while (i < lignes.length) {
  let l = lignes[i];

  // Code fence
  if (l.startsWith("```")) {
    const buf = []; i++;
    while (i < lignes.length && !lignes[i].startsWith("```")) { buf.push(esc(lignes[i])); i++; }
    i++; out.push(`<pre><code>${buf.join("\n")}</code></pre>`); continue;
  }
  // SOMMAIRE
  if (l.trim() === "[SOMMAIRE]") { out.push("[[TOC]]"); i++; continue; }
  // hr
  if (l.trim() === "---") { out.push("<hr/>"); i++; continue; }
  // Titres
  let m;
  if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
    const niv = m[1].length, txt = m[2].trim();
    if (niv === 1) { out.push(`<h1 id="${slug(txt)}">${inline(txt)}</h1>`); }
    else {
      const id = slug(txt);
      out.push(`<h${niv} id="${id}">${inline(txt)}</h${niv}>`);
      if (niv === 2 || niv === 3) toc.push({ niv, id, txt });
    }
    i++; continue;
  }
  // Tableau
  if (l.trim().startsWith("|") && i + 1 < lignes.length && /^\s*\|[\s:|-]+\|\s*$/.test(lignes[i + 1])) {
    const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(l);
    i += 2; const rows = [];
    while (i < lignes.length && lignes[i].trim().startsWith("|")) { rows.push(cells(lignes[i])); i++; }
    let t = "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
    for (const r of rows) t += "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
    t += "</tbody></table>"; out.push(t); continue;
  }
  // Blockquote (peut être multi-lignes)
  if (l.startsWith(">")) {
    const buf = [];
    while (i < lignes.length && lignes[i].startsWith(">")) { buf.push(lignes[i].replace(/^>\s?/, "")); i++; }
    out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`); continue;
  }
  // Liste à puces
  if (/^\s*-\s+/.test(l)) {
    const buf = [];
    while (i < lignes.length && /^\s*-\s+/.test(lignes[i])) { buf.push(lignes[i].replace(/^\s*-\s+/, "")); i++; }
    out.push("<ul>" + buf.map((x) => `<li>${inline(x)}</li>`).join("") + "</ul>"); continue;
  }
  // Liste numérotée
  if (/^\s*\d+\.\s+/.test(l)) {
    const buf = [];
    while (i < lignes.length && /^\s*\d+\.\s+/.test(lignes[i])) { buf.push(lignes[i].replace(/^\s*\d+\.\s+/, "")); i++; }
    out.push("<ol>" + buf.map((x) => `<li>${inline(x)}</li>`).join("") + "</ol>"); continue;
  }
  // Ligne vide
  if (l.trim() === "") { i++; continue; }
  // Paragraphe (regroupe lignes consécutives)
  const buf = [l];
  i++;
  while (i < lignes.length && lignes[i].trim() !== "" && !/^(#{1,3}\s|>|\s*-\s|\s*\d+\.\s|\||```|---)/.test(lignes[i]) && lignes[i].trim() !== "[SOMMAIRE]") { buf.push(lignes[i]); i++; }
  const txt = buf.join(" ").trim();
  if (txt === "*" ) continue;
  out.push(`<p>${inline(txt)}</p>`);
}

// Sommaire cliquable
const tocHtml = '<nav class="toc"><p class="toc-t">Accès rapide</p><ul>' +
  toc.map((t) => `<li class="${t.niv === 3 ? "sub" : ""}"><a href="#${t.id}">${inline(t.txt)}</a></li>`).join("") +
  "</ul></nav>";

let body = out.join("\n").replace("[[TOC]]", tocHtml);
// Le tout premier <h1> reste dans le corps (comme l'ancien).

const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>GesSchool — Mode d'emploi</title>
${style}
</head>
<body>
  <div class="cover"><div class="seal">GS</div><div><h1>GesSchool — Mode d'emploi</h1><p>Guide complet d'utilisation</p></div></div>
  <main>
${body}
  </main>
</body></html>`;

writeFileSync(SORTIE, html, "utf8");
console.log("public/mode-emploi.html régénéré :", html.length, "octets ·", toc.length, "entrées de sommaire");
console.log("→ servi par l'application à /mode-emploi.html après « npm run build ».");
