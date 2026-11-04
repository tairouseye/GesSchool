import { supabase } from "@/lib/supabase.js";

// GesSchool — recherche globale (Ctrl+K), lot 2 de l'audit du 31/10/2026.
//
// Une seule saisie pour retrouver : un ÉLÈVE (nom, prénom, matricule), un
// PARENT (nom ou téléphone — au guichet, on se présente avec son numéro),
// une FACTURE (numéro), ou un ÉCRAN du menu.
//
// ⚠️ AUCUN DROIT N'EST DÉCIDÉ ICI. Chaque lecture passe par la RLS : un
// rôle cloisonné à un cycle ne trouve que ses élèves, un enseignant n'a pas
// les factures. L'écran ne propose une catégorie que si le rôle ouvre la
// page qui la montre (`peutVoir`), pour ne pas mener à un refus.

const LIMITE = 5;

// Caractères réservés du filtre PostgREST (`or=(…)`), retirés de la saisie.
export const nettoyer = (q) => String(q || "").replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim();

// Un numéro se cherche par ses chiffres, quels que soient les espaces saisis
// ou enregistrés : « 77 123 45 67 », « 771234567 » et « +221 77… » se valent.
// On intercale un joker entre chaque chiffre. Au moins 4 chiffres : en
// dessous, presque tous les numéros correspondraient.
export function motifTelephone(q) {
  const ch = String(q || "").replace(/\D/g, "");
  return ch.length >= 4 ? `*${ch.split("").join("*")}*` : null;
}

/** Les écrans du menu dont le libellé contient tous les mots saisis. */
export function chercherPages(pages = [], q) {
  const mots = sansAccents(q).split(" ").filter(Boolean);
  if (mots.length === 0) return [];
  return pages.filter((p) => { const l = sansAccents(`${p.label} ${p.espace || ""} ${p.aide || ""}`); return mots.every((m) => l.includes(m)); }).slice(0, LIMITE);
}

export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Cherche en base, en parallèle. `voir` dit quelles catégories ce rôle peut
 * ouvrir : { eleves, parents, factures }. Une catégorie en échec est vide,
 * sans faire tomber les autres.
 */
export async function chercherPartout(ecoleId, q, voir = {}) {
  const m = nettoyer(q);
  if (!ecoleId || m.length < 2) return { eleves: [], parents: [], factures: [] };
  const tel = motifTelephone(m);
  const vide = Promise.resolve({ data: [] });
  //  « Aminata Diagne » : la base cherche le mot le plus long, puis on garde
  //  les lignes où TOUS les mots se retrouvent (prénom, nom, matricule).
  const mots = sansAccents(m).split(" ").filter(Boolean);
  const cle = m.split(" ").sort((a, b) => b.length - a.length)[0];
  const tousLesMots = (...champs) => { const t = sansAccents(champs.join(" ")); return mots.every((x) => t.includes(x)); };

  const [el, pa, fa] = await Promise.allSettled([
    voir.eleves
      ? supabase.from("eleves").select("id, prenom, nom, matricule, inscriptions(annee_id, annees_scolaires(courante), classes(libelle))")
          .eq("ecole_id", ecoleId)
          .or(`prenom.ilike.*${cle}*,nom.ilike.*${cle}*,matricule.ilike.*${cle}*`)
          .order("nom").limit(25)
      : vide,
    voir.parents
      ? supabase.from("tuteurs").select("id, prenom, nom, telephone, eleve_tuteurs(eleves(id, prenom, nom))")
          .eq("ecole_id", ecoleId)
          .or([`prenom.ilike.*${cle}*`, `nom.ilike.*${cle}*`, tel && `telephone.ilike.${tel}`].filter(Boolean).join(","))
          .order("nom").limit(25)
      : vide,
    voir.factures && /\d/.test(m)
      ? supabase.from("factures").select("id, numero, eleve_id, montant_total, montant_paye, statut, eleves(prenom, nom)")
          .eq("ecole_id", ecoleId).ilike("numero", `*${m}*`).order("date_emission", { ascending: false }).limit(LIMITE)
      : vide,
  ]);
  const lignes = (r) => (r.status === "fulfilled" && !r.value.error ? r.value.data ?? [] : []);
  return {
    eleves: lignes(el).filter((e) => tousLesMots(e.prenom, e.nom, e.matricule)).slice(0, LIMITE),
    //  Un parent trouvé par son numéro n'a pas à contenir les mots du nom.
    parents: lignes(pa).filter((t) => (tel && String(t.telephone || "").replace(/\D/g, "").includes(m.replace(/\D/g, "")))
      || tousLesMots(t.prenom, t.nom)).slice(0, LIMITE),
    factures: lignes(fa),
  };
}
