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
--  Config Supabase-compatible (pas d'ALTER DATABASE, interdit ici) :
--    - l'URL de la fonction est écrite en dur (elle n'est pas secrète) ;
--    - le secret anti-abus est OPTIONNEL et lu depuis le coffre Vault
--      (secret nommé « push_hook_secret »). S'il est absent, l'appel part
--      sans secret et la fonction l'accepte (tant que PUSH_HOOK_SECRET n'est
--      pas défini côté fonction). Définir les deux = durcissement recommandé.
--
--  ⚠️ Prérequis : extension pg_net activée (Dashboard → Database → Extensions).
-- =====================================================================

create extension if not exists pg_net;

create or replace function public.trg_notifications_push()
returns trigger language plpgsql security definer
set search_path = public, extensions, vault as $$
declare
  -- URL de la fonction edge `push` du projet (non secrète).
  v_url    text := 'https://vgozbticbhieddhcnnoa.supabase.co/functions/v1/push';
  v_secret text;
begin
  -- Secret partagé (optionnel) depuis Vault ; absent → chaîne vide.
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'push_hook_secret' limit 1;
  exception when others then
    v_secret := null;
  end;

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
--  DURCISSEMENT (optionnel, recommandé) — dans l'éditeur SQL :
--    select vault.create_secret('GS_push_9f3aK7Qx2M8vLpZ1', 'push_hook_secret');
--  puis définir le MÊME secret côté fonction :
--    (Dashboard → Edge Functions → push → Secrets) PUSH_HOOK_SECRET = GS_push_9f3aK7Qx2M8vLpZ1
--  Sans ce durcissement, le push fonctionne quand même (fonction sans secret).
-- =====================================================================

-- =====================================================================
--  ANNULATION
--    drop trigger if exists trg_notifications_push on public.notifications;
--    drop function if exists public.trg_notifications_push();
--    notify pgrst, 'reload schema';
--  Sans risque : on retire seulement l'appel d'envoi ; les notifications
--  in-app (cloche) et toute la chaîne de création restent intactes.
-- =====================================================================
