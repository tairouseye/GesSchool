# Fonction `push` — notifications push (web push)

Pipeline : insertion dans `notifications` → trigger `trg_notifications_push` (pg_net)
→ appelle cette fonction → envoie un web push aux `push_subscriptions` du destinataire.

## Étape de configuration requise (une seule fois)
La fonction a besoin des clés VAPID en **secrets**. La clé publique est déjà
dans le client (`src/lib/push.js`). Définir les secrets côté Supabase :

```
supabase secrets set \
  VAPID_PUBLIC="BJHkQ5Zf9rNfxVVO-bSV57UKVJZvjyKfXYobfB_AJuUs4coNN9vCxh91oz5nRSLIIdtQwfG4dlAmuIXtbRZuUOo" \
  VAPID_PRIVATE="<CLÉ_PRIVÉE_VAPID>" \
  VAPID_SUBJECT="mailto:contact@votre-ecole.sn"
```

(ou via le Dashboard → Edge Functions → Secrets).

Tant que les secrets ne sont pas définis, la fonction renvoie 200 sans envoyer :
les **notifications in-app (cloche) continuent de fonctionner**, seul l'envoi
push « téléphone » est en attente.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.
