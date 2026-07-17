// Convertit docs/mode-emploi.md -> docs/mode-emploi.html en réutilisant le
// style du HTML existant + sommaire cliquable (remplace [SOMMAIRE]).
import { readFileSync, writeFileSync } from "node:fs";

const DOCS = "C:/Users/bmd tech/GesSchool/docs";
const md = readFileSync(`${DOCS}/mode-emploi.md`, "utf8").replace(/\r/g, "");
const ancien = readFileSync(`${DOCS}/mode-emploi.html`, "utf8");
const style = (ancien.match(/<style>[\s\S]*?<\/style>/) || ["<style></style>"])[0];

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

writeFileSync(`${DOCS}/mode-emploi.html`, html, "utf8");
console.log("mode-emploi.html régénéré :", html.length, "octets ·", toc.length, "entrées de sommaire");
