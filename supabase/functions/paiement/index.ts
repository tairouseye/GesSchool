// =====================================================================
//  Edge Function « paiement » — paiement en ligne (CinetPay | PayDunya)
//
//  Deux routes :
//    POST /functions/v1/paiement/initier   (JWT parent)  → renvoie l'URL de paiement
//    POST /functions/v1/paiement/webhook   (public)      → confirme et solde la facture
//
//  Sécurité : on ne fait JAMAIS confiance au corps du webhook. À réception,
//  on RAPPELLE l'API du prestataire (/v2/payment/check chez CinetPay,
//  /checkout-invoice/confirm chez PayDunya) avec NOTRE référence, et c'est
//  ce statut qui fait foi. Idempotence garantie par le passage atomique de
//  la transaction 'initiee' → 'reussie' (une seule insertion dans paiements).
//
//  Déploiement (le webhook doit être public) :
//    supabase functions deploy paiement --no-verify-jwt
//  Le JWT du parent est vérifié MANUELLEMENT dans /initier.
//
//  Réfs API :
//    CinetPay : https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation
//               https://docs.cinetpay.com/api/1.0-fr/checkout/verification
//    PayDunya : https://developers.paydunya.com/doc/FR/http_json
//  ⚠️ Les noms de champs sont à confirmer en BAC À SABLE avant la production.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// URL publique de l'app (pour le retour du parent après paiement).
const APP_URL = Deno.env.get("APP_URL") ?? "https://gesschool.gesprosn.org";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// XOF : les montants doivent être des entiers multiples de 5.
const arrondi5 = (n: number) => Math.round(n / 5) * 5;

// Mappe le moyen de paiement du prestataire vers l'enum mode_paiement.
function modeDepuisMethode(m?: string): string {
  const s = (m || "").toLowerCase();
  if (s.includes("wave")) return "wave";
  if (s.includes("orange")) return "orange_money";
  if (s.includes("free") || s.includes("flooz") || s.includes("moov")) return "free_money";
  if (s.includes("card") || s.includes("visa") || s.includes("master") || s.includes("carte")) return "carte";
  return "virement";
}

// --------------------------------------------------------------------
//  Adaptateurs prestataires
// --------------------------------------------------------------------
type Cfg = {
  prestataire: string; api_key: string; site_id: string;
  secret_webhook: string | null; mode: string;
};
type InitParams = {
  reference: string; montant: number; devise: string; description: string;
  notifyUrl: string; returnUrl: string;
  clientNom: string; clientTel: string; clientEmail: string; paysISO: string;
};

const CINETPAY = {
  async initier(cfg: Cfg, p: InitParams) {
    const r = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: cfg.api_key, site_id: cfg.site_id,
        transaction_id: p.reference, amount: p.montant, currency: p.devise,
        description: p.description, notify_url: p.notifyUrl, return_url: p.returnUrl,
        channels: "ALL", lang: "fr", metadata: p.reference,
        customer_name: p.clientNom, customer_surname: "-",
        customer_email: p.clientEmail, customer_phone_number: p.clientTel,
        customer_country: p.paysISO,
      }),
    });
    const d = await r.json();
    const url = d?.data?.payment_url;
    if (!url) throw new Error(`CinetPay init: ${d?.message || d?.description || "réponse inattendue"}`);
    return { paymentUrl: url as string, token: d?.data?.payment_token ?? null };
  },
  // Rappelle CinetPay avec NOTRE transaction_id → statut faisant foi.
  async verifier(cfg: Cfg, ref: string, _token: string | null) {
    const r = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: cfg.api_key, site_id: cfg.site_id, transaction_id: ref }),
    });
    const d = await r.json();
    const status = (d?.data?.status || "").toUpperCase();
    return {
      reussi: status === "ACCEPTED",
      montant: Number(d?.data?.amount) || 0,
      methode: d?.data?.payment_method as string | undefined,
    };
  },
};

