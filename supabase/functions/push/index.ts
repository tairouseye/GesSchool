import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Envoi de notifications push (web push) aux abonnements d'un destinataire.
// Déclenchée par pg_net après insertion dans `notifications`.
// Secrets requis : VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT.
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@gesschool.app";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response("VAPID keys not configured", { status: 200 });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const body = await req.json().catch(() => ({}));
    const rec = body.record ?? body;
    const destinataire = rec?.destinataire_id;
    if (!destinataire) return new Response("no recipient", { status: 200 });

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("subscription, endpoint")
      .eq("profil_id", destinataire);

    const payload = JSON.stringify({
      title: rec.titre ?? "GesSchool",
      body: rec.message ?? "",
      url: "./",
    });

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, payload);
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 200 });
  }
});
