# Journal des modifications — GesSchool

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version la plus récente en haut.
La version applicative est celle de `package.json` (affichée dans l'app). Migrations dans [`supabase/migrations/`](supabase/migrations).

> Historique antérieur à `2.109.0` : voir l'historique git. Ce journal démarre au chantier **Comptabilité / RH & Paie**.

## [2.150.0]
- **RH & Paie — congés/absences avant la paie** : « Préparer la paie » liste désormais les **congés en attente** et les **absences** du mois. La **génération est bloquée** tant que des congés du mois ne sont pas validés/refusés (bouton « Aller à Congés & absences »). Les absences non justifiées restent gérées par la retenue (P5).

## [2.149.0]
- **RH & Paie — Retenue sur absences (P5 audit)** : règle configurable par école — **aucune** / **proratisée** (jours × brut soumis ÷ jours-mois) / **forfait** (jours × montant/jour), sur les absences **non justifiées** (absence/maladie) du mois. Ligne « Retenue absences (N j) » ajoutée automatiquement à la génération. Réglage dans **RH & paie → Paie → Régime → « Retenue sur absences »**. Défaut : aucune (comportement inchangé).

## [2.148.0] — migration 101
- **RH & Paie — Éléments périodiques (P4 audit)** : un élément peut être **mensuel** (défaut), **trimestriel** (3/6/9/12), **semestriel** (6/12) ou **annuel / 13ᵉ mois** (décembre). Il ne figure alors que sur ses **mois de déclenchement** → **anti-double** naturel (une fiche par mois). Sélecteur de périodicité dans **Éléments de paie**. Sans effet sur les éléments existants (restent mensuels).

## [2.147.0] — migration 100
- **RH & Paie — Éléments globaux (P3 audit)** : appliquer un élément à une **portée** (tous / une catégorie / une fonction) avec un montant par défaut, et **exclure** des employés précis. Priorité de fusion : `global < régime < individuel` (le plus spécifique l'emporte). Gestion via **RH & paie → Paie → « Global »**.

## [2.146.0] — migration 099
- **RH & Paie — Régimes de rémunération (P2 audit)** : un **régime** nommé regroupe des éléments récurrents (montant par défaut) et s'affecte à un employé (fiche → « Régime de rémunération ») ou **en masse à une catégorie**. À la génération, les éléments de l'employé = régime + affectations individuelles (**l'individuel prime**). Gestion via **RH & paie → Paie → « Régimes »**. Non destructif : un employé sans régime garde le comportement actuel.

## [2.145.0] — migration 098
- **Comptabilité — salaires (P1 audit RH&Paie)** : une paie **validée** génère l'écriture de **constatation** (Débit 661 rémunérations + 664 patronal / Crédit 422 net + 431/432/438 organismes + 441 IR-TRIMF + 447 CFCE + 421 avances + 423 retenues), et le **paiement** génère le **règlement** (Débit 422 / Crédit trésorerie) via la dépense salaire — **sans double comptage**. Réversible : dévalidation et annulation de paiement suppriment les pièces (période ouverte). Triggers **non bloquants**. La **reprise d'exercice** inclut désormais les salaires.

## [2.144.0]
- **Paie — primes après déductions** : les primes/indemnités ajoutées à un bulletin sont **non soumises par défaut** (hors assiette cotisations/IR) et affichées **après les déductions** dans l'éditeur (le brut n'inclut plus que les gains soumis) — cohérent avec le bulletin imprimable. Un élément explicitement « soumis » reste dans le brut.
- **Paie — fin des doublons au recalcul** : le bouton « ↻ Recalculer » supprime désormais les lignes auto (cotisations/impôts + charges patronales) de façon **atomique** et est protégé par un **verrou anti-chevauchement** (plus de double jeu de cotisations). Un clic suffit aussi à nettoyer d'éventuels doublons existants.

## [2.143.0]
- **Paie — salaire de base NET** : en régime complet, le salaire de base d'un salaire fixe peut être traité comme le **net à verser** ; le **brut est calculé à l'envers** (net-to-gross) pour que, cotisations et IR déduits, l'employé touche exactement ce montant. Interrupteur **Net / Brut** dans Régime (défaut : Net). Corrige l'écart « Salaire base » (vue Personnel) vs « Net » (vue Paie) : après régénération du bulletin, les deux coïncident. Sans effet sur les employés payés à l'heure (taux horaire).

## [2.142.0] — migration 097
- **Comptabilité — exercices** : `assurer_exercices()` crée un exercice (+ périodes) pour chaque **année scolaire** sans exercice (094 ne le faisait que pour l'année courante). Dans « Paramètres », **sélecteur d'exercice** pour la reprise + bouton **« Créer les exercices manquants »** — permet de comptabiliser une année dont les opérations ne tombent pas dans l'exercice courant (ex. année en cours de clôture).

## [2.141.0] — migration 096
- **Comptabilité générale (étape 3)** : branchement automatique des opérations en partie double (méthode **engagement**). Facture → *Débit 411 Famille / Crédit 706 Scolarité* ; règlement → *Débit trésorerie / Crédit 411* ; dépense → *Débit charge / Crédit trésorerie* (charge selon la catégorie, mapping configurable). **Activation par école** (opt-in), **règles de mapping** (`regles_ecriture`), lien portefeuille de trésorerie → plan. **Reprise de l'exercice courant** (idempotente) via « Paramètres ». Triggers **non bloquants** (une erreur de comptabilisation n'empêche jamais l'opération métier ; journalisée dans `compta_erreurs`). Salaires branchés à l'étape suivante.

## [2.140.0] — migrations 094, 095
- **Comptabilité générale (étapes 1–2)** : socle SYSCOHADA amorcé par école — **plan comptable** configurable (classes 1→7), **journaux** (CA/BQ/MM/AC/VE/SA/OD), **exercices** + périodes mensuelles. **Moteur d'écritures en partie double** : pièces équilibrées (contrôle Σdébit = Σcrédit côté serveur), idempotence par opération source, verrou de période clôturée. Onglets **Plan comptable** et **Journal** (saisie d'opérations diverses) dans le module Comptabilité. Le livre de caisse existant reste inchangé.

## [2.139.0]
- **Récapitulatif des salaires** (rapport comptable) : net à payer + institutions (VRS, IPRES+CSS, IPM) + total décaissé, imprimable + export Excel.

## [2.138.0]
- **Régimes de paie multi-pays** : modèles de cotisations applicables par école (Sénégal validé ; RDC, Mali, Côte d'Ivoire = structure + taux indicatifs). `src/lib/regimes.js`.

## [2.137.0] · [2.136.0]
- **UX mobile (Phase 5)** : listes de paie et de congés converties en **cartes** (fin du défilement horizontal), actions tactiles.

## [2.135.0]
- **Livre de paie** imprimable (brut/cotisations/net/charges patronales + totaux) + **export Excel**.

## [2.134.0] — migration 092
- **Absences RH** (absence/retard/maladie/autorisation), informatif (pas de retenue automatique).

## [2.133.0] — migration 091
- **Congés** : demande → approbation/refus → solde annuel (quota réglable).

## [2.132.0] — migration 090
- **Dossier employé 360°** + **identité civile** + **historique des contrats** (période d'essai, motif de fin).

## [2.131.0] · [2.130.0] — migration 089
- **Avances & prêts** : échéancier, solde réversible (dérivé), **déduction automatique** à la génération. Proratisation embauche/départ en cours de mois.

## [2.129.0] — migration 088
- **Contrôle interne (Phase 1)** : piste d'audit des montants (inviolable), garde de suppression hors brouillon, **séparation des tâches** optionnelle.

## [2.128.0] — migrations 086, 087
- **Réparation** workflow/audit (journal_audit non persisté) + **diagnostic santé** (RH → Paie → Régime → « Vérifier l'installation »).

## [2.127.0] — migration 085
- Audit 🟡 : import du barème **atomique** (RPC), **dette personnel** visible au comptable, Part TRIMF clarifiée.

## [2.126.0]
- **Arrondi au franc** cohérent (net = somme des lignes arrondies).

## [2.125.0]
- **Vérification des entêtes** avant génération (champs manquants par employé, taux horaire critique).

## [2.124.0]
- **Bulletin de paie au format officiel** (colonnes part employé / patronale, cotisations, net, charges patronales).

## [2.123.0] — migration 084
- Audit 🟠 #1 : **recalcul automatique** des cotisations/IR après édition. Retrait du code mort `maj_salaire`.

## [2.122.0]
- **Préparer la paie** : heures/absences validées par employé avant génération.

## [2.121.0]
- **Tableau de bord comptable** (Phase G) : caisse/banque, recettes/dépenses/salaires, **créances & dettes**, résultat.

## [2.120.0] — migration 083
- Gains **non soumis** (transport…) : dans le net mais hors assiette cotisations/IR.

## [2.119.0] — migration 082
- **Brut = heures mensuelles × taux horaire** (base + sursalaire) ; heures ajustables par bulletin.

## [2.118.0] · [2.117.0] — migration 081
- **Moteur de paie** : cotisations (part sal./patr., plafonds) + **IR/TRIMF via barème** ; **import du barème** par école.

## [2.116.0] — migration 080
- **Régime de paie configurable** par école (cotisations, mode simplifié/complet, champs fiscaux employé).

## [2.115.0] — migration 079
- **Workflow de paie** brouillon → validé → payé (verrouillage) + **journal d'audit**.

## [2.114.0] — migration 078
- **Bulletin dynamique** : composition en lignes (gains/retenues), net recalculé par trigger.

## [2.113.0] — migration 077
- **Catalogue d'éléments de paie** configurable (gains/retenues, récurrent/ponctuel).

## [2.112.0] — migration 076
- **Catégories financières** configurables par école.

## [2.111.0]
- Édition du personnel, import des enseignants comme personnel, personnel sans contrat visible en paie.

## [2.110.0] — migration 075
- **Trésorerie/scolarité** : les encaissements alimentent la caisse (cohérence trésorerie ↔ résultat).

## [2.109.0] — migration 074
- Paie **nette** (« salaire de base »), personnel automatique, édition post-paiement (resync dépense) ; correctifs d'audit RH & compta.

---

### Correctifs base (sans changement de version applicative)
- **093** — autorise la suppression d'un bulletin **brouillon** (le verrou ignorait le parent supprimé en cascade).