const PAYDUNYA = {
  base(cfg: Cfg) {
    return cfg.mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  },
  headers(cfg: Cfg) {
    // Les 3 clés PayDunya sont concaténées dans secret_webhook au format
    // "master|private|token" (master + private + token), api_key = master de secours.
    const [master, priv, token] = (cfg.secret_webhook || "").split("|");
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": master || cfg.site_id,
      "PAYDUNYA-PRIVATE-KEY": priv || cfg.api_key,
      "PAYDUNYA-TOKEN": token || "",
      "PAYDUNYA-MODE": cfg.mode === "live" ? "live" : "test",
    };
  },
  async initier(cfg: Cfg, p: InitParams) {
    const r = await fetch(`${this.base(cfg)}/checkout-invoice/create`, {
      method: "POST", headers: this.headers(cfg),
      body: JSON.stringify({
        invoice: { total_amount: p.montant, description: p.description },
        store: { name: "GesSchool" },
        actions: { callback_url: p.notifyUrl, return_url: p.returnUrl, cancel_url: p.returnUrl },
        custom_data: { reference: p.reference },
      }),
    });
    const d = await r.json();
    const url = d?.response_text;
    if (String(d?.response_code) !== "00" || !url) throw new Error(`PayDunya init: ${d?.response_text || "réponse inattendue"}`);
    return { paymentUrl: url as string, token: (d?.token as string) ?? null };
  },
  // Rappelle PayDunya avec le token d'invoice → statut faisant foi.
  async verifier(cfg: Cfg, _ref: string, token: string | null) {
    if (!token) return { reussi: false, montant: 0, methode: undefined };
    const r = await fetch(`${this.base(cfg)}/checkout-invoice/confirm/${token}`, { headers: this.headers(cfg) });
    const d = await r.json();
    return {
      reussi: (d?.status || "").toLowerCase() === "completed",
      montant: Number(d?.invoice?.total_amount) || 0,
      methode: d?.mode as string | undefined,
    };
  },
};

const ADAPTATEURS: Record<string, typeof CINETPAY | typeof PAYDUNYA> = {
  cinetpay: CINETPAY, paydunya: PAYDUNYA,
};

// --------------------------------------------------------------------
//  /initier — le parent demande un lien de paiement
// --------------------------------------------------------------------
async function handleInitier(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return json({ error: "Non authentifié." }, 401);

  const { facture_id, montant } = await req.json().catch(() => ({}));
  if (!facture_id || !montant || montant <= 0) return json({ error: "Paramètres invalides." }, 400);

  // Propriété : ce parent est-il tuteur de l'élève de cette facture ?
  const { data: fac } = await admin
    .from("factures")
    .select("id, ecole_id, eleve_id, montant_total, montant_paye, numero, eleves(prenom, nom)")
    .eq("id", facture_id).maybeSingle();
  if (!fac) return json({ error: "Facture introuvable." }, 404);

  const { data: lien } = await admin
    .from("eleve_tuteurs")
    .select("tuteurs!inner(profil_id, telephone, email)")
    .eq("eleve_id", fac.eleve_id);
  const tuteur = (lien || []).map((l: any) => l.tuteurs).find((t: any) => t?.profil_id === uid);
  if (!tuteur) return json({ error: "Accès refusé." }, 403);

  const reste = (Number(fac.montant_total) || 0) - (Number(fac.montant_paye) || 0);
  const base = Math.min(Number(montant), reste);
  if (base <= 0) return json({ error: "Cette facture est déjà soldée." }, 400);

  // Config prestataire de l'école (secrets — lus avec le service role).
  const { data: cfg } = await admin.from("psp_config").select("*").eq("ecole_id", fac.ecole_id).maybeSingle();
  if (!cfg || !cfg.actif || !cfg.api_key) return json({ error: "Paiement en ligne non activé pour cette école." }, 400);

  // Commission : à la charge du parent → ajoutée au montant appelé.
  const frais = cfg.commission_a_charge === "parent" ? arrondi5(base * (Number(cfg.commission_taux) || 0)) : 0;
  const montantAppel = arrondi5(base + frais);

  const reference = `GS-${String(fac.id).replace(/-/g, "").slice(0, 10)}-${Date.now()}`;

  // Trace AVANT l'appel prestataire (statut 'initiee').
  const { data: tx, error: eTx } = await admin.from("transactions_paiement").insert({
    ecole_id: fac.ecole_id, facture_id: fac.id, eleve_id: fac.eleve_id,
    montant: base, frais, prestataire: cfg.prestataire, reference_psp: reference,
    statut: "initiee", initiee_par: uid,
  }).select("id").single();
  if (eTx) return json({ error: "Impossible d'enregistrer la transaction." }, 500);

  const adapt = ADAPTATEURS[cfg.prestataire] || CINETPAY;
  const notifyUrl = `${SUPABASE_URL}/functions/v1/paiement/webhook`;
  const returnUrl = `${APP_URL}/#/parent/enfant/${fac.eleve_id}?paiement=retour`;
  try {
    const res = await adapt.initier(cfg as Cfg, {
      reference, montant: montantAppel, devise: "XOF",
      description: `Scolarité ${fac.numero || ""} — ${fac.eleves?.prenom || ""} ${fac.eleves?.nom || ""}`.trim(),
      notifyUrl, returnUrl,
      clientNom: `${fac.eleves?.prenom || ""} ${fac.eleves?.nom || ""}`.trim() || "Parent",
      clientTel: (tuteur.telephone || "").replace(/\D/g, "") || "770000000",
      clientEmail: tuteur.email || "parent@gesschool.app",
      paysISO: "SN",
    });
    await admin.from("transactions_paiement").update({ payload: { token: res.token } }).eq("id", tx.id);
    return json({ payment_url: res.paymentUrl, montant: base, frais });
  } catch (e) {
    await admin.from("transactions_paiement").update({ statut: "echouee", payload: { erreur: String(e) } }).eq("id", tx.id);
    return json({ error: "Le prestataire de paiement a refusé l'initialisation." }, 502);
  }
}

