// =====================================================================
//  Edge Function « parent-telephone » — activer l'accès d'un parent par son
//  NUMÉRO DE TÉLÉPHONE (mig. 221), sans SMS.
//
//    POST /functions/v1/parent-telephone
//    { "telephone": "77 123 45 67", "code": "A1B2C3D4", "mot_de_passe": "…" }
//    → { ok: true }  puis le client se connecte (numéro + mot de passe)
//    → { statut: "code_invalide" | "a_verifier" | "compte_email" | … , erreur }
//
//  Sert deux fois : à la PREMIÈRE connexion et après un MOT DE PASSE OUBLIÉ
//  (l'école remet un nouveau code). La preuve est toujours le code parent ;
//  le numéro seul ne permet rien.
//
//  Le compte porte l'adresse technique « 221XXXXXXXXX@tel.gesprosn.org »
//  (aucun courriel n'y part : email_confirm est posé à la création).
//
//  Déploiement (appelée AVANT toute connexion, donc sans JWT utilisateur) :
//    tableau de bord Supabase → Edge Functions → nom « parent-telephone »,
//    « Verify JWT » DÉCOCHÉ. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont
//    fournis automatiquement.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Même règle que tel_normalise (mig. 221) et src/lib/connexionTelephone.js.
function normaliser(t: string): string | null {
  const d = String(t || "").replace(/\D/g, "");
  const n = /^00221\d{9}$/.test(d) ? d.slice(5) : /^221\d{9}$/.test(d) ? d.slice(3) : d;
  return /^\d{9}$/.test(n) ? n : null;
}

const MESSAGES: Record<string, string> = {
  code_invalide: "Ce code ne correspond pas à ce numéro. Vérifiez-les, ou demandez un nouveau code à l'école.",
  a_verifier: "L'école a enregistré ce numéro pour plusieurs familles. Pour protéger les informations des enfants, la connexion par ce numéro est suspendue jusqu'à ce que l'école corrige la fiche.",
  compte_email: "Vous avez déjà un compte avec votre adresse e-mail : connectez-vous avec elle.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erreur: "Méthode non permise." }, 405);
  try {
    const { telephone, code, mot_de_passe } = await req.json();
    const tel = normaliser(telephone);
    if (!tel) return json({ statut: "telephone_invalide", erreur: "Numéro invalide : 9 chiffres, par exemple 77 123 45 67." });
    if (!code || String(code).trim().length < 6) return json({ statut: "code_invalide", erreur: MESSAGES.code_invalide });
    if (!mot_de_passe || String(mot_de_passe).length < 8) {
      return json({ statut: "mot_de_passe", erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    // 1. Le code correspond-il à ce numéro, et à une seule personne ?
    const { data: v, error: e1 } = await admin.rpc("_verifier_activation_telephone", { p_tel: tel, p_code: code });
    if (e1) throw e1;
    if (v?.statut !== "ok") return json({ statut: v?.statut, erreur: MESSAGES[v?.statut] || "Activation impossible." });

    // 2. Le compte : créé la première fois, mot de passe remplacé ensuite.
    const email = `221${tel}@tel.gesprosn.org`;
    const { data: uid, error: e2 } = await admin.rpc("_uid_compte_telephone", { p_tel: tel });
    if (e2) throw e2;
    let id = uid as string | null;
    if (id) {
      const { error } = await admin.auth.admin.updateUserById(id, { password: mot_de_passe });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password: mot_de_passe, email_confirm: true,
        user_metadata: { telephone: tel, prenom: v.prenom, nom: v.nom },
        app_metadata: { connexion: "telephone" },
      });
      if (error) throw error;
      id = data.user.id;
    }

    // 3. Relier toutes ses fiches, effacer le code.
    const { data: l, error: e3 } = await admin.rpc("_lier_parent_telephone", { p_uid: id, p_tel: tel, p_code: code });
    if (e3) throw e3;
    if (l?.statut !== "ok") return json({ statut: l?.statut, erreur: MESSAGES[l?.statut] || "Activation impossible." });
    return json({ ok: true, fiches: l.fiches });
  } catch (e) {
    console.error(e);
    return json({ erreur: "Service momentanément indisponible. Réessayez dans un instant." }, 500);
  }
});
