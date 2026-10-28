import { supabase } from "@/lib/supabase.js";

// GesSchool — encarts partenaires de l'écran de connexion (migration 215).
// La connexion lit `encarts_connexion()` (public, encarts en cours seulement) ;
// la console super-admin gère la table.

// Ce que l'écran de connexion affiche. Un échec (hors ligne, migration pas
// encore appliquée) ne doit jamais gêner la connexion : on rend [].
export async function getEncartsConnexion() {
  try {
    const { data, error } = await supabase.rpc("encarts_connexion");
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getEncarts() {
  const { data, error } = await supabase
    .from("encarts_partenaires")
    .select("*")
    .order("debut", { ascending: false })
    .order("ordre");
  if (error) throw error;
  return data ?? [];
}

const champs = (e) => ({
  partenaire: e.partenaire.trim(),
  message: e.message.trim(),
  lien: e.lien?.trim() || null,
  logo_url: e.logo_url || null,
  debut: e.debut,
  fin: e.fin || null,
  actif: !!e.actif,
  ordre: Number(e.ordre) || 0,
});

export async function enregistrerEncart(e) {
  const req = e.id
    ? supabase.from("encarts_partenaires").update(champs(e)).eq("id", e.id)
    : supabase.from("encarts_partenaires").insert(champs(e));
  const { error } = await req;
  if (error) throw error;
}

export async function supprimerEncart(id) {
  const { error } = await supabase.from("encarts_partenaires").delete().eq("id", id);
  if (error) throw error;
}

// Logo dans le bucket public `ecoles` (branding), sous partenaires/.
export async function televerserLogoPartenaire(file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const chemin = `partenaires/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("ecoles").upload(chemin, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from("ecoles").getPublicUrl(chemin).data.publicUrl;
}

// En cours / à venir / terminé / désactivé, pour la liste de la console.
export function etatEncart(e, aujourdhui = new Date().toISOString().slice(0, 10)) {
  if (!e.actif) return "desactive";
  if (e.debut > aujourdhui) return "a_venir";
  if (e.fin && e.fin < aujourdhui) return "termine";
  return "en_cours";
}