// --------------------------------------------------------------------
//  /webhook — le prestataire confirme (public). On re-vérifie côté serveur.
// --------------------------------------------------------------------
async function handleWebhook(req: Request) {
  // Le corps peut être form-encodé (CinetPay : cpm_trans_id) ou JSON (PayDunya).
  let ref = ""; let token = "";
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const b = await req.json();
      ref = b?.cpm_trans_id || b?.data?.custom_data?.reference || b?.custom_data?.reference || "";
      token = b?.data?.invoice_token || b?.token || "";
    } else {
      const f = await req.formData();
      ref = String(f.get("cpm_trans_id") || f.get("reference") || "");
      token = String(f.get("token") || "");
    }
  } catch { /* corps illisible : on tentera par ref vide → 200 */ }

  if (!ref && !token) return json({ ok: true }); // rien à faire, on acquitte

  // Retrouve la transaction (par notre référence, ou par le token stocké).
  let q = admin.from("transactions_paiement").select("*");
  q = ref ? q.eq("reference_psp", ref) : q.contains("payload", { token });
  const { data: tx } = await q.maybeSingle();
  if (!tx) return json({ ok: true }); // inconnue → acquittement neutre
  if (tx.statut === "reussie") return json({ ok: true }); // déjà traitée (idempotent)

  const { data: cfg } = await admin.from("psp_config").select("*").eq("ecole_id", tx.ecole_id).maybeSingle();
  if (!cfg) return json({ ok: true });

  // VÉRIFICATION FAISANT FOI : on rappelle le prestataire.
  const adapt = ADAPTATEURS[cfg.prestataire] || CINETPAY;
  const v = await adapt.verifier(cfg as Cfg, tx.reference_psp, tx.payload?.token || token || null);

  if (!v.reussi || v.montant < Number(tx.montant)) {
    await admin.from("transactions_paiement").update({ statut: "echouee", payload: { ...tx.payload, verif: v } }).eq("id", tx.id);
    return json({ ok: true });
  }

  // Claim ATOMIQUE : 'initiee' → 'reussie'. Si 0 ligne, une autre requête a
  // déjà encaissé → on n'insère pas de second paiement (anti-double-crédit).
  const { data: claim } = await admin.from("transactions_paiement")
    .update({ statut: "reussie", reglee_le: new Date().toISOString() })
    .eq("id", tx.id).eq("statut", "initiee").select("id");
  if (!claim || claim.length === 0) return json({ ok: true });

  // Crédite la facture (le trigger recalc_facture met à jour le solde/statut).
  const { data: pai, error: ep } = await admin.from("paiements").insert({
    ecole_id: tx.ecole_id, facture_id: tx.facture_id, montant: tx.montant,
    mode: modeDepuisMethode(v.methode), reference: tx.reference_psp,
    date_paiement: new Date().toISOString().slice(0, 10),
  }).select("id").single();
  if (ep) {
    // On remet la transaction en 'initiee' pour permettre un nouveau passage.
    await admin.from("transactions_paiement").update({ statut: "initiee" }).eq("id", tx.id);
    return json({ ok: false });
  }
  await admin.from("transactions_paiement").update({ paiement_id: pай.id }).eq("id", tx.id);

  // Notifie les parents (déclenche le push existant).
  const { data: lien } = await admin.from("eleve_tuteurs")
    .select("tuteurs!inner(profil_id)").eq("eleve_id", tx.eleve_id);
  const dests = (lien || []).map((l: any) => l.tuteurs?.profil_id).filter(Boolean);
  const fmt = new Intl.NumberFormat("fr-FR").format(Number(tx.montant));
  for (const d of dests) {
    await admin.from("notifications").insert({
      ecole_id: tx.ecole_id, destinataire_id: d,
      titre: "Paiement reçu", message: `Votre paiement de ${fmt} XOF a bien été enregistré. Merci.`,
    });
  }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/webhook")) return await handleWebhook(req);
    if (path.endsWith("/initier")) return await handleInitier(req);
    return json({ error: "Route inconnue." }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
