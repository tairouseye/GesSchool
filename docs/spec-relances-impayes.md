# Spec technique — Relances automatiques d'impayés

> Module : **Finances** (s'ajoute à Recouvrement, déjà couvert par `modules_actifs = finances`).
> Objectif : relancer automatiquement les parents dont la scolarité est en retard,
> selon des **paliers configurables** (ex. J+1, J+7, J+15 après l'échéance), via les
> canaux déjà en place (notification in-app + **push web**), avec un **journal** des
> relances et un déclenchement **quotidien planifié**.

## 1. Pourquoi c'est peu coûteux

On réutilise l'existant, sans nouvelle brique d'infra :

| Brique réutilisée | Rôle dans la feature |
|---|---|
| `factures` (`montant_total`, `montant_paye`, `date_echeance`, `statut`) | source des impayés ; `montant_paye`/`statut` déjà maintenus par le trigger `recalc_facture()` |
| `notifications` (insert → push auto) | canal d'envoi : insérer une notification suffit, le pipeline push (`supabase/functions/push`) part tout seul |
| `eleve_tuteurs` / `tuteurs` (`responsable_paiement`, `profil_id`) | destinataires de la relance |
| RLS par rôle (migration 018) | sécurité : config & journal réservés à comptable / gestion |

Nouveautés : **2 tables** (`regles_relance`, `relances`), **2 fonctions** (`executer_relances`, `relancer_facture`), **1 tâche cron**, **1 écran de config** + un onglet sur Recouvrement.

## 2. Modèle de données

### 2.1 `regles_relance` — paliers configurables (par école)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ecole_id` | uuid → ecoles | tenant |
| `libelle` | text | « 1er rappel », « Mise en demeure »… |
| `jours` | int | déclenchement à `date_echeance + jours`. Négatif = **avant** échéance (ex. `-3`) |
| `modele` | text | message avec variables `{ecole} {eleve} {montant} {devise} {echeance} {jours_retard}` |
| `actif` | bool | |
| `ordre` | int | tri d'affichage |
| unique | `(ecole_id, jours)` | un seul palier par décalage |

### 2.2 `relances` — journal des envois

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ecole_id` | uuid → ecoles | tenant |
| `facture_id` | uuid → factures (cascade) | |
| `eleve_id` | uuid → eleves | |
| `regle_id` | uuid → regles_relance (set null) | null = relance manuelle |
| `palier` | int | copie de `regles_relance.jours` (anti-doublon) |
| `canal` | text | `auto` \| `manuel` |
| `montant_du` | numeric | snapshot du reste dû au moment de la relance |
| `message` | text | message effectivement envoyé |
| `statut` | text | `envoye` \| `echec` |
| `envoye_le` | timestamptz default now() | |
| unique | `(facture_id, regle_id)` | **un palier ne se déclenche qu'une fois par facture** |

## 3. Logique métier

### 3.1 Job quotidien `executer_relances()`
Parcourt **toutes les écoles** (fonction système, pas de tenant courant), et pour chaque
règle active : sélectionne les factures non soldées / non annulées dont
`current_date >= date_echeance + jours` et **pas déjà relancées pour ce palier**, puis :
1. rend le message (`{…}` → valeurs),
2. insère une `notification` pour les parents **responsables du paiement** (repli : tous les parents liés) → déclenche le push,
3. journalise une ligne `relances`.

Déclenché par **pg_cron** chaque matin (07:00). Idempotent grâce à `unique(facture_id, regle_id)`.

### 3.2 Relance manuelle `relancer_facture(p_facture)`
Bouton « Relancer (push) » côté comptable : envoie immédiatement une notification + push
et journalise (`canal='manuel'`). Vérifie tenant + rôle (`comptable`/gestion).

### 3.3 Sécurité (RLS, cohérent avec migration 018)
- `regles_relance` / `relances` : **SELECT** = tout membre de l'école ; **écritures** = `comptable` ou gestion.
- `executer_relances` / `relancer_facture` : `SECURITY DEFINER` (le job contourne RLS ; le manuel re-vérifie le rôle).

## 4. Écrans

### 4.1 Paramètres → « Relances automatiques »
- Liste des paliers (libellé, J+/-, actif), boutons ajouter / éditer / supprimer.
- Éditeur de modèle de message avec aperçu des variables disponibles.
- Bouton « Relancer maintenant (tous les retards) » → appelle `executer_relances()` (réservé gestion).

### 4.2 Recouvrement (page existante) — ajouts
- Par ligne : badge **« prochain rappel : J+x »** + bouton **« Relancer (push) »** (en plus du bouton WhatsApp existant).
- Nouvel onglet **« Historique »** : journal `relances` (date, élève, palier, canal, montant, statut).

### 4.3 Parent
Aucun changement : la notification + le push arrivent via le pipeline existant
(`ParentNotifications` + service worker). On profite de l'infra déjà livrée en v2.8.0.

## 5. Couche d'accès `src/lib/relances.js` (esquisse)

```js
import { supabase } from "@/lib/supabase.js";

export async function getRegles(ecoleId) {
  const { data, error } = await supabase.from("regles_relance")
    .select("*").eq("ecole_id", ecoleId).order("ordre");
  if (error) throw error; return data ?? [];
}
export async function creerRegle(ecoleId, r) {
  const { error } = await supabase.from("regles_relance").insert({ ecole_id: ecoleId, ...r });
  if (error) throw error;
}
export async function majRegle(id, r) {
  const { error } = await supabase.from("regles_relance").update(r).eq("id", id);
  if (error) throw error;
}
export async function supprimerRegle(id) {
  const { error } = await supabase.from("regles_relance").delete().eq("id", id);
  if (error) throw error;
}
export async function getRelances(ecoleId, limit = 200) {
  const { data, error } = await supabase.from("relances")
    .select("*, eleves(prenom, nom)").eq("ecole_id", ecoleId)
    .order("envoye_le", { ascending: false }).limit(limit);
  if (error) throw error; return data ?? [];
}
export async function relancerFacture(factureId) {
  const { error } = await supabase.rpc("relancer_facture", { p_facture: factureId });
  if (error) throw error;
}
export async function lancerTout() {
  // wrapper sécurisé : ne traite QUE l'école courante (réservé gestion)
  const { data, error } = await supabase.rpc("relancer_tout");
  if (error) throw error; return data; // nb de relances envoyées
}
```

## 6. Paliers par défaut suggérés (à créer depuis l'UI)

| libellé | jours | modèle |
|---|---|---|
| Rappel avant échéance | -3 | `Bonjour, la scolarité de {eleve} arrive à échéance le {echeance}. Solde : {montant} {devise}.` |
| 1er rappel | 1 | `Rappel {ecole} : {montant} {devise} restent dus pour {eleve} (échéance {echeance}). Merci de régulariser.` |
| 2e rappel | 7 | `2e rappel : {eleve}, solde {montant} {devise} en retard de {jours_retard} j. Merci de régulariser rapidement.` |
| Relance ferme | 15 | `{ecole} : malgré nos rappels, {montant} {devise} restent impayés pour {eleve} ({jours_retard} j de retard).` |

## 7. Déploiement

1. Appliquer `supabase/migrations/019_relances_impayes.sql`.
2. Vérifier que **pg_cron** et **pg_net** sont activés (Dashboard → Database → Extensions).
3. Créer les paliers depuis Paramètres → Relances automatiques.
4. (Optionnel) lancer un premier `select public.executer_relances();` pour amorcer.

## 8. Limites / évolutions

- **SMS** non inclus (nécessite un fournisseur type Twilio + coût/numéro) → palier `canal='sms'` à ajouter plus tard.
- Pas d'anti-spam global au-delà du « 1 fois par palier » ; si besoin, ajouter un délai minimal entre deux relances d'une même facture.
- WhatsApp reste **manuel** (ouverture de `wa.me`) car l'envoi auto WhatsApp exige l'API Business (payante).
