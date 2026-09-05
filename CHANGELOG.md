# Journal des modifications — GesSchool

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version la plus récente en haut.
La version applicative est celle de `package.json` (affichée dans l'app). Migrations dans [`supabase/migrations/`](supabase/migrations).

> Historique antérieur à `2.109.0` : voir l'historique git. Ce journal démarre au chantier **Comptabilité / RH & Paie**.

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
