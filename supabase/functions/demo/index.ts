// =====================================================================
//  Edge Function « demo » — ouvrir la démonstration SANS COMPTE (mig. 216)
//
//    POST /functions/v1/demo   { "espace": "parent" | "direction" }
//    → { access_token, refresh_token }   (le client fait setSession)
//
//  AUCUN MOT DE PASSE. Un mot de passe partagé finirait dans le code de
//  l'appli, et un visiteur pourrait le CHANGER (auth.updateUser) et fermer
//  la démo à tous. Ici, la clé de service fabrique un lien de connexion
//  (generateLink, rien n'est envoyé par e-mail) et on l'échange aussitôt
//  contre une session (verifyOtp). Rien à voler, rien à changer.
//
//  Le compte est créé au premier appel s'il n'existe pas, et son marqueur
//  `app_metadata.demo` est reposé à chaque fois : c'est lui qui met la base
//  en lecture seule (trigger trg_demo_lecture_seule), il ne doit pas manquer.
//  Le profil, les rôles et le tuteur se posent ensuite avec
//  supabase/tests/demo_comptes.sql.
//
//  ⚠️ EN PRODUCTION, ELLE S'APPELLE « dynamic-endpoint » (nom donné par le
//  tableau de bord au déploiement, non modifiable) : src/lib/demo.js appelle
//  ce nom-là. Un redéploiement par la CLI doit donc viser dynamic-endpoint.
//
//  Déploiement (appelée AVANT toute connexion, donc sans JWT utilisateur) :
//    supabase functions deploy dynamic-endpoint --no-verify-jwt
//  SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis
//  automatiquement.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Les deux seuls comptes que cette fonction sait ouvrir.
const COMPTES: Record<string, string> = {
  parent: "demo.parent@gesprosn.org",
  direction: "demo.direction@gesprosn.org",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Retrouve le compte, ou le crée ; repose le marqueur dans les deux cas.
async function compteDemo(espace: string, email: string): Promise<void> {
  const { data: liste, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const u = liste.users.find((x) => x.email?.toLowerCase() === email);
  if (!u) {
    const { error: e } = await admin.auth.admin.createUser({
      email, email_confirm: true, app_metadata: { demo: espace },
    });
    if (e) throw e;
  } else if (u.app_metadata?.demo !== espace) {
    const { error: e } = await admin.auth.admin.updateUserById(u.id, {
      app_metadata: { ...u.app_metadata, demo: espace },
    });
    if (e) throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non permise." }, 405);
  try {
    const { espace } = await req.json().catch(() => ({}));
    const email = COMPTES[espace as string];
    if (!email) return json({ error: "Espace de démonstration inconnu." }, 400);

    await compteDemo(espace, email);

    const { data: lien, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (e1) throw e1;

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error: e2 } = await anon.auth.verifyOtp({
      token_hash: lien.properties.hashed_token, type: "magiclink",
    });
    if (e2 || !data.session) throw e2 ?? new Error("Session non ouverte.");

    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
