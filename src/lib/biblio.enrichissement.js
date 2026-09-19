import { normaliserAnnee, normaliserIsbn } from "@/lib/biblio.import.js";

// GesSchool — Bibliothèque : enrichissement d'une notice depuis un ISBN ou un
// DOI (Open Library et Crossref, tous deux publics, sans clé ni compte).
//
// Séparation volontaire : les FONCTIONS DE CORRESPONDANCE sont pures et
// testées (c'est là que les formats étranges font mal), le réseau se limite à
// trois lignes par source. Aucune donnée de l'établissement ne sort : on
// n'envoie qu'un ISBN ou un DOI, qui sont des identifiants publics.

const OPENLIBRARY = "https://openlibrary.org/api/books";
const CROSSREF = "https://api.crossref.org/works";

// Une personne, telle que ces bases la renvoient.
//
// Open Library donne un nom entier (« Antoine de Saint-Exupéry ») sans dire où
// s'arrête le prénom. Deviner en coupant au dernier espace produirait
// « de Saint / Exupéry ». On applique donc la MÊME règle qu'à l'import : on ne
// sépare que devant une virgule explicite, sinon on garde le nom entier. Le
// bibliothécaire corrige en un clic, ce qu'aucune heuristique ne garantit.
export function auteurDepuisNom(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const bouts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (bouts.length === 2) return { nom: bouts[0], prenom: bouts[1] };
  return { nom: s, prenom: null };
}

// --- Open Library (ISBN) ----------------------------------------------------
export function mapperOpenLibrary(json, isbn) {
  const cle = `ISBN:${normaliserIsbn(isbn) || ""}`;
  const d = json?.[cle] || Object.values(json || {})[0];
  if (!d) return null;
  return {
    titre: String(d.title || "").trim(),
    sous_titre: String(d.subtitle || "").trim() || null,
    editeur: (d.publishers || []).map((p) => p?.name).filter(Boolean).join(", ") || null,
    annee_pub: normaliserAnnee(d.publish_date),
    auteurs: (d.authors || []).map((a) => auteurDepuisNom(a?.name)).filter(Boolean),
    // Les « subjects » d'Open Library sont nombreux et bruités : on en garde
    // une poignée, sinon la notice se retrouve avec quarante mots-clés.
    mots_cles: (d.subjects || []).map((s) => s?.name).filter(Boolean).slice(0, 8),
    source: "Open Library",
  };
}

// --- Crossref (DOI) ---------------------------------------------------------
export function mapperCrossref(json) {
  const m = json?.message;
  if (!m) return null;
  const parts = m.issued?.["date-parts"]?.[0];
  return {
    titre: String((m.title || [])[0] || "").trim(),
    sous_titre: String((m.subtitle || [])[0] || "").trim() || null,
    editeur: String(m.publisher || "").trim() || null,
    annee_pub: parts?.[0] ? normaliserAnnee(String(parts[0])) : null,
    auteurs: (m.author || []).map((a) => {
      const nom = String(a?.family || "").trim();
      const prenom = String(a?.given || "").trim() || null;
      // Certaines entrées n'ont qu'un nom d'organisme.
      return nom ? { nom, prenom } : auteurDepuisNom(a?.name);
    }).filter(Boolean),
    mots_cles: (m.subject || []).filter(Boolean).slice(0, 8),
    doi: String(m.DOI || "").trim() || null,
    revue: String((m["container-title"] || [])[0] || "").trim() || null,
    volume: String(m.volume || "").trim() || null,
    numero: String(m.issue || "").trim() || null,
    pages: String(m.page || "").trim() || null,
    source: "Crossref",
  };
}

// Un DOI peut être collé sous forme d'URL : on ne garde que l'identifiant.
export function normaliserDoi(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/10\.\d{4,9}\/\S+/i);
  return m ? m[0].replace(/[.,;)\]]+$/, "") : null;
}

// --- Réseau -----------------------------------------------------------------
async function json(url, signal) {
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Service indisponible (${r.status}).`);
  return r.json();
}

export async function chercherParIsbn(isbn, { signal } = {}) {
  const n = normaliserIsbn(isbn);
  if (!n) throw new Error("ISBN vide.");
  const d = await json(`${OPENLIBRARY}?bibkeys=ISBN:${encodeURIComponent(n)}&format=json&jscmd=data`, signal);
  const map = mapperOpenLibrary(d, n);
  if (!map?.titre) throw new Error("Aucune notice trouvée pour cet ISBN.");
  return { ...map, isbn: n };
}

export async function chercherParDoi(doi, { signal } = {}) {
  const n = normaliserDoi(doi);
  if (!n) throw new Error("DOI invalide.");
  const d = await json(`${CROSSREF}/${encodeURIComponent(n)}`, signal);
  const map = mapperCrossref(d);
  if (!map?.titre) throw new Error("Aucune notice trouvée pour ce DOI.");
  return map;
}
