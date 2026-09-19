import { supabase } from "@/lib/supabase.js";

// GesSchool — emploi du temps du supérieur (migration 138).
//
// Planifié par filière / semestre / UE, et non par classe : l'université n'en
// a pas. C'est pourquoi `emplois_du_temps` (le modèle scolaire) ne pouvait pas
// servir, et que l'entrée de menu y restait masquée au supérieur.

export const JOURS = [
  [1, "Lundi"], [2, "Mardi"], [3, "Mercredi"],
  [4, "Jeudi"], [5, "Vendredi"], [6, "Samedi"], [7, "Dimanche"],
];
export const TYPES_SEANCE = [["CM", "Cours magistral"], ["TD", "Travaux dirigés"], ["TP", "Travaux pratiques"], ["autre", "Autre"]];

export const libJour = (j) => JOURS.find(([v]) => v === Number(j))?.[1] || "—";
export const heure = (h) => (h ? String(h).slice(0, 5) : "—");

// Séances d'un semestre, avec de quoi les afficher sans requête supplémentaire.
export async function getSeances(ecoleId, semestreId, anneeId = null) {
  if (!ecoleId || !semestreId) return [];
  let req = supabase
    .from("emplois_sup")
    .select("*, ue(code, intitule), ecue(intitule), enseignants(prenom, nom)")
    .eq("ecole_id", ecoleId)
    .eq("semestre_id", semestreId);
  if (anneeId) req = req.eq("annee_id", anneeId);
  const { data, error } = await req.order("jour").order("heure_debut");
  if (error) throw error;
  return data ?? [];
}

export async function enregistrerSeance(ecoleId, s) {
  const { id, ...reste } = s;
  const req = id
    ? supabase.from("emplois_sup").update(reste).eq("id", id)
    : supabase.from("emplois_sup").insert({ ecole_id: ecoleId, ...reste });
  const { error } = await req;
  if (error) throw error;
}

export async function supprimerSeance(id) {
  const { error } = await supabase.from("emplois_sup").delete().eq("id", id);
  if (error) throw error;
}

// L'emploi du temps de l'étudiant connecté (RPC : les tables de la maquette
// lui sont fermées, cf. migration 129 pour le même raisonnement).
export async function monEmploi() {
  const { data, error } = await supabase.rpc("mon_emploi_sup");
  if (error) throw error;
  return data ?? [];
}

// Regroupe des séances par jour, dans l'ordre de la semaine.
export function parJour(seances = []) {
  return JOURS
    .map(([j, libelle]) => ({
      jour: j, libelle,
      seances: seances.filter((s) => Number(s.jour) === j)
        .sort((a, b) => String(a.heure_debut).localeCompare(String(b.heure_debut))),
    }))
    .filter((d) => d.seances.length > 0);
}

// Deux séances du même jour se chevauchent-elles ? Une salle occupée deux
// fois, ou un étudiant convoqué à deux endroits, ne se voit pas à la lecture
// d'une liste — il faut le signaler.
export function chevauchements(seances = []) {
  const conflits = new Set();
  for (let i = 0; i < seances.length; i++) {
    for (let j = i + 1; j < seances.length; j++) {
      const a = seances[i], b = seances[j];
      if (Number(a.jour) !== Number(b.jour)) continue;
      if (String(a.heure_debut) < String(b.heure_fin) && String(b.heure_debut) < String(a.heure_fin)) {
        conflits.add(a.id); conflits.add(b.id);
      }
    }
  }
  return conflits;
}
