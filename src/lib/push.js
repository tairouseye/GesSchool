import { supabase } from "@/lib/supabase.js";

// Clé publique VAPID (publique — la clé privée est un secret de la fonction edge).
const VAPID_PUBLIC = "BJHkQ5Zf9rNfxVVO-bSV57UKVJZvjyKfXYobfB_AJuUs4coNN9vCxh91oz5nRSLIIdtQwfG4dlAmuIXtbRZuUOo";

function toUint8(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupporte() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function etatPush() {
  if (!pushSupporte()) return "non_supporte";
  if (Notification.permission === "denied") return "refuse";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? "actif" : "inactif";
}

export async function activerPush() {
  if (!pushSupporte()) throw new Error("Notifications non supportées sur cet appareil.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Autorisation refusée.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID_PUBLIC) });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté.");
  const { error } = await supabase.from("push_subscriptions").upsert(
    { profil_id: user.id, endpoint: sub.endpoint, subscription: sub.toJSON() },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function desactiverPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
