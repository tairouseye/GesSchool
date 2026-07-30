import { getMembres } from "@/lib/membres.js";
import { getPersonnels } from "@/lib/rh.js";
import { LIBELLES_ROLES } from "@/lib/permissions.js";

// GesSchool — organigramme AUTO de l'école. Aucune ressaisie : on fusionne
// les comptes (membres + rôles) et le personnel RH (fiches, avec ou sans
// compte), puis on classe chacun dans sa section selon son rôle/sa fonction.
// Modifier un rôle dans Membres suffit → l'organigramme suit.

// Sections d'encadrement (alignées sur les espaces d'usage).
export const SECTIONS = [
  { id: "pedagogie", label: "Pédagogie", icone: "🎓", chef: "direction", equipe: ["enseignant", "surveillant"] },
  { id: "gestion",   label: "Gestion",   icone: "💼", chef: "comptable", equipe: ["secretaire"] },
  { id: "rh",        label: "RH & Paie",  icone: "🧑‍💼", chef: "rh",       equipe: [] },
];

// Fonction RH (texte libre) → section. Insensible aux accents/casse.
function sectionDeFonction(fonction) {
  const f = (fonction || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/enseign|professeur|instituteur|maitre/.test(f)) return { section: "pedagogie", role: "enseignant" };
  if (/surveil|censeur|discipline|educateur/.test(f)) return { section: "pedagogie", role: "surveillant" };
  if (/compt|caiss|financ|econome/.test(f)) return { section: "gestion", role: "comptable" };
  if (/secret|accueil|scolarite/.test(f)) return { section: "gestion", role: "secretaire" };
  if (/\brh\b|ressources humaines|paie|personnel/.test(f)) return { section: "rh", role: "rh" };
  return null; // agent, chauffeur, gardien… → « Autres »
}

const estPromoteur = (roles = []) => roles.includes("admin_ecole") || roles.includes("super_admin");

// Détermine (section, estChef) pour un ensemble de rôles de compte.
function placerParRoles(roles = []) {
  for (const s of SECTIONS) {
    if (roles.includes(s.chef)) return { section: s.id, chef: true };
  }
  for (const s of SECTIONS) {
    if (roles.some((r) => s.equipe.includes(r))) return { section: s.id, chef: false };
  }
  return null;
}

const nomComplet = (p) => `${p.prenom || ""} ${p.nom || ""}`.trim() || p.email || "—";
const roleLisible = (roles = []) => roles.map((r) => LIBELLES_ROLES[r] || r).filter(Boolean)[0] || "";

export async function getOrganigramme(ecoleId) {
  const [membres, personnels] = await Promise.all([
    getMembres().catch(() => []),
    getPersonnels(ecoleId).catch(() => []),
  ]);

  // 1) Nœuds à partir des comptes (indexés par profil id).
  const parProfil = new Map();
  const noeuds = [];
  for (const m of membres) {
    const n = {
      cle: `m:${m.id}`, profilId: m.id, nom: nomComplet(m),
      roles: m.roles || [], fonction: null, compte: true,
      titre: roleLisible(m.roles) || "—",
    };
    parProfil.set(m.id, n);
    noeuds.push(n);
  }

  // 2) Personnel RH : enrichit le compte lié, sinon nœud « sans compte ».
  for (const p of personnels) {
    if (p.profil_id && parProfil.has(p.profil_id)) {
      const n = parProfil.get(p.profil_id);
      if (!n.fonction) n.fonction = p.fonction || null;
    } else {
      noeuds.push({
        cle: `p:${p.id}`, profilId: null, nom: nomComplet(p),
        roles: [], fonction: p.fonction || null, compte: false,
        titre: p.fonction || "Personnel",
      });
    }
  }

  // 3) Classement.
  const promoteurs = [];
  const sections = SECTIONS.map((s) => ({ ...s, responsable: null, equipe: [] }));
  const idx = Object.fromEntries(sections.map((s) => [s.id, s]));
  const autres = [];

  for (const n of noeuds) {
    if (n.compte && estPromoteur(n.roles)) { promoteurs.push(n); continue; }

    let cible = n.compte ? placerParRoles(n.roles) : null;
    if (!cible && n.fonction) {
      const f = sectionDeFonction(n.fonction);
      if (f) cible = { section: f.section, chef: false };
    }
    if (!cible) { autres.push(n); continue; }

    const s = idx[cible.section];
    if (cible.chef && !s.responsable) s.responsable = n;
    else s.equipe.push(n);
  }

  return { promoteurs, sections, autres };
}
