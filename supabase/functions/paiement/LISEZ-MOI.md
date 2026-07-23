# Edge Function `paiement` — déploiement & test

Paiement en ligne des scolarités via **CinetPay** ou **PayDunya**. L'argent va
**directement sur le compte marchand de chaque école** ; GesPro n'est jamais
intermédiaire financier.

## Prérequis (base)
Migrations à passer d'abord : **062** (tables `psp_config`, `transactions_paiement`,
RPC) et **065** (mode test/production). Vérifier :
```sql
select * from psp_config limit 1;      -- doit exister
```

## Déploiement de la fonction
Le webhook doit être **public** (le prestataire n'a pas de session). Le JWT du
parent est vérifié **manuellement** dans `/initier`.

```bash
supabase functions deploy paiement --no-verify-jwt
# Secret optionnel : URL publique de l'app (retour du parent après paiement)
supabase secrets set APP_URL=https://gesschool.gesprosn.org
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés
automatiquement.

## URL à donner au prestataire (webhook / notify_url)
```
https://<ref-projet>.supabase.co/functions/v1/paiement/webhook
```
Elle est aussi affichée dans **Paramètres → Paiement en ligne** (bouton copier).

## Configuration par école (dans l'app, par le promoteur)
Paramètres → **Paiement en ligne** :
- Prestataire (CinetPay / PayDunya) + **Environnement = Test** pour commencer.
- **CinetPay** : `API key` + `Site ID` (dashboard CinetPay).
- **PayDunya** : `Private key` + `Master key` + `Token` (dans le champ secret, format
  `master|private|token`).
- Qui paie la commission (école ou parent).
- **Enregistrer & activer**.

## Recette (bac à sable, AVANT la production)
1. Compte prestataire en **mode test**, clés saisies, `mode = test`, `actif = true`.
2. Espace parent → une facture impayée → **💳 En ligne** → redirection prestataire →
   payer avec un moyen de test.
3. Le webhook doit :
   - créditer `paiements` (la facture passe à *payée*),
   - passer la transaction à **réussie** (onglet *Paiements en ligne*),
   - notifier le parent (push).
4. **Rejouer** le même webhook → **aucun second paiement** (idempotence).
5. Vérifier qu'une école `actif = false` garde le **flux manuel** (déclaration + preuve).

## Sécurité (rappel)
- Les clés (`psp_config`) ne sont **jamais** lues côté client : seule cette fonction
  (service role) y accède. RLS sans policy de lecture.
- Le webhook ne fait pas confiance à son corps : il **rappelle** le prestataire
  (`/v2/payment/check` CinetPay, `/checkout-invoice/confirm` PayDunya) pour le statut.
- Anti-double-crédit : index unique `(prestataire, reference_psp)` + passage atomique
  `initiee → reussie`.

## ⚠️ À confirmer en bac à sable
Les noms exacts de certains champs d'API (init/réponse) et le format du webhook
peuvent varier selon la version du prestataire — les valider lors de la recette et
ajuster l'adaptateur correspondant dans `index.ts` si besoin.
