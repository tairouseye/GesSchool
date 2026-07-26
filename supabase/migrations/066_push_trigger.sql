-- =====================================================================
--  066 — Déclencheur d'envoi PUSH (le maillon manquant)
--
--  L'infra web push existe (fonction edge `push`, service worker,
--  abonnements), mais RIEN ne l'appelait quand une notification était
--  créée : les appareils abonnés ne recevaient jamais rien. Ce trigger
--  ferme la boucle : à chaque insertion dans `notifications`, il POST la
--  ligne vers la fonction `push` via pg_net.
--
--  Ainsi, TOUT ce qui crée une notification est automatiquement poussé sur
--  les téléphones : rappels de paiement (cron `executer_relances` selon les
--  paliers réglés par le gestionnaire), paiement reçu, nouvelle note, etc.
--
--  Sécurité : la fonction `push` est publique (appelée par la base, pas par
--  un utilisateur). On envoie un en-tête secret `x-push-secret` que la
--  fonction vérifie (env PUSH_HOOK_SECRET). URL et secret sont lus depuis
--  des réglages de base (jamais en clair dans cette migration).
--
--  ⚠️ Prérequis (une fois, cf. bloc CONFIGURATION plus bas) :
--    - extension pg_net activée,
--    - réglages `app.push_url` et `app.push_secret` définis,
--    - fonction `push` déployée avec le secret PUSH_HOOK_SECRET = app.push_secret.
-- =====================================================================

create extension if not exists pg_net;

create or replace function public.trg_notifications_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text := current_setting('app.push_url', true);
  v_secret text := current_setting('app.push_secret', true);
begin
  -- Non configuré → on ne fait rien (la cloche in-app fonctionne quand même).
  if v_url is null or v_url = '' then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('record', jsonb_build_object(
                 'destinataire_id', new.destinataire_id,
                 'titre',           new.titre,
                 'message',         new.message)),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-push-secret', coalesce(v_secret, '')),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Un échec d'envoi ne doit jamais bloquer la création de la notification.
  return new;
end $$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.trg_notifications_push();

notify pgrst, 'reload schema';

-- =====================================================================
--  CONFIGURATION (à exécuter UNE FOIS, en remplaçant <…>)
--
--    -- 1) Réglages de base (URL de la fonction + secret partagé aléatoire)
--    alter database postgres
--      set app.push_url = 'https://<REF-PROJET>.supabase.co/functions/v1/push';
--    alter database postgres
--      set app.push_secret = '<UN_SECRET_ALEATOIRE_LONG>';
--    -- (recharger la connexion pour que current_setting voie les valeurs)
--
--    -- 2) Déployer la fonction et lui donner le MÊME secret + les clés VAPID
--    --    supabase functions deploy push --no-verify-jwt
--    --    supabase secrets set PUSH_HOOK_SECRET='<LE_MEME_SECRET>' \
--    --      VAPID_PUBLIC='...' VAPID_PRIVATE='...' VAPID_SUBJECT='mailto:contact@tuttank.sn'
--
--    -- 3) (rappels auto) s'assurer que pg_cron est actif et le job planifié
--    --    (migration 019 : cron.schedule 'relances-impayes-quotidien').
-- =====================================================================

-- =====================================================================
--  ANNULATION
--    drop trigger if exists trg_notifications_push on public.notifications;
--    drop function if exists public.trg_notifications_push();
--    -- (pg_net peut rester ; app.push_url/secret peuvent être laissés)
--    notify pgrst, 'reload schema';
--  Sans risque : on retire seulement l'appel d'envoi ; les notifications
--  in-app (cloche) et toute la chaîne de création restent intactes.
-- =====================================================================
